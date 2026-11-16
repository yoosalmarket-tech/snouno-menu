const base='https://wknpuzdyemwkllmxehyy.supabase.co/rest/v1/';
const headers={apikey:'sb_publishable_FJg5RC-dTvsINEy9D8_rXw_xM03B4Ip'};
const $=id=>document.getElementById(id);
const make=(tag,text)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;return el;};
let dishes=[],categories=[],links=[],advertisements=[],settings={};
let favorites=new Set(JSON.parse(localStorage.getItem('snouno-favorites')||'[]'));
const money=value=>Number(value)+' ₪';
const isPreview=window.parent!==window&&new URLSearchParams(location.search).get('preview')==='1';
function asset(src){if(!src)return '';if(isPreview&&src.startsWith('blob:'+location.origin+'/'))return src;try{const u=new URL(src,location.origin);return /^(https?:)$/.test(u.protocol)?u.href:'';}catch{return '';}}
function setText(id,text){$(id).textContent=text||'';}
function image(src,alt){const img=make('img');img.src=asset(src);img.alt=alt;return img;}
const ordering=['makook','sonbol'];
function contactLinks(container,channels,meal) {
 container.replaceChildren();
 for(const channel of channels){
   const link=links.find(row=>row.channel===channel);
   const url=channel==='sonbol'&&meal?.id?meal.sonbol_url:link?.url;
   if(!link||!url||!/^https?:\/\//i.test(url))continue;
   const a=make('a');a.href=url;a.dataset.channel=channel;
   a.setAttribute('aria-label',link.name);
   a.append(image('/assets/'+channel+'.svg',''),make('span',link.name));
   if(ordering.includes(channel))a.classList.add('order-action');
   container.append(a);
 }
}
let stopCarousel=()=>{};
function renderAds() {
 stopCarousel();
 const ads=advertisements.filter(ad=>asset(ad.image));
 const track=$('ad-track'), dots=$('ad-dots');
 track.replaceChildren(); dots.replaceChildren(); $('ads').hidden=!ads.length;
 const duration=5000;
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 let timer,progress,frame,active=0,dragging=false;
 const listeners=new AbortController();
 const restart=()=>{
   clearTimeout(timer);progress?.cancel();
   if(isPreview||ads.length<2||document.hidden||currentPage()!=='menu'||dragging)return;
   const fill=dots.children[active]?.firstElementChild;
   if(!motion.matches)progress=fill?.animate?.([{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration,fill:'forwards'});
   timer=setTimeout(()=>{
     if(!$('dish').open)select((active+1)%ads.length);
     restart();
   },duration);
 };
 stopCarousel=()=>{clearTimeout(timer);progress?.cancel();cancelAnimationFrame(frame);listeners.abort();};
 window.addEventListener('pagechange',restart,{signal:listeners.signal});
 document.addEventListener('visibilitychange',restart,{signal:listeners.signal});
 track.onpointerdown=()=>{dragging=true;restart();};
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
 for (const [index,{image:url,name:label,dish_id:dishId}] of ads.entries()) {
   const title=label||('إعلان '+(index+1));
   const slide=make('button');slide.type='button';slide.className='ad-product';slide.setAttribute('aria-label','عرض '+title);
   slide.append(image(url,title));slide.onclick=()=>detail(dishes.find(d=>d.id===dishId)||{name:title,image:url,available:true});
   track.append(slide);
   const dot=make('button');dot.type='button';dot.setAttribute('aria-label',title);
   const fill=make('span');fill.className='ad-progress';dot.append(fill);
   dot.onclick=()=>{select(index);restart();};dots.append(dot);
 }
 dots.hidden=ads.length<2;highlight(0);
 function paintSlides(){
   frame=0;
   const width=track.clientWidth;
   if(!width)return;
   const position=Math.abs(track.scrollLeft)/width;
   const nearest=Math.min(ads.length-1,Math.round(position));
   if(active!==nearest){highlight(nearest);restart();}
   Array.from(track.children).forEach((slide,i)=>{
     const distance=Math.max(-1,Math.min(1,i-position));
     const depth=Math.abs(distance);
     slide.firstElementChild.style.transform=motion.matches?'none':
       'translateX('+distance*7+'%) scale('+(1+depth*.16)+')';
     slide.style.opacity=motion.matches?'1':String(1-depth*.28);
   });
 }
 track.onscroll=()=>{if(!frame)frame=requestAnimationFrame(paintSlides);};
 motion.addEventListener('change',()=>{paintSlides();restart();},{signal:listeners.signal});
 paintSlides();
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
 $('logo').src=asset(s.logo)||'/assets/logo.webp';renderAds();
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
const pages=['welcome','menu','contact'];
function currentPage(){
 const path=location.pathname.replace(/^\/|\/$/g,'');
 return pages.includes(path)?path:'welcome';
}
function pageUrl(page){return '/'+page+location.search;}
function route(){
 const legacy=location.hash.slice(1);
 if(pages.includes(legacy))history.replaceState(null,'',pageUrl(legacy));
 resetCredit();
 const dest=currentPage();
 const welcome=dest==='welcome',contact=dest==='contact';
 $('welcome').hidden=!welcome;$('inside').hidden=welcome;$('menu').hidden=contact;$('contact').hidden=!contact;
 for(const a of $('dock').children)a.setAttribute('aria-current',a.dataset.page===dest?'page':'false');
 $('social-links').hidden=welcome;document.body.classList.toggle('contact-route',contact);
 $('inside').querySelector('header').classList.remove('tucked');pageHeader.style.transform='';previousY=0;
 if($('dish').open)$('dish').close();window.scrollTo(0,0);
 window.dispatchEvent(new Event('pagechange'));
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
window.addEventListener('popstate',route);
window.addEventListener('hashchange',route);
document.addEventListener('click',event=>{
 const link=event.target.closest('a[data-page]');
 if(!link||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
 event.preventDefault();
 const url=pageUrl(link.dataset.page);
 if(location.pathname+location.search!==url)history.pushState(null,'',url);
 route();
});
function theme(dark){document.body.classList.toggle('dark',dark);$('theme').textContent=dark?'☀':'☾';}
const systemTheme=matchMedia('(prefers-color-scheme:dark)');
theme(systemTheme.matches);
systemTheme.addEventListener('change',event=>theme(event.matches));
$('theme').onclick=()=>{const dark=!document.body.classList.contains('dark');theme(dark);};
let favoritesOnly=false,activeCategory=null,categoryFrame=0;
const favoritesCategory={id:'favorites',name:'المفضلة',icon:'★'};
let menuSections=[];
const categoryButtons=new Map();
const scrollBehavior=()=>matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth';

function highlightCategory(id){
 if(id===activeCategory)return;
 const previous=categoryButtons.get(activeCategory);
 if(previous)previous.setAttribute('aria-current','false');
 activeCategory=id;
 const button=categoryButtons.get(id);
 if(!button)return;
 button.setAttribute('aria-current','location');
 const strip=$('chips'),bounds=strip.getBoundingClientRect(),tab=button.getBoundingClientRect();
 strip.scrollBy({left:tab.left+tab.width/2-bounds.left-bounds.width/2,behavior:scrollBehavior()});
}
function updateVisibleCategory(){
 categoryFrame=0;
 if(isPreview||!menuSections.length||$('inside').hidden||$('menu').hidden)return;
 const boundary=$('chips').getBoundingClientRect().bottom+3;
 let current=menuSections[0];
 for(const section of menuSections){
   if(section.getBoundingClientRect().top>boundary)break;
   current=section;
 }
 if(window.scrollY>0&&Math.ceil(window.scrollY+window.innerHeight)>=document.documentElement.scrollHeight)
   current=menuSections[menuSections.length-1];
 highlightCategory(current.dataset.category);
}
function scheduleCategoryUpdate(){
 if(!categoryFrame)categoryFrame=requestAnimationFrame(updateVisibleCategory);
}
window.addEventListener('scroll',scheduleCategoryUpdate,{passive:true});
window.addEventListener('resize',scheduleCategoryUpdate);
$('chips').addEventListener('transitionend',scheduleCategoryUpdate);
window.addEventListener('pagechange',scheduleCategoryUpdate);
function scrollToSection(section){
 const y=section.getBoundingClientRect().top;
 const stripHeight=$('chips').offsetHeight;
 const headerSpace=y<stripHeight+pageHeader.offsetHeight?pageHeader.offsetHeight:0;
 window.scrollTo({top:Math.max(0,window.scrollY+y-stripHeight-headerSpace),behavior:scrollBehavior()});
}
function renderChips(groups){
 const strip=$('chips');strip.replaceChildren();categoryButtons.clear();activeCategory=null;
 const favorite=make('button');favorite.type='button';favorite.className='chip';
 favorite.append(make('span','★'),'المفضلة');favorite.setAttribute('aria-pressed',String(favoritesOnly));
 favorite.onclick=()=>{favoritesOnly=!favoritesOnly;renderCards();if(menuSections.length)scrollToSection(menuSections[0]);};
 strip.append(favorite);
 for(const {category,section} of groups){
   if(category===favoritesCategory){
     favorite.setAttribute('aria-controls',section.id);
     categoryButtons.set(category.id,favorite);
     continue;
   }
   const button=make('button');button.type='button';button.className='chip';
   button.append(make('span',category.icon),category.name);
   button.setAttribute('aria-controls',section.id);
   button.onclick=()=>scrollToSection(section);
   strip.append(button);categoryButtons.set(category.id,button);
 }
 scheduleCategoryUpdate();
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
 const groups=[];
 const visible=dishes.filter(d=>(d.name+' '+d.description).toLocaleLowerCase('ar').includes(q));
 const byCategory=new Map();
 for(const dish of visible){
   const key=favorites.has(dish.id)?favoritesCategory.id:dish.category_id;
   if(!byCategory.has(key))byCategory.set(key,[]);
   byCategory.get(key).push(dish);
 }
 const ordered=favoritesOnly?[favoritesCategory]:[favoritesCategory,...categories];
 for(const category of ordered){
   const matches=byCategory.get(category.id)||[];
   if(!matches.length)continue;
   const section=make('section'),heading=make('h2',category.name),cards=make('div');
   section.id='category-'+category.id;section.dataset.category=category.id;
   heading.id=section.id+'-title';section.setAttribute('aria-labelledby',heading.id);
   cards.className='meal-grid';cards.append(...matches.map(mealCard));
   section.append(heading,cards);grid.append(section);groups.push({category,section});
 }
 if(!groups.length){const p=make('p',favoritesOnly&&!q?'اضغط على القلب لحفظ أطباقك المفضلة.':'لا توجد أطباق مطابقة.');p.className='empty';grid.append(p);}
 menuSections=groups.map(group=>group.section);renderChips(groups);
}
function startingScore(value){
 const score=make('span');score.className='rating';
 const amount=make('bdi','★ '+Number(value).toFixed(1));amount.dir='ltr';
 score.append(amount);
 return score;
}
function mealCard(d){
   const article=make('article');article.className='card';
   const open=make('button');open.className='card-open';open.onclick=()=>detail(d);
   if(d.image)open.append(image(d.image,d.name));
   if(d.rating!=null)open.append(startingScore(d.rating));
   open.append(make('strong',d.name),make('p',d.description),price(d));if(!d.available)open.append(make('small','غير متوفر'));
   article.append(open);
   if(d.badge){const badge=make('span',d.badge);badge.className='badge';article.append(badge);}
   const heart=make('button');heart.className='heart';const heartSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');heartSvg.setAttribute('viewBox','0 0 24 24');heartSvg.setAttribute('aria-hidden','true');const heartPath=document.createElementNS(heartSvg.namespaceURI,'path');heartPath.setAttribute('d','M12 20.25c-.4 0-.78-.16-1.09-.42C8.22 17.54 3 13.52 3 9.19 3 6.21 5.21 4.25 7.85 4.25c1.77 0 3.23.88 4.15 2.21.92-1.33 2.38-2.21 4.15-2.21C18.79 4.25 21 6.21 21 9.19c0 4.33-5.22 8.35-7.91 10.64-.31.26-.69.42-1.09.42Z');heartSvg.append(heartPath);heart.append(heartSvg);heart.setAttribute('aria-label','المفضلة · '+d.name);heart.setAttribute('aria-pressed',String(favorites.has(d.id)));
   heart.onclick=()=>{favorites.has(d.id)?favorites.delete(d.id):favorites.add(d.id);localStorage.setItem('snouno-favorites',JSON.stringify([...favorites]));heart.setAttribute('aria-pressed',String(favorites.has(d.id)));renderCards();};article.append(heart);return article;
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
 if(d.rating!=null)lead.append(startingScore(d.rating));
 content.append(lead);if(d.price!=null)content.append(price(d));
 if(d.description)content.append(make('p',d.description));
 if(d.ingredients){content.append(make('h3','المكونات'));const groups=make('div');groups.className='ingredients';
   for(const [group,items] of ingredientGroups(d.ingredients)){
     const row=make('div');row.setAttribute('aria-label',group);
     for(const item of items){const chip=make('span',item);chip.title=group;chip.dataset.color=/طماطم/.test(item)?'red':group==='خضار'?'green':group==='ألبان'?'white':'gold';row.append(chip);}
     groups.append(row);
   }content.append(groups);
 }else if(d.id){
   content.append(make('h3','المكونات'),make('p','لم ينشر المطعم تفاصيل المكونات بعد.'));
 }
 const buttons=make('div');buttons.className='links meal-order';if(d.available)contactLinks(buttons,ordering,d);else buttons.append('غير متوفر');content.append(buttons);
 const show=()=>{box.append(content);if(!$('dish').open){if(isPreview)$('dish').show();else $('dish').showModal();}$('dish').scrollTop=0;};
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
function installDishDismissal(dialog) {
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 let gesture=null,offset=0,phase='',settleTimer;
 const clear=()=>{
   clearTimeout(settleTimer);
   gesture=null;offset=0;phase='';
   dialog.removeAttribute('data-motion');
   dialog.style.removeProperty('--sheet-offset');
 };
 const move=y=>{
   offset=Math.max(0,y);
   dialog.style.setProperty('--sheet-offset',offset+'px');
 };
 const settle=closing=>{
   if(!dialog.open||phase==='dismiss')return;
   gesture=null;clearTimeout(settleTimer);
   phase=closing?'dismiss':'return';dialog.dataset.motion=phase;
   move(closing?dialog.getBoundingClientRect().height:0);
   const finish=()=>{
     if(closing&&dialog.open)dialog.close();
     clear();
   };
   if(reducedMotion.matches)finish();else settleTimer=setTimeout(finish,250);
 };
 const start=(id,x,y,target)=>{
   if(phase||dialog.scrollTop>1||!target.closest('#details')||
      target.closest('button,a,input,textarea,select,label,form'))return;
   gesture={id,x,y,drag:false};
 };
 const drag=(id,x,y,event)=>{
   if(!gesture||gesture.id!==id)return;
   const dy=y-gesture.y,dx=Math.abs(x-gesture.x);
   if(!gesture.drag){
     if(Math.max(Math.abs(dy),dx)<6)return;
     if(dy<=dx||dialog.scrollTop>1||!event.cancelable){gesture=null;return;}
     gesture.drag=true;dialog.dataset.motion='drag';
   }
   if(event.cancelable)event.preventDefault();
   move(dy);
 };
 const end=(id,cancelled=false)=>{
   if(!gesture||gesture.id!==id)return;
   if(gesture.drag)settle(!cancelled&&offset>=Math.min(128,dialog.clientHeight*.18));
   else gesture=null;
 };
 const cancel=()=>{if(gesture)end(gesture.id,true);};
 dialog.addEventListener('touchstart',event=>{
   if(event.touches.length!==1){cancel();return;}
   const t=event.changedTouches[0];start(t.identifier,t.clientX,t.clientY,event.target);
 },{passive:true});
 dialog.addEventListener('touchmove',event=>{
   const t=event.touches[0];
   if(t&&event.touches.length===1)drag(t.identifier,t.clientX,t.clientY,event);
 },{passive:false});
 dialog.addEventListener('touchend',event=>{
   for(const t of event.changedTouches)end(t.identifier);
 });
 dialog.addEventListener('touchcancel',cancel);
 dialog.addEventListener('pointerdown',event=>{
   if(event.pointerType==='mouse'&&event.button===0)start('mouse',event.clientX,event.clientY,event.target);
 });
 window.addEventListener('pointermove',event=>{
   if(event.pointerType==='mouse')drag('mouse',event.clientX,event.clientY,event);
 });
 window.addEventListener('pointerup',event=>{if(event.pointerType==='mouse')end('mouse');});
 window.addEventListener('blur',cancel);
 dialog.addEventListener('dragstart',event=>{if(gesture)event.preventDefault();});
 dialog.addEventListener('click',event=>{
   if(event.target===dialog&&!phase)settle(true);
 });
 dialog.addEventListener('cancel',event=>{event.preventDefault();settle(true);});
 dialog.addEventListener('close',clear);
 $('close').onclick=()=>settle(true);
}
$('search').oninput=renderCards;
if(!isPreview)installDishDismissal($('dish'));
bindFeedback($('feedback'),{});route();
function installPreview(){
 if(!isPreview)return;
 let previewObserver;
 document.body.inert=true;
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
   history.replaceState(null,'',pageUrl(dest));route();renderSettings();
   if(key==='dishes'){
     const draft={...data,id:'preview',rating:data.rating===''?null:data.rating,price:data.price===''?null:Number(data.price),old_price:Number(data.old_price)};
     const mode=new URLSearchParams(location.search).get('view');
     document.body.dataset.preview=mode;
     if(mode==='card')$('cards').replaceChildren(mealCard(draft));else detail(draft);
     const target=mode==='card'?$('cards'):$('dish');
     const report=()=>window.parent.postMessage({type:'snouno-preview-height',height:Math.ceil(target.getBoundingClientRect().height)},location.origin);
     previewObserver?.disconnect();previewObserver=new ResizeObserver(report);previewObserver.observe(target);report();
   }
   if(key==='categories'){
     const preview=make('button');preview.className='chip';preview.append(make('span',data.icon),data.name);
     preview.setAttribute('aria-pressed','true');$('chips').replaceChildren(preview);
     $('cards').replaceChildren();
   }

 });
 window.parent.postMessage('snouno-preview-ready',location.origin);
}
async function load(){
 try{
  const values=await Promise.all(['menu_settings','categories?order=position,name','dishes?order=position,name','menu_links?order=position,name','menu_ads?order=position,name,id'].map(async path=>{
   const r=await fetch(base+path,{headers});if(!r.ok)throw new Error();return r.json();
  }));
  [settings]=values[0];[,categories,dishes,links,advertisements]=values;renderSettings();renderCards();installPreview();$('network').hidden=true;
 }catch{$('network').hidden=false;$('network').replaceChildren('تعذّر تحميل المنيو. ');const b=make('button','إعادة المحاولة');b.onclick=load;$('network').append(b);}
}
async function revealPage(){
 if(!document.documentElement.classList.contains('loading'))return;
 const shell=document.documentElement;
 const onWelcome=!$('welcome').hidden;
 if(onWelcome){
  const sources=[$('cover-photo').getAttribute('href'),'/assets/mask.webp'];
  await Promise.allSettled(sources.map(src=>{const img=new Image();img.src=src;return img.decode();}));
 }
 await document.fonts.ready;
 if(!shell.classList.contains('loading'))return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(!reduced){
  const strokes=$('page-loader').getAnimations({subtree:true});
  for(const stroke of strokes)stroke.playbackRate=2;
  await Promise.allSettled(strokes.map(stroke=>stroke.finished));
 }
 shell.classList.remove('loading');
}
load().finally(revealPage);
