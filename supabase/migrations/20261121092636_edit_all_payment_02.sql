-- Retire outbound ordering only. Keep catalog identifiers used by menu assets and translations.
delete from public.menu_links where channel in ('sonbol','makook','utlob');
alter table public.dishes drop column sonbol_url, drop column makook_url,
 add column order_options jsonb not null default '[]' check(jsonb_typeof(order_options)='array' and jsonb_array_length(order_options)<=16);
update public.menu_settings set welcome_description='اكتشف وجباتنا، اختر اللي بتحبه، واطلب مباشرة من سنونو.'
 where welcome_description='اكتشف وجباتنا، اختر اللي بتحبه، واطلب من تطبيق التوصيل المفضل عندك.';
alter table public.pay_methods add column qr_url text not null default '' check(qr_url='' or qr_url ~ '^https://');
insert into public.pay_methods(name,icon,instructions,position) values
 ('بنك فلسطين الدفع لتاجر','▤','ادفع للتاجر من تطبيق البنك باستخدام بيانات سنونو المعروضة، ثم ارفع وصل التحويل.',10),
 ('بال باي الدفع لتاجر','◈','حوّل المبلغ إلى رقم التاجر في محفظة بال باي، ثم ارفع وصل التحويل.',20),
 ('جوال باي QR','▦','امسح رمز التاجر أو حوّل إلى الرقم المعروض في جوال باي، ثم ارفع الوصل.',30);
alter table public.pay_settings add column max_quantity int not null default 99 check(max_quantity between 1 and 99);
alter table public.pay_items add column line_id uuid not null default gen_random_uuid(),
 add column choices jsonb not null default '[]', add column special_instructions text not null default '';
alter table public.pay_items drop constraint pay_items_pkey,add primary key(order_id,line_id);

-- One calculation is shared by quotes and the locked submission transaction.
create function public.pay_price_lines(p_items jsonb) returns table(dish_id uuid,name text,qty int,price numeric,old_price numeric,choices jsonb,special_instructions text)
language plpgsql set search_path='' as $$
declare item jsonb; d public.dishes; grp jsonb; opt jsonb; selected jsonb; hits int; matched int; extra numeric; max_qty int;
begin
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 60 then raise exception 'Invalid cart'; end if;
 select max_quantity into strict max_qty from public.pay_settings where id=1;
 for item in select * from jsonb_array_elements(p_items) loop
  select * into strict d from public.dishes where id=(item->>'id')::uuid and available for share;
  qty:=(item->>'qty')::int; selected:=coalesce(item->'options','[]'); choices:='[]'; matched:=0;extra:=0;
  special_instructions:=coalesce(item->>'note','');
  if qty is null or qty not between 1 and max_qty or length(special_instructions)>300 or jsonb_typeof(selected)<>'array' or jsonb_array_length(selected)>100 then raise exception 'Invalid selection'; end if;
  for grp in select * from jsonb_array_elements(d.order_options) loop
   hits:=0;
   for opt in select * from jsonb_array_elements(grp->'choices') loop
    if selected ? (opt->>'id') then
     if coalesce((opt->>'available')::boolean,true)=false then raise exception 'Unavailable option'; end if;
     hits:=hits+1;
     extra:=extra+coalesce((opt->>'price')::numeric,0);
     choices:=choices||jsonb_build_array(jsonb_build_object('id',opt->>'id','group',grp->>'label','label',opt->>'label','price',coalesce((opt->>'price')::numeric,0)));
    end if;
   end loop;
   if (coalesce((grp->>'required')::boolean,false) and hits=0) or (not coalesce((grp->>'multiple')::boolean,false) and hits>1) then raise exception 'Invalid group selection'; end if;
   matched:=matched+hits;
  end loop;
  if matched<>jsonb_array_length(selected) then raise exception 'Unknown or duplicate option'; end if;
  dish_id:=d.id;name:=d.name;price:=d.price+extra;old_price:=d.old_price+extra;
  if price is distinct from (item->>'price')::numeric then raise exception 'Price changed'; end if;
  return next;
 end loop;
end $$;
revoke all on function public.pay_price_lines from public,anon,authenticated;
grant execute on function public.pay_price_lines to service_role;
create or replace function public.pay_submit(p_id uuid,p_hash text,p_customer text,p_phone text,p_notes text,p_method uuid,p_items jsonb,p_total numeric,p_path text)
returns void language plpgsql set search_path='' as $$
declare m public.pay_methods; line record; cost numeric:=0; q int; existing public.pay_orders;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into existing from public.pay_orders where id=p_id;
 if found then
  if existing.secret_hash<>p_hash then raise exception 'Invalid tracking key'; end if;
  return;
 end if;
 select * into strict m from public.pay_methods where id=p_method and enabled for share;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 60 then raise exception 'Invalid cart'; end if;
 insert into public.pay_orders(id,secret_hash,customer,phone,notes,method_id,method,total)
 values(p_id,p_hash,p_customer,p_phone,p_notes,p_method,m.name,0);
 for line in select * from public.pay_price_lines(p_items) loop
  insert into public.pay_items(order_id,dish_id,name,qty,price,old_price,choices,special_instructions)
   values(p_id,line.dish_id,line.name,line.qty,line.price,line.old_price,line.choices,line.special_instructions);
  cost:=cost+line.qty*line.price;
 end loop;
 if cost is distinct from p_total then raise exception 'Total changed'; end if;
 update public.pay_orders set total=cost where id=p_id;
 insert into public.pay_proofs(path,order_id) values(p_path,p_id);
 insert into public.pay_history(order_id,status) values(p_id,'pending');
end $$;
revoke all on function public.pay_submit from public,anon,authenticated;
grant execute on function public.pay_submit to service_role;

create function private.valid_meal_options(groups jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare g jsonb; o jsonb; ids text[]:='{}';
begin
 if jsonb_typeof(groups)<>'array' or jsonb_array_length(groups)>16 then return false;end if;
 for g in select * from jsonb_array_elements(groups) loop
  if coalesce(length(trim(g->>'label')),0) not between 1 and 120 or jsonb_typeof(g->'choices') is distinct from 'array' or jsonb_array_length(g->'choices') not between 1 and 40 then return false;end if;
  for o in select * from jsonb_array_elements(g->'choices') loop
   if coalesce(length(trim(o->>'id')),0) not between 1 and 80 or (o->>'id')=any(ids) or coalesce(length(trim(o->>'label')),0) not between 1 and 120 or jsonb_typeof(o->'price') is distinct from 'number' or (o->>'price')::numeric not between 0 and 10000 or (o->>'price')::numeric<>round((o->>'price')::numeric,2) then return false;end if;
   ids:=array_append(ids,o->>'id');
  end loop;
 end loop;
 return true;
end $$;
alter table public.dishes add constraint valid_order_options check(private.valid_meal_options(order_options));
