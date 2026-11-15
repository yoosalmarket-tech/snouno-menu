update public.dishes d
set sonbol_url='https://sonbol.ps/vendor/snounu?item=' || listing.id
from (values ('نوك آوت','2465'),('بوكس المشاركة','2468'),('الناشفيل','2472')) listing(name,id)
where d.name=listing.name and d.sonbol_url is null;
