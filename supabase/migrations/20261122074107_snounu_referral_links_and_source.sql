-- Snounu organic referral links and server-verified order attribution.
-- Existing approved payments and orders are left unchanged; old orders remain un-attributed.
create table if not exists public.menu_referral_links (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(btrim(label)) between 2 and 120),
  code text not null unique check (char_length(code) between 2 and 80 and code !~ '[[:space:]/?#&]'),
  channel text not null default 'instagram' check (channel in ('instagram','facebook','whatsapp','qr','other')),
  target_kind text not null default 'menu' check (target_kind in ('menu','dish')),
  dish_id uuid references public.dishes(id) on delete set null,
  created_at timestamptz not null default now(),
  check (target_kind <> 'menu' or dish_id is null)
);
create index if not exists menu_referral_links_created_idx on public.menu_referral_links(created_at desc);
alter table public.menu_referral_links enable row level security;
revoke all on table public.menu_referral_links from public, anon, authenticated;
grant select,insert,update,delete on table public.menu_referral_links to authenticated;
drop policy if exists menu_referrals_owner on public.menu_referral_links;
create policy menu_referrals_owner on public.menu_referral_links for all to authenticated
 using (auth.uid() is not null and (select private.menu_role()) = 'owner')
 with check (auth.uid() is not null and (select private.menu_role()) = 'owner');

alter table public.pay_orders add column if not exists referral_source text;
create index if not exists pay_orders_referral_created_idx on public.pay_orders(referral_source,created_at desc)
 where referral_source is not null;

-- Backend-only wrapper: source attribution and existing payment validation are atomic.
create or replace function public.pay_submit_with_referral(
 p_id uuid, p_hash text, p_customer text, p_phone text, p_notes text,
 p_method uuid, p_items jsonb, p_total numeric, p_path text, p_referral_source text
) returns void language plpgsql set search_path = '' as $$
declare source_code text := nullif(lower(btrim(coalesce(p_referral_source,''))), '');
begin
 if source_code is not null and
    (char_length(source_code) not between 2 and 80 or source_code ~ '[[:space:]/?#&]')
 then source_code := null; end if;
 perform public.pay_submit(p_id,p_hash,p_customer,p_phone,p_notes,p_method,p_items,p_total,p_path);
 if source_code is not null then
   update public.pay_orders set referral_source=source_code
     where id=p_id and referral_source is null;
 end if;
end $$;
revoke all on function public.pay_submit_with_referral(uuid,text,text,text,text,uuid,jsonb,numeric,text,text)
 from public,anon,authenticated;
grant execute on function public.pay_submit_with_referral(uuid,text,text,text,text,uuid,jsonb,numeric,text,text)
 to service_role;

-- Owner-only aggregated reporting; no raw customer/order details.
create or replace function public.snounu_referral_stats(p_days integer default 28)
 returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
 if auth.uid() is null or private.menu_role() is distinct from 'owner'
   then raise exception 'Access denied'; end if;
 if p_days not in (7,28,90,365) then raise exception 'Unsupported period'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
     'source',s.referral_source,
     'submitted',s.submitted,
     'approved',s.approved,
     'revenue_ils',s.revenue
 ) order by s.approved desc, s.referral_source),'[]'::jsonb) into result
 from (
   select o.referral_source, count(*)::integer submitted,
     count(*) filter (where o.status='approved')::integer approved,
     coalesce(sum(o.total) filter (where o.status='approved'),0)::numeric revenue
   from public.pay_orders o
   where o.referral_source is not null
     and o.created_at>=now()-make_interval(days=>p_days)
   group by o.referral_source
 ) s;
 return result;
end $$;
revoke all on function public.snounu_referral_stats(integer) from public,anon,authenticated;
grant execute on function public.snounu_referral_stats(integer) to authenticated;
