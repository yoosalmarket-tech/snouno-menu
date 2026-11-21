-- EDIT ALL PAYMENT 13.1 — fix per-meal aggregate and usable owner AI allowance.
-- Existing order/payment/usage data stays untouched.
do $fix$
declare fn text;
begin
  fn := pg_get_functiondef('public.snounu_ai_analytics_summary(integer)'::regprocedure);
  if position('m.sold_units desc' in fn)=0 then
    raise exception 'Analytics function changed; review function before applying';
  end if;
  fn := replace(fn,'m.sold_units desc','m.approved_units desc');
  execute fn;
end
$fix$;

-- Owner can ask more than 20 useful questions without triggering the canned fallback.
-- Keep a bounded allowance (100 successful Groq answers per Gaza-local day).
create or replace function public.snounu_ai_daily_quota_remaining()
returns integer language sql stable security definer set search_path = ''
as $$
  select case when auth.uid() is null or private.menu_role() is distinct from 'owner'
    then 0
    else greatest(0,100-coalesce(
      (select u.request_count from private.snounu_ai_daily_usage u
       where u.user_id=auth.uid()
         and u.usage_date=(now() at time zone 'Asia/Gaza')::date),0))
  end
$$;

create or replace function public.snounu_ai_consume_daily_quota()
returns boolean language plpgsql security definer set search_path = ''
as $$
declare current_count integer;
begin
  if auth.uid() is null or private.menu_role() is distinct from 'owner' then
    return false;
  end if;
  insert into private.snounu_ai_daily_usage(user_id,usage_date,request_count)
  values(auth.uid(),(now() at time zone 'Asia/Gaza')::date,1)
  on conflict (user_id,usage_date) do update
  set request_count = private.snounu_ai_daily_usage.request_count+1
  where private.snounu_ai_daily_usage.request_count < 100
  returning request_count into current_count;
  return current_count is not null;
end
$$;

revoke all on function public.snounu_ai_daily_quota_remaining() from public,anon;
revoke all on function public.snounu_ai_consume_daily_quota() from public,anon;
grant execute on function public.snounu_ai_daily_quota_remaining() to authenticated;
grant execute on function public.snounu_ai_consume_daily_quota() to authenticated;
