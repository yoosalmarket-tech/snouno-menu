/* Opt-in immersive Snounu menu: spring inertia, horizontal 3D dish feed,
   swipe-driven category transitions, and a perspective thumbnail rail. */
import {handleYoosalCreditClick} from './credit-bell.js?v=3';
const mk=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!=null)e.textContent=String(value);return e;};
const at=(root,selector)=>root.querySelector(selector);
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const validImage=value=>{if(!value)return '';try{const u=new URL(value,location.origin);return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}};
const categoryWords=name=>{const a=String(name||'SNOUNU').trim().split(/\s+/);return [a.slice(0,Math.ceil(a.length/2)).join(' '),a.slice(Math.ceil(a.length/2)).join(' ')]};
export function createRichMenu({configureMeal,host,getData,onOpen,onRestaurantInfo,onFavorite,onExit,onSelection,onShare,onMealView}){
 const root=mk('div','rm-app');root.dir='ltr';root.id='rich-interactive-stage';
 root.innerHTML=[
 '<div class="rm-top"><svg class="rm-band" viewBox="0 0 390 66" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 H390 V48 Q195 75 0 48 Z" fill="#FDBE2D"/></svg>',
 '<span class="rm-top-caption" lang="en">SNOUNU / INTERACTIVE</span><a class="rm-top-logo-home" href="/welcome" data-page="welcome" aria-label="العودة إلى شاشة ترحيب سنونو" title="العودة إلى شاشة الترحيب"><img class="rm-top-logo" src="/assets/logo.webp" alt="مطعم سنونو"></a></div>',
 '<nav class="rm-categories" aria-label="تصنيفات الأطباق"><div class="rm-categories-header">',
 '<div class="rm-categories-label"><strong lang="en">CATEGORIES</strong><span dir="rtl">التصنيفات</span></div>',
 '<div class="rm-categories-controls"><button class="rm-category-previous" type="button" aria-label="الصنف السابق">←</button>',
 '<b class="rm-categories-count" dir="ltr">1 / 1</b><button class="rm-category-next" type="button" aria-label="الصنف التالي">→</button></div></div>',
 '<div class="rm-categories-track" role="tablist"></div></nav>',
 '<div class="rm-stage-wrap"><div class="rm-stage-word" aria-hidden="true"><span></span><span></span></div>',
 '<div class="rm-shadow" aria-hidden="true"></div><div class="rm-stage" role="listbox" tabindex="0"></div>',
 // Desktop-only navigation buttons live outside the draggable carousel surface.
 '<button class="rm-meal-nav rm-meal-nav-prev" type="button" aria-label="الوجبة السابقة" data-track-action="meal_previous"><span aria-hidden="true">←</span><span dir="rtl">السابقة</span></button>',
 '<button class="rm-meal-nav rm-meal-nav-next" type="button" aria-label="الوجبة التالية" data-track-action="meal_next"><span dir="rtl">التالية</span><span aria-hidden="true">→</span></button>',
 '</div>',
 // The entire sidebar is a sibling of the 3D scene, not its descendant.
 '<aside class="rm-thumbs" aria-label="اختيار وجبة"><button type="button" class="rm-rail-button rm-rail-previous" aria-label="السابق">←</button>',
 '<div class="rm-rail-row"><div class="rm-rail-window"><div class="rm-rail-track"></div></div></div><button type="button" class="rm-rail-button rm-rail-next" aria-label="التالي">→</button>',
 '<span class="rm-rail-count" dir="ltr">1 / 1</span></aside>',
 '<section class="rm-info" aria-live="polite">',
 // ORDER NOW stays above the rating; both continue to track the selected meal.
 '<div class="rm-order-wrap"><button type="button" class="rm-customize" dir="rtl" aria-label="اطلب الآن"><span class="rm-order-ar" dir="rtl">اطلب الآن</span><svg class="rm-order-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.1 12H6.1L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/><path d="M9 14h6"/></svg><strong class="rm-order-en" lang="en" dir="ltr">ORDER NOW</strong></button></div>',
 '<span class="rm-info-rating" dir="ltr" hidden></span>',
 // Center meal copy as a group between the rating and the bottom action.
 '<div class="rm-meal-copy"><h2 class="rm-info-name"></h2><span class="rm-availability" hidden></span><p class="rm-info-desc"></p><span class="rm-info-price" dir="ltr"></span></div>',
 '<div class="rm-info-actions">',
 '<button type="button" class="rm-info-details">◷ مواعيد ومعلومات المطعم</button>',
 '<button type="button" class="rm-info-fav" aria-pressed="false" aria-label="المفضلة">♡</button></div>',
 '<p class="rm-closure-note" role="status"><span class="rm-closure-mark" aria-hidden="true">◷</span><span class="rm-closure-note-copy"></span></p>',
 '</section>',
 '<footer class="rm-interactive-credit" aria-label="حقوق تصميم المنيو">',
 '<button type="button" class="rm-interactive-credit-link" aria-label="زيارة موقع وكالة يوصل">تصميم <strong>وكالة يوصل</strong> لتسويق المطاعم</button></footer>'
 ].join('');
 const share=mk('button','rm-share');
 share.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 13.5 6.6 4M15.3 6.5l-6.6 4"/></svg>';
 share.type='button';share.id='rich-share-meal';share.dataset.trackAction='share_meal_click';
 share.setAttribute('aria-label','مشاركة الوجبة');
 at(root,'.rm-info-actions').insertBefore(share,at(root,'.rm-info-fav'));
 host.replaceChildren(root);
 // A non-modal way out if the currently selected meal photo stalls.
 const networkNotice=mk('div','rm-network-notice');
 networkNotice.hidden=true;
 networkNotice.setAttribute('role','status');
 const noticeCopy=mk('span','rm-network-copy');
 const noticeSwitch=mk('button','rm-network-switch');
 noticeSwitch.type='button';noticeSwitch.dataset.trackAction='rich_slow_switch_to_standard';
 noticeSwitch.onclick=()=>{networkNotice.hidden=true;onExit?.();};
 const noticeClose=mk('button','rm-network-close','×');
 noticeClose.type='button';noticeClose.setAttribute('aria-label','إغلاق التنبيه');
 networkNotice.append(noticeCopy,noticeSwitch,noticeClose);root.append(networkNotice);
 const u={
  stage:at(root,'.rm-stage'),wrap:at(root,'.rm-stage-wrap'),
  mealPrev:at(root,'.rm-meal-nav-prev'),mealNext:at(root,'.rm-meal-nav-next'),
  logo:at(root,'.rm-top-logo'),word:at(root,'.rm-stage-word'),
  shadow:at(root,'.rm-shadow'),categories:at(root,'.rm-categories-track'),
  catCount:at(root,'.rm-categories-count'),
  catPrev:at(root,'.rm-category-previous'),catNext:at(root,'.rm-category-next'),
  thumbWindow:at(root,'.rm-rail-window'),thumbTrack:at(root,'.rm-rail-track'),
  railCount:at(root,'.rm-rail-count'),
  railUp:at(root,'.rm-rail-previous'),railDown:at(root,'.rm-rail-next'),
  info:at(root,'.rm-info'),orderWrap:at(root,'.rm-order-wrap'),rating:at(root,'.rm-info-rating'),title:at(root,'.rm-info-name'),
  availability:at(root,'.rm-availability'),closureNote:at(root,'.rm-closure-note'),
  desc:at(root,'.rm-info-desc'),price:at(root,'.rm-info-price'),
  details:at(root,'.rm-info-details'),share:at(root,'.rm-share'),fav:at(root,'.rm-info-fav'),
  customize:at(root,'.rm-customize')
 };
 // Anchor the horizontal selector below categories, outside the animated scene.
 root.insertBefore(at(root,'.rm-thumbs'),u.wrap);
 // First click turns the agency name orange; second click opens Yoosal with the bell.
 const creditButton=at(root,'.rm-interactive-credit-link');
 creditButton.addEventListener('click',handleYoosalCreditClick);
 let groups=[],groupIndex=0,front=0,k=2.2,target=0,velocity=-.02;
 let active=false,frame=0,lastTime=0,pointer=null,lastWheel=-Infinity,wheelAxis=null,wheelHandled=false,wheelDistance=0,swapping=false,swapToken=0;
 let motionDirection=1,visualDirection=1;
 let dishesEls=[],thumbEls=[],categoryEls=[],snapshot={},destroyed=false;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
 let networkDegraded=false,noticeDismissed=false,imageWatchTimer=0,networkCautionTimer=0;
 let watchedPhoto=null,watchedLoad=null,watchedError=null;
 const constrainedNetwork=()=>networkDegraded||navigator.onLine===false||
  connection?.saveData===true||/^(slow-2g|2g)$/.test(connection?.effectiveType||'');
 const updateNoticeLanguage=()=>{
  const english=isEnglish();
  noticeCopy.textContent=english?'Images are taking longer than expected. Try the standard menu?':'تحميل صور الوجبات بطيء. هل تفضّل المنيو العادي؟';
  noticeSwitch.textContent=english?'Switch to standard menu':'الانتقال للمنيو العادي';
  noticeClose.setAttribute('aria-label',english?'Dismiss message':'إغلاق التنبيه');
 };
 noticeClose.onclick=()=>{noticeDismissed=true;networkNotice.hidden=true;};
 const offerStandardMenu=()=>{
  networkDegraded=true;
  if(!active||destroyed||noticeDismissed)return;
  updateNoticeLanguage();networkNotice.hidden=false;
 };
 function stopImageWatch(){
  clearTimeout(imageWatchTimer);clearTimeout(networkCautionTimer);
  if(watchedPhoto){
   watchedPhoto.removeEventListener('load',watchedLoad);
   watchedPhoto.removeEventListener('error',watchedError);
  }
  watchedPhoto=watchedLoad=watchedError=null;
 }
 // Only the selected category exists in the DOM, and only nearby dishes
 // receive src attributes. Never prefetch unopened categories.
 function loadNearbyImages(center=front){
  const limited=constrainedNetwork(),radius=limited?1:2;
  for(let i=0;i<dishesEls.length;i++){
   if(Math.abs(i-center)>radius)continue;
   const img=dishesEls[i].querySelector('img.rm-dish-photo');
   if(img?.dataset.src&&!img.hasAttribute('src')){
    img.loading=Math.abs(i-center)<=1?'eager':'lazy';
    img.src=img.dataset.src;
   }
  }
  const start=clamp(center-1,0,Math.max(0,thumbEls.length-3));
  for(let i=start;i<Math.min(start+3,thumbEls.length);i++){
   if(limited&&i!==center)continue;
   const img=thumbEls[i].querySelector('img');
   if(img?.dataset.src&&!img.hasAttribute('src'))img.src=img.dataset.src;
  }
 }
 function watchSelectedImage(){
  stopImageWatch();
  if(!active||destroyed)return;
  loadNearbyImages();
  const photo=dishesEls[front]?.querySelector('img.rm-dish-photo');
  if(!photo||!photo.hasAttribute('src'))return;
  if(photo.complete&&photo.naturalWidth>0){networkNotice.hidden=true;return;}
  if(photo.complete&&photo.naturalWidth===0){offerStandardMenu();return;}
  watchedPhoto=photo;
  watchedLoad=()=>{stopImageWatch();networkNotice.hidden=true;};
  watchedError=()=>{stopImageWatch();offerStandardMenu();};
  photo.addEventListener('load',watchedLoad,{once:true});
  photo.addEventListener('error',watchedError,{once:true});
  networkCautionTimer=setTimeout(()=>{networkDegraded=true;},2500);
  imageWatchTimer=setTimeout(()=>{stopImageWatch();offerStandardMenu();},6000);
 }
 const handleNetworkChange=()=>{
  if(constrainedNetwork()){networkDegraded=true;if(navigator.onLine===false)offerStandardMenu();}
 };
 window.addEventListener('offline',handleNetworkChange);
 connection?.addEventListener?.('change',handleNetworkChange);
 const group=()=>groups[groupIndex];
 const dish=()=>group()?.items[front];
 const getName=d=>snapshot.displayName?.(d)||d.name;
 const getDescription=d=>snapshot.displayDescription?.(d)||d.description||'';
 const isEnglish=()=>snapshot.lang==='en';
 const focusCategory=()=>{
  const selected=categoryEls[groupIndex];if(!selected)return;
  const r=selected.getBoundingClientRect(),p=u.categories.getBoundingClientRect();
  const vertical=getComputedStyle(u.categories).flexDirection==='column';
  u.categories.scrollBy(vertical
   ? {top:r.top+r.height/2-p.top-p.height/2,behavior:reduced.matches?'instant':'smooth'}
   : {left:r.left+r.width/2-p.left-p.width/2,behavior:reduced.matches?'instant':'smooth'});
 };
 function drawCategoryTabs(){
  u.categories.replaceChildren();categoryEls=[];
  groups.forEach((g,i)=>{
   const button=mk('button','rm-cat');button.type='button';button.setAttribute('role','tab');
   button.id='rich-category-'+g.id;button.dataset.categoryId=String(g.id);
   button.dataset.trackAction='category_select';
   button.dataset.permalink='/menu?category='+encodeURIComponent(g.id)+'&mode=interactive';
   button.setAttribute('aria-label',g.name);
   // Restore the original bilingual category buttons in the top navigation.
   button.append(mk('strong',null,g.english||g.name),mk('span',null,g.name));
   button.addEventListener('click',()=>changeGroup(i));
   categoryEls.push(button);u.categories.append(button);
  });selectCategoryTab();
 }
 function selectCategoryTab(){
  u.catCount.textContent=groups.length?(groupIndex+1)+' / '+groups.length:'0 / 0';
  categoryEls.forEach((el,i)=>el.setAttribute('aria-selected',String(i===groupIndex)));
  // Both controls can wrap; only disable when there is no other category.
  u.catPrev.disabled=groups.length<=1;u.catNext.disabled=groups.length<=1;
  focusCategory();
 }
 function paintStage(){
  const g=group();
  dishesEls=[];thumbEls=[];
  u.stage.replaceChildren();u.thumbTrack.replaceChildren();
  if(!g)return;
  const words=categoryWords(g.english||g.name);
  u.word.children[0].textContent=words[0];
  u.word.children[1].textContent=words[1];
  u.stage.setAttribute('aria-label',g.name);
  g.items.forEach((meal,i)=>{
   const frame=mk('div','rm-dish');
   frame.id='rich-meal-'+meal.id;frame.dataset.mealId=String(meal.id);
   frame.dataset.unavailable=String(meal.available===false);
   frame.dataset.categoryId=String(g.id);
   frame.dataset.idx=String(i);frame.setAttribute('role','option');
   frame.setAttribute('aria-label',getName(meal)+(meal.available===false?' — غير متوفر':''));frame.tabIndex=-1;
   frame.append(mk('div','rm-dish-shadow'));
   const photo=validImage(meal.rich_image)||validImage(meal.image);
   if(photo){
    const image=mk('img','rm-dish-photo');image.dataset.src=photo;
    image.alt=meal.seo_alt||getName(meal);image.draggable=false;image.decoding='async';
    image.loading='lazy';frame.append(image);
   }else{
    const empty=mk('div','rm-dish-photo','🍽');
    empty.style.cssText='display:grid;place-items:center;font-size:76px;color:#FDBE2D';
    frame.append(empty);
   }
   if(meal.badge){
    const badge=mk('div','rm-dish-badge',meal.badge);
    const px=clamp(Number(meal.rich_badge_x??77),5,95);
    const py=clamp(Number(meal.rich_badge_y??36),5,95);
    badge.style.setProperty('--rich-badge-x',px+'%');
    badge.style.setProperty('--rich-badge-y',py+'%');
    frame.append(badge);
   }
   const smoke=mk('div','rm-dish-steam');smoke.setAttribute('aria-hidden','true');
   for(let n=0;n<4;n++)smoke.append(mk('i'));
   frame.append(smoke);u.stage.append(frame);dishesEls.push(frame);
   const thumbnail=mk('button','rm-thumb');thumbnail.type='button';
   thumbnail.id='rich-thumb-'+meal.id;
   thumbnail.dataset.mealId=String(meal.id);thumbnail.dataset.categoryId=String(g.id);
   thumbnail.dataset.unavailable=String(meal.available===false);
   thumbnail.dataset.trackAction='meal_select';
   thumbnail.title=getName(meal)+(meal.available===false?' — غير متوفر':'');thumbnail.setAttribute('aria-label',thumbnail.title);
   if(photo){const img=mk('img');img.dataset.src=photo;img.alt='';img.loading='lazy';img.draggable=false;thumbnail.append(img);}
   else thumbnail.textContent='•';
   const label=mk('span','rm-thumb-name',getName(meal));label.dir=isEnglish()?'ltr':'rtl';
   thumbnail.append(label);
   thumbnail.addEventListener('click',()=>goTo(i));
   u.thumbTrack.append(thumbnail);thumbEls.push(thumbnail);
  });
 }
 function labelRail(){
  const g=group();if(!g)return;
  const start=clamp(front-1,0,Math.max(0,g.items.length-3));
  thumbEls.forEach((el,i)=>{
   const visible=i>=start&&i<start+3;
   el.hidden=!visible;el.style.display=visible?'grid':'none';
   el.setAttribute('aria-current',String(i===front));
  });
  u.railCount.textContent=(front+1)+' / '+g.items.length;
  u.stage.setAttribute('aria-activedescendant',dishesEls[front]?.id||'');
 }
 let viewTimer,viewCandidate=null;
 function trackVisibleMeal(){
  const meal=active?dish():null;
  if(viewCandidate===meal?.id)return;
  clearTimeout(viewTimer);
  viewCandidate=meal?.id;
  if(meal)viewTimer=setTimeout(()=>{
   if(active&&!document.hidden&&dish()?.id===meal.id)onMealView?.(meal);
   else viewCandidate=null;
  },500);
 }
 function info(){
  trackVisibleMeal();
  const m=dish();if(!m)return;
  u.title.textContent=getName(m);
  const unavailable=m.available===false;
  u.availability.hidden=!unavailable;
  u.availability.textContent=unavailable?(isEnglish()?'Sold out':'نفدت الكمية'):'';
  at(u.closureNote,'.rm-closure-note-copy').textContent=isEnglish()
   ?'Restaurant currently closed. Browse the menu and come back when we reopen!'
   :'المطعم مغلق حالياً · تقدر تتصفح وجباتنا ونستناك وقت الافتتاح!';
  u.closureNote.dir=isEnglish()?'ltr':'rtl';
  u.fav.dataset.mealId=String(m.id);u.share.dataset.mealId=String(m.id);
  u.customize.dataset.mealId=String(m.id);
  u.share.title=isEnglish()?'Share meal':'مشاركة الوجبة';
  const ratingValue=m.rating==null||m.rating===''?NaN:Number(m.rating);
  const hasRating=Number.isFinite(ratingValue)&&ratingValue>=0&&ratingValue<=5;
  u.rating.hidden=!hasRating;
  u.rating.textContent=hasRating?'★ '+ratingValue.toFixed(1):'';
  if(hasRating)u.rating.setAttribute('aria-label',(isEnglish()?'Rating ':'التقييم ')+ratingValue.toFixed(1)+' / 5');
  u.desc.textContent=getDescription(m)||m.ingredients||(isEnglish()?'Discover Snounu favourites':'اختار وجبتك المفضلة من سنونو');
  const price=m.price==null||m.price===''?NaN:Number(m.price);
  const oldPrice=m.old_price==null||m.old_price===''?NaN:Number(m.old_price);
  const formatPrice=value=>value.toLocaleString('en-US',{maximumFractionDigits:2})+' ₪';
  u.price.replaceChildren();
  if(Number.isFinite(price)){
   u.price.append(mk('span','rm-current-price',formatPrice(price)));
   // A previous price may be lower (increase) or higher (discount).
   if(Number.isFinite(oldPrice)&&oldPrice!==price){
    const old=mk('del','rm-old-price',formatPrice(oldPrice));
    old.title='السعر السابق';
    old.setAttribute('aria-label','السعر السابق '+formatPrice(oldPrice));
    u.price.append(old);
   }
  }
  u.details.textContent=isEnglish()?'◷ OPENING HOURS & CONTACT':'◷ مواعيد ومعلومات المطعم';
  u.details.disabled=false;
  at(u.customize,'.rm-order-en').textContent=unavailable?'UNAVAILABLE':'ORDER NOW';
  at(u.customize,'.rm-order-ar').textContent=unavailable?'غير متوفر':'اطلب الآن';
  u.customize.disabled=unavailable;
  u.customize.setAttribute('aria-label',unavailable
   ?(isEnglish()?'Currently unavailable':'غير متوفر حالياً')
   :(isEnglish()?'Order now':'اطلب الآن'));
  const saved=!!snapshot.favorites?.has(m.id);
  u.fav.textContent=saved?'♥':'♡';u.fav.setAttribute('aria-pressed',String(saved));
  u.fav.setAttribute('aria-label',saved?'إزالة من المفضلة':'إضافة إلى المفضلة');
  labelRail();
  updateNoticeLanguage();
  loadNearbyImages();
  watchSelectedImage();
 }
 function updateFront(index){
  const g=group();if(!g)return;
  const next=clamp(index,0,g.items.length-1);
  if(next===front)return;
  front=next;info();
  // The order action follows the selected meal, rating, name and price.
  // Contact and favorite controls stay steady during dish swipes.
  for(const el of [u.orderWrap,u.rating,u.title,u.desc,u.price]){
   if(!reduced.matches)el.animate?.([{opacity:.75,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:230,easing:'cubic-bezier(.28,.8,.2,1)'});
  }
 }
 function draw(){
  const g=group();if(!g)return;
  const len=g.items.length;
  const height=u.wrap.clientHeight,width=u.wrap.clientWidth;
  // Keep adjacent meals within the showroom. Both sides use one mirrored
  // entry/exit path instead of throwing an outgoing plate toward the camera.
  const desktop=window.matchMedia('(min-width:981px)').matches;
  // More space between neighboring plates (about 30-40% farther apart).
  // Keep the same mirrored depth, opacity, spring physics and edge bounce.
  // Desktop side plates sit farther out; the central plate keeps its full size.
  const sideRoom=desktop?clamp(width*.50,160,305):clamp(width*.44,92,255);
  const availableHeight=desktop?Math.max(160,height-120):Math.max(180,height);
  const scale=clamp(availableHeight/340,availableHeight<230?.53:.62,1.1)*(desktop?1.04:.96);
  for(let i=0;i<dishesEls.length;i++){
   const el=dishesEls[i],dif=i-k;
   el.setAttribute('aria-selected',String(i===front));
   if(Math.abs(dif)>3.1){el.style.visibility='hidden';el.style.pointerEvents='none';continue;}
   el.style.visibility='visible';
   const distance=Math.abs(dif);
   // Symmetric in both swipe directions; transform stays continuous on reversal.
   const x=Math.sign(dif)*Math.min(distance,1.15)*sideRoom;
   const y=Math.min(distance,2.5)*(desktop?34:22);
   const z=-Math.min(distance,3)*(desktop?270:240);
   const rotateY=Math.sign(dif)*Math.min(distance,1.5)*9;
   const rotateZ=-Math.sign(dif)*Math.min(distance,2)*2.8;
   const opacity=distance<=1?1-distance*.30:distance<=2?.70-(distance-1)*.42:Math.max(0,.28-(distance-2)*.28);
   const rotX=clamp(-velocity*25,-8,8);
   // A subtle continuous shrink prevents desktop side plates from masking
   // each other or the center plate. Mobile scaling remains untouched.
   const mealScale=desktop?scale*(1-.20*Math.min(distance,1)):scale;
   el.style.transform='translate(-50%,0) translate3d('+x.toFixed(1)+'px,'+y.toFixed(1)+'px,'+z.toFixed(1)+'px) rotateX('+rotX.toFixed(2)+'deg) rotateY('+rotateY.toFixed(2)+'deg) rotateZ('+rotateZ.toFixed(2)+'deg) scale('+mealScale.toFixed(3)+')';
   el.style.opacity=opacity.toFixed(3);
   // Transparent outgoing dishes must not intercept taps on the centered dish.
   el.style.pointerEvents=opacity>.35?'auto':'none';
   el.style.zIndex=String(Math.round(1000+z*.1));
  }
  // Keep the name, rating and price steady while food bounces at an edge.
  const infoPosition=clamp(k,0,len-1);
  const fade=Math.min(1,Math.abs(infoPosition-Math.round(infoPosition))*2.6);
  for(const el of [u.orderWrap,u.rating,u.title,u.desc,u.price]){
   el.style.opacity=(1-fade).toFixed(3);
   el.style.transform='translateY('+(fade*12).toFixed(1)+'px)';
  }
  const pulse=Math.min(Math.abs(velocity),.4);
  u.shadow.style.transform='translateX(-50%) scale('+(1+pulse*.15).toFixed(3)+','+(1-pulse*.1).toFixed(3)+')';
 }
 function tick(now){
  if(!active||destroyed){frame=0;return;}
  const dt=clamp((now-(lastTime||now))/16.67,.5,3);lastTime=now;
  visualDirection+=(motionDirection-visualDirection)*(1-Math.pow(.78,dt));
  if(!pointer||pointer.axis!=='x'){
   velocity+=(target-k)*.07*dt;
   velocity*=Math.pow(.8,dt);
   k+=velocity*dt;
   // Permit a small elastic overshoot; the existing spring settles back
   // to the valid target. Sidebar and controls never use this offset.
   const maxIndex=Math.max(0,(group()?.items.length||1)-1);
   const overshootLimit=.42;
   if(k< -overshootLimit){k=-overshootLimit;velocity=Math.max(0,velocity);}
   if(k>maxIndex+overshootLimit){k=maxIndex+overshootLimit;velocity=Math.min(0,velocity);}
  }
  const g=group();
  if(g){
   const rounded=clamp(Math.round(k),0,g.items.length-1);
   if(rounded!==front)updateFront(rounded);
   draw();
  }
  frame=requestAnimationFrame(tick);
 }
 function goTo(index){
  const g=group();if(!g||swapping||pointer)return;
  const next=clamp(index,0,g.items.length-1);
  if(Math.abs(next-k)>.001)motionDirection=Math.sign(next-k);
  const changed=next!==target;target=next;
  if(changed)loadNearbyImages(next);
  if(changed)resetEdgeSwipes();
  if(changed&&typeof onSelection==='function')onSelection({mealId:g.items[target]?.id,categoryId:g.id});
  if(reduced.matches){k=target;velocity=0;updateFront(target);draw();}
 }
 // Count consecutive outward swipes only when the selected meal is
 // already at a category boundary. Normal navigation resets the sequence.
 let edgeSwipeCount=0,edgeSwipeDirection=0,edgeSwipeGroup=null;
 function resetEdgeSwipes(){
  edgeSwipeCount=0;edgeSwipeDirection=0;edgeSwipeGroup=null;
 }
 function recordEdgeSwipe(direction){
  const current=group(),last=(current?.items.length||0)-1;
  if(!current||groups.length<=1||front!==(direction>0?last:0)||
     target!==(direction>0?last:0)){
   resetEdgeSwipes();return false;
  }
  if(edgeSwipeDirection!==direction||edgeSwipeGroup!==current.id){
   edgeSwipeCount=0;
  }
  edgeSwipeDirection=direction;edgeSwipeGroup=current.id;
  edgeSwipeCount++;
  if(edgeSwipeCount<3)return false;
  resetEdgeSwipes();
  // The existing changeGroup() wraps first and last categories.
  void changeGroup(groupIndex+direction);
  return true;
 }
 const step=(delta,{swipe=false}={})=>{
  if(swapping||pointer||!active)return;
  motionDirection=Math.sign(delta);
  const maxIndex=(group()?.items.length||1)-1;
  const next=Math.round(target)+delta;
  if(next<0||next>maxIndex){
   // Trackpad swipes count; regular navigation buttons retain their bounce.
   if(swipe&&recordEdgeSwipe(Math.sign(delta)))return;
   if(!swipe)resetEdgeSwipes();
   // First and second outward swipes retain the existing edge bounce.
   if(!reduced.matches&&active&&!swapping&&!pointer){
    target=next<0?0:maxIndex;
    velocity=next<0?-.12:.12;
   }
   return;
  }
  goTo(next);
 };
 async function changeGroup(index){
  if(swapping||pointer||destroyed||groups.length<=1||!Number.isInteger(index))return;
  // Normalize requested category to the circular index. Keep the original
  // movement direction from the unwrapped request for the transition.
  const nextIndex=((index%groups.length)+groups.length)%groups.length;
  if(nextIndex===groupIndex)return;
  resetEdgeSwipes();
  swapping=true;clearTimeout(viewTimer);viewCandidate=null;
  target=front;k=front;velocity=0;
  const serial=++swapToken,direction=index>groupIndex?1:-1;
  root.style.setProperty('--rm-shift-out',-direction*115+'px');
  root.style.setProperty('--rm-shift-in',direction*125+'px');
  root.classList.remove('rm-category-in');root.classList.add('rm-category-out');
  await new Promise(r=>setTimeout(r,reduced.matches?0:220));
  if(serial!==swapToken||destroyed)return;
  groupIndex=nextIndex;front=0;k=0;target=0;velocity=0;motionDirection=visualDirection=1;
  paintStage();info();selectCategoryTab();draw();
  root.classList.remove('rm-category-out');root.classList.add('rm-category-in');
  await new Promise(r=>setTimeout(r,reduced.matches?0:550));
  if(serial!==swapToken||destroyed)return;
  root.classList.remove('rm-category-in');swapping=false;
  if(typeof onSelection==='function')onSelection({categoryId:group()?.id});
 }
 function pointerDown(event){
  if(event.button!==0||swapping||!active||pointer||document.querySelector('dialog[open]')||event.isPrimary===false)return;
  const fromInfo=event.currentTarget===u.info;
  // Controls on the information panel must remain ordinary, clickable buttons.
  // Dragging on its text, price, rating or blank space uses the same physics
  // as dragging a food image; no separate swipe simulation is introduced.
  if(fromInfo&&event.target.closest('button,a,input,textarea,select,[role="button"]'))return;
  const el=fromInfo?null:event.target.closest('.rm-dish');
  pointer={id:event.pointerId,x:event.clientX,y:event.clientY,lastT:performance.now(),
   startK:k,startFront:front,startTarget:target,axis:null,index:el?Number(el.dataset.idx):null,
   source:fromInfo?'info':'stage',captureTarget:event.currentTarget};
  if(!fromInfo)u.stage.focus({preventScroll:true});
  event.currentTarget.setPointerCapture?.(event.pointerId);
 }
 function pointerMove(event){
  const p=pointer;if(!p||event.pointerId!==p.id)return;
  const dx=event.clientX-p.x,dy=event.clientY-p.y;
  if(!p.axis){
   if(Math.hypot(dx,dy)<8)return;
   p.axis=Math.abs(dy)>Math.abs(dx)?'y':'x';
  }
  if(p.axis==='x'){
   const len=group()?.items.length||1,maxIndex=len-1;
   const raw=p.startK-dx/160;
   // Resist motion beyond either edge, but allow a bounded elastic stretch.
   const elastic=raw<0?raw*.32:raw>maxIndex?maxIndex+(raw-maxIndex)*.32:raw;
   const value=clamp(elastic,-.42,maxIndex+.42);
   const now=performance.now(),dt=Math.max((now-p.lastT)/16.67,.5);
   velocity=velocity*.5+(value-k)/dt*.5;
   if(Math.abs(value-k)>.001)motionDirection=Math.sign(value-k);
   k=value;p.lastT=now;
  }
 }
 // On desktop, transparent padding of the foreground PNG can intercept a
 // visible neighboring plate. Use the pointer's position within that plate
 // to resolve the intended meal before deciding whether to open a popup.
 function desktopAdjacentHit(clientX,clientY,clickedIndex){
  if(!window.matchMedia('(min-width:981px)').matches)return clickedIndex;
  const bounds=u.stage.getBoundingClientRect();
  const offset=(clientX-bounds.left)/Math.max(bounds.width,1);
  const direction=offset<.36?-1:offset>.64?1:0;
  if(!direction)return clickedIndex;
  const candidate=front+direction;
  if(candidate<0||candidate>=(group()?.items.length||0))return clickedIndex;
  const side=dishesEls[candidate];
  if(!side||side.style.visibility==='hidden'||Number(side.style.opacity)<.35)return clickedIndex;
  const rect=side.getBoundingClientRect();
  if(clientX>=rect.left&&clientX<=rect.right&&clientY>=rect.top&&clientY<=rect.bottom)
   return candidate;
  return clickedIndex;
 }
 function pointerUp(event){
  const p=pointer;if(!p||event.pointerId!==p.id)return;
  pointer=null;
  const capture=p.captureTarget||u.stage;
  if(capture.hasPointerCapture?.(event.pointerId))capture.releasePointerCapture(event.pointerId);
  if(p.axis==='x'){
   const dx=event.clientX-p.x;
   if(Math.abs(dx)>=45){
    // Swiping left advances a meal; swiping right moves back.
    const direction=dx<0?1:-1,last=(group()?.items.length||1)-1;
    const boundary=direction>0?last:0;
    if(p.startFront===boundary&&p.startTarget===boundary){
     if(recordEdgeSwipe(direction))return;
    }else resetEdgeSwipes();
   }
   goTo(Math.round(k+velocity*7));
  }else if(p.axis==='y'){
   const delta=event.clientY-p.y;
   // Mobile: swipe up advances, swipe down goes back; desktop gesture stays as before.
   // changeGroup handles wrapping at the first and last categories.
   if(Math.abs(delta)>50){
    const mobile=window.matchMedia('(max-width:980px)').matches;
    changeGroup(groupIndex+(mobile?(delta<0?1:-1):(delta<0?-1:1)));
   }
  }else if(p.source==='info'){
   // A tap on meal information opens the same meal-specific ordering sheet
   // as ORDER NOW. Gestures are handled above and action buttons never
   // start a pointer gesture, so swiping or tapping them won't open it.
   if(dish())scheduleMealOpen(dish());
  }else{
   const index=desktopAdjacentHit(event.clientX,event.clientY,p.index);
   const selected=index==null?null:group()?.items[index];
   if(selected){
    const wasFront=index===front;
    goTo(index);
    if(wasFront)scheduleMealOpen(selected);
   }
  }
 }
 function cancelPointer(){
  const p=pointer;if(!p)return;
  pointer=null;
  const capture=p.captureTarget||u.stage;
  if(capture.hasPointerCapture?.(p.id))capture.releasePointerCapture(p.id);
  if(p.axis==='x')goTo(Math.round(k));
 }
 function wheel(event){
  if(!active||pointer||document.querySelector('dialog[open]')||event.ctrlKey)return;
  const now=performance.now(),dx=event.deltaX,dy=event.deltaY;
  if(!dx&&!dy)return;
  // A wheel burst (including its inertial tail) owns one axis and one action.
  if(now-lastWheel>260){wheelAxis=null;wheelHandled=false;wheelDistance=0;}
  lastWheel=now;
  if(!wheelAxis)wheelAxis=Math.abs(dx)>Math.abs(dy)?'x':'y';
  const delta=wheelAxis==='x'?dx:dy;
  // Let the wheel reach the opposite end; one gesture still moves once.
  event.preventDefault();
  if(swapping){wheelHandled=true;return;}
  if(wheelHandled)return;
  wheelDistance+=(wheelAxis==='x'?dx:dy)*(event.deltaMode===1?16:event.deltaMode===2?u.wrap.clientHeight:1);
  if(Math.abs(wheelDistance)<8)return;
  wheelHandled=true;
  if(wheelAxis==='x')step(wheelDistance>0?1:-1,{swipe:true});
  else changeGroup(groupIndex+(wheelDistance>0?1:-1));
 }
 function key(event){
  if(!active||document.querySelector('dialog[open]')||document.activeElement?.matches('input,textarea,select,[contenteditable="true"]'))return;
  if(!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Enter',' '].includes(event.key))return;
  event.preventDefault();
  if(swapping||pointer)return;
  if(event.key==='ArrowRight')step(1);
  else if(event.key==='ArrowLeft')step(-1);
  else if(event.key==='ArrowDown'){if(!event.repeat)changeGroup(groupIndex+1);}
  else if(event.key==='ArrowUp'){if(!event.repeat)changeGroup(groupIndex-1);}
  else if(dish())configureMeal?.(dish());
 }
 let pendingMealOpen=0;
 // Finish the original burger's pointer/click sequence before opening the
 // modal. Otherwise its synthetic click can hit the newly opened backdrop.
 const scheduleMealOpen=meal=>{
  if(pendingMealOpen)clearTimeout(pendingMealOpen);
  pendingMealOpen=setTimeout(()=>{
   pendingMealOpen=0;
   if(active&&!destroyed&&!document.querySelector('dialog[open]'))configureMeal?.(meal);
  },0);
 };
 // Both the food stage and the meal information are gesture surfaces.
 // Reusing the same handlers preserves spring inertia, boundary bounce,
 // vertical category navigation, and the three-outward-swipes transition.
 for(const surface of [u.stage,u.info]){
  surface.addEventListener('pointerdown',pointerDown);
  surface.addEventListener('pointermove',pointerMove);
  surface.addEventListener('pointerup',pointerUp);
  surface.addEventListener('pointercancel',cancelPointer);
  surface.addEventListener('lostpointercapture',cancelPointer);
  surface.addEventListener('wheel',wheel,{passive:false});
 }
 u.stage.addEventListener('keydown',key);
 u.catPrev.id='rich-category-previous';u.catNext.id='rich-category-next';
 u.railUp.id='rich-meal-previous';u.railDown.id='rich-meal-next';
 u.customize.id='rich-order-now';u.customize.dataset.trackAction='order_now_click';
 u.catPrev.onclick=()=>changeGroup(groupIndex-1);
 u.catNext.onclick=()=>changeGroup(groupIndex+1);
 u.railUp.onclick=()=>step(-1);u.railDown.onclick=()=>step(1);
 u.mealPrev.id='rich-desktop-meal-previous';u.mealNext.id='rich-desktop-meal-next';
 u.mealPrev.onclick=()=>step(-1);u.mealNext.onclick=()=>step(1);
 u.details.id='rich-restaurant-details';u.details.dataset.trackAction='restaurant_info_click';
 u.details.onclick=()=>onRestaurantInfo?.();
 u.customize.onclick=()=>{if(dish()&&dish().available!==false)configureMeal?.(dish());};
 u.share.onclick=()=>{
  const current=dish();
  if(current?.id&&typeof onShare==='function')void onShare(current);
 };
 u.fav.onclick=()=>{
  if(!dish())return;
  onFavorite(dish());
  snapshot.favorites=getData().favorites;
  info();
 };
 function refresh(){
  resetEdgeSwipes();cancelPointer();++swapToken;swapping=false;
  root.classList.remove('rm-category-out','rm-category-in');
  snapshot=getData();
  // Match the editable footer text and emphasis of the regular menu.
  const agency='وكالة يوصل';
  const creditText=String(snapshot.settings?.credit||'');
  const parts=creditText.split(agency);
  creditButton.replaceChildren(document.createTextNode(parts[0]||''));
  if(parts.length>1)creditButton.append(mk('strong',null,agency),document.createTextNode(parts.slice(1).join(agency)));
  const creditFooter=creditButton.closest('.rm-interactive-credit');
  creditFooter.dataset.creditConfigured=creditText?'1':'0';
  creditFooter.hidden=!creditText;
  const oldGroup=group()?.id,oldDish=dish()?.id;
  const all=snapshot.dishes||[];
  groups=(snapshot.categories||[]).map(cat=>({
   ...cat,english:snapshot.categoryEnglish?.[cat.name]||cat.name,
   items:cat.items||all.filter(d=>String(d.category_id)===String(cat.id))
  })).filter(c=>c.items.length);
  const favorites=snapshot.favoriteMeals;
  if(favorites.length)groups.unshift({id:'favorites',name:'المفضلة',english:'FAVORITES',items:favorites});
  const retained=groups.findIndex(c=>String(c.id)===String(oldGroup));
  groupIndex=retained>=0?retained:0;
  const matching=group()?.items.findIndex(d=>d.id===oldDish)??0;
  front=matching>=0?matching:0;target=front;k=front;velocity=0;
  const photo=validImage(snapshot.settings?.logo);if(photo)u.logo.src=photo;
  drawCategoryTabs();paintStage();info();draw();
 }
 function focusLink({mealId,categoryId}={}){
  if(!groups.length)return false;
  const selected=snapshot.dishes?.find(m=>String(m.id)===String(mealId));
  let groupAt=selected?groups.findIndex(g=>String(g.id)===String(selected.category_id)):-1;
  if(groupAt<0&&selected)groupAt=groups.findIndex(g=>g.items.some(m=>String(m.id)===String(mealId)));
  if(!selected)groupAt=groups.findIndex(g=>String(g.id)===String(categoryId));
  if(groupAt<0)return false;
  resetEdgeSwipes();cancelPointer();groupIndex=groupAt;
  const index=selected?group().items.findIndex(m=>String(m.id)===String(selected.id)):0;
  front=Math.max(0,index);k=front;target=front;velocity=0;
  root.classList.remove('rm-category-out','rm-category-in');
  swapping=false;++swapToken;
  drawCategoryTabs();paintStage();info();draw();
  return true;
 }
 function setActive(on){
  active=!!on&&!destroyed;
  trackVisibleMeal();
  if(active){
   lastTime=0;
   loadNearbyImages();watchSelectedImage();
   if(!frame)frame=requestAnimationFrame(tick);
  }else{
   stopImageWatch();
   cancelPointer();
   cancelAnimationFrame(frame);frame=0;
   if(pendingMealOpen){clearTimeout(pendingMealOpen);pendingMealOpen=0;}
  }
 }
 function destroy(){
  destroyed=true;setActive(false);
  window.removeEventListener('offline',handleNetworkChange);
  connection?.removeEventListener?.('change',handleNetworkChange);
  ++swapToken;root.remove();
 }
 refresh();
 return {refresh,setActive,destroy,focusLink,get selected(){return dish();}};
}
