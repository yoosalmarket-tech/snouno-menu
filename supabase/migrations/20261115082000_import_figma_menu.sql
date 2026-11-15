alter table public.dishes add column badge text not null default '', add column rating numeric(2,1) check(rating between 0 and 5), add column old_price numeric(10,2) check(old_price>=0), add column ingredients text not null default '';
alter table public.categories add column icon text not null default '';
alter table public.menu_settings add column hotline text not null default '', add column banner text not null default '', add column credit text not null default '',add column welcome_button text not null default 'تصفح المنيو';
update public.menu_settings set name='مطعم سنونو',welcome='أهلاً بكـ في',hero='/assets/plate.webp',logo='/assets/logo.webp',banner='/assets/banner.webp',address='الرمال - شارع الشهداء - بجانب حلويات ساق الله',hours='السبت — الخميس: 10 صباحاً — 11 مساءً',hotline='#889',contact='للشراكات، الاستفسارات المؤسسية، أو حجز المناسبات والفعاليات الخاصة — راسلنا وسيتواصل معك فريق سنونو فوراً.',credit='تصميم وكالة يوصل لتسويق المطاعم' where id=1;
insert into public.categories(name,position,icon) values ('المقبلات',1,'🥗'),('الوجبات الرئيسية',2,'🍔'),('سندويتشات',3,'🌯'),('حلويات',4,'🍰'),('المشروبات',5,'🥤');
insert into public.dishes(category_id,name,description,price,old_price,image,badge,rating,position,ingredients)
select c.id,v.n,v.des,v.p,v.was,'/assets/'||v.img||'.webp',v.badge,v.rating,v.pos,v.ing from (values
('الوجبات الرئيسية','نوك آوت','برجر باللحم',26,35,'knockout','عرض خاص',4.9,1,'خس، خيار، طماطم، جبنة'),
('المقبلات','سلطة سيزر بالدجاج','خس روماني، دجاج مشوي، خبز محمص، سيزر',28,null,'caesar','مميز',4.8,2,'خس روماني، دجاج مشوي، خبز محمص، سيزر'),
('المقبلات','سلطة الخضار','خس، طماطم، خيار، جزر، مع صوص الليمون',34,null,'vegetables','جديد',5.0,3,'خس، طماطم، خيار، جزر، صوص الليمون'),
('المقبلات','الأفوكادو والروبيان','أفوكادو طازج، روبيان مشوي، خس، صوص مميز',24,null,'shrimp','الأكثر طلباً',4.7,4,'أفوكادو، روبيان، خس، صوص مميز')
) as v(cat,n,des,p,was,img,badge,rating,pos,ing) join public.categories c on c.name=v.cat;
create table public.menu_feedback(id uuid primary key default gen_random_uuid(),created_at timestamptz not null default now(),kind text not null check(kind in ('استفسار','اقتراح','تقييم')),name text not null default '' check(length(name)<=100),phone text not null default '' check(length(phone)<=32),message text not null check(length(message)<=2000),dish_id uuid references public.dishes on delete set null,stars smallint check(stars between 1 and 5),check((kind='تقييم' and stars is not null) or (kind<>'تقييم' and length(trim(message))>0)));
alter table public.menu_feedback enable row level security;
revoke all on public.menu_feedback from public,anon,authenticated;
grant insert(kind,name,phone,message,dish_id,stars) on public.menu_feedback to anon,authenticated;
grant select,delete on public.menu_feedback to authenticated;
create policy feedback_submit on public.menu_feedback for insert to anon,authenticated with check (true);
create policy feedback_read on public.menu_feedback for select to authenticated using((select private.menu_role()) is not null);
create policy feedback_remove on public.menu_feedback for delete to authenticated using((select private.menu_role()) is not null);
create index feedback_dish on public.menu_feedback(dish_id);

