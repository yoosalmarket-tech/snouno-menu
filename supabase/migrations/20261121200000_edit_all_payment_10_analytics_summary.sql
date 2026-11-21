-- EDIT ALL PAYMENT 10 — exact aggregated menu engagement & approved product sales.
-- Unlike a 1,000-row event sample, these counters aggregate ALL matching records.
-- Read-only owner RPC; no raw customer information is exposed.
create or replace function public.snounu_ai_analytics_summary(p_days integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  engagement jsonb;
  products jsonb;
  counted bigint;
begin
  if auth.uid() is null or private.menu_role() is distinct from 'owner' then
    raise exception 'owner_only' using errcode='42501';
  end if;
  if p_days not in (7,28) then
    raise exception 'invalid_period' using errcode='22023';
  end if;

  select coalesce(jsonb_object_agg(s.action,s.qty),'{}'::jsonb),
         coalesce(sum(s.qty),0)::bigint
  into engagement,counted
  from (
    select e.action,count(*)::bigint as qty
    from public.menu_action_events e
    where e.created_at>=now()-make_interval(days=>p_days)
      and e.action in (
        'meal_open','meal_select','order_now_click',
        'share_meal_click','favorite_toggle','ad_open',
        'order_platform_click','category_select'
      )
    group by e.action
  ) s;

  with event_rollup as (
    select e.meal_id,
      count(*) filter(where e.action='meal_open')::integer as detail_opens,
      count(*) filter(where e.action='meal_select')::integer as meal_selections,
      count(*) filter(where e.action='order_now_click')::integer as order_clicks,
      count(*) filter(where e.action='share_meal_click')::integer as share_clicks,
      count(*) filter(where e.action='favorite_toggle')::integer as favorite_toggles,
      count(*) filter(where e.action='ad_open')::integer as ad_opens
    from public.menu_action_events e
    where e.created_at>=now()-make_interval(days=>p_days)
      and e.meal_id is not null
      and e.action in ('meal_open','meal_select','order_now_click','share_meal_click','favorite_toggle','ad_open')
    group by e.meal_id
  ), approved_meals as (
    select i.dish_id,sum(i.qty)::integer as sold_units,
      round(sum(i.qty*i.price)::numeric,2) as sold_value_ils
    from public.pay_items i
    join public.pay_orders o on o.id=i.order_id
    where o.status='approved'
      and o.approved_at>=now()-make_interval(days=>p_days)
    group by i.dish_id
  )
  select coalesce(jsonb_agg(to_jsonb(m)
     order by m.order_clicks desc,m.sold_units desc,m.detail_opens desc),'[]'::jsonb)
  into products
  from (
    select d.name::text as name,d.available as available,d.price as price_ils,
      coalesce(a.detail_opens,0)::integer as detail_opens,
      coalesce(a.meal_selections,0)::integer as meal_selections,
      coalesce(a.order_clicks,0)::integer as order_clicks,
      coalesce(a.share_clicks,0)::integer as share_clicks,
      coalesce(a.favorite_toggles,0)::integer as favorite_toggles,
      coalesce(a.ad_opens,0)::integer as ad_opens,
      coalesce(s.sold_units,0)::integer as approved_units,
      coalesce(s.sold_value_ils,0)::numeric as approved_sales_ils
    from public.dishes d
    left join event_rollup a on a.meal_id=d.id::text
    left join approved_meals s on s.dish_id=d.id
    order by coalesce(a.order_clicks,0) desc,
      coalesce(s.sold_units,0) desc,coalesce(a.detail_opens,0) desc
    limit 80
  ) m;
  return jsonb_build_object(
    'source','Supabase aggregated events and approved orders',
    'period_days',p_days,
    'as_of',now(),
    'recorded_engagement_events',counted,
    'actions',engagement,
    'meals',products,
    'definitions',jsonb_build_object(
      'meal_open','Explicit meal detail openings; not total meal impressions',
      'meal_select','Meal selections in the interface; not unique visitors',
      'order_now_click','Clicks on order-now; intent only, not completed sales',
      'favorite_toggle','Favorite toggles; may include removals',
      'share_meal_click','Share clicks, not confirmed shares',
      'approved_units','Units in payment-approved orders only',
      'approved_sales_ils','Approved meal line-item value; not all attempted checkouts',
      'recorded_engagement_events','Count of selected menu action events; not page views or users',
      'order_platform_click','Legacy delivery-platform event; excluded from product scores',
      'note','Clicks can repeat and can include tests; no unique visitor IDs in menu_action_events'
    )
  );
end;
$$;
revoke all on function public.snounu_ai_analytics_summary(integer) from public,anon;
grant execute on function public.snounu_ai_analytics_summary(integer) to authenticated;
