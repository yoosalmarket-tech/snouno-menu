alter table public.menu_settings
 add column banner_alt text not null default 'إعلان مطعم سنونو',
 add column banner_two text not null default '/assets/knockout-ad.webp',
 add column banner_two_alt text not null default 'نوك آوت',
 add column banner_three text not null default '/assets/caesar-ad.webp',
 add column banner_three_alt text not null default 'سلطة سيزر بالدجاج';
