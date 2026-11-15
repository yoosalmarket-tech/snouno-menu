alter table public.dishes add column sonbol_url text
 check (sonbol_url is null or sonbol_url ~* '^https://[^[:space:]]+$');

create table public.menu_ads (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) > 0),
 image text not null check (length(trim(image)) > 0),
 dish_id uuid references public.dishes on delete set null,
 position integer not null default 0
);
insert into public.menu_ads(name,image,dish_id,position)
select coalesce(nullif(slot.label,''),'إعلان ' || slot.position),slot.image,slot.dish_id,slot.position
from public.menu_settings s cross join lateral (values
 (s.banner_alt,s.banner,s.banner_dish,1),
 (s.banner_two_alt,s.banner_two,s.banner_two_dish,2),
 (s.banner_three_alt,s.banner_three,s.banner_three_dish,3)
) slot(label,image,dish_id,position) where nullif(slot.image,'') is not null;
alter table public.menu_ads enable row level security;
revoke all on public.menu_ads from public, anon, authenticated;
grant select on public.menu_ads to anon,authenticated;
grant insert,update,delete on public.menu_ads to authenticated;
create policy ads_read on public.menu_ads for select using (true);
create policy ads_edit on public.menu_ads for all to authenticated
 using ((select private.menu_role()) is not null)
 with check ((select private.menu_role()) is not null);

alter table public.menu_feedback add column meal_name text;
-- Older rankings predate visitor IDs. Assign an independent ID so their
-- historical names can be saved and later foreign-key updates can succeed.
update public.menu_feedback set visitor_id=gen_random_uuid()
 where kind='تقييم' and visitor_id is null;
update public.menu_feedback f set meal_name=d.name
 from public.dishes d where f.kind='تقييم' and f.dish_id=d.id;
create function private.capture_ranked_meal() returns trigger
 language plpgsql set search_path='' as $$
begin
 if new.kind='تقييم' then
   select name into strict new.meal_name from public.dishes where id=new.dish_id;
 end if;
 return new;
end $$;
create trigger capture_ranked_meal before insert on public.menu_feedback
 for each row execute function private.capture_ranked_meal();
