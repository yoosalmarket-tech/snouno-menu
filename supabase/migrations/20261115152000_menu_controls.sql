alter table public.menu_settings
 add column banner_dish uuid references public.dishes(id) on delete set null,
 add column banner_two_dish uuid references public.dishes(id) on delete set null,
 add column banner_three_dish uuid references public.dishes(id) on delete set null;
update public.menu_settings set banner_alt='الشافل',banner_two_dish=(select id from public.dishes where name='نوك آوت' limit 1),banner_three_dish=(select id from public.dishes where name='سلطة سيزر بالدجاج' limit 1) where id=1 and banner_alt='إعلان مطعم سنونو';
create function private.protect_menu_credit() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or new.credit is distinct from old.credit then raise exception 'Footer attribution is read only';end if;
 return new;
end $$;
create trigger lock_attribution before update or delete on public.menu_settings for each row execute function private.protect_menu_credit();
alter table public.menu_links add column channel text unique;
insert into public.menu_links(channel,name,url,position) values
 ('makook','اطلب من مكوك','https://makuk.torood.net/',1),
 ('sonbol','اطلب من سنبل','https://sonbol.ps/vendor/snounu',2),
 ('whatsapp','تواصل واتس اب','https://wa.me/970599468542',3),
 ('instagram','إنستغرام','https://www.instagram.com/snounu/',4),
 ('facebook','فيسبوك','https://www.facebook.com/903658066380370/',5);
revoke insert,update,delete on public.menu_links from authenticated;
grant update(url) on public.menu_links to authenticated;
alter table public.menu_feedback add column visitor_id uuid;
alter table public.menu_feedback add constraint rating_needs_visitor check(kind <> 'تقييم' or visitor_id is not null) not valid;
create unique index one_browser_rating_per_dish on public.menu_feedback(dish_id,visitor_id) where kind='تقييم';
grant insert(visitor_id) on public.menu_feedback to anon,authenticated;
alter policy feedback_submit on public.menu_feedback with check (kind <> 'تقييم' or dish_id is not null);
