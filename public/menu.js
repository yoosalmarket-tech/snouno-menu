const base='https://wknpuzdyemwkllmxehyy.supabase.co/rest/v1/';
const headers={apikey:'sb_publishable_FJg5RC-dTvsINEy9D8_rXw_xM03B4Ip'};
const $=id=>document.getElementById(id);
const make=(tag,text)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;return el;};
let dishes=[],categories=[],links=[],settings={},category='all';
let favorites=new Set(JSON.parse(localStorage.getItem('snouno-favorites')||'[]'));
const money=value=>Number(value)+' ₪';
function asset(src){if(!src)return '';try{const u=new URL(src,location.origin);return /^(https?:)$/.test(u.protocol)?u.href:'';}catch{return '';}}
function setText(id,text){$(id).textContent=text||'';}
function image(src,alt){const img=make('img');img.src=asset(src);img.alt=alt;return img;}
function orderLinks(container){
 container.replaceChildren();
 for(const link of links){
   if(!/^(https:\/\/|mailto:|tel:)/i.test(link.url))continue;
   const a=make('a');a.href=link.url;
   a.append(make('span',link.name));
   if (/سنبل|مكوك/.test(link.name)) {
     a.className='order-action';
     const arrow=make('i','←');arrow.setAttribute('aria-hidden','true');a.append(arrow);
   }
   container.append(a);
 }
}
function renderAds(s) {
 const ads = [[s.banner,s.banner_alt],[s.banner_two,s.banner_two_alt],[s.banner_three,s.banner_three_alt]].filter(([url])=>asset(url));
 const track=$('ad-track'), dots=$('ad-dots');
 track.replaceChildren(); dots.replaceChildren(); $('ads').hidden=!ads.length;
 const select=index=>{
   const slide=track.children[index];
   if (!slide) return;
   const offset=slide.getBoundingClientRect().left-track.getBoundingClientRect().left;
   track.scrollBy({left:offset,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 };
 function highlight(index) {
   Array.from(dots.children).forEach((dot,i)=>dot.setAttribute('aria-pressed',String(i===index)));
 }
 for (const [index,[url,label]] of ads.entries()) {
   const title=label||('إعلان '+(index+1));
   const slide=image(url,title);track.append(slide);
   const dot=make('button');dot.type='button';dot.setAttribute('aria-label',title);
   dot.onclick=()=>select(index);dots.append(dot);
 }
 dots.hidden=ads.length<2;highlight(0);
 track.onscroll=()=>{
   if(!track.clientWidth)return;
   const left=track.getBoundingClientRect().left;
   highlight(Array.from(track.children).findIndex(slide=>Math.abs(slide.getBoundingClientRect().left-left)<track.clientWidth/2+1));
 };
 track.onkeydown=event=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();
   const i=Array.from(dots.children).findIndex(dot=>dot.getAttribute('aria-pressed')==='true');
   const target=event.key==='Home'?0:event.key==='End'?ads.length-1:i+(event.key==='ArrowLeft'?1:-1);
   select(Math.min(ads.length-1,Math.max(0,target)));
 };
}
function renderSettings(){
 const s=settings;
 setText('brand',s.name);setText('greeting',s.welcome);setText('quick',s.hotline);setText('browse',s.welcome_button);
 $('cover-photo').setAttribute('href',asset(s.hero)||'/assets/plate.webp');
 $('logo').src=asset(s.logo)||'/assets/logo.webp';renderAds(s);
 setText('location-name',s.name+' — غزة');setText('address',s.address);setText('hours',s.hours);setText('hotline',s.hotline);setText('intro',s.contact);setText('credit',s.credit);
 orderLinks($('links'));
}
function route(){
 const dest=location.hash.slice(1)||'welcome';
 const welcome=dest==='welcome',contact=dest==='contact';
 $('welcome').hidden=!welcome;$('inside').hidden=welcome;$('menu').hidden=contact;$('contact').hidden=!contact;
 for(const a of $('dock').children)a.setAttribute('aria-current',a.hash===(contact?'#contact':'#menu')?'page':'false');
 if($('dish').open)$('dish').close();window.scrollTo(0,0);
}
window.addEventListener('hashchange',route);
function theme(dark){document.body.classList.toggle('dark',dark);$('theme').textContent=dark?'☀':'☾';}
theme(localStorage.getItem('snouno-theme')==='dark');
$('theme').onclick=()=>{const dark=!document.body.classList.contains('dark');theme(dark);localStorage.setItem('snouno-theme',dark?'dark':'light');};
function renderChips(){
 $('chips').replaceChildren();
 for(const c of [{id:'all',name:'الكل',icon:'☰'},{id:'favorites',name:'المفضلة',icon:'★'},...categories]){
   const b=make('button');b.className='chip';b.append(make('span',c.icon),c.name);b.setAttribute('aria-pressed',String(category===c.id));
   b.onclick=()=>{category=c.id;renderChips();renderCards();};$('chips').append(b);
 }
}
function price(d){
 const p=make('div',money(d.price));p.className='price';
 if(d.old_price>d.price)p.append(make('del',money(d.old_price)));
 return p;
}
function renderCards(){
 const q=$('search').value.trim().toLocaleLowerCase('ar');const grid=$('cards');grid.replaceChildren();
 const filtered=dishes.filter(d=>(category==='all'||d.category_id===category||(category==='favorites'&&favorites.has(d.id)))&&(d.name+' '+d.description).toLocaleLowerCase('ar').includes(q));
 if(!filtered.length){const p=make('p',category==='favorites'?'اضغط على القلب لحفظ أطباقك المفضلة.':'لا توجد أطباق مطابقة.');p.className='empty';grid.append(p);}
 for(const d of filtered){
   const article=make('article');article.className='card';
   const open=make('button');open.className='card-open';open.onclick=()=>detail(d);
   if(d.image)open.append(image(d.image,d.name));
   const rating=make('span',d.rating!=null?'★ '+Number(d.rating).toFixed(1):'');rating.className='rating';
   open.append(rating,make('strong',d.name),make('p',d.description),price(d));if(!d.available)open.append(make('small','غير متوفر'));
   article.append(open);
   if(d.badge){const badge=make('span',d.badge);badge.className='badge';article.append(badge);}
   const heart=make('button',favorites.has(d.id)?'♥':'♡');heart.className='heart';heart.textContent='';const heartSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');heartSvg.setAttribute('viewBox','0 0 24 24');heartSvg.setAttribute('aria-hidden','true');const heartPath=document.createElementNS(heartSvg.namespaceURI,'path');heartPath.setAttribute('d','M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z');heartSvg.append(heartPath);heart.append(heartSvg);heart.setAttribute('aria-label','المفضلة · '+d.name);heart.setAttribute('aria-pressed',String(favorites.has(d.id)));
   heart.onclick=()=>{favorites.has(d.id)?favorites.delete(d.id):favorites.add(d.id);localStorage.setItem('snouno-favorites',JSON.stringify([...favorites]));renderCards();};article.append(heart);grid.append(article);
 }
}
function bindFeedback(form,extra){
 form.onsubmit=async e=>{e.preventDefault();const output=form.querySelector('output');const button=form.querySelector('button[type=submit],button:not([type])');
 button.disabled=true;try{
 const values=Object.fromEntries(new FormData(form));
 const reply=await fetch(base+'menu_feedback',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({...values,...extra})});
 if(!reply.ok)throw new Error();form.reset();output.textContent='شكراً لك، وصلتنا رسالتك.';
 }catch{output.textContent='تعذّر الإرسال. حاول مرة أخرى.';}finally{button.disabled=false;}};
}
function detail(d){
 const box=$('details');box.replaceChildren();if(d.image)box.append(image(d.image,d.name));
 const content=make('div');content.className='content';content.append(make('h2',d.name),make('p',d.description),price(d));
 if(d.ingredients)content.append(make('h3','المكونات'),make('p',d.ingredients));
 const buttons=make('div');buttons.className='links';if(d.available)orderLinks(buttons);else buttons.append('غير متوفر');content.append(buttons);
 const form=make('form');form.innerHTML='<h3>قيّم الطبق</h3><fieldset class="stars"><legend>التقييم</legend></fieldset><label>اكتب رأيك عن الطبق<textarea name="message" maxlength="2000"></textarea></label><button class="yellow">إرسال التقييم</button><output></output>';
 const stars=form.querySelector('.stars');
 for(let i=1;i<=5;i++){
   const label=make('label');const radio=make('input');
   radio.type='radio';radio.name='stars';radio.value=i;radio.required=true;
   radio.setAttribute('aria-label',i+' من 5');const star=make('span','★');star.setAttribute('aria-hidden','true');
   label.append(radio,star);stars.append(label);
 }
 bindFeedback(form,{kind:'تقييم',dish_id:d.id});content.append(form);box.append(content);$('dish').showModal();$('dish').scrollTop=0;
}
$('search').oninput=renderCards;$('close').onclick=()=>$('dish').close();
$('dish').onclick=e=>{if(e.target===$('dish')&&e.clientY<$('dish').getBoundingClientRect().top)$('dish').close();};
bindFeedback($('feedback'),{});route();
async function load(){
 try{
  const values=await Promise.all(['menu_settings','categories?order=position,name','dishes?order=position,name','menu_links?order=position,name'].map(async path=>{
   const r=await fetch(base+path,{headers});if(!r.ok)throw new Error();return r.json();
  }));
  [settings]=values[0];[,categories,dishes,links]=values;renderSettings();renderChips();renderCards();$('network').hidden=true;
 }catch{$('network').hidden=false;$('network').replaceChildren('تعذّر تحميل المنيو. ');const b=make('button','إعادة المحاولة');b.onclick=load;$('network').append(b);}
}
load();
