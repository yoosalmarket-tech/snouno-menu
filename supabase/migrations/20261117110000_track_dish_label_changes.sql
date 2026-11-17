alter table public.dishes add column badge_changed_at timestamptz;

create function public.track_dish_badge_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if nullif(btrim(new.badge), '') is null then
    new.badge_changed_at := null;
  elsif tg_op = 'INSERT' then
    new.badge_changed_at := clock_timestamp();
  elsif btrim(new.badge) is distinct from btrim(old.badge) then
    new.badge_changed_at := clock_timestamp();
  else
    new.badge_changed_at := old.badge_changed_at;
  end if;
  return new;
end;
$$;

create trigger track_dish_badge_change
before insert or update on public.dishes
for each row execute function public.track_dish_badge_change();
