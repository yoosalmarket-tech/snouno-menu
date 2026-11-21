-- EDIT ALL PAYMENT 06.13 — estimated arrival for new pay-at-restaurant orders.
-- Preserve older orders (including at-restaurant orders without an ETA).
alter table public.pay_orders
  add column arrival_eta_minutes integer
    check (arrival_eta_minutes in (10,15,20,30,45,60,90,120)),
  add column expected_arrival_at timestamptz,
  add constraint pay_arrival_eta_pair check (
    (arrival_eta_minutes is null and expected_arrival_at is null)
    or (payment_mode='at_restaurant' and arrival_eta_minutes is not null and expected_arrival_at is not null)
  );

-- Keep current RPC signature; check the ETA inside the submitted JSON.
create or replace function public.pay_submit(p_id uuid,p_hash text,p_customer text,p_phone text,p_notes text,p_method uuid,p_items jsonb,p_total numeric,p_path text)
returns void language plpgsql set search_path='' as $$
declare m public.pay_methods; line record; cost numeric:=0; q int; existing public.pay_orders;
 payload jsonb; service text := 'unspecified'; destination text := ''; landmark text := ''; secondary_phone text := ''; customer_note text := coalesce(p_notes,''); pay_mode text := 'online'; arrival_minutes integer := null;
begin
 if left(coalesce(p_notes,''),length('SNOUNU_FULFILLMENT_V1:'))='SNOUNU_FULFILLMENT_V1:' then
   payload := substring(p_notes from length('SNOUNU_FULFILLMENT_V1:') + 1)::jsonb;
   if jsonb_typeof(payload) is distinct from 'object' then raise exception 'Invalid fulfillment'; end if;
   service := payload->>'type';
   pay_mode := coalesce(payload->>'payment_mode','online');
   if pay_mode not in ('online','at_restaurant') then raise exception 'Invalid payment mode'; end if;
   if pay_mode='at_restaurant' then
     if service<>'dine_in' then raise exception 'Arrival payment is dine-in only'; end if;
     if coalesce(payload->>'arrival_eta_minutes','') !~ '^(10|15|20|30|45|60|90|120)$'
       then raise exception 'Expected arrival time required'; end if;
     arrival_minutes := (payload->>'arrival_eta_minutes')::integer;
   else
     if payload->>'arrival_eta_minutes' is not null and payload->>'arrival_eta_minutes'<>''
       then raise exception 'Arrival time is only for pay-at-restaurant'; end if;
   end if;
   destination := trim(coalesce(payload->>'address',''));
   landmark := trim(coalesce(payload->>'landmark',''));
   secondary_phone := trim(coalesce(payload->>'backup_phone',''));
   customer_note := trim(coalesce(payload->>'notes',''));
   if service is null or service not in ('dine_in','delivery') then raise exception 'Invalid service type'; end if;
   if service='delivery' then
     if length(destination) not between 8 and 500 then raise exception 'Delivery address required'; end if;
     if length(landmark) not between 3 and 160 then raise exception 'Nearby landmark required'; end if;
     if secondary_phone !~ '^([+])?[0-9 ()-]{7,25}$'
       or length(regexp_replace(secondary_phone,'[^0-9]','','g')) not between 7 and 15
       then raise exception 'Valid backup phone required'; end if;
     if regexp_replace(secondary_phone,'[^0-9]','','g') = regexp_replace(p_phone,'[^0-9]','','g')
       then raise exception 'Backup phone must differ from primary'; end if;
   else
     destination := ''; landmark := ''; secondary_phone := '';
   end if;
 end if;
 if length(customer_note)>1000 then raise exception 'Notes too long'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into existing from public.pay_orders where id=p_id;
 if found then
  if existing.secret_hash<>p_hash then raise exception 'Invalid tracking key'; end if;
  return;
 end if;
 if pay_mode='online' then
   if p_method is null or p_path is null then raise exception 'Online payment requires receipt'; end if;
   select * into strict m from public.pay_methods where id=p_method and enabled for share;
 else
   if p_method is not null or p_path is not null then raise exception 'Arrival payment cannot have proof'; end if;
 end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 60 then raise exception 'Invalid cart'; end if;
 insert into public.pay_orders(id,secret_hash,customer,phone,notes,method_id,method,total,service_type,delivery_address,delivery_landmark,backup_phone,payment_mode,fulfillment_status,arrival_eta_minutes,expected_arrival_at)
 values(p_id,p_hash,p_customer,p_phone,customer_note,p_method,case when pay_mode='at_restaurant' then 'الدفع عند الوصول' else m.name end,0,service,destination,landmark,secondary_phone,pay_mode,case when pay_mode='at_restaurant' then 'awaiting_visit' else 'awaiting_approval' end,arrival_minutes,case when arrival_minutes is not null then now() + arrival_minutes * interval '1 minute' else null end);
 for line in select * from public.pay_price_lines(p_items) loop
  insert into public.pay_items(order_id,dish_id,name,qty,price,old_price,choices,special_instructions)
   values(p_id,line.dish_id,line.name,line.qty,line.price,line.old_price,line.choices,line.special_instructions);
  cost:=cost+line.qty*line.price;
 end loop;
 if cost is distinct from p_total then raise exception 'Total changed'; end if;
 update public.pay_orders set total=cost where id=p_id;
 if pay_mode='online' then insert into public.pay_proofs(path,order_id) values(p_path,p_id); end if;
 insert into public.pay_history(order_id,status) values(p_id,'pending');
end $$;
