-- EDIT ALL PAYMENT 05.1: Owner-only daily AI request allowance.
-- Stores only request counts. No chat text or customer records are persisted.
create table if not exists private.snounu_ai_daily_usage (
 user_id uuid not null,
 usage_date date not null,
 request_count integer not null default 0 check (request_count between 0 and 20),
 primary key (user_id,usage_date)
);
revoke all on private.snounu_ai_daily_usage from public,anon,authenticated;

create or replace function public.snounu_ai_consume_daily_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare current_count integer;
begin
 if auth.uid() is null or private.menu_role() is distinct from 'owner' then
   return false;
 end if;

 insert into private.snounu_ai_daily_usage(user_id,usage_date,request_count)
 values(auth.uid(), (now() at time zone 'Asia/Hebron')::date, 1)
 on conflict (user_id,usage_date)
 do update set request_count = private.snounu_ai_daily_usage.request_count + 1
 where private.snounu_ai_daily_usage.request_count < 20
 returning request_count into current_count;

 return current_count is not null;
end;
$$;
revoke all on function public.snounu_ai_consume_daily_quota() from public,anon,authenticated;
grant execute on function public.snounu_ai_consume_daily_quota() to authenticated;
