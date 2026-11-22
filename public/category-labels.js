// Original Snounu English CATEGORY labels only.
// This intentionally does not restore an English UI or translate meal records.
export const categoryEnglish = Object.freeze({
 'الأطباق المميزة':'Featured',
 'سنونو ساندويش':'Snounu Sandwiches',
 'برجر اللحم':'Beef Burgers',
 'برجر الدجاج المقلي':'Chicken Burgers',
 'فرايز':'Fries',
 'شاورما':'Shawarma',
 'السلطات / المقبلات':'Salads & Sides',
 'صوصات':'Sauces',
 'مشروبات':'Drinks',
 'المفضلة':'Favorites',
 'سندويتشات':'Sandwiches',
 'المقبلات':'Appetizers',
 'المشروبات':'Drinks'
});
export function englishCategoryName(name){
 return categoryEnglish[String(name||'').trim()] || String(name||'');
}
