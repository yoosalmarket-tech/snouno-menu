import {mealTranslation,categoryEnglish,ingredientEnglish,enText} from './translations.js?v=delivery-options-edit10-20261119';
import {installActionReporting,menuLink,shareMeal} from './action-tracking.js?v=ga4-order-intent-1';
const base='https://wknpuzdyemwkllmxehyy.supabase.co/rest/v1/';
const headers={apikey:'sb_publishable_FJg5RC-dTvsINEy9D8_rXw_xM03B4Ip'};
const $=id=>document.getElementById(id);
const make=(tag,text)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;return el;};
let dishes=[],categories=[],links=[],advertisements=[],settings={};
// Preserve returning visitors' favorites, theme, ratings and menu preferences after the rebrand.
try {
 for (const oldKey of Object.keys(localStorage)) {
  if (!oldKey.startsWith('snouno-')) continue;
  const newKey='snounu-'+oldKey.slice('snouno-'.length);
  if (localStorage.getItem(newKey)===null) localStorage.setItem(newKey,localStorage.getItem(oldKey));
  localStorage.removeItem(oldKey);
 }
} catch (error) { console.warn('Legacy menu preferences could not be migrated',error); }
let favorites=new Set(JSON.parse(localStorage.getItem('snounu-favorites')||'[]'));
const money=value=>Number(value)+' ₪';
const isPreview=window.parent!==window&&new URLSearchParams(location.search).get('preview')==='1';
const explicitMode=new URLSearchParams(location.search).get('mode');
const reporting=installActionReporting({
 route:()=>currentPage(),
 mode:()=>document.body.classList.contains('rich-menu-active')?'interactive':'standard',
 preview:()=>isPreview,
 onAction:trackMenuAction
});
function trackMealEvent(name,meal,params={}){
 if(isPreview||typeof window.gtag!=='function')return;
 const event={send_to:'G-V9S0D0J0RX',menu_mode:document.body.classList.contains('rich-menu-active')?'interactive':'standard',...params};
 if(meal?.id){
  const item={item_id:String(meal.id),item_name:meal.name,item_category:categories.find(c=>c.id===meal.category_id)?.name};
  if(meal.price!=null)item.price=Number(meal.price);
  event.items=[item];
  event.meal_name=meal.name;
  event.currency='ILS';
 }
 window.gtag('event',name,event);
}
// Deduplicate referral VALUE separately from raw outbound clicks. There is no
// visitor ID here: only a short-lived timestamp and a first-referral flag.
// The 30-minute inactivity window approximates GA4's default session timeout.
const referralSessionKey='snounu-first-referral-session-v1';
const referralInactivityMs=30*60*1000;
let referralMemory=null;
function registerReferralSession(firstReferral=false){
 if(isPreview)return false;
 const now=Date.now();
 let previous=referralMemory;
 try{previous=JSON.parse(localStorage.getItem(referralSessionKey)||'null');}catch{}
 const active=previous&&Number.isFinite(previous.lastActivity)
  &&now>=previous.lastActivity&&now-previous.lastActivity<referralInactivityMs;
 const alreadyAttributed=!!(active&&previous.attributed);
 const next={lastActivity:now,attributed:alreadyAttributed||firstReferral};
 referralMemory=next;
 try{localStorage.setItem(referralSessionKey,JSON.stringify(next));}catch{}
 return firstReferral&&!alreadyAttributed;
}
function trackMenuAction(action,target,mealId){
 const meal=dishes.find(d=>d.id===mealId);
 if(action!=='order_platform_click')registerReferralSession();
 if(action==='order_platform_click'){
  const platform=target?.dataset.platform||target?.dataset.channel;
  if(['sonbol','makook'].includes(platform)){
   const firstReferral=registerReferralSession(true);
   // Raw click event remains unchanged for click-through analysis.
   trackMealEvent('delivery_app_click',meal,{delivery_platform:platform});
   if(firstReferral){
    const price=Number(meal?.price);
    const hasPrice=meal?.price!=null&&meal.price!==''&&Number.isFinite(price)&&price>=0;
    trackMealEvent('delivery_referral_unique',meal,{
     delivery_platform:platform,
     meal_name:meal?.name||'General menu',
     currency:'ILS',
     ...(hasPrice?{value:price,referral_value:price}:{})
    });
   }
  }
 }else if(action==='favorite_toggle'&&meal){
  if(!favorites.has(meal.id))trackMealEvent('add_to_wishlist',meal);
 }else if(action==='share_meal_click'&&meal){
  trackMealEvent('meal_share_click',meal);
 }
}
let appliedDeepLink='';
function applyDeepLink(){
 if(isPreview||currentPage()!=='menu'||!dishes.length||!firstVisitDecisionComplete)return;
 const params=new URLSearchParams(location.search);
 const hashDish=location.hash.startsWith('#meal-')?location.hash.slice(6):location.hash.startsWith('#rich-meal-')?location.hash.slice(11):'';
 const hashCategory=location.hash.startsWith('#category-')?location.hash.slice(10):location.hash.startsWith('#rich-category-')?location.hash.slice(15):'';
 const mealId=params.get('dish')||hashDish;
 const categoryId=params.get('category')||hashCategory;
 if(!mealId&&!categoryId)return;
 const fingerprint=location.search+'|'+location.hash;
 if(appliedDeepLink===fingerprint)return;
 if(richDesired){
  if(!richController)return;
  const matched=richController.focusLink({mealId,categoryId});
  if(matched)appliedDeepLink=fingerprint;
  return;
 }
 if(mealId){
  const found=dishes.find(row=>String(row.id)===mealId);
  if(!found)return;
  appliedDeepLink=fingerprint;
  detail(found);
 }else if(categoryId){
  const section=document.getElementById('category-'+categoryId);
  if(!section)return;
  appliedDeepLink=fingerprint;
  requestAnimationFrame(()=>scrollToSection(section));
 }
}
function reflectExplicitMode(){
 if(isPreview||currentPage()!=='menu')return;
 const url=new URL(location.href);
 if(!url.searchParams.has('mode'))return;
 url.searchParams.set('mode',richDesired?'interactive':'standard');
 history.replaceState(null,'',url.pathname+url.search+url.hash);
 appliedDeepLink=url.search+'|'+url.hash;
}
function noteSelection(kind,id){
 if(isPreview||currentPage()!=='menu'||!id)return;
 const url=new URL(location.href);
 url.searchParams.delete('dish');url.searchParams.delete('category');
 url.searchParams.set(kind==='meal'?'dish':'category',String(id));
 history.replaceState(null,'',url.pathname+url.search+url.hash);
 appliedDeepLink=url.search+'|'+url.hash;
}


/* Rich menu is an explicit, bandwidth-sensitive opt-in. Nothing from the
   immersive stage is fetched until its switch is on. */
// Check the connection on each new browsing session, or after 30 minutes.
// A manual mode selection is preserved within the current session.
const modePreferenceKey='snounu-rich-mode';
const modeTestTimeKey='snounu-mode-tested-at-v1';
const modeSessionKey='snounu-mode-tested-session-v1';
const savedMode=localStorage.getItem(modePreferenceKey);
const previousTestAt=Number(localStorage.getItem(modeTestTimeKey)||0);
const testIsRecent=previousTestAt>0&&Date.now()>=previousTestAt&&Date.now()-previousTestAt<30*60*1000;
let testedThisSession=false;
try{testedThisSession=sessionStorage.getItem(modeSessionKey)==='1';}catch{}
const firstVisitModeCheck=!isPreview&&!['interactive','standard'].includes(explicitMode)
 &&(!testedThisSession||!testIsRecent||!['0','1'].includes(savedMode));
let richDesired=!isPreview&&(explicitMode==='interactive'||(explicitMode!=='standard'&&!firstVisitModeCheck&&savedMode==='1'));
function rememberMode(value){
 localStorage.setItem(modePreferenceKey,value?'1':'0');
 localStorage.setItem(modeTestTimeKey,String(Date.now()));
 try{sessionStorage.setItem(modeSessionKey,'1');}catch{}
}
const firstVisitStartedAt=performance.now();
let firstVisitDecisionComplete=!firstVisitModeCheck;
let richController=null,richImport=null,richBusy=false,richRevision=0;
const richToggle=document.getElementById('rich-mode-toggle');
function updateRichToggle(){
 if(!richToggle)return;
 richToggle.checked=richDesired;
 richToggle.disabled=richBusy;
 const english=typeof isEnglish==='function'&&isEnglish();
 const title=document.getElementById('experience-switch-title');
 const hint=document.getElementById('experience-switch-hint');
 const status=document.getElementById('experience-switch-status');
 if(title)title.textContent=english?'Interactive mode':'الوضع التفاعلي';
 if(hint)hint.textContent=english?'3D food animations · best with fast internet':'حركة ثلاثية الأبعاد وصور أكثر · يُفضّل اتصال سريع';
 if(status)status.textContent=richBusy?(english?'Loading':'تحميل'):richDesired?(english?'ON':'متقدم'):(english?'OFF':'عادي');
}
async function richAssets(){
 if(richImport)return richImport;
 const link=document.createElement('link');link.rel='stylesheet';link.href='/rich-menu.css?v=network-fallback-edit9-20261119';
 link.dataset.richStyles='1';
 const css=new Promise((resolve,reject)=>{
  link.onload=resolve;link.onerror=()=>reject(new Error('تعذّر تحميل تصميم الوضع التفاعلي'));
 });
 document.head.append(link);
 richImport=Promise.all([css,import('./rich-menu.js?v=seo-edit11-20261119')]).then(([,module])=>module).catch(error=>{
  richImport=null;link.remove();throw error;
 });
 return richImport;
}
function newestFavorites(meals){
 const byId=new Map(meals.map(meal=>[meal.id,meal]));
 return Array.from(favorites).reverse().map(id=>byId.get(id)).filter(Boolean);
}
function richData(){
 return {categories:[{...featuredCategory,items:newestLabeledMeals(dishes)},...categories],dishes,favorites,favoriteMeals:newestFavorites(dishes),settings,links,lang:currentLanguage,categoryEnglish,
  displayName,displayDescription};
}
async function syncRichMode(){
 const enabled=richDesired&&!isPreview;
 const target=$('rich-menu');
 if(!target||!richToggle)return;
 const version=++richRevision;
 document.body.classList.toggle('rich-menu-active',enabled&&currentPage()==='menu');
 updateRichToggle();
 // The two menu modes share menu data, but never build each other's meal imagery.
 if(settings?.name&&dishes.length){
  if(enabled&&currentPage()==='menu'){
   stopCarousel();
   for(const id of ['ad-track','ad-dots','ad-thumbnails','cards','chips'])$(id).replaceChildren();
   $('ads').hidden=true;
   menuSections=[];categoryButtons.clear();activeCategory=null;
  }else if(!enabled&&currentPage()==='menu'&&firstVisitDecisionComplete){
   renderAds();renderCards();
  }
 }
 if(!enabled||currentPage()!=='menu'){
  if(richController){
   if(!enabled){richController.destroy();richController=null;}
   else richController.setActive(false);
  }
  target.hidden=true;
  if(!enabled)target.replaceChildren();
  return;
 }
 target.hidden=false;
 if(!dishes.length){
  target.textContent=isEnglish()?'Loading menu…':'جاري تحميل المنيو…';
  return;
 }
 if(richController){
  richController.refresh();richController.setActive(true);
  applyDeepLink();
  return;
 }
 richBusy=true;updateRichToggle();
 target.textContent=isEnglish()?'Preparing interactive experience…':'جاري تجهيز التجربة التفاعلية…';
 try{
  const module=await richAssets();
  if(version!==richRevision||!richDesired||currentPage()!=='menu')return;
  richController=module.createRichMenu({
   host:target,getData:richData,onOpen:detail,
   onMealView:meal=>trackMealEvent('view_item',meal),
   onSelection:selection=>{
    if(selection?.mealId)noteSelection('meal',selection.mealId);
    else if(selection?.categoryId)noteSelection('category',selection.categoryId);
   },
   onShare:meal=>shareMeal(meal,'interactive'),
   onExit:()=>{
    richDesired=false;
    richToggle.checked=false;
    rememberMode(false);
    reflectExplicitMode();
    void syncRichMode();
   },
   onFavorite:meal=>{
    if(favorites.has(meal.id))favorites.delete(meal.id);else favorites.add(meal.id);
    localStorage.setItem('snounu-favorites',JSON.stringify([...favorites]));
    richController?.refresh();
   }
  });
  richController.setActive(true);
  applyDeepLink();
 }catch(error){
  console.error('Snounu rich menu:',error);
  richDesired=false;localStorage.removeItem('snounu-rich-mode');
  document.body.classList.remove('rich-menu-active');
  target.hidden=true;
  // If loading the interactive assets fails, build the standard menu now.
  if(currentPage()==='menu'&&dishes.length){renderAds();renderCards();}
  $('network').hidden=false;
  $('network').textContent=isEnglish()?'Interactive mode unavailable; the standard menu remains active.':'تعذّر تحميل الوضع التفاعلي، المنيو العادي متاح.';
 }finally{richBusy=false;updateRichToggle();}
}
richToggle?.addEventListener('change',()=>{
 richDesired=richToggle.checked;
 rememberMode(richDesired);
 reflectExplicitMode();
 void syncRichMode();
});
window.addEventListener('pagechange',()=>{void syncRichMode();});


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
 const installLabel=$('install-app-label');
 if(installLabel)installLabel.textContent=isEnglish()?'Install the app':'تثبيت التطبيق';
 const promoTitle=$('install-promo-title'),promoText=$('install-promo-subtitle');
 if(promoTitle)promoTitle.textContent=isEnglish()?'Keep Snounu on your phone!':'خلي منيو سنونو على هاتفك!';
 if(promoText)promoText.textContent=isEnglish()?'Open the menu like an app, in one tap.':'افتح المنيو مثل التطبيق، بضغطة واحدة.';
 updateRichToggle();
 if(richController)richController.refresh();
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
   a.id='order-'+channel+'-'+(meal?.id||'restaurant');
   a.dataset.trackAction='order_platform_click';
   if(meal?.id)a.dataset.mealId=meal.id;
   a.append(image('/assets/'+channel+'.svg',''),make('span',tr(link.name)));
   if(ordering.includes(channel))a.classList.add('order-action');
   container.append(a);
 }
}


/* Welcome hero carousel. The food assets are pre-rendered transparent WebP
   cutouts based on the original Snounu product photography; never run a
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
let welcomeCarouselTimer=null,welcomeCarouselCleanupTimer=null;
let welcomeCarouselActive=false,welcomeCarouselAnimating=false,welcomeCarouselSession=0;
const welcomeAutoplayMs=3000,welcomeTransitionMs=600;
const prefersReducedWelcomeMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const welcomeVisible=()=>!isPreview&&!document.hidden&&currentPage()==='welcome'&&document.documentElement.classList.contains('loader-complete');
function welcomeMealName(index){
 const choice=welcomeMobileMeals[index];
 if(!isEnglish())return choice.name;
 const defaults=welcomeDefaults[index];
 if(choice.name!==defaults.name)return tr(choice.name);
 const d=dishes.find(item=>Number(item.sonbol_listing_id)===choice.listing);
 return d?displayName(d):({2468:'Sharing Box',2465:'Knock Out',2472:'Nashville'}[choice.listing]);
}

/* Optical centering for dashboard-uploaded transparent welcome photos.
   CSS centers the full image rectangle, which can contain asymmetric blank
   alpha padding. Measure its opacity-weighted center and offset only the visible food.
   The horizontal translate/scale used by the swipe animation is unchanged. */
const welcomeVisualCenters=new Map();
function getWelcomeVisualCenter(src){
 if(!welcomeVisualCenters.has(src)){
  const result=(async()=>{
   const probe=new Image();
   probe.crossOrigin='anonymous';
   probe.src=src;
   await probe.decode();
   const canvas=document.createElement('canvas');
   canvas.width=256;canvas.height=256;
   const context=canvas.getContext('2d',{willReadFrequently:true});
   if(!context)return {delta:0,ratio:1};
   context.drawImage(probe,0,0,256,256);
   const data=context.getImageData(0,0,256,256).data;
   let totalWeight=0,weightedX=0;
   for(let i=0;i<data.length;i+=4){
    const weight=(data[i+3]/255)**3;
    totalWeight+=weight;
    weightedX+=weight*((i/4)%256+.5);
   }
   const delta=totalWeight ? .5-weightedX/(256*totalWeight) : 0;
   return {delta,ratio:(probe.naturalWidth||1)/(probe.naturalHeight||1)};
  })().catch(()=>({delta:0,ratio:1}));
  welcomeVisualCenters.set(src,result);
 }
 return welcomeVisualCenters.get(src);
}
async function centerWelcomePhoto(img,src){
 if(!img||!src)return;
 img.style.setProperty('--welcome-visual-offset','0px');
 const {delta,ratio}=await getWelcomeVisualCenter(src);
 if(img.getAttribute('src')!==src)return;
 const width=img.clientWidth,height=img.clientHeight;
 // object-fit: contain centers the bitmap inside an image box that can be taller
 // or wider than the actual image. Use the rendered bitmap width, not box width.
 const drawnWidth=Math.min(width,height*ratio);
 img.style.setProperty('--welcome-visual-offset',
  Math.round(delta*drawnWidth*1.2*10)/10+'px');
}

function setWelcomeImage(img,index){
 const choice=welcomeMobileMeals[index];
 img.onerror=()=>{
  if(img.dataset.fallbackFor!==choice.src){
   img.dataset.fallbackFor=choice.src;img.src=choice.fallback;
   void centerWelcomePhoto(img,choice.fallback);
  }
 };
 img.src=choice.src;
 void centerWelcomePhoto(img,choice.src);
}
function updateWelcomeLabels(index){
 const label=tr(settings?.welcome_label||'من سنونو');
 const badge=document.querySelector('#welcome .welcome-food-badge');
 if(badge){
   const i=index+1;
   const clamp=v=>Math.min(95,Math.max(5,Number(v)||0));
   const x=clamp(settings?.['welcome_label_x_'+i]??82);
   const y=clamp(settings?.['welcome_label_y_'+i]??28);
   badge.style.setProperty('left',x+'%','important');
   badge.style.setProperty('right','auto','important');
   badge.style.setProperty('top',y+'%','important');
   badge.style.setProperty('transform','translate(-50%,-50%) rotate(5deg)','important');
 }
 $('mobile-meal-prefix').textContent=label;
 $('mobile-meal-name').textContent=welcomeMealName(index);
 $('cover-photo').alt=seoImageSettings['welcome_image_alt_'+(index+1)]||welcomeMealName(index);
 [...document.querySelectorAll('.welcome-stage-rail button')].forEach((d,i)=>{
  d.setAttribute('aria-current',String(i===index));
  d.setAttribute('aria-label',welcomeMealName(i));
 });
}
function resetWelcomeImages(){
 const current=mobileWelcomeIndex;
 const image=$('cover-photo'),next=$('cover-next');
 $('welcome').removeAttribute('data-meal-direction');
 image.classList.remove('mobile-food-out','mobile-food-in');
 next.classList.remove('is-visible','mobile-food-in');
 setWelcomeImage(image,current);
 updateWelcomeLabels(current);
}
function stopWelcomeCarousel(){
 ++welcomeCarouselSession;
 clearTimeout(welcomeCarouselTimer);clearTimeout(welcomeCarouselCleanupTimer);
 welcomeCarouselTimer=welcomeCarouselCleanupTimer=null;
 activeWelcomeAnimations.forEach(animation=>animation.cancel());
 activeWelcomeAnimations=[];
 welcomeCarouselAnimating=false;welcomeCarouselActive=false;
 $('cover-photo').classList.remove('mobile-food-out');
 $('cover-next').classList.remove('is-visible','mobile-food-in');
}
function scheduleWelcomeCarousel(afterTransition=false){
 clearTimeout(welcomeCarouselTimer);
 if(!welcomeVisible()||!welcomeCarouselActive)return;
 // 3 seconds from one transition start to the next, not 3 seconds plus motion.
 const delay=afterTransition?Math.max(0,welcomeAutoplayMs-welcomeTransitionMs):welcomeAutoplayMs;
 welcomeCarouselTimer=setTimeout(()=>goToWelcomeMeal((mobileWelcomeIndex+1)%3,'right'),delay);
}
/* GPU-only horizontal carousel: preload/decode the next meal before animating.
   Keep the incoming layer visible until the current layer has the new image,
   preventing the brief blank frame and lag from swapping src mid-animation. */
let activeWelcomeAnimations=[];
async function goToWelcomeMeal(index,direction='right'){
 index=(index+3)%3;
 if(welcomeCarouselAnimating||!welcomeVisible()||index===mobileWelcomeIndex)return;
 clearTimeout(welcomeCarouselTimer);
 const session=welcomeCarouselSession;
 const current=$('cover-photo'),incoming=$('cover-next');
 const forward=direction==='left'?1:-1;
 welcomeCarouselAnimating=true;
 const src=welcomeMobileMeals[index].src;
 try{
  const image=new Image();
  image.src=src;
  await image.decode();
  if(session!==welcomeCarouselSession||!welcomeVisible())return;
  if(prefersReducedWelcomeMotion()){
   mobileWelcomeIndex=index;resetWelcomeImages();
   return;
  }
  incoming.src=src;incoming.alt='';
  await incoming.decode();
  await centerWelcomePhoto(incoming,src);
  if(session!==welcomeCarouselSession||!welcomeVisible())return;
  const leaveX=forward>0?-155:55;
  const arriveX=forward>0?55:-155;
  const outFrames=[
   {transform:'translate3d(-50%,-50%,0) scale(1)',opacity:1},
   {transform:'translate3d('+leaveX+'%,-50%,0) scale(.90)',opacity:0}
  ];
  const inFrames=[
   {transform:'translate3d('+arriveX+'%,-50%,0) scale(.90)',opacity:0},
   {transform:'translate3d(-52%,-50%,0) scale(1.018)',opacity:.98,offset:.87},
   {transform:'translate3d(-50%,-50%,0) scale(1)',opacity:1}
  ];
  incoming.classList.add('is-visible');
  const duration=600;
  activeWelcomeAnimations=[
   current.animate(outFrames,{duration,easing:'cubic-bezier(.24,.68,.22,1)',fill:'both'}),
   incoming.animate(inFrames,{duration,easing:'cubic-bezier(.24,.68,.22,1)',fill:'both'})
  ];
  await Promise.allSettled(activeWelcomeAnimations.map(a=>a.finished));
  if(session!==welcomeCarouselSession||!welcomeVisible())return;
  // Keep the incoming image fully visible while the background layer catches up.
  current.src=src;
  await current.decode();
  await centerWelcomePhoto(current,src);
  if(session!==welcomeCarouselSession||!welcomeVisible())return;
  mobileWelcomeIndex=index;
  updateWelcomeLabels(index);
  current.style.opacity='1';
  current.style.transform='translate(-50%,-50%)';
  for(const anim of activeWelcomeAnimations)anim.cancel();
  activeWelcomeAnimations=[];
  incoming.classList.remove('is-visible','mobile-food-in');
  current.style.removeProperty('opacity');
  current.style.removeProperty('transform');
 }catch(error){
  if(session===welcomeCarouselSession){
   // Keep a working carousel even if the image failed to load/decode.
   console.warn('Welcome meal transition skipped:',error);
  }
 }finally{
  if(session===welcomeCarouselSession){
   activeWelcomeAnimations.forEach(a=>a.cancel());
   activeWelcomeAnimations=[];
   incoming.classList.remove('is-visible','mobile-food-in');
   current.classList.remove('mobile-food-out');
   current.style.removeProperty('transform');
   current.style.removeProperty('opacity');
   welcomeCarouselAnimating=false;
   scheduleWelcomeCarousel(true);
  }
 }
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
 dot.onclick=()=>{if(welcomeCarouselAnimating)return;
  const previous=(mobileWelcomeIndex+welcomeMobileMeals.length-1)%welcomeMobileMeals.length;
  goToWelcomeMeal(i,i===previous?'left':'right');};
});
const stage=$('welcome');
stage.addEventListener('wheel',event=>{
 if(!welcomeVisible()||welcomeCarouselAnimating)return;
 if(Math.abs(event.deltaX)+Math.abs(event.deltaY)<7)return;
 if(!event.target.closest('.welcome-stage,.desktop-visual'))return;
 event.preventDefault();
 const forward=event.deltaX+event.deltaY>0;
 goToWelcomeMeal((mobileWelcomeIndex+(forward?1:2))%3,forward?'right':'left');
},{passive:false});
let welcomeSwipeX=null,welcomeSwipeY=null,lastWelcomeSwipe=0;
function handleWelcomeSwipe(dx,dy){
 if(!welcomeVisible()||welcomeCarouselAnimating||Date.now()-lastWelcomeSwipe<450)return;
 if(Math.abs(dx)<38||Math.abs(dx)<=Math.abs(dy)*1.15)return;
 lastWelcomeSwipe=Date.now();
 // Left: move the food left and reveal the previous meal from the right.
 // Right: move the food right and reveal the next meal from the left.
 goToWelcomeMeal((mobileWelcomeIndex+(dx<0?2:1))%3,dx<0?'left':'right');
}
stage.addEventListener('pointerdown',event=>{
 if(!welcomeVisible()||!event.target.closest('.welcome-stage'))return;
 welcomeSwipeX=event.clientX;welcomeSwipeY=event.clientY;
});
stage.addEventListener('pointerup',event=>{
 if(welcomeSwipeX===null)return;
 const dx=event.clientX-welcomeSwipeX,dy=event.clientY-welcomeSwipeY;
 welcomeSwipeX=welcomeSwipeY=null;handleWelcomeSwipe(dx,dy);
});
stage.addEventListener('pointercancel',()=>{welcomeSwipeX=welcomeSwipeY=null;});
let touchSwipeStart=null;
stage.addEventListener('touchstart',event=>{
 if(!welcomeVisible()||!event.target.closest('.welcome-stage'))return;
 const touch=event.touches[0];if(touch)touchSwipeStart={x:touch.clientX,y:touch.clientY};
},{passive:true});
stage.addEventListener('touchend',event=>{
 if(!touchSwipeStart)return;
 const touch=event.changedTouches[0];
 if(touch)handleWelcomeSwipe(touch.clientX-touchSwipeStart.x,touch.clientY-touchSwipeStart.y);
 touchSwipeStart=null;
},{passive:true});
window.addEventListener('pagechange',startWelcomeCarousel);
window.addEventListener('resize',()=>{
 if(welcomeCarouselAnimating)stopWelcomeCarousel();
 startWelcomeCarousel();
 for(const id of ['cover-photo','cover-next']){
  const img=$(id),src=img?.getAttribute('src');
  if(src)void centerWelcomePhoto(img,src);
 }
});
document.addEventListener('visibilitychange',startWelcomeCarousel);

let stopCarousel=()=>{};
function renderAds() {
 stopCarousel();
 const ads=advertisements.filter(ad=>asset(ad.image));
 const track=$('ad-track'), dots=$('ad-dots'),thumbs=$('ad-thumbnails');
 if(!isPreview&&(richDesired||!firstVisitDecisionComplete||currentPage()!=='menu')){
  track.replaceChildren();dots.replaceChildren();thumbs.replaceChildren();$('ads').hidden=true;
  return;
 }
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
 for (const [index,{id:adId,image:url,name:label,dish_id:dishId}] of ads.entries()) {
   const title=label||('إعلان '+(index+1));
   const slide=make('button');slide.type='button';slide.className='ad-product';slide.setAttribute('aria-label','عرض '+title);slide.id='ad-'+(adId||index);slide.dataset.trackAction='ad_open';if(dishId)slide.dataset.mealId=dishId;
   slide.append(image(url,title));slide.onclick=()=>detail(dishes.find(d=>d.id===dishId)||{name:title,image:url,available:true});
   track.append(slide);
   const dot=make('button');dot.type='button';dot.setAttribute('aria-label',title);dot.id='ad-dot-'+(adId||index);dot.dataset.trackAction='ad_select';
   const fill=make('span');fill.className='ad-progress';dot.append(fill);
   dot.onclick=()=>{select(index);restart();};dots.append(dot);
   const thumb=make('button');thumb.type='button';thumb.className='ad-thumb';thumb.id='ad-thumb-'+(adId||index);thumb.dataset.trackAction='ad_select';
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
 setText('desktop-welcome-accent',tr(s.welcome_desktop_accent||'على مزاجك.'));
 setText('desktop-welcome-description',tr(s.welcome_description||'اكتشف وجباتنا، اختر اللي بتحبه، واطلب من تطبيق التوصيل المفضل عندك.'));
 setWelcomeImage($('cover-photo'),mobileWelcomeIndex);
 setWelcomeImage($('cover-next'),(mobileWelcomeIndex+1)%3);
 setText('brand',tr(s.name));setText('greeting',tr(s.welcome));setText('quick',s.hotline);
 const buttonText=tr(s.welcome_button||'تصفح المنيو');
 $('browse').querySelector('span').textContent=buttonText;
 $('desktop-welcome-browse').querySelector('span').textContent=buttonText;
 setText('desktop-welcome-brand',tr(s.name));
 // Keep the browser-tab icon independent of the large welcome/header logo.
 // Uploaded files use unique Storage paths, so replacements avoid stale cache.
 const favicon=document.getElementById('snounu-favicon');
 if(favicon){
  const faviconUrl=asset(s.favicon_url)||'/assets/snounu-original-192.png?v=20261118-original';
  if(favicon.getAttribute('href')!==faviconUrl)favicon.href=faviconUrl;
 }
 const logo=asset(s.logo)||'/assets/logo.webp';
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
// Stop the welcome loader as soon as a user leaves the welcome route.
 // Without this cancellation, its 2.1s animated yellow canvas can continue
 // over the menu after the shorter Browse transition has finished.
let welcomeRevealCancelled=false;
let activeWelcomeRevealCleanup=null;
function cancelWelcomeReveal(){
 welcomeRevealCancelled=true;
 if(activeWelcomeRevealCleanup){
  activeWelcomeRevealCleanup();
  activeWelcomeRevealCleanup=null;
 }
 const root=document.documentElement,loader=$('page-loader');
 root.classList.remove('loading','loader-morphing','loader-finishing');
 root.classList.add('loader-complete');
 root.style.removeProperty('--loader-header-height');
 $('welcome-logo').style.removeProperty('visibility');
 $('desktop-welcome-logo').style.removeProperty('visibility');
 loader.getAnimations({subtree:true}).forEach(animation=>animation.cancel());
 loader.style.display='none';
 loader.style.visibility='hidden';
 loader.style.pointerEvents='none';
}
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
 applyDeepLink();
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
// Welcome -> menu is immediate. Never hide welcome before its destination
// exists: sequential opacity fades previously exposed a blank pale background.
let browseFadeTimer=0;
const cancelBrowseFade=()=>{
 if(browseFadeTimer)clearTimeout(browseFadeTimer);
 browseFadeTimer=0;
 $('welcome').classList.remove('welcome-browsing-out');
 $('inside').classList.remove('menu-browsing-in');
};
window.addEventListener('popstate',()=>{cancelBrowseFade();route();});
window.addEventListener('hashchange',()=>{cancelBrowseFade();route();});
document.addEventListener('click',event=>{
 const link=event.target.closest('a[data-page]');
 if(!link||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
 event.preventDefault();
 const destination=link.dataset.page;
 const navigate=()=>{
  if(destination!=='welcome')cancelWelcomeReveal();
  const url=pageUrl(destination);
  if(location.pathname+location.search!==url)history.pushState(null,'',url);
  route();
 };
 if(destination==='menu'&&currentPage()==='welcome'&&!isPreview&&
    (link.id==='browse'||link.id==='desktop-welcome-browse')){
  if(browseFadeTimer)return;
  // Cancel the logo morph and switch routes in the SAME event. No white
  // interstitial frame and no second opacity fade after the menu appears.
  cancelWelcomeReveal();
  cancelBrowseFade();
  // No opacity animation at all: reveal the ready destination directly.
  navigate();
  return;
 }
 cancelBrowseFade();
 navigate();
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
const storedTheme=localStorage.getItem('snounu-theme');
theme(storedTheme==='dark'||(storedTheme!=='light'&&systemTheme.matches));
systemTheme.addEventListener('change',event=>{
 if(localStorage.getItem('snounu-theme')===null)theme(event.matches);
});
$('theme').onclick=()=>{
 const dark=!document.body.classList.contains('dark');
 localStorage.setItem('snounu-theme',dark?'dark':'light');
 theme(dark);
};
let activeCategory=null,categoryFrame=0;
const featuredCategory={id:'featured',name:'الأطباق المميزة'};
function newestLabeledMeals(meals){
 // Undated labels keep their existing menu order behind dated labels.
 const changedAt=meal=>Date.parse(meal.badge_changed_at)||0;
 return meals.filter(meal=>meal.badge?.trim()).sort((a,b)=>changedAt(b)-changedAt(a));
}
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
 const previous=make('button',isEnglish()?'←':'→');previous.type='button';previous.className='category-nav-arrow';previous.id='category-previous';
 previous.setAttribute('aria-label',isEnglish()?'Previous category':'الصنف السابق');
 const position=make('span');position.id='category-position';position.dir='ltr';
 position.textContent='1 / '+groups.length;
 const next=make('button',isEnglish()?'→':'←');next.type='button';next.className='category-nav-arrow';next.id='category-next';
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
   button.id='category-button-'+category.id;
   button.dataset.categoryId=category.id;
   button.dataset.trackAction='category_select';
   button.dataset.permalink=menuLink('category',category.id,'standard');
   button.setAttribute('aria-label',tr(category.name));
   button.setAttribute('aria-controls',section.id);
   button.onclick=()=>{scrollToSection(section);noteSelection('category',category.id);};
   rail.append(button);categoryButtons.set(category.id,button);
 }
 const go=delta=>{
   if(!groups.length)return;
   const current=groups.findIndex(group=>group.category.id===activeCategory);
   const index=Math.min(groups.length-1,Math.max(0,(current<0?0:current)+delta));
   scrollToSection(groups[index].section);
   noteSelection('category',groups[index].category.id);
 };
 previous.onclick=()=>go(-1);next.onclick=()=>go(1);
 strip.append(head,rail);scheduleCategoryUpdate();
}
function price(d){
 const p=make('div');p.className='price';
 const amount=(tag,value)=>{const el=make(tag,money(value));el.dir='ltr';return el;};
 p.append(amount('bdi',d.price));
 // Preserve historical previous prices for increases as well as discounts.
 const previous=d.old_price===null||d.old_price===undefined||d.old_price===''?NaN:Number(d.old_price);
 if(Number.isFinite(previous)&&previous!==Number(d.price)){
  const old=amount('del',previous);
  old.title='السعر السابق';
  old.setAttribute('aria-label','السعر السابق '+previous+' شيكل');
  p.append(old);
 }
 return p;
}
function renderCards(){
 const q=$('search').value.trim().toLocaleLowerCase();const grid=$('cards');grid.replaceChildren();
 if(!isPreview&&(richDesired||!firstVisitDecisionComplete||currentPage()!=='menu')){
  $('chips').replaceChildren();menuSections=[];categoryButtons.clear();activeCategory=null;
  return;
 }
 const groups=[];
 const visible=dishes.filter(d=>(d.name+' '+d.description+' '+displayName(d)+' '+displayDescription(d)).toLocaleLowerCase().includes(q));
 const byCategory=new Map();
 for(const dish of visible){
   if(!byCategory.has(dish.category_id))byCategory.set(dish.category_id,[]);
   byCategory.get(dish.category_id).push(dish);
 }
 // Favorites is a genuine scrollable category, not a filter.
 // Favorite dishes remain visible in their original categories too.
 byCategory.set(favoritesCategory.id,newestFavorites(visible));
 byCategory.set(featuredCategory.id,newestLabeledMeals(visible));
 for(const category of [favoritesCategory,featuredCategory,...categories]){
   const matches=byCategory.get(category.id)||[];
   if(!matches.length&&category!==favoritesCategory)continue;
   const section=make('section'),heading=make('h2',tr(category.name)),cards=make('div');
   section.id='category-'+category.id;section.dataset.category=category.id;section.dataset.categoryId=category.id;
   heading.id=section.id+'-title';section.setAttribute('aria-labelledby',heading.id);
   cards.className='meal-grid';
   if(matches.length)cards.append(...matches.map(meal=>mealCard(meal,category===favoritesCategory?'favorite':category===featuredCategory?'featured':'regular')));
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
function mealCard(d,context='regular'){
   const article=make('article');article.className='card';
   article.id=(context==='regular'?'meal-':context+'-meal-')+d.id;
   article.dataset.mealId=d.id;article.dataset.categoryId=d.category_id;
   const open=make('button');open.className='card-open';open.id=(context==='regular'?'open-meal-':context+'-open-')+d.id;
   open.dataset.mealId=d.id;open.dataset.trackAction='meal_open';
   open.onclick=()=>detail(d);
   if(d.image){const photo=make('img');photo.loading='lazy';photo.decoding='async';photo.src=asset(d.image);photo.alt=d.seo_alt||displayName(d);open.append(photo);}
   if(d.rating!=null)open.append(startingScore(d.rating));
   open.append(make('strong',displayName(d)),make('p',displayDescription(d)),price(d));if(!d.available)open.append(make('small',tr('غير متوفر')));
   article.append(open);
   if(d.badge){const badge=make('span',d.badge);badge.className='badge';if(isEnglish())badge.textContent=tr(d.badge);article.append(badge);}
   const heart=make('button');heart.className='heart';heart.id=(context==='regular'?'heart-meal-':context+'-heart-')+d.id;heart.dataset.mealId=d.id;heart.dataset.trackAction='favorite_toggle';const heartSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');heartSvg.setAttribute('viewBox','0 0 24 24');heartSvg.setAttribute('aria-hidden','true');const heartPath=document.createElementNS(heartSvg.namespaceURI,'path');heartPath.setAttribute('d','M12 20.25c-.4 0-.78-.16-1.09-.42C8.22 17.54 3 13.52 3 9.19 3 6.21 5.21 4.25 7.85 4.25c1.77 0 3.23.88 4.15 2.21.92-1.33 2.38-2.21 4.15-2.21C18.79 4.25 21 6.21 21 9.19c0 4.33-5.22 8.35-7.91 10.64-.31.26-.69.42-1.09.42Z');heartSvg.append(heartPath);heart.append(heartSvg);heart.setAttribute('aria-label',tr('المفضلة')+' · '+displayName(d));heart.setAttribute('aria-pressed',String(favorites.has(d.id)));
   heart.onclick=()=>{favorites.has(d.id)?favorites.delete(d.id):favorites.add(d.id);localStorage.setItem('snounu-favorites',JSON.stringify([...favorites]));heart.setAttribute('aria-pressed',String(favorites.has(d.id)));renderCards();};article.append(heart);return article;
}
function bindFeedback(form,extra){
 form.onsubmit=async e=>{e.preventDefault();const output=form.querySelector('output');const button=form.querySelector('button[type=submit],button:not([type])');
 button.disabled=true;try{
 const values=Object.fromEntries(new FormData(form));
 if(extra.dish_id){
   let visitor=localStorage.getItem('snounu-visitor');
   if(!visitor){visitor=crypto.randomUUID();localStorage.setItem('snounu-visitor',visitor);}
   values.visitor_id=visitor;
 }
 const reply=await fetch(base+'menu_feedback',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({...values,...extra})});
 const duplicate=extra.dish_id&&reply.status===409&&(await reply.json()).code==='23505';
 if(!reply.ok&&!duplicate)throw new Error();
 if(extra.dish_id){
   localStorage.setItem('snounu-rated-'+extra.dish_id,'1');form.replaceChildren(make('p',tr(duplicate?'سبق أن قيّمت هذا الطبق.':'شكراً لك، تم حفظ تقييمك.')));
 }else{form.reset();output.textContent=tr('شكراً لك، وصلتنا رسالتك.');}
 reporting.report('form_submit_success',button,{meal_id:extra.dish_id||null});
 }catch{output.textContent=tr('تعذّر الإرسال. حاول مرة أخرى.');reporting.report('form_submit_error',button,{meal_id:extra.dish_id||null});}finally{button.disabled=false;}};
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
 if(d.id)trackMealEvent('view_item',d);
 const box=$('details');box.replaceChildren();
 // The dialog persists between dishes: clear its previous floating share action.
 $('dish').querySelector('.share-meal-link')?.remove();
 $('dish').dataset.mealId=d.id||'';
 if(d.id&&!isPreview)noteSelection('meal',d.id);
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
 if(d.id&&!isPreview){
  const share=make('button');
  share.type='button';share.className='share-meal-link';share.id='share-meal-'+d.id;
  share.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 13.5 6.6 4M15.3 6.5l-6.6 4"/></svg>';
  share.dataset.mealId=d.id;share.dataset.trackAction='share_meal_click';
  share.title=isEnglish()?'Share meal':'مشاركة الوجبة';
  share.setAttribute('aria-label',share.title);
  share.onclick=()=>{void shareMeal(d,richDesired?'interactive':'standard');};
  // Keep this control above the meal photo, immediately below the close icon.
  $('close').after(share);
 }
 const show=()=>{box.append(content);if(!$('dish').open){if(isPreview)$('dish').show();else $('dish').showModal();}$('dish').scrollTop=0;};
 if(!d.id){show();return;}
 if(localStorage.getItem('snounu-rated-'+d.id)){content.append(make('p',tr('سبق أن قيّمت هذا الطبق.')));show();return;}
 const form=make('form');form.id='review-form-'+d.id;form.dataset.mealId=d.id;form.innerHTML='<h3>'+tr('قيّم الطبق')+'</h3><fieldset class="stars"><legend>'+tr('التقييم')+'</legend></fieldset><label>'+tr('اكتب رأيك عن الطبق')+'<textarea name="message" maxlength="2000"></textarea></label><button class="yellow send-rating" aria-label="'+tr('إرسال التقييم')+'">➤</button><output></output>';
 const stars=form.querySelector('.stars');
 for(let i=1;i<=5;i++){
   const label=make('label');const radio=make('input');
   radio.type='radio';radio.name='stars';radio.value=i;radio.required=true;radio.id='review-star-'+d.id+'-'+i;
   radio.setAttribute('aria-label',isEnglish()?i+' of 5':i+' من 5');const star=make('span','★');star.setAttribute('aria-hidden','true');
   label.append(radio,star);stars.append(label);
 }
 const submit=form.querySelector('.send-rating');submit.id='review-submit-'+d.id;submit.dataset.mealId=d.id;
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
   if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='snounu-draft')return;
   const {key,data,field}=event.data;
   let dest='menu';
   settings={...original.settings};links=original.links.map(v=>({...v}));
   if(key==='menu_settings'){
     settings={...settings,...data};
     if(['name','welcome','welcome_button','hotline','logo','welcome_caption','welcome_subtitle','welcome_question','welcome_label','welcome_desktop_accent','welcome_description','welcome_meal_1','welcome_meal_2','welcome_meal_3','welcome_image_1','welcome_image_2' ,'welcome_image_3','welcome_label_x_1','welcome_label_y_1','welcome_label_x_2','welcome_label_y_2','welcome_label_x_3','welcome_label_y_3'].includes(field))dest='welcome';
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
     const report=()=>window.parent.postMessage({type:'snounu-preview-height',height:Math.ceil(target.getBoundingClientRect().height)},location.origin);
     previewObserver?.disconnect();previewObserver=new ResizeObserver(report);previewObserver.observe(target);report();
   }
   if(key==='categories'){
     const preview=make('button');preview.className='chip';preview.append(make('span',data.icon),data.name);
     preview.setAttribute('aria-pressed','true');$('chips').replaceChildren(preview);
     $('cards').replaceChildren();
   }

 });
 window.parent.postMessage('snounu-preview-ready',location.origin);
}
let seoImageSettings={};
async function refreshSeoWelcomeAlts(){
 try{
  const response=await fetch(base+'seo_settings?select=data&id=eq.1',{headers});
  if(!response.ok)return;
  const rows=await response.json();
  seoImageSettings=rows[0]?.data||{};
  updateWelcomeLabels(mobileWelcomeIndex);
 }catch{}
}
async function load(){
 try{
  const values=await Promise.all(['menu_settings','categories?order=position,name','dishes?order=position,name','menu_links?order=position,name','menu_ads?order=position,name,id'].map(async path=>{
   const r=await fetch(base+path,{headers});if(!r.ok)throw new Error();return r.json();
  }));
  [settings]=values[0];[,categories,dishes,links,advertisements]=values;renderSettings();applyLanguage();installPreview();installWelcomeFoodCutouts();startDesktopMealWheel();startMobileWelcomeCycle();$('network').hidden=true;
  // The SEO fetch runs after initial menu data, outside the 3-second decision.
  setTimeout(()=>void refreshSeoWelcomeAlts(),3200);
  void syncRichMode();
  applyDeepLink();
  return true;
 }catch{$('network').hidden=false;$('network').replaceChildren('تعذّر تحميل المنيو. ');const b=make('button','إعادة المحاولة');b.onclick=load;$('network').append(b);return false;}
}
async function revealPage(){
 const root=document.documentElement;
 if(welcomeRevealCancelled||!root.classList.contains('loading'))return;
 const welcome=currentPage()==='welcome';
 await Promise.allSettled([
  $('welcome-logo').decode(),$('desktop-welcome-logo').decode(),
  $('cover-photo').decode()
 ]);
 await document.fonts.ready;
 if(welcomeRevealCancelled)return;
 if(!root.classList.contains('loading'))return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(!reduced){
  const drawings=$('page-loader').getAnimations({subtree:true});
  for(const drawing of drawings)drawing.playbackRate=2;
  await Promise.allSettled(drawings.map(drawing=>drawing.finished));
 }
 if(welcomeRevealCancelled)return;
 if(welcome&&!reduced){
  // Desktop and mobile now share the same welcome hero and logo geometry.
  const header=document.querySelector('.welcome-top');
  const destination=$('welcome-logo');
  const loader=$('page-loader');
  const drawnLogo=loader.querySelector('svg');
  const finalWave=header?.querySelector('.welcome-top-wave');
  if(header&&destination&&drawnLogo&&finalWave){
   const start=drawnLogo.getBoundingClientRect();
   const finish=destination.getBoundingClientRect();
   const styling=getComputedStyle(destination);
   const measure=name=>parseFloat(styling.getPropertyValue(name))||0;
   const bx=measure('border-left-width'),by=measure('border-top-width');
   const padL=measure('padding-left'),padR=measure('padding-right');
   const padT=measure('padding-top'),padB=measure('padding-bottom');
   const contentWidth=Math.max(1,finish.width-padL-padR-bx-measure('border-right-width'));
   const contentHeight=Math.max(1,finish.height-padT-padB-by-measure('border-bottom-width'));
   const naturalRatio=destination.naturalWidth&&destination.naturalHeight
     ?destination.naturalWidth/destination.naturalHeight:start.width/start.height;
   const imageWidth=Math.min(contentWidth,contentHeight*naturalRatio);
   const imageHeight=imageWidth/naturalRatio;
   // The image contains transparent padding: the painted Snounu logo occupies
   // only ~77% of the WebP width and ~64% of its height. Comparing outer
   // element boxes made the handoff appear to SHRINK at the final frame.
   let alpha={left:0,top:0,right:1,bottom:1};
   try{
     const w=Math.min(destination.naturalWidth,600);
     const h=Math.max(1,Math.round(w/destination.naturalWidth*destination.naturalHeight));
     const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
     const ctx=canvas.getContext('2d',{willReadFrequently:true});
     ctx.drawImage(destination,0,0,w,h);
     const data=ctx.getImageData(0,0,w,h).data;
     let left=w,top=h,right=0,bottom=0;
     for(let y=0;y<h;y++)for(let x=0;x<w;x++){
       if(data[(y*w+x)*4+3]>24){
         left=Math.min(left,x);top=Math.min(top,y);
         right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);
       }
     }
     if(right>left&&bottom>top)
       alpha={left:left/w,top:top/h,right:right/w,bottom:bottom/h};
   }catch{ /* Cross-origin custom logos: fall back to the complete image box. */ }
   const view=drawnLogo.viewBox.baseVal;
   let art;
   try{art=drawnLogo.getBBox();}catch{art=null;}
   const svgBounds=art?.width&&art?.height?art:
     {x:view.x,y:view.y,width:view.width,height:view.height};
   const svgVisibleWidth=start.width*svgBounds.width/view.width;
   const svgVisibleHeight=start.height*svgBounds.height/view.height;
   const targetVisibleWidth=imageWidth*(alpha.right-alpha.left);
   const targetVisibleHeight=imageHeight*(alpha.bottom-alpha.top);
   const startCenterX=start.left+start.width/2;
   const startCenterY=start.top+start.height/2;
   const svgArtCenterX=start.left+start.width*(svgBounds.x-view.x+svgBounds.width/2)/view.width;
   const svgArtCenterY=start.top+start.height*(svgBounds.y-view.y+svgBounds.height/2)/view.height;
   const targetArtCenterX=finish.left+bx+padL+(contentWidth-imageWidth)/2+
      imageWidth*(alpha.left+alpha.right)/2;
   const targetArtCenterY=finish.top+by+padT+(contentHeight-imageHeight)/2+
      imageHeight*(alpha.top+alpha.bottom)/2;
   const scale=Math.min(targetVisibleWidth/svgVisibleWidth,targetVisibleHeight/svgVisibleHeight);
   // Transform origin is element center, so compensate for the painted art's
   // own offset within the SVG viewBox when setting the final translation.
   const deltaX=targetArtCenterX-startCenterX-(svgArtCenterX-startCenterX)*scale;
   const deltaY=targetArtCenterY-startCenterY-(svgArtCenterY-startCenterY)*scale;
   const duration=2100,easing='cubic-bezier(.19,.84,.16,1)';
   const endHeaderHeight=header.getBoundingClientRect().height;
   // Keep the SAME already-drawn SVG logo visible throughout the travel.
   // Switching to an <img> at the start caused the previous sudden scale jump.
   Object.assign(drawnLogo.style,{
    position:'fixed',left:start.left+'px',top:start.top+'px',
    width:start.width+'px',height:start.height+'px',maxWidth:'none',
    margin:'0',padding:'0',transform:'none',
    transformOrigin:'center center',transition:'none',
    zIndex:'3',pointerEvents:'none',willChange:'transform'
   });
   const movingCurve=finalWave.cloneNode(true);
   movingCurve.classList.add('loader-curve');
   Object.assign(movingCurve.style,{
    position:'absolute',inset:'0',width:'100%',height:'100%',
    maxWidth:'none',display:'block',zIndex:'0',pointerEvents:'none',
    transform:'none',transition:'none',filter:'none'
   });
   const shape=movingCurve.querySelector('path');
   // Both layouts use the 390 × 112 curved mobile SVG shape.
   const width=390,fullHeight=112;
   const endEdge=87,endControl=122;
   const finalPath=shape.getAttribute('d');
   shape.setAttribute('d',`M0 0H${width}V${fullHeight}Q${width/2} ${fullHeight} 0 ${fullHeight}Z`);
   loader.append(movingCurve);
   destination.style.visibility='hidden';
   loader.style.background='transparent';
   loader.style.transition='none';
   loader.style.borderRadius='0';
   loader.style.height=window.innerHeight+'px';
   // Welcome's real curved shadow is fixed at its FINAL position below the
   // moving yellow field, and is revealed as that field rises past it.
   root.classList.add('loader-morphing');
   root.classList.remove('loading');
   const fly=drawnLogo.animate([
    {transform:'translate3d(0px,0px,0) scale(1)'},
    {transform:`translate3d(${deltaX}px,${deltaY}px,0) scale(${scale})`}
   ],{duration,easing,fill:'forwards'});
   const fold=loader.animate([
    {height:window.innerHeight+'px'},
    {height:endHeaderHeight+'px'}
   ],{duration,easing,fill:'forwards'});
   let pathFrame=0;
   const launched=performance.now();
   const adjustPath=now=>{
    const t=Math.min(1,(now-launched)/duration);
    const eased=1-Math.pow(1-t,3);
    const edge=fullHeight+(endEdge-fullHeight)*eased;
    const control=fullHeight+(endControl-fullHeight)*eased;
    shape.setAttribute('d',`M0 0H${width}V${edge}Q${width/2} ${control} 0 ${edge}Z`);
    if(t<1)pathFrame=requestAnimationFrame(adjustPath);
   };
   pathFrame=requestAnimationFrame(adjustPath);
   activeWelcomeRevealCleanup=()=>{
    cancelAnimationFrame(pathFrame);
    fly.cancel();fold.cancel();
   };
   await Promise.allSettled([fly.finished,fold.finished]);
   // Cancelling Browse must never revive the yellow overlay above the menu.
   if(welcomeRevealCancelled||currentPage()!=='welcome')return;
   activeWelcomeRevealCleanup=null;
   cancelAnimationFrame(pathFrame);
   shape.setAttribute('d',finalPath);
   // Same position and scale at the cut; only the EN/AR button may fade in.
   root.classList.remove('loader-morphing');
   root.classList.add('loader-complete');
   destination.style.removeProperty('visibility');
   loader.style.display='none';
   fly.cancel();fold.cancel();
   root.style.removeProperty('--loader-header-height');
   startWelcomeCarousel();
   return;
  }
 }
 if(welcomeRevealCancelled)return;
 root.classList.remove('loading');
 root.classList.add('loader-complete');
 $('page-loader').style.display='none';
 startWelcomeCarousel();
}
// First-visit test only loads shared menu data and every interactive meal
// image in the first category. No rich CSS/JS or standard-menu cards.
// Use the standard mode after three seconds.
async function chooseFirstVisitMode(initialMenu){
 let timer,timedOut=false,samples=[];
 try{
  const remaining=Math.max(0,3000-(performance.now()-firstVisitStartedAt));
  const deadline=new Promise(resolve=>{timer=setTimeout(()=>{timedOut=true;resolve(false);},remaining);});
  const probe=initialMenu.then(async loaded=>{
   if(timedOut||performance.now()-firstVisitStartedAt>3000||!loaded||!categories.length)return false;
   const firstCategory=categories[0];
   const firstMeals=dishes.filter(meal=>String(meal.category_id)===String(firstCategory.id));
   if(!firstMeals.length)return false;
   const sources=firstMeals.map(meal=>asset(meal.rich_image||meal.image));
   if(sources.some(src=>!src))return false;
   samples=sources.map(src=>{const img=new Image();img.decoding='async';img.src=src;return img;});
   await Promise.all(samples.map(img=>img.decode()));
   return !timedOut&&performance.now()-firstVisitStartedAt<=3000;
  }).catch(()=>false);
  const fast=await Promise.race([probe,deadline]);
  if(!fast){
   timedOut=true;
   for(const img of samples)img.removeAttribute('src');
  }
  richDesired=Boolean(fast);
  firstVisitDecisionComplete=true;
  rememberMode(fast);
  updateRichToggle();
  if(currentPage()==='menu'){void syncRichMode();applyDeepLink();}
  if(!fast&&!dishes.length){
   $('network').hidden=false;
   $('network').textContent=isEnglish()?'Slow connection — loading the standard menu…':'الاتصال بطيء — جاري تحميل المنيو العادي…';
  }
 }finally{clearTimeout(timer);}
}
const initialMenu=load();
(firstVisitModeCheck?chooseFirstVisitMode(initialMenu):initialMenu).finally(revealPage);
/* Install Snounu menu as a standalone home-screen app on phones.
   iOS uses Add to Home Screen; Android supports the native prompt when eligible.
   Installation never affects visitor reporting or dashboard routes. */
function setupMenuInstall(){
 if(isPreview)return;
 const promo=$('install-snounu-promo'),button=$('install-snounu-app'),guide=$('install-guide');
 if(!promo||!button||!guide)return;
 let installPrompt=null,showTimer=0,hideTimer=0;
 const dismissedKey='snounu-install-promo-dismissed-v1';
 const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const mobile=()=>window.matchMedia('(max-width: 980px)').matches;
 const dismissed=()=>{try{return sessionStorage.getItem(dismissedKey)==='yes';}catch{return false;}};
 const markDismissed=()=>{try{sessionStorage.setItem(dismissedKey,'yes');}catch{}};
 const hide=({remember=false}={})=>{
  clearTimeout(showTimer);clearTimeout(hideTimer);
  promo.hidden=true;
  if(remember)markDismissed();
 };
 const updateLanguage=()=>{
  $('install-promo-title').textContent=isEnglish()?'Keep Snounu on your phone!':'خلي منيو سنونو على هاتفك!';
  $('install-promo-subtitle').textContent=isEnglish()?'Open the menu like an app, in one tap.':'افتح المنيو مثل التطبيق، بضغطة واحدة.';
  $('install-app-label').textContent=isEnglish()?'Install the app':'تثبيت التطبيق';
  $('install-promo-close').setAttribute('aria-label',isEnglish()?'Dismiss install offer':'إغلاق إعلان التثبيت');
 };
 // Keep the floating install card eligible during Welcome -> Menu navigation.
 // Early browsing shouldn't cancel a pending offer.
 const eligible=()=>mobile()&&!standalone()&&!dismissed()&&
  (currentPage()==='welcome'||currentPage()==='menu');
 const showWhenReady=(attempt=0)=>{
  if(!eligible())return;
  if(!document.documentElement.classList.contains('loader-complete')){
   if(attempt<8)showTimer=setTimeout(()=>showWhenReady(attempt+1),500);
   return;
  }
  updateLanguage();
  promo.hidden=false;
  // This optional card never traps focus; dismiss automatically after 20 seconds.
  hideTimer=setTimeout(()=>hide({remember:true}),20000);
 };
 // Show once per browser tab, after the welcome animation. Ignore or close it freely.
 // Route changes don't dismiss this offer; its existing 20s timer continues.
 showTimer=setTimeout(()=>showWhenReady(),2100);
 $('install-promo-close').addEventListener('click',()=>hide({remember:true}));
 window.addEventListener('resize',()=>{if(!mobile())hide();},{passive:true});
 window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  installPrompt=event;
  window.__snounuDeferredInstallPrompt=event;
 });
 window.addEventListener('snounu-install-ready',()=>{
  installPrompt=window.__snounuDeferredInstallPrompt;
 });
 // The early listener in the HTML head may have captured the event already.
 installPrompt=window.__snounuDeferredInstallPrompt||installPrompt;
 window.addEventListener('appinstalled',()=>{
  installPrompt=null;
  window.__snounuDeferredInstallPrompt=null;
  hide({remember:true});
 });
 window.matchMedia('(display-mode: standalone)').addEventListener?.('change',()=>{
  if(standalone())hide({remember:true});
 });
 $('install-guide-close').addEventListener('click',()=>guide.close());
 button.addEventListener('click',async()=>{
  if(standalone()){hide({remember:true});return;}
  // Modern Chromium can install the linked app directly on a user gesture.
  // Fall back to the legacy beforeinstallprompt event where unsupported.
  if(typeof navigator.install==='function'){
   try{
    await navigator.install();
    hide({remember:true});
    return;
   }catch(error){
    if(error?.name==='AbortError'){hide({remember:true});return;}
    // Only use older Chrome's prompt if the new API cannot start.
    console.info('Direct Snounu install unavailable:',error?.name||error);
   }
  }
  const prompt=installPrompt||window.__snounuDeferredInstallPrompt;
  if(prompt){
   installPrompt=null;window.__snounuDeferredInstallPrompt=null;
   try{
    await prompt.prompt();
    const choice=await prompt.userChoice;
    // The browser decides whether installation was accepted or dismissed.
    hide({remember:true});
   }catch(error){console.info('Snounu native install prompt unavailable:',error);}
   return;
  }
  // No browser-controlled install API was offered. A website cannot
  // manufacture Chrome's system dialog; retain the optional instructions.
  const iOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||
    (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  $('install-guide-title').textContent=isEnglish()?'Install Snounu':'تثبيت منيو سنونو';
  $('install-guide-body').textContent=iOS
    ?(isEnglish()?'Tap Share in Safari, then Add to Home Screen.':'اضغط على زر المشاركة في سفاري، ثم اختر «إضافة إلى الشاشة الرئيسية».')
    :(isEnglish()?'Open your browser menu (⋮) and choose Install app or Add to Home Screen.':'افتح قائمة المتصفح (⋮)، ثم اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».');
  $('install-guide-close').textContent=isEnglish()?'Got it':'تمام';
  if(typeof guide.showModal==='function')guide.showModal();
  else alert($('install-guide-body').textContent);
 });
 if('serviceWorker' in navigator&&window.isSecureContext){
  navigator.serviceWorker.register('/sw.js',{scope:'/'})
   .catch(error=>console.warn('Snounu install service worker:',error));
 }
}
setupMenuInstall();

