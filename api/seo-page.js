import fs from 'node:fs';
import path from 'node:path';

const ORIGIN='https://snounu-restaurant.vercel.app';
const SUPABASE='https://wknpuzdyemwkllmxehyy.supabase.co/rest/v1/';
const KEY='sb_publishable_FJg5RC-dTvsINEy9D8_rXw_xM03B4Ip';
const ROUTES=['welcome','menu','contact'];
const DEFAULTS={
 site_name:'مطعم سنونو',default_image:'/assets/welcome/2468.webp',
 default_image_alt:'وجبات مطعم سنونو',restaurant_schema:true,sitemap_enabled:true,
 pages:{
  welcome:{title:'مطعم سنونو | الوجبات والعروض',description:'استكشف وجبات مطعم سنونو واختر وجبتك المفضلة.',canonical:'/welcome',index:true},
  menu:{title:'منيو مطعم سنونو | قائمة الطعام والأسعار',description:'تصفح منيو مطعم سنونو، شاهد الصور والأسعار والوجبات.',canonical:'/menu',index:true},
  contact:{title:'تواصل مع مطعم سنونو | الموقع وساعات العمل',description:'تعرف على موقع مطعم سنونو وساعات العمل وطرق التواصل.',canonical:'/contact',index:true}
 }
};
const esc=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const absolute=value=>{
 if(typeof value!=='string'||!value.trim())return '';
 try{const u=new URL(value,ORIGIN);return u.protocol==='https:'?u.href:''}catch{return ''}
};
const canonical=(value,route)=>{
 const url=absolute(value)||ORIGIN+'/'+route;
 // Avoid accidental canonical URLs pointing at unrelated websites.
 return new URL(url).origin===ORIGIN?url:ORIGIN+'/'+route;
};
async function getPublic(table){
 try{
  const r=await fetch(SUPABASE+table,{
   headers:{apikey:KEY},
   signal:AbortSignal.timeout(3500),
   cache:'no-store'
  });
  if(!r.ok)throw Error('HTTP '+r.status);
  const rows=await r.json();return rows[0]||{};
 }catch(e){console.warn('SEO read fallback:',table,e.message);return {}}
}
function sitemap(data){
 const pages=data.pages||{};
 const list=ROUTES.filter(route=>pages[route]?.index!==false).map(route=>canonical(pages[route]?.canonical,route));
 return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+
  list.map(url=>'<url><loc>'+esc(url)+'</loc></url>').join('')+'</urlset>';
}
function meta(data,settings,links,route){
 const cfg={...DEFAULTS.pages[route],...data.pages?.[route]};
 const title=String(cfg.title||DEFAULTS.pages[route].title).slice(0,180);
 const description=String(cfg.description||DEFAULTS.pages[route].description).slice(0,350);
 const openTitle=String(cfg.og_title||title).slice(0,180);
 const openDescription=String(cfg.og_description||description).slice(0,350);
 const url=canonical(cfg.canonical,route),image=absolute(cfg.og_image||data.default_image||DEFAULTS.default_image);
 const robots=cfg.index===false?'noindex,follow':'index,follow,max-image-preview:large';
 const social=String(data.social_handle||'').replace(/^@/,'').trim();
 const tags=[
  '<meta name="description" content="'+esc(description)+'">',
  '<meta name="robots" content="'+robots+'">',
  '<link rel="canonical" href="'+esc(url)+'">',
  '<meta property="og:type" content="website">',
  '<meta property="og:locale" content="ar_PS">',
  '<meta property="og:site_name" content="'+esc(data.site_name||DEFAULTS.site_name)+'">',
  '<meta property="og:url" content="'+esc(url)+'">',
  '<meta property="og:title" content="'+esc(openTitle)+'">',
  '<meta property="og:description" content="'+esc(openDescription)+'">',
  '<meta name="twitter:card" content="'+(image?'summary_large_image':'summary')+'">',
  '<meta name="twitter:title" content="'+esc(openTitle)+'">',
  '<meta name="twitter:description" content="'+esc(openDescription)+'">'
 ];
 if(image){
  tags.push('<meta property="og:image" content="'+esc(image)+'">');
  tags.push('<meta property="og:image:alt" content="'+esc(data.default_image_alt||DEFAULTS.default_image_alt)+'">');
  tags.push('<meta name="twitter:image" content="'+esc(image)+'">');
 }
 if(social&&/^[A-Za-z0-9_]{1,15}$/.test(social))tags.push('<meta name="twitter:site" content="@'+esc(social)+'">');
 if(data.restaurant_schema!==false){
  const schema={
   '@context':'https://schema.org','@type':'Restaurant',
   name:settings.name||data.site_name||DEFAULTS.site_name,
   url:ORIGIN+'/welcome',
   hasMenu:ORIGIN+'/menu',
   inLanguage:'ar',
   description:description
  };
  if(settings.address)schema.address={'@type':'PostalAddress',streetAddress:settings.address};
  if(settings.hotline)schema.telephone=settings.hotline;
  if(settings.hours)schema.openingHours=settings.hours;
  if(image)schema.image=image;
  const sameAs=links.map(link=>link.url).filter(url=>url&&/^https:\/\//.test(url)&&
   ['instagram','facebook'].includes(links.find(x=>x.url===url)?.channel));
  if(sameAs.length)schema.sameAs=sameAs;
  tags.push('<script type="application/ld+json">'+JSON.stringify(schema).replace(/</g,'\\u003c')+'</script>');
 }
 return {title,tags:tags.join('\n')};
}
export default async function handler(req,res){
 if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;res.end('Method Not Allowed');return;}
 const type=String(req.query?.type||'');
 const route=ROUTES.includes(req.query?.route)?req.query.route:'welcome';
 const [record,settings,allLinks]=await Promise.all([
  getPublic('seo_settings?select=data&id=eq.1&limit=1'),
  getPublic('menu_settings?select=name,address,hours,hotline&id=eq.1&limit=1'),
  (async()=>{
   try{
    const r=await fetch(SUPABASE+'menu_links?select=channel,url',{headers:{apikey:KEY},signal:AbortSignal.timeout(3500)});
    return r.ok?await r.json():[];
   }catch{return []}
  })()
 ]);
 const data={...DEFAULTS,...record.data,pages:{...DEFAULTS.pages,...record.data?.pages}};
 if(type==='sitemap'){
  if(data.sitemap_enabled===false){res.statusCode=404;res.end('Not Found');return;}
  res.statusCode=200;res.setHeader('Content-Type','application/xml; charset=utf-8');
  res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=240');
  res.end(sitemap(data));return;
 }
 let html;
 try{html=fs.readFileSync(path.join(process.cwd(),'public','index.html'),'utf8');}
 catch(e){console.error('SEO HTML template missing',e);res.statusCode=500;res.end('Template unavailable');return;}
 const info=meta(data,settings,Array.isArray(allLinks)?allLinks:[],route);
 // Keep the original responsive menu shell and its JavaScript behavior intact.
 html=html.replace(/<title>[^<]*<\/title>/i,'<title>'+esc(info.title)+'</title>');
 html=html.replace('</head>',info.tags+'\n</head>');
 res.statusCode=200;
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=240');
 res.end(html);
}