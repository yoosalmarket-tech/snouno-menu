create table public.pay_methods (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 120),
 icon text not null default '▣', account text not null default '', holder text not null default '',
 instructions text not null default '', url text not null default '' check(url='' or url ~ '^https://'),
 enabled boolean not null default false, position integer not null default 0,
 check(not enabled or (trim(account)<>'' and trim(holder)<>''))
);
insert into public.pay_methods(name,position) values ('محفظة إلكترونية',1),('تحويل بنكي',2);
create table public.pay_settings (
 id int primary key check(id=1), formats text[] not null default array['image/jpeg','image/png','image/webp','application/pdf'],
 restaurant text not null, address text not null, phone text not null, logo text not null,
 paper text not null default 'A4' check(paper in ('A4','80mm')), cancellation boolean not null default true,
 live_updates boolean not null default true,
 check(cardinality(formats)>0 and formats <@ array['image/jpeg','image/png','image/webp','application/pdf'])
);
insert into public.pay_settings(id,restaurant,address,phone,logo) select 1,name,address,coalesce(hotline,''),logo from public.menu_settings where id=1;
create table public.pay_orders (
 id uuid primary key, number bigint generated always as identity unique, secret_hash text not null,
 topic uuid not null default gen_random_uuid(), created_at timestamptz not null default now(),
 customer text not null check(length(trim(customer)) between 1 and 100),
 phone text not null check(phone ~ '^[+0-9 ()-]{7,25}$'), notes text not null check(length(notes)<=1000),
 method_id uuid not null references public.pay_methods, method text not null, total numeric(12,2) not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
 reason text not null default '', approved_at timestamptz, invoice jsonb,
 check((status='approved')=(approved_at is not null and invoice is not null))
);
create index pay_orders_date on public.pay_orders(created_at desc);
create table public.pay_items (
 order_id uuid references public.pay_orders, dish_id uuid not null, name text not null, qty int not null check(qty between 1 and 99),
 price numeric(10,2) not null, old_price numeric(10,2), primary key(order_id,dish_id)
);
create table public.pay_proofs (
 path text primary key, order_id uuid not null references public.pay_orders, uploaded_at timestamptz not null default now()
);
create index pay_proofs_order on public.pay_proofs(order_id);
create table public.pay_history (
 id bigint generated always as identity primary key, order_id uuid not null references public.pay_orders,
 status text not null, actor uuid, reason text not null default '', occurred_at timestamptz not null default now()
);
create index pay_history_order on public.pay_history(order_id);
do $$ declare t text; begin
 foreach t in array array['pay_orders','pay_items','pay_proofs','pay_history','pay_settings','pay_methods'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy owner_read on public.%I for select to authenticated using ((select private.menu_role())=''owner'')',t);
 end loop;
 foreach t in array array['pay_methods','pay_settings'] loop
 execute format('grant update on public.%I to authenticated',t);
 execute format('create policy owner_write on public.%I for update to authenticated using ((select private.menu_role())=''owner'') with check ((select private.menu_role())=''owner'')',t);
 end loop;
end $$;
grant insert on public.pay_methods to authenticated;
create policy owner_add on public.pay_methods for insert to authenticated with check((select private.menu_role())='owner');
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('snounu-payment-proofs','snounu-payment-proofs',false,4194304,array['image/jpeg','image/png','image/webp','application/pdf']);
create policy pay_owner_view on storage.objects for select to authenticated using(bucket_id='snounu-payment-proofs' and (select private.menu_role())='owner');

-- Only the validating Edge Function may submit guest orders. Keep prices and totals in Postgres.
create function public.pay_submit(p_id uuid,p_hash text,p_customer text,p_phone text,p_notes text,p_method uuid,p_items jsonb,p_total numeric,p_path text)
returns void language plpgsql set search_path='' as $$
declare m public.pay_methods; item jsonb; dish public.dishes; cost numeric:=0; q int; existing public.pay_orders;
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
 for item in select * from jsonb_array_elements(p_items) loop
  select * into strict dish from public.dishes where id=(item->>'id')::uuid and available for share;
  q:=(item->>'qty')::int;
  if dish.price is distinct from (item->>'price')::numeric then raise exception 'Menu price changed'; end if;
  insert into public.pay_items values(p_id,dish.id,dish.name,q,dish.price,dish.old_price);
  cost:=cost+q*dish.price;
 end loop;
 if cost is distinct from p_total then raise exception 'Total changed'; end if;
 update public.pay_orders set total=cost where id=p_id;
 insert into public.pay_proofs(path,order_id) values(p_path,p_id);
 insert into public.pay_history(order_id,status) values(p_id,'pending');
end $$;
revoke all on function public.pay_submit from public,anon,authenticated;
grant execute on function public.pay_submit to service_role;

create function private.pay_change(p_id uuid,p_target text,p_reason text,p_actor uuid,p_hash text,p_path text)
returns void language plpgsql security definer set search_path='' as $$
declare o public.pay_orders; cfg public.pay_settings;
begin
 select * into strict o from public.pay_orders where id=p_id for update;
 select * into strict cfg from public.pay_settings where id=1;
 if p_actor is null then
  if o.secret_hash is distinct from p_hash or p_target not in ('cancelled','pending') then raise exception 'Access denied'; end if;
  if p_target='cancelled' and not cfg.cancellation then raise exception 'Cancellation disabled'; end if;
 elsif p_actor is distinct from auth.uid() or private.menu_role() is distinct from 'owner' then raise exception 'Access denied'; end if;
 if o.status=p_target and p_target<>'pending' then return; end if;
 if p_target='pending' then
  if o.status<>'rejected' or p_path is null then raise exception 'Proof cannot be replaced'; end if;
  insert into public.pay_proofs(path,order_id) values(p_path,p_id);
 elsif o.status<>'pending' or p_target not in ('approved','rejected','cancelled') then raise exception 'Decision already recorded';
 end if;
 if p_target='rejected' and length(trim(coalesce(p_reason,''))) not between 1 and 500 then raise exception 'Rejection reason required'; end if;
 update public.pay_orders set status=p_target,reason=coalesce(p_reason,''),
 approved_at=case when p_target='approved' then now() end,
 invoice=case when p_target='approved' then jsonb_build_object('number','SN-'||o.number,'restaurant',cfg.restaurant,'address',cfg.address,'phone',cfg.phone,'logo',cfg.logo,'paper',cfg.paper) end where id=p_id;
 insert into public.pay_history(order_id,status,actor,reason) values(p_id,p_target,p_actor,coalesce(p_reason,''));
 if cfg.live_updates then perform realtime.send('{}'::jsonb,'refresh','payment-'||o.topic,false); end if;
end $$;
revoke all on function private.pay_change from public,anon,authenticated;
grant execute on function private.pay_change to service_role;
create function public.pay_customer_change(p_id uuid,p_target text,p_hash text,p_path text default null) returns void language sql security definer set search_path='' as $$
 select private.pay_change(p_id,p_target,'',null,p_hash,p_path)
$$;
revoke all on function public.pay_customer_change from public,anon,authenticated;
grant execute on function public.pay_customer_change to service_role;
create function public.pay_decide(p_id uuid,p_target text,p_reason text default '') returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or private.menu_role() is distinct from 'owner' or p_target not in ('approved','rejected','cancelled') then raise exception 'Access denied'; end if;
 perform private.pay_change(p_id,p_target,p_reason,auth.uid(),null,null);
end $$;
revoke all on function public.pay_decide from public,anon;
grant execute on function public.pay_decide to authenticated;
create function public.pay_sales() returns jsonb language sql stable security invoker set search_path='' as $$
 with approved as (select * from public.pay_orders where status='approved'),
 trends as (select period,date_trunc(period,approved_at at time zone 'Asia/Gaza')::date as day,sum(total) as value from approved cross join unnest(array['day','week','month']) period group by 1,2),
 meals as (select i.dish_id,max(i.name) name,sum(i.qty) quantity,sum(i.price*i.qty) value from public.pay_items i join approved a on a.id=i.order_id group by i.dish_id order by quantity desc,value desc limit 10)
 select jsonb_build_object('total',count(*),'pending',count(*) filter(where status='pending'),'approved',count(*) filter(where status='approved'),'rejected',count(*) filter(where status='rejected'),'cancelled',count(*) filter(where status='cancelled'),'value',coalesce(sum(total) filter(where status='approved'),0),'average',coalesce(round(avg(total) filter(where status='approved'),2),0),'trends',coalesce((select jsonb_agg(to_jsonb(t) order by day desc) from trends t),'[]'),'meals',coalesce((select jsonb_agg(to_jsonb(m)) from meals m),'[]')) from public.pay_orders
$$;
revoke all on function public.pay_sales from public,anon;
grant execute on function public.pay_sales to authenticated;
