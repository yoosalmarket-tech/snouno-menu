-- Snapshot of the public Snounu catalog, in the order returned by Sonbol.
alter table public.categories add column sonbol_category_id bigint unique;
alter table public.dishes add column sonbol_listing_id bigint unique;

create temporary table import_categories (source_id bigint primary key,name text,previous_name text,icon text,position integer) on commit drop;
insert into import_categories values
 (343, 'سنونو ساندويش', 'سندويتشات', '🥪', 1),
 (347, 'برجر اللحم', null, '🍔', 2),
 (342, 'برجر الدجاج المقلي', null, '🍗', 3),
 (344, 'فرايز', null, '🍟', 4),
 (341, 'شاورما', null, '🌯', 5),
 (346, 'السلطات / المقبلات', 'المقبلات', '🥗', 6),
 (345, 'صوصات', null, '🧂', 7),
 (565, 'مشروبات', 'المشروبات', '', 8);

-- Keep existing category IDs and place local-only entries after imported items.
update public.categories c set sonbol_category_id=i.source_id
from import_categories i where c.name=coalesce(i.previous_name,i.name);
update public.categories set position=1000+position where sonbol_category_id is null;
update public.dishes d set position=1000+d.position from public.categories c
where c.id=d.category_id and c.sonbol_category_id is not null;
insert into public.categories (sonbol_category_id,name,icon,position)
select source_id,name,icon,position from import_categories
on conflict (sonbol_category_id) do update set name=excluded.name,icon=excluded.icon,position=excluded.position;

create temporary table import_dishes (listing bigint primary key,category bigint,position integer,name text,description text,
 price numeric,old_price numeric,image text,available boolean,url text) on commit drop;
insert into import_dishes values
 (2463, 343, 1, 'باظظ', 'قطع دجاج مقلي بخلطة سنونو الخاصة وخبزة الباظظ المميزة + صوص + خس + بندورة + جبنة - بدون بطاطا', 55.0, null, 'https://media.sonbol.ps/uploads/listings/a2d69b16ca6730eb0595516dc09a2d00.webp', true, 'https://sonbol.ps/vendor/snounu?item=2463'),
 (2482, 343, 2, 'بيج سنونو', 'قطع دجاج مقلي بخلطة سنونو الخاصة وخبزة البيج المميزة + صوص + خس + بندورة + جبنة - بدون بطاطا', 55.0, null, 'https://media.sonbol.ps/uploads/listings/adbe86da7ccc848af1c21020702e12bb.webp', true, 'https://sonbol.ps/vendor/snounu?item=2482'),
 (2465, 343, 3, 'نوك أوت', 'خبزة برجر مع قطعتين ستربس + قطعة بيف + صوص النوك أوت السياسي + أصابع موزريلا + خس + بندورة - بدون بطاطا', 55.0, null, 'https://media.sonbol.ps/uploads/listings/736dd71b99de5da9ce5e8d06ae4c8ea2.webp', true, 'https://sonbol.ps/vendor/snounu?item=2465'),
 (2469, 343, 4, 'تشيكن رول مقلي', 'فيليه دجاج مقلي - خس - بندورة - صوص - مخلل', 40.0, null, 'https://media.sonbol.ps/uploads/listings/802ab3ec7c74480e6110932206af079f.webp', true, 'https://sonbol.ps/vendor/snounu?item=2469'),
 (2934, 343, 5, 'تشكن رول مشوي', 'فليه دجاج مشوي + صوص + خضار + بطاطا', 40.0, null, '', true, 'https://sonbol.ps/vendor/snounu?item=2934'),
 (5177, 343, 6, 'تشكن تندر', '5 قطع ستربس - بدون بطاطا - صوصات - خبزة جانبية', 50.0, null, 'https://media.sonbol.ps/uploads/menu/1793799783970-964135449.jpeg', true, 'https://sonbol.ps/vendor/snounu?item=5177'),
 (2489, 347, 1, 'كلاسيك برجر', 'بيف + جبنة + خس + بندورة + صوص - بدون بطاطا', 45.0, null, 'https://media.sonbol.ps/uploads/listings/b61d71bb37164c8a6939c09bc5a8a305.webp', true, 'https://sonbol.ps/vendor/snounu?item=2489'),
 (2477, 347, 2, 'تشيزي برجر', 'بيف + أصابع موزريلا + خس + بندورة + صوص شيدر - بدون بطاطا', 50.0, null, 'https://media.sonbol.ps/uploads/listings/602dd5feea4ba6fba8c5aa669c17f8f2.webp', true, 'https://sonbol.ps/vendor/snounu?item=2477'),
 (2493, 347, 3, 'ماشروم برجر', 'بيف + ماشروم مع بصل مكرمل + خس + بندورة + صوص باربيكيو - بدون بطاطا', 50.0, null, 'https://media.sonbol.ps/uploads/listings/9445dba25a08e044d7e675b5ac4e089a.webp', true, 'https://sonbol.ps/vendor/snounu?item=2493'),
 (2475, 347, 4, 'دبل برجر', 'قطعتين بيف + جبنة + خس + بندورة + صوص - بدون بطاطا', 58.0, null, 'https://media.sonbol.ps/uploads/listings/b0798414cc94302e0ea0b162c912052e.webp', true, 'https://sonbol.ps/vendor/snounu?item=2475'),
 (5173, 347, 5, 'دبل برجر " كل الاضافات "', 'قطعتي بيف - ماشروم مع بصل مكرمل - خضار - صوص - بطاطا - أصبعين موزيريلا - بدون بطاطا', 60.0, null, 'https://media.sonbol.ps/uploads/menu/1793799106758-714381396.jpeg', true, 'https://sonbol.ps/vendor/snounu?item=5173'),
 (2479, 342, 1, 'اوريجنال برجر', 'فيليه دجاج مقلي + جبنة + مايونيز + خس + مخلل - بدون بطاطا', 40.0, null, 'https://media.sonbol.ps/uploads/listings/b41f12f2bf5b9e70b8ddaa581f99ad5b.webp', true, 'https://sonbol.ps/vendor/snounu?item=2479'),
 (2472, 342, 2, 'ناشفيل', 'فيليه دجاج مقلي + صلصة الناشفيل السياسي + جبنة + صوص  - بدون بطاطا', 40.0, null, 'https://media.sonbol.ps/uploads/listings/ae00a7ab6eae528419b4cf8b06f49f7d.webp', true, 'https://sonbol.ps/vendor/snounu?item=2472'),
 (2481, 342, 3, 'ديلوكس برجر', 'فيليه دجاج مشوي + جبنة + مايونيز + خس + مخلل - بدون بطاطا', 40.0, null, 'https://media.sonbol.ps/uploads/listings/6b06c888cbc57e404a9bcb5da4415838.webp', true, 'https://sonbol.ps/vendor/snounu?item=2481'),
 (2473, 344, 1, 'تشيزي فرايز', 'بطاطا - صوص - جبنة - هالبينو', 25.0, null, 'https://media.sonbol.ps/uploads/listings/5d5d8821393056ebd67fc290e939a378.webp', false, 'https://sonbol.ps/vendor/snounu?item=2473'),
 (2470, 344, 2, 'تشيكن فرايز', 'قطع دجاج مقلي - بطاطا - صوص - جبنة - هالبينو', 40.0, null, 'https://media.sonbol.ps/uploads/listings/d722bcc00a2c02f8670babf205b656ec.webp', false, 'https://sonbol.ps/vendor/snounu?item=2470'),
 (2461, 344, 3, 'لودد فرايز', 'لحم برجر مقطع - بطاطا - جبنة - صوص - هالبينو', 40.0, null, 'https://media.sonbol.ps/uploads/listings/265a657c9cfd81d05b09a965681d83e3.webp', false, 'https://sonbol.ps/vendor/snounu?item=2461'),
 (2490, 341, 1, 'فرشوحة شاورما', '', 25.0, null, 'https://media.sonbol.ps/uploads/listings/77bde1b86afe91fc37e8e79ae7446ecf.webp', true, 'https://sonbol.ps/vendor/snounu?item=2490'),
 (2484, 341, 2, 'شاورما دبل', '', 27.0, null, 'https://media.sonbol.ps/uploads/listings/027bef1a0b94fc816b0d08e7a59d7802.webp', true, 'https://sonbol.ps/vendor/snounu?item=2484'),
 (2466, 341, 3, 'شاورما دبل دجاج', '', 35.0, null, 'https://media.sonbol.ps/uploads/listings/c2f4eee75793f3fbf7471f3e4dc81ea4.webp', true, 'https://sonbol.ps/vendor/snounu?item=2466'),
 (2464, 341, 4, 'مكس مسحب شاورما', 'مسحب مشوي - شاورما - صوص - طحينة  - بدون بطاطا', 45.0, null, 'https://media.sonbol.ps/uploads/listings/f6fb8be241034dfa293853941ed69d73.webp', true, 'https://sonbol.ps/vendor/snounu?item=2464'),
 (2485, 341, 5, 'شاورما سوري', ' بدون بطاطا', 35.0, null, 'https://media.sonbol.ps/uploads/listings/e5a96f14a53434696a92c97893232397.webp', true, 'https://sonbol.ps/vendor/snounu?item=2485'),
 (2460, 341, 6, 'صفيحة شاورما', '', 40.0, null, 'https://media.sonbol.ps/uploads/listings/263f8a389250654c23f17edad74193bd.webp', true, 'https://sonbol.ps/vendor/snounu?item=2460'),
 (2468, 341, 7, 'بوكس المشاركة', '30 قطعة شاورما عربي - بدون بطاطا - ثوم - ثوم حار - طحينة - مخلل ', 120.0, null, 'https://media.sonbol.ps/uploads/listings/cb5205cf8a454ea5659949e235b90936.webp', true, 'https://sonbol.ps/vendor/snounu?item=2468'),
 (2487, 341, 8, 'شاورما عربي', '  بدون بطاطا', 40.0, null, '', true, 'https://sonbol.ps/vendor/snounu?item=2487'),
 (2471, 346, 1, 'ذرة بالمايونيز', '', 8.0, null, 'https://media.sonbol.ps/uploads/listings/79996921c723a8ab66e51d030ae68d21.webp', true, 'https://sonbol.ps/vendor/snounu?item=2471'),
 (2483, 346, 2, 'كولسلو', '', 8.0, null, 'https://media.sonbol.ps/uploads/listings/4820cb8ed664e0a884e67515b224db03.webp', true, 'https://sonbol.ps/vendor/snounu?item=2483'),
 (2480, 346, 3, 'ملفوف أحمر بالمايونيز', '', 8.0, null, 'https://media.sonbol.ps/uploads/listings/7f7d42207a000d26564a167081881c28.webp', true, 'https://sonbol.ps/vendor/snounu?item=2480'),
 (2467, 346, 4, 'صحن بطاطا', '', 10.0, null, 'https://media.sonbol.ps/uploads/listings/6a450f916cdf39496ba73238e7772d1e.webp', false, 'https://sonbol.ps/vendor/snounu?item=2467'),
 (2488, 346, 5, '4 أصابع جبنة', '', 12.0, null, 'https://media.sonbol.ps/uploads/listings/6c6a750d92139beb6cda03bf78ad4a9d.webp', true, 'https://sonbol.ps/vendor/snounu?item=2488'),
 (2476, 345, 1, 'باربيكيو', '', 4.0, null, 'https://media.sonbol.ps/uploads/listings/5032664147c97e94b3549664ca780f89.webp', true, 'https://sonbol.ps/vendor/snounu?item=2476'),
 (2486, 345, 2, 'باربيكيو حار', '', 4.0, null, 'https://media.sonbol.ps/uploads/listings/4fe9855e12a876509145dd89b305a550.webp', true, 'https://sonbol.ps/vendor/snounu?item=2486'),
 (2474, 345, 3, 'ثوم', '', 4.0, null, 'https://media.sonbol.ps/uploads/listings/6edc7f4211b7db94e685c853e6a9d464.webp', true, 'https://sonbol.ps/vendor/snounu?item=2474'),
 (2462, 345, 4, 'ثوم حار', '', 4.0, null, 'https://media.sonbol.ps/uploads/listings/245f07411153c71644aa94ba837ce88d.webp', true, 'https://sonbol.ps/vendor/snounu?item=2462'),
 (2478, 345, 5, 'ناشفيل صوص', '', 4.0, null, 'https://media.sonbol.ps/uploads/listings/6026b29023eba7c73fd5da1cc3806c71.webp', true, 'https://sonbol.ps/vendor/snounu?item=2478'),
 (2491, 345, 6, 'بيكاتا', '', 4.0, null, 'https://media.sonbol.ps/uploads/listings/4c5c6d41f43fd40bf6379680d0bf239e.webp', true, 'https://sonbol.ps/vendor/snounu?item=2491'),
 (5452, 565, 1, 'كوكاكولا', '', 7.0, null, 'https://media.sonbol.ps/uploads/menu/1794477114338-355741279.webp', true, 'https://sonbol.ps/vendor/snounu?item=5452'),
 (5725, 565, 2, 'سبرايت', '', 7.0, null, 'https://media.sonbol.ps/uploads/menu/1794659166083-405267660.webp', true, 'https://sonbol.ps/vendor/snounu?item=5725'),
 (4671, 565, 3, 'مياه معدنية', '', 5.0, null, 'https://media.sonbol.ps/uploads/menu/1794477241842-720785492.webp', true, 'https://sonbol.ps/vendor/snounu?item=4671');

-- The three previously linked dishes retain IDs, ratings, favorites and ad relationships.
update public.dishes d set sonbol_listing_id=i.listing from import_dishes i where d.sonbol_url=i.url;
insert into public.dishes(sonbol_listing_id,category_id,position,name,description,price,old_price,image,available,sonbol_url)
select i.listing,c.id,i.position,i.name,i.description,i.price,i.old_price,i.image,i.available,i.url
from import_dishes i join public.categories c on c.sonbol_category_id=i.category
on conflict (sonbol_listing_id) do update set category_id=excluded.category_id,position=excluded.position,
name=excluded.name,description=excluded.description,price=excluded.price,old_price=excluded.old_price,
image=coalesce(nullif(excluded.image,''),public.dishes.image),available=excluded.available,sonbol_url=excluded.sonbol_url;
