import {mealTranslation,categoryEnglish,ingredientEnglish,enText} from './translations.js';
const base='https://wknpuzdyemwkllmxehyy.supabase.co/rest/v1/';
const headers={apikey:'sb_publishable_FJg5RC-dTvsINEy9D8_rXw_xM03B4Ip'};
const $=id=>document.getElementById(id);
const make=(tag,text)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;return el;};
let dishes=[],categories=[],links=[],advertisements=[],settings={};
let favorites=new Set(JSON.parse(localStorage.getItem('snouno-favorites')||'[]'));
const money=value=>Number(value)+' ₪';
const isPreview=window.parent!==window&&new URLSearchParams(location.search).get('preview')==='1';

let currentLanguage='ar'; // Start every new visit in Arabic; visitors may switch to English.
const originalTextNodes=new WeakMap();
const isEnglish=()=>currentLanguage==='en';
const tr=value=>isEnglish()?enText(value):value;
const displayName=d=>isEnglish()?(mealTranslation(d)?.[0]||d.name):d.name;
const displayDescription=d=>isEnglish()?(mealTranslation(d)?.[1]||d.description):d.description;
function translateStaticContent(){
 const nodes=['#welcome','#inside>header','#contact','#dock'];
 for(const selector of nodes){
  const root=document.querySelector(selector);if(!root)continue;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
   const node=walker.currentNode;
   if(!originalTextNodes.has(node))originalTextNodes.set(node,node.nodeValue);
   const base=originalTextNodes.get(node);
   const trimmed=base.trim();
   if(trimmed&&enText(trimmed)!==trimmed){
     node.nodeValue=isEnglish()?base.replace(trimmed,enText(trimmed)):base;
   }
  }
 }
}
function applyLanguage(){
 document.documentElement.lang=isEnglish()?'en':'ar';
 document.body.classList.toggle('lang-en',isEnglish());
 for(const toggle of document.querySelectorAll('.language-switch')){
   toggle.querySelector('.language-label').textContent=isEnglish()?'AR':'EN';
   toggle.setAttribute('aria-pressed',String(isEnglish()));
   toggle.setAttribute('aria-label',isEnglish()?'Switch to Arabic':'Switch to English');
   toggle.title=isEnglish()?'العربية':'English';
 }
 $('search').placeholder=tr('ابحث عن طبقك أو مشروبك المفضل...');
 $('search').setAttribute('aria-label',tr('البحث عن طبق'));
 for(const input of document.querySelectorAll('#contact input[placeholder],#contact textarea[placeholder]')){
  if(!input.dataset.arPlaceholder)input.dataset.arPlaceholder=input.placeholder;
  input.placeholder=tr(input.dataset.arPlaceholder);
 }
 $('menu').dir=isEnglish()?'ltr':'rtl';
 $('contact').dir=isEnglish()?'ltr':'rtl';
 if(settings?.name){
   renderSettings();
   renderCards();
   updateWelcomeLabels(mobileWelcomeIndex);
 }
 translateStaticContent();
}
for(const switcher of document.querySelectorAll('.language-switch')){
 switcher.onclick=()=>{
   currentLanguage=isEnglish()?'ar':'en';
   applyLanguage();
 };
}

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
   a.setAttribute('aria-label',tr(link.name));
   a.append(image('/assets/'+channel+'.svg',''),make('span',tr(link.name)));
   if(ordering.includes(channel))a.classList.add('order-action');
   container.append(a);
 }
}


/* Welcome hero carousel. The food assets are pre-rendered transparent WebP
   cutouts based on the original Snouno product photography; never run a
   browser-side color-removal algorithm against food pixels. */
const transparentWelcomeFood=async src=>src;
function installWelcomeFoodCutouts(){}
const welcomeMobileMeals=[
 {listing:2468,name:'بوكس المشاركة',src:'/assets/welcome/2468.webp',fallback:'/assets/meals/2468.webp'},
 {listing:2465,name:'نوك أوت',src:'/assets/welcome/2465.webp',fallback:'/assets/meals/2465.webp'},
 {listing:2472,name:'ناشفيل',src:'/assets/welcome/2472.webp',fallback:'/assets/meals/2472.webp'}
];
const welcomeDefaults=[
 {name:'بوكس المشاركة',image:'/assets/welcome/2468.webp'},
 {name:'نوك أوت',image:'/assets/welcome/2465.webp'},
 {name:'ناشفيل',image:'/assets/welcome/2472.webp'}
];
function syncWelcomeSettings(){
 if(!settings)return;
 welcomeMobileMeals.forEach((item,index)=>{
   const num=index+1;
   item.name=String(settings['welcome_meal_'+num]||welcomeDefaults[index].name);
   item.src=asset(settings['welcome_image_'+num])||welcomeDefaults[index].image;
 });
}
let mobileWelcomeIndex=0;
let desktopWheelTimer=null,welcomeCarouselTimer=null,welcomeCarouselCleanupTimer=null;
let welcomeCarouselActive=false,welcomeCarouselAnimating=false,welcomeCarouselSession=0;
const welcomeAutoplayMs=3000,welcomeTransitionMs=600;
const prefersReducedWelcomeMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const welcomeVisible=()=>!isPreview&&!document.hidden&&currentPage()==='welcome';
const onMobileWelcome=()=>matchMedia('(max-width:980px)').matches;
function welcomeMealName(index){
 const choice=welcomeMobileMeals[index];
 if(!isEnglish())return choice.name;
 const defaults=welcomeDefaults[index];
 if(choice.name!==defaults.name)return tr(choice.name);
 const d=dishes.find(item=>Number(item.sonbol_listing_id)===choice.listing);
 return d?displayName(d):({2468:'Sharing Box',2465:'Knock Out',2472:'Nashville'}[choice.listing]);
}
function setWelcomeImage(img,index){
 const choice=welcomeMobileMeals[index];
 img.onerror=()=>{
  if(img.dataset.fallbackFor!==choice.src){
   img.dataset.fallbackFor=choice.src;img.src=choice.fallback;
  }
 };
 img.src=choice.src;
}
function updateWelcomeLabels(index){
 const label=tr(settings?.welcome_label||'من سنونو');
 $('mobile-meal-prefix').textContent=label;
 $('desktop-meal-prefix').textContent=label;
 $('mobile-meal-name').textContent=welcomeMealName(index);
 $('desktop-meal-name').textContent=welcomeMealName(index);
 $('cover-photo').alt=welcomeMealName(index);
 $('desktop-welcome-hero').alt=welcomeMealName(index);
 [...document.querySelectorAll('.welcome-stage-rail button')].forEach((d,i)=>{
  d.setAttribute('aria-current',String(i===index));
  d.setAttribute('aria-label',welcomeMealName(i));
 });
}
function resetWelcomeImages(){
 const current=mobileWelcomeIndex;
 const image=$('cover-photo'),next=$('cover-next'),desktop=$('desktop-welcome-hero');
 image.classList.remove('mobile-food-out','mobile-food-in');
 next.classList.remove('is-visible','mobile-food-in');
 desktop.classList.remove('wheel-exit','wheel-enter');
 setWelcomeImage(image,current);setWelcomeImage(desktop,current);
 updateWelcomeLabels(current);
}
function stopWelcomeCarousel(){
 ++welcomeCarouselSession;
 clearTimeout(welcomeCarouselTimer);clearTimeout(welcomeCarouselCleanupTimer);
 welcomeCarouselTimer=welcomeCarouselCleanupTimer=null;
 desktopWheelTimer=null;welcomeCarouselAnimating=false;welcomeCarouselActive=false;
 $('cover-photo').classList.remove('mobile-food-out');
 $('cover-next').classList.remove('is-visible','mobile-food-in');
 $('desktop-welcome-hero').classList.remove('wheel-exit','wheel-enter');
}
function scheduleWelcomeCarousel(){
 clearTimeout(welcomeCarouselTimer);
 if(!welcomeVisible()||!welcomeCarouselActive)return;
 welcomeCarouselTimer=setTimeout(()=>goToWelcomeMeal((mobileWelcomeIndex+1)%3),welcomeAutoplayMs);
 desktopWheelTimer=welcomeCarouselTimer;
}
function goToWelcomeMeal(index){
 index=(index+3)%3;
 if(welcomeCarouselAnimating||!welcomeVisible()||index===mobileWelcomeIndex)return;
 clearTimeout(welcomeCarouselTimer);
 const old=mobileWelcomeIndex,session=welcomeCarouselSession;
 const current=$('cover-photo'),next=$('cover-next'),desktop=$('desktop-welcome-hero');
 const mobile=onMobileWelcome();
 welcomeCarouselAnimating=true;
 const nextAsset=new Image();
 let transitionStarted=false;
 nextAsset.onload=()=>{
  if(transitionStarted||session!==welcomeCarouselSession)return;
  transitionStarted=true;
  if(prefersReducedWelcomeMotion()){
   mobileWelcomeIndex=index;resetWelcomeImages();welcomeCarouselAnimating=false;scheduleWelcomeCarousel();return;
  }
  if(mobile){
   setWelcomeImage(next,index);next.alt='';
   next.classList.remove('mobile-food-in');
   next.classList.add('is-visible');
   void next.offsetWidth;
   current.classList.add('mobile-food-out');next.classList.add('mobile-food-in');
  }else{
   desktop.classList.remove('wheel-enter');desktop.classList.add('wheel-exit');
  }
  welcomeCarouselCleanupTimer=setTimeout(()=>{
   if(session!==welcomeCarouselSession)return;
   mobileWelcomeIndex=index;
   setWelcomeImage(current,index);
   setWelcomeImage(desktop,index);
   updateWelcomeLabels(index);
   current.classList.remove('mobile-food-out');
   next.classList.remove('mobile-food-in','is-visible');
   if(!mobile){desktop.classList.remove('wheel-exit');void desktop.offsetWidth;desktop.classList.add('wheel-enter');}
   welcomeCarouselCleanupTimer=setTimeout(()=>{
    if(session!==welcomeCarouselSession)return;
    desktop.classList.remove('wheel-enter');
    welcomeCarouselAnimating=false;
    scheduleWelcomeCarousel();
   },mobile?100:250);
  },mobile?welcomeTransitionMs:320);
 };
 nextAsset.onerror=()=>{welcomeCarouselAnimating=false;scheduleWelcomeCarousel();};
 nextAsset.src=welcomeMobileMeals[index].src;
 if(nextAsset.complete&&nextAsset.naturalWidth)nextAsset.onload();
}
function startWelcomeCarousel(){
 if(!welcomeVisible()){if(welcomeCarouselActive)stopWelcomeCarousel();return;}
 if(welcomeCarouselActive)return;
 ++welcomeCarouselSession;welcomeCarouselActive=true;
 resetWelcomeImages();scheduleWelcomeCarousel();
}
function stopMobileWelcomeCycle(){stopWelcomeCarousel()}
function startMobileWelcomeCycle(){startWelcomeCarousel()}
function stopDesktopMealWheel(){stopWelcomeCarousel()}
function startDesktopMealWheel(){startWelcomeCarousel()}
document.querySelectorAll('.welcome-stage-rail button').forEach((dot,i)=>{
 dot.onclick=()=>{if(welcomeCarouselAnimating)return;goToWelcomeMeal(i)};
});
const stage=$('welcome');
stage.addEventListener('wheel',event=>{
 if(!welcomeVisible()||welcomeCarouselAnimating)return;
 if(Math.abs(event.deltaX)+Math.abs(event.deltaY)<7)return;
 if(!event.target.closest('.welcome-stage,.desktop-visual'))return;
 event.preventDefault();
 goToWelcomeMeal((mobileWelcomeIndex+(event.deltaX+event.deltaY>0?1:2))%3);
},{passive:false});
let welcomeSwipeX=null,welcomeSwipeY=null;
stage.addEventListener('pointerdown',event=>{
 if(!welcomeVisible()||!event.target.closest('.welcome-stage,.desktop-visual'))return;
 welcomeSwipeX=event.clientX;welcomeSwipeY=event.clientY;
});
stage.addEventListener('pointerup',event=>{
 if(welcomeSwipeX===null||welcomeCarouselAnimating)return;
 const dx=event.clientX-welcomeSwipeX,dy=event.clientY-welcomeSwipeY;
 welcomeSwipeX=welcomeSwipeY=null;
 if(Math.abs(dx)>35&&Math.abs(dx)>Math.abs(dy)*1.1)goToWelcomeMeal((mobileWelcomeIndex+(dx<0?1:2))%3);
});
window.addEventListener('pagechange',startWelcomeCarousel);
window.addEventListener('resize',()=>{
 if(welcomeCarouselAnimating)stopWelcomeCarousel();
 startWelcomeCarousel();
});
document.addEventListener('visibilitychange',startWelcomeCarousel);

let stopCarousel=()=>{};
function renderAds() {
 stopCarousel();
 const ads=advertisements.filter(ad=>asset(ad.image));
 const track=$('ad-track'), dots=$('ad-dots'),thumbs=$('ad-thumbnails');
 track.replaceChildren(); dots.replaceChildren();thumbs.replaceChildren(); $('ads').hidden=!ads.length;
 const duration=3000;
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
   Array.from(thumbs.children).forEach((thumb,i)=>{
     thumb.setAttribute('aria-current',String(i===index));
     const number=thumb.querySelector('.ad-thumb-index');
     if(number)number.textContent=String(i+1).padStart(2,'0');
   });
   const count=$('ad-total');
   if(count)count.textContent=String(index+1).padStart(2,'0')+' / '+String(ads.length).padStart(2,'0');
 }
 for (const [index,{image:url,name:label,dish_id:dishId}] of ads.entries()) {
   const title=label||('إعلان '+(index+1));
   const slide=make('button');slide.type='button';slide.className='ad-product';slide.setAttribute('aria-label','عرض '+title);
   slide.append(image(url,title));slide.onclick=()=>detail(dishes.find(d=>d.id===dishId)||{name:title,image:url,available:true});
   track.append(slide);
   const dot=make('button');dot.type='button';dot.setAttribute('aria-label',title);
   const fill=make('span');fill.className='ad-progress';dot.append(fill);
   dot.onclick=()=>{select(index);restart();};dots.append(dot);
   const thumb=make('button');thumb.type='button';thumb.className='ad-thumb';
   const thumbImage=image(url,title);thumbImage.loading='lazy';
   const thumbDetails=make('span');thumbDetails.className='ad-thumb-text';
   const number=make('small',String(index+1).padStart(2,'0'));
   number.className='ad-thumb-index';
   const text=make('strong',title);
   thumbDetails.append(number,text);
   thumb.append(thumbImage,thumbDetails);
   thumb.setAttribute('aria-label',title);
   thumb.onclick=()=>{select(index);restart();};
   thumbs.append(thumb);
 }
 dots.hidden=ads.length<2;
 $('ad-previous').disabled=ads.length<2;
 $('ad-next').disabled=ads.length<2;
 $('ad-previous').onclick=()=>{select((active-1+ads.length)%ads.length);restart();};
 $('ad-next').onclick=()=>{select((active+1)%ads.length);restart();};
 highlight(0);
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
 syncWelcomeSettings();
 setText('mobile-welcome-caption',tr(s.welcome_caption||'أهلاً وسهلاً'));
 setText('desktop-welcome-caption',tr(s.welcome_caption||'أهلاً وسهلاً'));
 setText('welcome-subtitle',tr(s.welcome_subtitle||'جاهز تختار وجبتك المفضّلة؟'));
 setText('desktop-meal-question',tr(s.welcome_question||'شو آكل؟'));
 setText('desktop-welcome-accent',tr(s.welcome_desktop_accent||'على مزاجك.'));
 setText('desktop-welcome-description',tr(s.welcome_description||'اكتشف وجباتنا، اختر اللي بتحبه، واطلب من تطبيق التوصيل المفضل عندك.'));
 setWelcomeImage($('cover-photo'),mobileWelcomeIndex);
 setWelcomeImage($('cover-next'),(mobileWelcomeIndex+1)%3);
 setText('brand',tr(s.name));setText('greeting',tr(s.welcome));setText('quick',s.hotline);
 const buttonText=tr(s.welcome_button||'تصفح المنيو');
 $('browse').querySelector('span').textContent=buttonText;
 $('desktop-welcome-browse').querySelector('span').textContent=buttonText;
 setText('desktop-welcome-brand',tr(s.name));setText('desktop-welcome-greeting',tr(s.welcome));
 const logo=asset(s.logo)||'/assets/logo.webp';
 setWelcomeImage($('desktop-welcome-hero'),mobileWelcomeIndex);
 $('desktop-welcome-hero').classList.add('is-menu-meal');
 updateWelcomeLabels(mobileWelcomeIndex);
 $('logo').src=logo;$('welcome-logo').src=logo;$('desktop-welcome-logo').src=logo;
 renderAds();
 setText('location-name',tr(s.name)+' — '+(isEnglish()?'Gaza':'غزة'));setText('address',tr(s.address));setText('hours',tr(s.hours));setText('hotline',s.hotline);setText('intro',tr(s.contact));const credit=$('credit-link'), agency='وكالة يوصل',parts=s.credit.split(agency);
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
const moonIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.1 15.5A8 8 0 0 1 8.5 3.9a8.2 8.2 0 1 0 11.6 11.6Z"/><path d="m18.3 3.4.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5Z"/></svg>';
const sunIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>';
function theme(dark){
 document.body.classList.toggle('dark',dark);
 const toggle=$('theme');
 toggle.innerHTML=dark?sunIcon:moonIcon;
 toggle.setAttribute('aria-pressed',String(dark));
 toggle.setAttribute('aria-label',dark?'استخدام الوضع الفاتح':'استخدام الوضع الداكن');
 document.documentElement.style.colorScheme=dark?'dark':'light';
}
const systemTheme=matchMedia('(prefers-color-scheme:dark)');
const storedTheme=localStorage.getItem('snouno-theme');
theme(storedTheme==='dark'||(storedTheme!=='light'&&systemTheme.matches));
systemTheme.addEventListener('change',event=>{
 if(localStorage.getItem('snouno-theme')===null)theme(event.matches);
});
$('theme').onclick=()=>{
 const dark=!document.body.classList.contains('dark');
 localStorage.setItem('snouno-theme',dark?'dark':'light');
 theme(dark);
};
let activeCategory=null,categoryFrame=0;
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
 const counter=$('category-position');
 if(counter){
   const index=[...categoryButtons.keys()].indexOf(id);
   counter.textContent=(index+1)+' / '+categoryButtons.size;
 }
 const strip=$('category-rail'),bounds=strip.getBoundingClientRect(),tab=button.getBoundingClientRect();
 if(matchMedia('(min-width:981px)').matches){
   strip.scrollBy({top:tab.top+tab.height/2-bounds.top-bounds.height/2,behavior:scrollBehavior()});
 }else{
   strip.scrollBy({left:tab.left+tab.width/2-bounds.left-bounds.width/2,behavior:scrollBehavior()});
 }
}
function updateVisibleCategory(){
 categoryFrame=0;
 if(isPreview||!menuSections.length||$('inside').hidden||$('menu').hidden)return;
 const boundary=matchMedia('(min-width:981px)').matches?Math.min(window.innerHeight*.36,250):$('chips').getBoundingClientRect().bottom+3;
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
 const desktop=matchMedia('(min-width:981px)').matches;
 const stripHeight=desktop?0:$('chips').offsetHeight;
 const headerSpace=desktop?110:(y<stripHeight+pageHeader.offsetHeight?pageHeader.offsetHeight:0);
 window.scrollTo({top:Math.max(0,window.scrollY+y-stripHeight-headerSpace),behavior:scrollBehavior()});
}
function renderChips(groups){
 const strip=$('chips');strip.replaceChildren();categoryButtons.clear();activeCategory=null;
 const head=make('div');head.className='category-nav-head';
 const titles=make('span');titles.className='category-nav-title';
 const english=make('strong','CATEGORIES');english.lang='en';english.dir='ltr';
 const arabic=make('span','التصنيفات');arabic.lang='ar';arabic.dir='rtl';
 titles.append(english,arabic);
 const controls=make('div');controls.className='category-nav-controls';
 const previous=make('button',isEnglish()?'←':'→');previous.type='button';previous.className='category-nav-arrow';
 previous.setAttribute('aria-label',isEnglish()?'Previous category':'الصنف السابق');
 const position=make('span');position.id='category-position';position.dir='ltr';
 position.textContent='1 / '+groups.length;
 const next=make('button',isEnglish()?'→':'←');next.type='button';next.className='category-nav-arrow';
 next.setAttribute('aria-label',isEnglish()?'Next category':'الصنف التالي');
 controls.append(previous,position,next);
 head.append(titles,controls);
 const rail=make('div');rail.id='category-rail';rail.className='category-rail';
 rail.setAttribute('aria-label',isEnglish()?'Meal categories':'أصناف المنيو');
 for(const {category,section} of groups){
   const button=make('button');button.type='button';button.className='chip';
   const en=make('span',(categoryEnglish[category.name]||category.name).toLocaleUpperCase('en'));
   en.className='chip-en';en.lang='en';en.dir='ltr';
   const ar=make('span',category.name);
   ar.className='chip-ar';ar.lang='ar';ar.dir='rtl';
   button.append(en,ar);
   button.setAttribute('aria-label',tr(category.name));
   button.setAttribute('aria-controls',section.id);
   button.onclick=()=>scrollToSection(section);
   rail.append(button);categoryButtons.set(category.id,button);
 }
 const go=delta=>{
   if(!groups.length)return;
   const current=groups.findIndex(group=>group.category.id===activeCategory);
   const index=Math.min(groups.length-1,Math.max(0,(current<0?0:current)+delta));
   scrollToSection(groups[index].section);
 };
 previous.onclick=()=>go(-1);next.onclick=()=>go(1);
 strip.append(head,rail);scheduleCategoryUpdate();
}
function price(d){
 const p=make('div');p.className='price';
 const amount=(tag,value)=>{const el=make(tag,money(value));el.dir='ltr';return el;};
 p.append(amount('bdi',d.price));
 if(d.old_price>d.price)p.append(amount('del',d.old_price));
 return p;
}
function renderCards(){
 const q=$('search').value.trim().toLocaleLowerCase();const grid=$('cards');grid.replaceChildren();
 const groups=[];
 const visible=dishes.filter(d=>(d.name+' '+d.description+' '+displayName(d)+' '+displayDescription(d)).toLocaleLowerCase().includes(q));
 const byCategory=new Map();
 for(const dish of visible){
   if(!byCategory.has(dish.category_id))byCategory.set(dish.category_id,[]);
   byCategory.get(dish.category_id).push(dish);
 }
 // Favorites is a genuine scrollable category, not a filter.
 // Favorite dishes remain visible in their original categories too.
 const saved=visible.filter(d=>favorites.has(d.id));
 for(const category of [favoritesCategory,...categories]){
   const matches=category===favoritesCategory?saved:(byCategory.get(category.id)||[]);
   if(!matches.length&&category!==favoritesCategory)continue;
   const section=make('section'),heading=make('h2',tr(category.name)),cards=make('div');
   section.id='category-'+category.id;section.dataset.category=category.id;
   heading.id=section.id+'-title';section.setAttribute('aria-labelledby',heading.id);
   cards.className='meal-grid';
   if(matches.length)cards.append(...matches.map(mealCard));
   else{const p=make('p',tr('اضغط على القلب لحفظ أطباقك المفضلة.'));p.className='empty favorites-empty';cards.append(p);}
   section.append(heading,cards);grid.append(section);groups.push({category,section});
 }
 if(!visible.length&&q){const p=make('p',tr('لا توجد أطباق مطابقة.'));p.className='empty';grid.append(p);}
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
   if(d.image)open.append(image(d.image,displayName(d)));
   if(d.rating!=null)open.append(startingScore(d.rating));
   open.append(make('strong',displayName(d)),make('p',displayDescription(d)),price(d));if(!d.available)open.append(make('small',tr('غير متوفر')));
   article.append(open);
   if(d.badge){const badge=make('span',d.badge);badge.className='badge';if(isEnglish())badge.textContent=tr(d.badge);article.append(badge);}
   const heart=make('button');heart.className='heart';const heartSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');heartSvg.setAttribute('viewBox','0 0 24 24');heartSvg.setAttribute('aria-hidden','true');const heartPath=document.createElementNS(heartSvg.namespaceURI,'path');heartPath.setAttribute('d','M12 20.25c-.4 0-.78-.16-1.09-.42C8.22 17.54 3 13.52 3 9.19 3 6.21 5.21 4.25 7.85 4.25c1.77 0 3.23.88 4.15 2.21.92-1.33 2.38-2.21 4.15-2.21C18.79 4.25 21 6.21 21 9.19c0 4.33-5.22 8.35-7.91 10.64-.31.26-.69.42-1.09.42Z');heartSvg.append(heartPath);heart.append(heartSvg);heart.setAttribute('aria-label',tr('المفضلة')+' · '+displayName(d));heart.setAttribute('aria-pressed',String(favorites.has(d.id)));
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
   localStorage.setItem('snouno-rated-'+extra.dish_id,'1');form.replaceChildren(make('p',tr(duplicate?'سبق أن قيّمت هذا الطبق.':'شكراً لك، تم حفظ تقييمك.')));
 }else{form.reset();output.textContent=tr('شكراً لك، وصلتنا رسالتك.');}
 }catch{output.textContent=tr('تعذّر الإرسال. حاول مرة أخرى.');}finally{button.disabled=false;}};
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
 const categoryLabel=tr(categories.find(c=>c.id===d.category_id)?.name||'');
 if(d.image){
   const frame=make('figure');frame.className='dish-photo';
   frame.append(image(d.image==='/assets/knockout.webp'?'/assets/knockout-detail.webp':d.image,displayName(d)));
   if(categoryLabel){const tag=make('span',categoryLabel);tag.className='photo-tag';frame.append(tag);}
   box.append(frame);
 }
 const content=make('div');content.className='content';
 const lead=make('div');lead.className='dish-lead';lead.append(make('h2',displayName(d)));
 if(d.rating!=null)lead.append(startingScore(d.rating));
 content.append(lead);if(d.price!=null)content.append(price(d));
 if(d.description)content.append(make('p',displayDescription(d)));
 if(d.ingredients){content.append(make('h3',tr('المكونات')));const groups=make('div');groups.className='ingredients';
   for(const [group,items] of ingredientGroups(d.ingredients)){
     const row=make('div');row.setAttribute('aria-label',tr(ingredientEnglish[group]||group));
     for(const item of items){const chip=make('span',isEnglish()?(ingredientEnglish[item]||item):item);chip.title=isEnglish()?(ingredientEnglish[group]||group):group;chip.dataset.color=/طماطم/.test(item)?'red':group==='خضار'?'green':group==='ألبان'?'white':'gold';row.append(chip);}
     groups.append(row);
   }content.append(groups);
 }else if(d.id){
   content.append(make('h3',tr('المكونات')),make('p',tr('لم ينشر المطعم تفاصيل المكونات بعد.')));
 }
 const buttons=make('div');buttons.className='links meal-order';if(d.available)contactLinks(buttons,ordering,d);else buttons.append(tr('غير متوفر'));content.append(buttons);
 const show=()=>{box.append(content);if(!$('dish').open){if(isPreview)$('dish').show();else $('dish').showModal();}$('dish').scrollTop=0;};
 if(!d.id){show();return;}
 if(localStorage.getItem('snouno-rated-'+d.id)){content.append(make('p',tr('سبق أن قيّمت هذا الطبق.')));show();return;}
 const form=make('form');form.innerHTML='<h3>'+tr('قيّم الطبق')+'</h3><fieldset class="stars"><legend>'+tr('التقييم')+'</legend></fieldset><label>'+tr('اكتب رأيك عن الطبق')+'<textarea name="message" maxlength="2000"></textarea></label><button class="yellow send-rating" aria-label="'+tr('إرسال التقييم')+'">➤</button><output></output>';
 const stars=form.querySelector('.stars');
 for(let i=1;i<=5;i++){
   const label=make('label');const radio=make('input');
   radio.type='radio';radio.name='stars';radio.value=i;radio.required=true;
   radio.setAttribute('aria-label',isEnglish()?i+' of 5':i+' من 5');const star=make('span','★');star.setAttribute('aria-hidden','true');
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
     if(['name','welcome','hero','welcome_button','hotline','logo','welcome_caption','welcome_subtitle','welcome_question','welcome_label','welcome_desktop_accent','welcome_description','welcome_meal_1','welcome_meal_2','welcome_meal_3','welcome_image_1','welcome_image_2','welcome_image_3'].includes(field))dest='welcome';
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
  [settings]=values[0];[,categories,dishes,links,advertisements]=values;renderSettings();applyLanguage();installPreview();installWelcomeFoodCutouts();startDesktopMealWheel();startMobileWelcomeCycle();$('network').hidden=true;
 }catch{$('network').hidden=false;$('network').replaceChildren('تعذّر تحميل المنيو. ');const b=make('button','إعادة المحاولة');b.onclick=load;$('network').append(b);}
}
async function revealPage(){
 const shell=document.documentElement;
 if(!shell.classList.contains('loading'))return;
 const onWelcome=!$('welcome').hidden;
 if(onWelcome){
  const sources=[$('cover-photo').getAttribute('src'),$('desktop-welcome-hero').getAttribute('src')].filter(Boolean);
  // Prepare hero cutouts under the loading screen so colored source tiles never flash.
  await Promise.allSettled(sources.map(transparentWelcomeFood));
  await Promise.allSettled([
   $('welcome-logo').decode(),
   $('desktop-welcome-logo').decode()
  ]);
 }
 await document.fonts.ready;
 if(!shell.classList.contains('loading'))return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(!reduced){
  const strokes=$('page-loader').getAnimations({subtree:true});
  for(const stroke of strokes)stroke.playbackRate=2;
  await Promise.allSettled(strokes.map(stroke=>stroke.finished));
 }
 if(onWelcome&&!reduced){
  const header=matchMedia('(min-width:981px)').matches
    ?document.querySelector('.desktop-welcome-top')
    :document.querySelector('.welcome-top');
  const target=matchMedia('(min-width:981px)').matches
    ?$('desktop-welcome-logo'):$('welcome-logo');
  const logoSvg=$('page-loader').querySelector('svg');
  if(header&&target&&logoSvg){
   const logoStart=logoSvg.getBoundingClientRect();
   const logoBox=target.getBoundingClientRect();
   const imageAspect=(target.naturalWidth&&target.naturalHeight)
     ?target.naturalWidth/target.naturalHeight
     :logoStart.width/logoStart.height;
   // object-fit:contain means the actual visible wordmark is centered inside its img box.
   const boxWidth=Math.min(logoBox.width,logoBox.height*imageAspect);
   const boxHeight=boxWidth/imageAspect;
   const centerX=logoBox.left+logoBox.width/2;
   const centerY=logoBox.top+logoBox.height/2;
   const scale=Math.min(boxWidth/logoStart.width,boxHeight/logoStart.height);
   const endWidth=logoStart.width*scale;
   const endHeight=logoStart.height*scale;
   const endX=centerX-endWidth/2,endY=centerY-endHeight/2;
   const duration=1900;
   shell.style.setProperty('--loader-header-height',Math.round(header.getBoundingClientRect().height)+'px');
   // Pin the loader's real SVG to viewport coordinates; resizing the yellow parent
   // cannot shift the logo while it travels to the exact final welcome-logo center.
   Object.assign(logoSvg.style,{
     position:'fixed',left:'0px',top:'0px',
     width:logoStart.width+'px',height:logoStart.height+'px',
     maxWidth:'none',margin:'0',transformOrigin:'top left',
     transition:'none',
     transform:'translate('+logoStart.left+'px,'+logoStart.top+'px)'
   });
   const loader=$('page-loader');
   const originalHeight=loader.getBoundingClientRect().height;
   shell.classList.add('loader-morphing');
   shell.classList.remove('loading');
   // Explicit animation makes the yellow canvas and its curve animate even if
   // the page switches from loading to morphing in the same animation frame.
   const shapeMovement=loader.animate([
     {height:originalHeight+'px',borderRadius:'0px'},
     {height:header.getBoundingClientRect().height+'px',borderRadius:'0 0 50% 50% / 0 0 19% 19%'}
   ],{duration,easing:'cubic-bezier(.19,.82,.16,1)',fill:'forwards'});
   const movement=logoSvg.animate([
     {transform:'translate('+logoStart.left+'px,'+logoStart.top+'px) scale(1)'},
     {transform:'translate('+endX+'px,'+endY+'px) scale('+scale+')'}
   ],{duration,easing:'cubic-bezier(.19,.82,.16,1)',fill:'forwards'});
   const shadowTimer=setTimeout(()=>shell.classList.add('loader-shadow-intro'),duration-620);
   await Promise.allSettled([
     movement.finished,
     shapeMovement.finished,
     new Promise(resolve=>setTimeout(resolve,duration+20))
   ]);
   clearTimeout(shadowTimer);
   // Both logos now occupy the same visual box. The yellow shape clears
   // while the shadow finishes rising from behind the curved edge.
   shell.classList.add('loader-finishing');
   shell.classList.remove('loader-morphing');
   await new Promise(resolve=>setTimeout(resolve,310));
   shell.classList.remove('loader-finishing','loader-shadow-intro');
   shell.style.removeProperty('--loader-header-height');
   movement.cancel();
   shapeMovement.cancel();
   return;
  }
 }
 shell.classList.remove('loading');
}
load().finally(revealPage);
