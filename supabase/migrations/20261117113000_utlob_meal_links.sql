alter table public.dishes add column utlob_url text check (utlob_url ~ '^https://');
insert into public.menu_links(channel,name,url,position)
values ('utlob','اطلب عبر تطبيق اطلب','https://utlob.co/stores/172',3)
on conflict (channel) do nothing;

update public.dishes as dish
set utlob_url = 'https://utlob.co/products/' || product.utlob_id
from (values
  (2460, 36957),
  (2462, 36969),
  (2463, 36937),
  (2464, 36955),
  (2465, 36939),
  (2466, 36954),
  (2468, 36958),
  (2469, 36940),
  (2471, 36960),
  (2472, 36947),
  (2474, 36968),
  (2475, 36945),
  (2476, 36966),
  (2477, 36943),
  (2478, 36970),
  (2479, 36946),
  (2480, 36962),
  (2481, 36948),
  (2482, 36938),
  (2483, 36961),
  (2484, 36953),
  (2485, 36956),
  (2486, 36967),
  (2487, 36959),
  (2488, 36964),
  (2489, 36942),
  (2490, 36952),
  (2491, 36971),
  (2493, 36944),
  (2934, 36941)
) as product(listing_id, utlob_id)
where dish.sonbol_listing_id = product.listing_id;
