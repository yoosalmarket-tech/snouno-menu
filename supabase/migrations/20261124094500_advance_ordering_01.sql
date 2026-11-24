-- ADVANCE ORDERING 01.3. Safe default: advance payments are disabled until launch.
alter table public.pay_settings
 add column advance_enabled boolean not null default false,
 add column advance_capacity integer not null default 30 check (advance_capacity between 1 and 500),
 add column advance_window_hours integer not null default 24 check (advance_window_hours between 1 and 168),
 add column advance_suspended boolean not null default false;
alter table public.pay_orders
 add column advance_order boolean not null default false,
 add column advance_opening_at timestamptz,
 add column queue_joined_at timestamptz,
 add column queue_managed boolean not null default false,
 add column advance_exception boolean not null default false,
 add column refund_resolution text not null default 'none' check(refund_resolution in ('none','review_required','refunded','no_refund_required'));
create table private.advance_checkout_holds(id uuid primary key,secret_hash text not null,expires_at timestamptz not null,opening_at timestamptz not null,consumed_at timestamptz);
alter table private.advance_checkout_holds enable row level security;
revoke all on private.advance_checkout_holds from public,anon,authenticated;
create index advance_checkout_hold_expiry on private.advance_checkout_holds(expires_at) where consumed_at is null;
update public.pay_orders set queue_joined_at=created_at where payment_mode='online';
create index pay_orders_active_queue_idx on public.pay_orders(queue_joined_at,number)
 where status in ('pending','approved') and fulfillment_status not in ('completed','stopped') and queue_joined_at is not null and not advance_exception;
alter table public.pay_orders drop constraint pay_orders_fulfillment_status_check;
alter table public.pay_orders add constraint pay_orders_fulfillment_status_check check
 (fulfillment_status in ('awaiting_approval','awaiting_visit','awaiting_payment','queued','preparing','ready','completed','stopped'));

-- Match the existing Gaza wall-clock closure rules, including overnight overlap.
create function private.advance_closed(rules jsonb, instant timestamptz) returns boolean
language sql stable set search_path='' as $$
 with local_time as (select instant at time zone 'Asia/Gaza' as wall),
 rule as (
  select r, wall::date as day, wall::time as tm
  from local_time cross join lateral jsonb_array_elements(
   case when jsonb_typeof(rules)='array' then rules else '[]'::jsonb end) r
 ), matches as (
  select r,tm,
   case when r->>'kind'='date' then r->>'date'=day::text
        when r->>'kind'='weekly' then coalesce(r->'weekdays','[]'::jsonb) @> jsonb_build_array(extract(dow from day)::int)
        else false end as today,
   case when r->>'kind'='date' then r->>'date'=(day-1)::text
        when r->>'kind'='weekly' then coalesce(r->'weekdays','[]'::jsonb) @> jsonb_build_array(extract(dow from day-1)::int)
        else false end as yesterday,
   case when r->>'start' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then (r->>'start')::time end as starts,
   case when r->>'end' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then (r->>'end')::time end as ends
  from rule
 )
 select coalesce(bool_or(case when r->'allDay'='true'::jsonb then today
  when starts<ends then today and tm>=starts and tm<ends
  when starts>ends then (today and tm>=starts) or (yesterday and tm<ends)
  else false end),false) from matches;
$$;

create function private.advance_next_open(rules jsonb, instant timestamptz, hours integer)
returns timestamptz language sql stable set search_path='' as $$
 select candidate from generate_series(date_trunc('minute',instant)+interval '1 minute',
  instant+least(greatest(hours,1),168)*interval '1 hour',interval '1 minute') candidate
 where private.advance_closed(rules,instant) and not private.advance_closed(rules,candidate)
 order by candidate limit 1;
$$;

-- Service-only aggregate; never return another customer's row or tracking credential.
create function public.pay_advance_info(p_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare cfg public.pay_settings; rules jsonb; moment timestamptz:=statement_timestamp();
 closed boolean; opening timestamptz; active integer; advance_active integer; holds integer;
 ahead integer; own public.pay_orders;
begin
 select * into strict cfg from public.pay_settings where id=1;
 select closure_rules into strict rules from public.menu_settings where id=1;
 closed:=private.advance_closed(rules,moment);
 if closed then opening:=private.advance_next_open(rules,moment,cfg.advance_window_hours); end if;
 select count(*),count(*) filter(where advance_order) into active,advance_active
 from public.pay_orders where status in ('pending','approved') and fulfillment_status not in ('completed','stopped') and queue_joined_at is not null and not advance_exception;
 select count(*) into holds from private.advance_checkout_holds where consumed_at is null and expires_at>moment;
 if p_id is not null then
  select * into own from public.pay_orders where id=p_id;
  if found and own.queue_joined_at is not null and not own.advance_exception and own.status in ('pending','approved')
    and own.fulfillment_status not in ('completed','stopped') then
   select count(*) into ahead from public.pay_orders
   where status in ('pending','approved') and fulfillment_status not in ('completed','stopped')
    and queue_joined_at is not null and not advance_exception and (queue_joined_at,number)<(own.queue_joined_at,own.number);
  end if;
 end if;
 return jsonb_build_object('closed',closed,'next_opening_at',opening,'advance_enabled',cfg.advance_enabled,
  'advance_allowed',closed and cfg.advance_enabled and not cfg.advance_suspended and opening is not null and advance_active+holds<cfg.advance_capacity,
  'active_orders',active,'orders_ahead',ahead,'queue_position',case when ahead is not null then ahead+1 end);
end $$;
revoke all on function public.pay_advance_info(uuid) from public,anon,authenticated;
grant execute on function public.pay_advance_info(uuid) to service_role;
revoke all on function private.advance_closed(jsonb,timestamptz),private.advance_next_open(jsonb,timestamptz,integer) from public,anon,authenticated;
grant execute on function private.advance_closed(jsonb,timestamptz),private.advance_next_open(jsonb,timestamptz,integer) to service_role;

-- Reserve capacity (not queue position) for 20 minutes before showing payment instructions.
create function public.pay_reserve_checkout(p_id uuid,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg public.pay_settings; rules jsonb; moment timestamptz; opening timestamptz; n integer; h private.advance_checkout_holds;
begin
 if p_id is null or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid checkout'; end if;
 perform pg_advisory_xact_lock(84621001);
 moment:=clock_timestamp();
 select * into h from private.advance_checkout_holds where id=p_id;
 if found then
  if h.secret_hash is distinct from p_hash or h.consumed_at is not null or h.expires_at<=moment then raise exception 'Checkout hold unavailable'; end if;
  return jsonb_build_object('expires_at',h.expires_at,'opening_at',h.opening_at);
 end if;
 select * into strict cfg from public.pay_settings where id=1;
 select closure_rules into strict rules from public.menu_settings where id=1;
 if not private.advance_closed(rules,moment) then return null; end if;
 if not cfg.advance_enabled or cfg.advance_suspended then raise exception 'Advance ordering unavailable'; end if;
 opening:=private.advance_next_open(rules,moment,cfg.advance_window_hours);
 if opening is null then raise exception 'No available opening'; end if;
 select count(*) into n from public.pay_orders where advance_order and not advance_exception and status in ('pending','approved') and fulfillment_status not in ('completed','stopped');
 n:=n+(select count(*) from private.advance_checkout_holds where consumed_at is null and expires_at>moment);
 if n>=cfg.advance_capacity then raise exception 'Advance queue full'; end if;
 insert into private.advance_checkout_holds(id,secret_hash,expires_at,opening_at) values(p_id,p_hash,moment+interval '20 minutes',opening) returning * into h;
 return jsonb_build_object('expires_at',h.expires_at,'opening_at',h.opening_at);
end $$;
revoke all on function public.pay_reserve_checkout(uuid,text) from public,anon,authenticated;
grant execute on function public.pay_reserve_checkout(uuid,text) to service_role;

-- Serialize reservation and capacity checks inside the existing order transaction.
-- A cart or quote does not create an order or reserve queue position.
create function private.advance_on_insert() returns trigger language plpgsql security definer set search_path='' as $$
declare cfg public.pay_settings; rules jsonb; moment timestamptz; h private.advance_checkout_holds;
begin
 perform pg_advisory_xact_lock(84621001);
 moment:=clock_timestamp();
 select * into strict cfg from public.pay_settings where id=1;
 select closure_rules into strict rules from public.menu_settings where id=1;
 select * into h from private.advance_checkout_holds where id=new.id and secret_hash=new.secret_hash and consumed_at is null;
 if found then
  if new.payment_mode<>'online' then raise exception 'Advance payment proof required'; end if;
  new.advance_order:=true;
  new.advance_opening_at:=h.opening_at;
  new.advance_exception:=h.expires_at<=moment;
  update private.advance_checkout_holds set consumed_at=moment where id=h.id;
 elsif private.advance_closed(rules,moment) then raise exception 'Reserve checkout before paying';
 end if;
 if new.payment_mode='online' then
  new.queue_joined_at:=moment;
  new.queue_managed:=new.advance_order or cfg.advance_enabled or exists(select 1 from public.pay_orders where advance_order and status in ('pending','approved') and fulfillment_status not in ('completed','stopped'));
 end if;
 return new;
end $$;
revoke all on function private.advance_on_insert() from public,anon,authenticated;
create trigger pay_advance_on_insert before insert on public.pay_orders for each row execute function private.advance_on_insert();

-- Preserve original status transitions for existing non-queue-managed orders.
create or replace function private.pay_order_stage_sync() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.status is distinct from old.status then
  if new.status='approved' then
   if old.advance_exception then raise exception 'Resolve expired checkout before approval'; end if;
   new.fulfillment_status:=case when new.queue_managed then 'queued'
    when new.service_type='dine_in' and new.arrived_at is null then 'awaiting_visit' else 'preparing' end;
  elsif new.status in ('cancelled','rejected') then
   new.fulfillment_status:='stopped';
   if old.payment_mode='online' then new.refund_resolution:='review_required'; end if;
  elsif new.status='pending' then
   new.fulfillment_status:=case when new.payment_mode='at_restaurant' and new.arrived_at is null then 'awaiting_visit' else 'awaiting_approval' end;
   if old.status='rejected' and new.payment_mode='online' then
    new.queue_joined_at:=clock_timestamp();
    if old.advance_order then new.advance_exception:=true; end if;
    new.refund_resolution:='none';
   end if;
  end if;
 end if;
 return new;
end $$;

-- Explicit staff-controlled preparation, only when the restaurant is open.
create function public.pay_queue_stage(p_id uuid,p_stage text) returns void
language plpgsql security definer set search_path='' as $$
declare o public.pay_orders; cfg public.pay_settings; rules jsonb;
begin
 if auth.uid() is null or coalesce(private.menu_role(),'') not in ('owner','customer_service')
  or p_stage is null or p_stage not in ('preparing','ready') then raise exception 'Access denied'; end if;
 perform pg_advisory_xact_lock(84621001);
 select * into strict o from public.pay_orders where id=p_id for update;
 if not o.queue_managed or o.status<>'approved' then raise exception 'Payment approval required'; end if;
 if o.fulfillment_status=p_stage then return; end if;
 select closure_rules into strict rules from public.menu_settings where id=1;
 if private.advance_closed(rules,clock_timestamp()) then raise exception 'Restaurant closed'; end if;
 if p_stage='preparing' then
  if o.fulfillment_status<>'queued' then raise exception 'Invalid stage'; end if;
  if exists(select 1 from public.pay_orders q where q.queue_managed and q.status='approved' and q.fulfillment_status='queued'
    and (q.queue_joined_at,q.number)<(o.queue_joined_at,o.number)) then raise exception 'An earlier verified order is waiting'; end if;
 elsif o.fulfillment_status<>'preparing' then raise exception 'Start preparation first'; end if;
 update public.pay_orders set fulfillment_status=p_stage where id=p_id;
 insert into public.pay_history(order_id,status,actor,reason) values(p_id,p_stage,auth.uid(),'');
 select * into strict cfg from public.pay_settings where id=1;
 if cfg.live_updates then perform realtime.send('{}'::jsonb,'refresh','payment-'||o.topic,false); end if;
end $$;
revoke all on function public.pay_queue_stage(uuid,text) from public,anon;
grant execute on function public.pay_queue_stage(uuid,text) to authenticated;

-- Maintain the staff arrival workflow without bypassing the queue.
create or replace function public.pay_mark_arrived(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare o public.pay_orders; cfg public.pay_settings;
begin
 if auth.uid() is null or coalesce(private.menu_role(),'') not in ('owner','customer_service') then raise exception 'Access denied'; end if;
 select * into strict o from public.pay_orders where id=p_id for update;
 if o.service_type<>'dine_in' or o.status not in ('pending','approved') then raise exception 'Invalid arrival'; end if;
 if o.arrived_at is not null then return; end if;
 update public.pay_orders set arrived_at=now(),fulfillment_status=case when o.queue_managed then o.fulfillment_status
  when status='approved' then 'preparing' when payment_mode='at_restaurant' then 'awaiting_payment' else 'awaiting_approval' end where id=p_id;
 insert into public.pay_history(order_id,status,actor,reason) values(p_id,'arrived',auth.uid(),'تم تأكيد وصول العميل');
 select * into cfg from public.pay_settings where id=1;
 if cfg.live_updates then perform realtime.send('{}'::jsonb,'refresh','payment-'||o.topic,false); end if;
end $$;

create or replace function public.pay_mark_completed(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare o public.pay_orders; cfg public.pay_settings;
begin
 if auth.uid() is null or coalesce(private.menu_role(),'') not in ('owner','customer_service') then raise exception 'Access denied'; end if;
 select * into strict o from public.pay_orders where id=p_id for update;
 if o.fulfillment_status='completed' then return; end if;
 if o.status<>'approved' then raise exception 'Only approved orders can be completed'; end if;
 if o.queue_managed and o.fulfillment_status<>'ready' then raise exception 'Mark order ready first'; end if;
 if o.service_type='dine_in' and o.arrived_at is null then raise exception 'Confirm customer arrival first'; end if;
 update public.pay_orders set fulfillment_status='completed',completed_at=now() where id=p_id;
 insert into public.pay_history(order_id,status,actor,reason) values(p_id,'completed',auth.uid(),'تم تأكيد تسليم الطلب');
 select * into cfg from public.pay_settings where id=1;
 if cfg.live_updates then perform realtime.send('{}'::jsonb,'refresh','payment-'||o.topic,false); end if;
end $$;

-- Staff queue ranks, independent of table pagination.
create function public.pay_staff_queue() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare positions jsonb;
begin
 if auth.uid() is null or not coalesce(private.menu_can('orders'),false) then raise exception 'Access denied'; end if;
 select coalesce(jsonb_object_agg(id::text,position),'{}'::jsonb) into positions from (
 select id,row_number() over(order by queue_joined_at,number) as position
 from public.pay_orders where status in ('pending','approved')
 and fulfillment_status not in ('completed','stopped') and queue_joined_at is not null and not advance_exception
 ) q;
 return positions;
end $$;
revoke all on function public.pay_staff_queue() from public,anon;
grant execute on function public.pay_staff_queue() to authenticated;

create function public.pay_admit_advance(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.pay_orders; cfg public.pay_settings; rules jsonb; n integer; moment timestamptz;
begin
 if auth.uid() is null or coalesce(private.menu_role(),'') not in ('owner','customer_service') then raise exception 'Access denied'; end if;
 perform pg_advisory_xact_lock(84621001);
 moment:=clock_timestamp();
 select * into strict o from public.pay_orders where id=p_id for update;
 if not o.advance_exception or o.status<>'pending' then raise exception 'No pending exception'; end if;
 select * into strict cfg from public.pay_settings where id=1;
 select closure_rules into strict rules from public.menu_settings where id=1;
 if private.advance_closed(rules,moment) then
  select count(*) into n from public.pay_orders where advance_order and not advance_exception and status in ('pending','approved') and fulfillment_status not in ('completed','stopped');
  n:=n+(select count(*) from private.advance_checkout_holds where consumed_at is null and expires_at>moment);
  if n>=cfg.advance_capacity then raise exception 'Advance queue full'; end if;
 end if;
 update public.pay_orders set advance_exception=false where id=p_id;
 insert into public.pay_history(order_id,status,actor,reason) values(p_id,'queue_admitted',auth.uid(),'تم قبول الطلب في قائمة الانتظار');
 if cfg.live_updates then perform realtime.send('{}'::jsonb,'refresh','payment-'||o.topic,false); end if;
end $$;
revoke all on function public.pay_admit_advance(uuid) from public,anon;
grant execute on function public.pay_admit_advance(uuid) to authenticated;
create function public.pay_refund_resolution(p_id uuid,p_resolution text) returns void language plpgsql security definer set search_path='' as $$
declare o public.pay_orders; cfg public.pay_settings;
begin
 if auth.uid() is null or coalesce(private.menu_role(),'') not in ('owner','customer_service')
 or p_resolution is null or p_resolution not in ('refunded','no_refund_required') then raise exception 'Access denied'; end if;
 select * into strict o from public.pay_orders where id=p_id for update;
 if o.refund_resolution<>'review_required' or o.status not in ('rejected','cancelled') then raise exception 'No refund review pending'; end if;
 update public.pay_orders set refund_resolution=p_resolution where id=p_id;
 insert into public.pay_history(order_id,status,actor,reason) values(p_id,p_resolution,auth.uid(),'تسوية يدوية');
 select * into cfg from public.pay_settings where id=1;
 if cfg.live_updates then perform realtime.send('{}'::jsonb,'refresh','payment-'||o.topic,false); end if;
end $$;
revoke all on function public.pay_refund_resolution(uuid,text) from public,anon;
grant execute on function public.pay_refund_resolution(uuid,text) to authenticated;
