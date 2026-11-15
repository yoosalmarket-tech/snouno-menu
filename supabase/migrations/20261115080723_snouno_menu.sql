create schema if not exists private;
create table public.menu_staff (
 email text primary key check(email=lower(trim(email)) and position('@' in email)>1),
 role text not null check(role in ('owner','editor'))
);
insert into public.menu_staff values ('info@yoosal.net','owner');
create function private.menu_role() returns text language sql stable security definer set search_path='' as $$
 select s.role from public.menu_staff s join auth.users u on lower(u.email)=s.email
 where u.id=(select auth.uid()) and u.email_confirmed_at is not null
$$;
revoke all on function private.menu_role() from public;
grant usage on schema private to authenticated;
grant execute on function private.menu_role() to authenticated;
alter table public.menu_staff enable row level security;
revoke all on public.menu_staff from public,anon,authenticated;
grant select,insert,delete on public.menu_staff to authenticated;
create policy staff_read on public.menu_staff for select to authenticated using (email=lower(auth.jwt()->>'email') or (select private.menu_role())='owner');
create policy staff_add on public.menu_staff for insert to authenticated with check (role='editor' and (select private.menu_role())='owner');
create policy staff_remove on public.menu_staff for delete to authenticated using (role='editor' and (select private.menu_role())='owner');
create table public.categories(id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name))>0), position integer not null default 0);
create table public.dishes(id uuid primary key default gen_random_uuid(), category_id uuid not null references public.categories on delete restrict, name text not null check(length(trim(name))>0), description text not null default '', price numeric(10,2) not null check(price>=0), image text not null default '', available boolean not null default true, position integer not null default 0);
create index dishes_category on public.dishes(category_id);
create table public.menu_links(id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name))>0), url text not null check(url ~* '^(https://|tel:|mailto:)'), position integer not null default 0);
create table public.menu_settings(id integer primary key check(id=1), name text not null, welcome text not null default '', contact text not null default '', hours text not null default '', address text not null default '', logo text not null default '', hero text not null default '');
insert into public.menu_settings(id,name,welcome) values(1,'سنونو','شو آكل؟');
do $$ declare t text; begin
foreach t in array array['categories','dishes','menu_links','menu_settings'] loop
execute format('alter table public.%I enable row level security',t);
execute format('revoke all on public.%I from public, anon, authenticated',t);
execute format('grant select on public.%I to anon,authenticated',t);
execute format('grant insert,update,delete on public.%I to authenticated',t);
execute format('create policy menu_read on public.%I for select using (true)',t);
execute format('create policy menu_edit on public.%I for all to authenticated using ((select private.menu_role()) is not null) with check ((select private.menu_role()) is not null)',t);
end loop; end $$;
revoke insert,delete on public.menu_settings from authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('menu-images','menu-images',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy menu_upload on storage.objects for insert to authenticated with check (bucket_id='menu-images' and (select private.menu_role()) is not null);
