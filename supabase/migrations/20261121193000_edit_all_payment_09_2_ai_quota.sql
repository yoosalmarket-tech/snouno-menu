-- EDIT ALL PAYMENT 09.2 — read remaining AI quota without consuming failed requests.
-- Owner-only, computed for local Gaza day. Retains original 20-per-day limit.
create or replace function public.snounu_ai_daily_quota_remaining()
returns integer language sql stable security definer set search_path = ''
as $$
 select case when auth.uid() is null or private.menu_role() is distinct from 'owner'
   then 0
   else greatest(0,20-coalesce(
    (select u.request_count
     from private.snounu_ai_daily_usage u
     where u.user_id=auth.uid() and u.usage_date=(now() at time zone 'Asia/Gaza')::date),0))
 end
$$;
revoke all on function public.snounu_ai_daily_quota_remaining() from public,anon;
grant execute on function public.snounu_ai_daily_quota_remaining() to authenticated;
