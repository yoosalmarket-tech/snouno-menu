const base='https://wknpuzdyemwkllmxehyy.supabase.co/rest/v1/';
const headers={apikey:'sb_publishable_FJg5RC-dTvsINEy9D8_rXw_xM03B4Ip'};
const $=id=>document.getElementById(id);
const make=(tag,text)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;return el;};
let dishes=[],categories=[],links=[],settings={},category='all';
let favorites=new Set(JSON.parse(localStorage.getItem('snouno-favorites')||'[]'));
const money=value=>Number(value)+' ₪';
const isPreview=window.parent!==window&&new URLSearchParams(location.search).get('preview')==='1';
function asset(src){if(!src)return '';if(isPreview&&src.startsWith('blob:'+location.origin+'/'))return src;try{const u=new URL(src,location.origin);return /^(https?:)$/.test(u.protocol)?u.href:'';}catch{return '';}}
function setText(id,text){$(id).textContent=text||'';}
function image(src,alt){const img=make('img');img.src=asset(src);img.alt=alt;return img;}
const ordering=['makook','sonbol'];
function contactLinks(container,channels) {
 container.replaceChildren();
 for(const channel of channels){
   const link=links.find(row=>row.channel===channel);
   if(!link||!/^https?:\/\//i.test(link.url))continue;
   const a=make('a');a.href=link.url;a.dataset.channel=channel;
   a.setAttribute('aria-label',link.name);
   a.append(image('/assets/'+channel+'.svg',''),make('span',link.name));
   if(ordering.includes(channel))a.classList.add('order-action');
   container.append(a);
 }
}
let stopCarousel=()=>{};
function renderAds(s) {
 stopCarousel();
 const ads = [[s.banner,s.banner_alt,s.banner_dish],[s.banner_two,s.banner_two_alt,s.banner_two_dish],[s.banner_three,s.banner_three_alt,s.banner_three_dish]].filter(([url])=>asset(url));
 const track=$('ad-track'), dots=$('ad-dots');
 track.replaceChildren(); dots.replaceChildren(); $('ads').hidden=!ads.length;
 let timer,active=0,dragging=false;
 const listeners=new AbortController();
 const restart=()=>{
   clearTimeout(timer);
   if(isPreview||ads.length<2||document.hidden||location.hash!=='#menu'||dragging)return;
   timer=setTimeout(()=>{
     if(!$('dish').open)select((active+1)%ads.length);
     restart();
   },2000);
 };
 stopCarousel=()=>{clearTimeout(timer);listeners.abort();};
 window.addEventListener('hashchange',restart,{signal:listeners.signal});
 document.addEventListener('visibilitychange',restart,{signal:listeners.signal});
 track.onpointerdown=()=>{dragging=true;clearTimeout(timer);};
 const release=()=>{if(dragging){dragging=false;restart();}};
 window.addEventListener('pointerup',release,{signal:listeners.signal});
 window.addEventListener('pointercancel',release,{signal:listeners.signal});
 const select=index=>{
   const slide=track.children[index];
   if (!slide) return;
   const offset=slide.getBoundingClientRect().left-track.getBoundingClientRect().left;
   track.scrollBy({left:offset,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 };
 function highlight(index) {
   if(index<0)return;
   active=index;
   Array.from(dots.children).forEach((dot,i)=>dot.setAttribute('aria-pressed',String(i===index)));
 }
 for (const [index,[url,label,dishId]] of ads.entries()) {
   const title=label||('إعلان '+(index+1));
   const slide=make('button');slide.type='button';slide.className='ad-product';slide.setAttribute('aria-label','عرض '+title);
   slide.append(image(url,title));slide.onclick=()=>detail(dishes.find(d=>d.id===dishId)||{name:title,image:url,available:true});
   track.append(slide);
   const dot=make('button');dot.type='button';dot.setAttribute('aria-label',title);
   dot.onclick=()=>{select(index);restart();};dots.append(dot);
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
   select(Math.min(ads.length-1,Math.max(0,target)));restart();
 };
 restart();
}
function renderSettings(){
 const s=settings;
 setText('brand',s.name);setText('greeting',s.welcome);setText('quick',s.hotline);setText('browse',s.welcome_button);
 $('cover-photo').setAttribute('href',asset(s.hero)||'/assets/plate.webp');
 $('logo').src=asset(s.logo)||'/assets/logo.webp';renderAds(s);
 setText('location-name',s.name+' — غزة');setText('address',s.address);setText('hours',s.hours);setText('hotline',s.hotline);setText('intro',s.contact);const credit=$('credit-link'), agency='وكالة يوصل',parts=s.credit.split(agency);
 credit.replaceChildren(parts[0]);if(parts.length>1)credit.append(make('strong',agency),parts.slice(1).join(agency));$('credit').hidden=!s.credit;
 contactLinks($('links'),[...ordering,'whatsapp']);contactLinks($('social-links'),['instagram','facebook']);
}
let creditTimeout;
function resetCredit() {
 clearTimeout(creditTimeout);
 creditTimeout=undefined;
 setText('credit-hint','');
}
$('credit-link').onclick=()=>{
 if(creditTimeout!==undefined){
   resetCredit();location.assign('https://www.yoosal.net/');return;
 }
 setText('credit-hint','اضغط مرة ثانية لزيارة موقع يوصل');
 creditTimeout=setTimeout(resetCredit,5000);
};
function route(){
 resetCredit();
 const dest=location.hash.slice(1)||'welcome';
 const welcome=dest==='welcome',contact=dest==='contact';
 $('welcome').hidden=!welcome;$('inside').hidden=welcome;$('menu').hidden=contact;$('contact').hidden=!contact;
 for(const a of $('dock').children)a.setAttribute('aria-current',a.hash===(contact?'#contact':'#menu')?'page':'false');
 $('social-links').hidden=!contact;document.body.classList.toggle('contact-route',contact);
 $('inside').querySelector('header').classList.remove('tucked');pageHeader.style.transform='';previousY=0;
 if($('dish').open)$('dish').close();window.scrollTo(0,0);
}
let previousY=0;
 const pageHeader=$('inside').querySelector('header');
 window.addEventListener('scroll',()=>{
   const y=Math.max(0,window.scrollY);
   if(y!==previousY){
     const down=y>previousY;
     pageHeader.classList.toggle('tucked',down&&y>=pageHeader.offsetHeight);
     pageHeader.style.transform=down&&y<pageHeader.offsetHeight?'translateY(-'+y+'px)':'';
   }
   previousY=y;
 },{passive:true});
window.addEventListener('hashchange',route);
function theme(dark){document.body.classList.toggle('dark',dark);$('theme').textContent=dark?'☀':'☾';}
const systemTheme=matchMedia('(prefers-color-scheme:dark)');
theme(systemTheme.matches);
systemTheme.addEventListener('change',event=>theme(event.matches));
$('theme').onclick=()=>{const dark=!document.body.classList.contains('dark');theme(dark);};
function renderChips(){
 $('chips').replaceChildren();
 for(const c of [{id:'all',name:'الكل',icon:'☰'},{id:'favorites',name:'المفضلة',icon:'★'},...categories]){
   const b=make('button');b.className='chip';b.append(make('span',c.icon),c.name);b.setAttribute('aria-pressed',String(category===c.id));
   b.onclick=()=>{category=c.id;renderChips();renderCards();};$('chips').append(b);
 }
}
function price(d){
 const p=make('div');p.className='price';
 const amount=(tag,value)=>{const el=make(tag,money(value));el.dir='ltr';return el;};
 p.append(amount('bdi',d.price));
 if(d.old_price>d.price)p.append(amount('del',d.old_price));
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
   const heart=make('button');heart.className='heart';const heartSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');heartSvg.setAttribute('viewBox','0 0 24 24');heartSvg.setAttribute('aria-hidden','true');const heartPath=document.createElementNS(heartSvg.namespaceURI,'path');heartPath.setAttribute('d','M12 20.25c-.4 0-.78-.16-1.09-.42C8.22 17.54 3 13.52 3 9.19 3 6.21 5.21 4.25 7.85 4.25c1.77 0 3.23.88 4.15 2.21.92-1.33 2.38-2.21 4.15-2.21C18.79 4.25 21 6.21 21 9.19c0 4.33-5.22 8.35-7.91 10.64-.31.26-.69.42-1.09.42Z');heartSvg.append(heartPath);heart.append(heartSvg);heart.setAttribute('aria-label','المفضلة · '+d.name);heart.setAttribute('aria-pressed',String(favorites.has(d.id)));
   heart.onclick=()=>{favorites.has(d.id)?favorites.delete(d.id):favorites.add(d.id);localStorage.setItem('snouno-favorites',JSON.stringify([...favorites]));renderCards();};article.append(heart);grid.append(article);
 }
}
function bindFeedback(form,extra){
 form.onsubmit=async e=>{e.preventDefault();const output=form.querySelector('output');const button=form.querySelector('button[type=submit],button:not([type])');
 button.disabled=true;try{
 const values=Object.fromEntries(new FormData(form));
 if(extra.dish_id){
   let visitor=localStorage.getItem('snouno-visitor');
   if(!visitor){visitor=crypto.randomUUID();localStorage.setItem('snouno-visitor',visitor);}
   values.visitor_id=visitor;
 }
 const reply=await fetch(base+'menu_feedback',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({...values,...extra})});
 const duplicate=extra.dish_id&&reply.status===409&&(await reply.json()).code==='23505';
 if(!reply.ok&&!duplicate)throw new Error();
 if(extra.dish_id){
   localStorage.setItem('snouno-rated-'+extra.dish_id,'1');form.replaceChildren(make('p',duplicate?'سبق أن قيّمت هذا الطبق.':'شكراً لك، تم حفظ تقييمك.'));
 }else{form.reset();output.textContent='شكراً لك، وصلتنا رسالتك.';}
 }catch{output.textContent='تعذّر الإرسال. حاول مرة أخرى.';}finally{button.disabled=false;}};
}
function ingredientGroups(text=''){
 const groups=new Map();
 for(const line of text.split(/[;؛\n]/)){
   const split=line.indexOf(':');
   const heading=split<0?'':line.slice(0,split).trim();
   const items=(split<0?line:line.slice(split+1)).split(/[،,]/).map(v=>v.trim()).filter(Boolean);
   for(const item of items){
     const group=heading||(/جبن|حليب|لبن/.test(item)?'ألبان':/دجاج|لحم|روبيان/.test(item)?'بروتين':/صوص|سيزر|صلصة/.test(item)?'صلصات':/خس|خيار|طماطم|أفوكادو|جزر/.test(item)?'خضار':'إضافات');
     if(!groups.has(group))groups.set(group,[]);groups.get(group).push(item);
   }
 }
 return groups;
}
function detail(d){
 const box=$('details');box.replaceChildren();
 const categoryLabel=categories.find(c=>c.id===d.category_id)?.name||'';
 if(d.image){
   const frame=make('figure');frame.className='dish-photo';
   frame.append(image(d.image==='/assets/knockout.webp'?'/assets/knockout-detail.webp':d.image,d.name));
   if(categoryLabel){const tag=make('span',categoryLabel);tag.className='photo-tag';frame.append(tag);}
   box.append(frame);
 }
 const content=make('div');content.className='content';
 const lead=make('div');lead.className='dish-lead';lead.append(make('h2',d.name));
 if(d.rating!=null){const n=Math.min(5,Math.max(0,Math.round(d.rating)));const stars=make('span','★'.repeat(n));stars.className='summary-stars';stars.dir='ltr';stars.append(make('small','★'.repeat(5-n)));stars.title=String(d.rating);lead.append(stars);}
 content.append(lead);if(d.price!=null)content.append(price(d));
 if(d.ingredients){content.append(make('h3','المكونات'));const groups=make('div');groups.className='ingredients';
   for(const [group,items] of ingredientGroups(d.ingredients)){
     const row=make('div');row.setAttribute('aria-label',group);
     for(const item of items){const chip=make('span',item);chip.title=group;chip.dataset.color=/طماطم/.test(item)?'red':group==='خضار'?'green':group==='ألبان'?'white':'gold';row.append(chip);}
     groups.append(row);
   }content.append(groups);
 }
 const buttons=make('div');buttons.className='links meal-order';if(d.available)contactLinks(buttons,ordering);else buttons.append('غير متوفر');content.append(buttons);
 const show=()=>{box.append(content);if(!$('dish').open)$('dish').showModal();$('dish').scrollTop=0;};
 if(!d.id){show();return;}
 if(localStorage.getItem('snouno-rated-'+d.id)){content.append(make('p','سبق أن قيّمت هذا الطبق.'));show();return;}
 const form=make('form');form.innerHTML='<h3>قيّم الطبق</h3><fieldset class="stars"><legend>التقييم</legend></fieldset><label>اكتب رأيك عن الطبق<textarea name="message" maxlength="2000"></textarea></label><button class="yellow send-rating" aria-label="إرسال التقييم">➤</button><output></output>';
 const stars=form.querySelector('.stars');
 for(let i=1;i<=5;i++){
   const label=make('label');const radio=make('input');
   radio.type='radio';radio.name='stars';radio.value=i;radio.required=true;
   radio.setAttribute('aria-label',i+' من 5');const star=make('span','★');star.setAttribute('aria-hidden','true');
   label.append(radio,star);stars.append(label);
 }
 bindFeedback(form,{kind:'تقييم',dish_id:d.id});content.append(form);show();
}
$('search').oninput=renderCards;$('close').onclick=()=>$('dish').close();
$('dish').onclick=e=>{if(e.target===$('dish')&&e.clientY<$('details').getBoundingClientRect().top)$('dish').close();};
bindFeedback($('feedback'),{});route();
function installPreview(){
 if(!isPreview)return;
 const original={settings:{...settings},links:links.map(v=>({...v}))};
 document.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();},true);
 document.addEventListener('click',event=>{if(event.target.closest('a,button')){event.preventDefault();event.stopImmediatePropagation();}},true);
 window.addEventListener('message',event=>{
   if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='snouno-draft')return;
   const {key,data,field}=event.data;
   let dest='menu';
   settings={...original.settings};links=original.links.map(v=>({...v}));
   if(key==='menu_settings'){
     settings={...settings,...data};
     if(['name','welcome','hero','welcome_button','hotline'].includes(field))dest='welcome';
     if(['address','hours','contact'].includes(field))dest='contact';
   }else if(key==='menu_links'){
     dest='contact';links=links.map(link=>link.id===data.id?{...link,url:data.url}:link);
   }
   history.replaceState(null,'','#'+dest);route();renderSettings();
   if(key==='dishes'){detail({...data,id:'preview',price:data.price===''?null:data.price});}
   if(key==='categories'){
     const preview=make('button');preview.className='chip';preview.append(make('span',data.icon),data.name);
     preview.setAttribute('aria-pressed','true');$('chips').replaceChildren(preview);
     $('cards').replaceChildren();
   }
   if(key==='menu_settings'&&field?.startsWith('banner')){
     const n=field.startsWith('banner_three')?2:field.startsWith('banner_two')?1:0;
     const slide=$('ad-track').children[n];if(slide)slide.scrollIntoView({inline:'start',block:'nearest'});
   }
 });
 window.parent.postMessage('snouno-preview-ready',location.origin);
}
async function load(){
 try{
  const values=await Promise.all(['menu_settings','categories?order=position,name','dishes?order=position,name','menu_links?order=position,name'].map(async path=>{
   const r=await fetch(base+path,{headers});if(!r.ok)throw new Error();return r.json();
  }));
  [settings]=values[0];[,categories,dishes,links]=values;renderSettings();renderChips();renderCards();installPreview();$('network').hidden=true;
 }catch{$('network').hidden=false;$('network').replaceChildren('تعذّر تحميل المنيو. ');const b=make('button','إعادة المحاولة');b.onclick=load;$('network').append(b);}
}
load();
