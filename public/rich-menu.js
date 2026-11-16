/* Opt-in immersive Snouno menu, based on motion behavior in the supplied
   Hungry Buten HTML: spring inertia, vertical 3D dish feed, swipe-driven
   category transitions, and a perspective thumbnail rail. No original art. */
const mk=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!=null)e.textContent=String(value);return e;};
const at=(root,selector)=>root.querySelector(selector);
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const validImage=value=>{if(!value)return '';try{const u=new URL(value,location.origin);return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}};
const categoryWords=name=>{const a=String(name||'SNOUNO').trim().split(/\s+/);return [a.slice(0,Math.ceil(a.length/2)).join(' '),a.slice(Math.ceil(a.length/2)).join(' ')]};
export function createRichMenu({host,getData,onOpen,onFavorite,onExit}){
 const root=mk('div','rm-app');root.dir='ltr';
 root.innerHTML=[
 '<div class="rm-top"><svg class="rm-band" viewBox="0 0 390 66" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 H390 V48 Q195 75 0 48 Z" fill="#FDBE2D"/></svg>',
 '<button type="button" class="rm-exit" aria-label="العودة إلى المنيو العادي" title="العودة إلى المنيو العادي"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>',
 '<span class="rm-top-caption" lang="en">SNOUNO / INTERACTIVE</span><img class="rm-top-logo" src="/assets/logo.webp" alt="مطعم سنونو"></div>',
 '<nav class="rm-categories" aria-label="تصنيفات الأطباق"><div class="rm-categories-header">',
 '<div class="rm-categories-label"><strong lang="en">CATEGORIES</strong><span dir="rtl">التصنيفات</span></div>',
 '<div class="rm-categories-controls"><button class="rm-category-previous" type="button" aria-label="الصنف السابق">←</button>',
 '<b class="rm-categories-count" dir="ltr">1 / 1</b><button class="rm-category-next" type="button" aria-label="الصنف التالي">→</button></div></div>',
 '<div class="rm-categories-track" role="tablist"></div></nav>',
 '<div class="rm-stage-wrap"><div class="rm-stage-word" aria-hidden="true"><span></span><span></span></div>',
 '<div class="rm-shadow" aria-hidden="true"></div><div class="rm-stage" role="listbox" tabindex="0"></div>',
 '<aside class="rm-thumbs" aria-label="اختيار وجبة"><button type="button" class="rm-rail-button rm-rail-up" aria-label="السابق">⌃</button>',
 '<div class="rm-rail-row"><div class="rm-rail-labels" aria-hidden="true"></div><div class="rm-rail-window"><div class="rm-rail-track"></div></div></div><button type="button" class="rm-rail-button rm-rail-down" aria-label="التالي">⌄</button>',
 '<span class="rm-rail-count" dir="ltr">1 / 1</span></aside>',
 '<button type="button" class="rm-customize" aria-label="اطلب الآن"><svg class="rm-order-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.1 12H6.1L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/><path d="M9 14h6"/></svg><span><strong lang="en">ORDER NOW</strong><span dir="rtl">اطلب الآن</span></span></button></div>',
 '<section class="rm-info" aria-live="polite"><h2 class="rm-info-name"></h2><p class="rm-info-desc"></p>',
 '<span class="rm-info-price" dir="ltr"></span><div class="rm-info-actions">',
 '<button type="button" class="rm-info-details">＋ عرض تفاصيل الوجبة</button>',
 '<button type="button" class="rm-info-fav" aria-pressed="false" aria-label="المفضلة">♡</button></div>',
 '<small class="rm-instruction" dir="rtl">اسحب للأعلى والأسفل للوجبات · يمين ويسار للتصنيفات</small></section>',
 '<dialog class="rm-sheet" aria-labelledby="rm-sheet-title" dir="rtl"><div class="rm-sheet-grab" aria-hidden="true"></div>',
 '<header class="rm-sheet-head"><div class="rm-sheet-heading"><span class="rm-sheet-overline" lang="en">SNOUNO / RESTAURANT</span>',
 '<h2 id="rm-sheet-title" class="rm-sheet-title"></h2><p class="rm-sheet-subtitle"></p></div>',
 '<button type="button" class="rm-sheet-close" aria-label="إغلاق">×</button></header>',
 '<div class="rm-sheet-body"></div></dialog>'
 ].join('');
 host.replaceChildren(root);
 const u={
  stage:at(root,'.rm-stage'),wrap:at(root,'.rm-stage-wrap'),
  logo:at(root,'.rm-top-logo'),word:at(root,'.rm-stage-word'),
  shadow:at(root,'.rm-shadow'),categories:at(root,'.rm-categories-track'),
  catCount:at(root,'.rm-categories-count'),
  catPrev:at(root,'.rm-category-previous'),catNext:at(root,'.rm-category-next'),
  thumbWindow:at(root,'.rm-rail-window'),thumbTrack:at(root,'.rm-rail-track'),
  labels:at(root,'.rm-rail-labels'),railCount:at(root,'.rm-rail-count'),
  railUp:at(root,'.rm-rail-up'),railDown:at(root,'.rm-rail-down'),
  info:at(root,'.rm-info'),title:at(root,'.rm-info-name'),
  desc:at(root,'.rm-info-desc'),price:at(root,'.rm-info-price'),
  details:at(root,'.rm-info-details'),fav:at(root,'.rm-info-fav'),
  customize:at(root,'.rm-customize'),sheet:at(root,'.rm-sheet'),
  sheetTitle:at(root,'.rm-sheet-title'),sheetSubtitle:at(root,'.rm-sheet-subtitle'),
  sheetBody:at(root,'.rm-sheet-body')
 };
 let groups=[],groupIndex=0,front=0,k=2.2,target=0,velocity=-.02;
 let active=false,frame=0,lastTime=0,pointer=null,lastWheel=0,swapping=false,swapToken=0;
 let dishesEls=[],thumbEls=[],categoryEls=[],snapshot={},destroyed=false;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const group=()=>groups[groupIndex];
 const dish=()=>group()?.items[front];
 const getName=d=>snapshot.displayName?.(d)||d.name;
 const getDescription=d=>snapshot.displayDescription?.(d)||d.description||'';
 const isEnglish=()=>snapshot.lang==='en';
 const focusCategory=()=>{
  const selected=categoryEls[groupIndex];if(!selected)return;
  const r=selected.getBoundingClientRect(),p=u.categories.getBoundingClientRect();
  u.categories.scrollBy({left:r.left+r.width/2-p.left-p.width/2,behavior:reduced.matches?'instant':'smooth'});
 };
 function drawCategoryTabs(){
  u.categories.replaceChildren();categoryEls=[];
  groups.forEach((g,i)=>{
   const button=mk('button','rm-cat');button.type='button';button.setAttribute('role','tab');
   button.setAttribute('aria-label',g.name);
   button.append(mk('strong',null,g.english||g.name),mk('span',null,g.name));
   button.addEventListener('click',()=>changeGroup(i));
   categoryEls.push(button);u.categories.append(button);
  });selectCategoryTab();
 }
 function selectCategoryTab(){
  u.catCount.textContent=groups.length?(groupIndex+1)+' / '+groups.length:'0 / 0';
  categoryEls.forEach((el,i)=>el.setAttribute('aria-selected',String(i===groupIndex)));
  u.catPrev.disabled=groupIndex===0;u.catNext.disabled=groupIndex>=groups.length-1;
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
   frame.dataset.idx=String(i);frame.setAttribute('role','option');
   frame.setAttribute('aria-label',getName(meal));frame.tabIndex=-1;
   frame.append(mk('div','rm-dish-shadow'));
   const photo=validImage(meal.rich_image)||validImage(meal.image);
   if(photo){
    const image=mk('img','rm-dish-photo');image.src=photo;
    image.alt=getName(meal);image.draggable=false;image.decoding='async';
    image.loading=i<4?'eager':'lazy';frame.append(image);
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
   thumbnail.title=getName(meal);thumbnail.setAttribute('aria-label',getName(meal));
   if(photo){const img=mk('img');img.src=photo;img.alt='';img.loading='lazy';img.draggable=false;thumbnail.append(img);}
   else thumbnail.textContent='•';
   thumbnail.addEventListener('click',()=>goTo(i));
   u.thumbTrack.append(thumbnail);thumbEls.push(thumbnail);
  });
 }
 function labelRail(){
  const g=group();if(!g)return;
  u.labels.replaceChildren();
  // Show the same three nearby dishes as the compact thumbnail selector.
  const start=clamp(front-1,0,Math.max(0,g.items.length-3));
  for(let i=start;i<Math.min(g.items.length,start+3);i++){
   const name=mk('span',null,getName(g.items[i]));
   name.dataset.index=String(i);
   name.setAttribute('dir','rtl');
   name.setAttribute('aria-current',String(i===front));
   u.labels.append(name);
  }
 }
 function info(){
  const m=dish();if(!m)return;
  u.title.textContent=getName(m);
  u.desc.textContent=getDescription(m)||m.ingredients||(isEnglish()?'Discover Snouno favourites':'اختار وجبتك المفضلة من سنونو');
  const price=Number(m.price);
  u.price.textContent=Number.isFinite(price)?price.toLocaleString('en-US',{maximumFractionDigits:2})+' ₪':'';
  u.details.textContent=isEnglish()?'⌖ LOCATION & CONTACT':'⌖ موقعنا و التواصل';
  at(u.customize,'.rm-customize strong').textContent='ORDER NOW';
  at(u.customize,'.rm-customize span span').textContent='اطلب الآن';
  u.customize.setAttribute('aria-label',isEnglish()?'Order now':'اطلب الآن');
  const saved=!!snapshot.favorites?.has(m.id);
  u.fav.textContent=saved?'♥':'♡';u.fav.setAttribute('aria-pressed',String(saved));
  u.fav.setAttribute('aria-label',saved?'إزالة من المفضلة':'إضافة إلى المفضلة');
  labelRail();
 }
 function updateFront(index){
  const g=group();if(!g)return;
  const next=clamp(index,0,g.items.length-1);
  if(next===front)return;
  front=next;info();
  // Only the changing meal copy animates. Keep the contact and favorite
  // buttons completely steady as users swipe between dishes.
  for(const el of [u.title,u.desc,u.price]){
   el.animate?.([{opacity:.75,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:230,easing:'cubic-bezier(.28,.8,.2,1)'});
  }
 }
 function draw(){
  const g=group();if(!g)return;
  const len=g.items.length,position=clamp(k,-.5,len-.5);
  const height=u.wrap.clientHeight;
  const scale=clamp(height/380,height<200?.42:.5,1)*.88;
  for(let i=0;i<dishesEls.length;i++){
   const el=dishesEls[i],dif=i-k;
   if(dif< -1.3||dif>5.6){el.style.visibility='hidden';continue;}
   el.style.visibility='visible';
   let x=0,y=0,z=0,rotateY=0,rotateZ=0,opacity=1;
   if(dif>=0){
    z=-dif*300;y=Math.max(-dif*62-Math.max(0,dif-1)*6,-150);
    x=-Math.sin(Math.min(dif,4)*.75)*110;
    rotateY=Math.min(dif,2)*7;
    const fade=dif>4?Math.max(0,1-(dif-4)*.7):1;
    opacity=fade*(.35+.65*(1-Math.min(dif,4)*.17));
   }else{
    const behind=-dif,side=i%2?1:-1;
    z=behind*420;y=behind*110;x=side*behind*50;rotateZ=side*behind*6;
    opacity=Math.max(0,1-behind*1.3);
   }
   const rotX=clamp(-velocity*25,-8,8);
   el.style.transform='translate(-50%,0) translate3d('+x.toFixed(1)+'px,'+y.toFixed(1)+'px,'+z.toFixed(1)+'px) rotateX('+rotX.toFixed(2)+'deg) rotateY('+rotateY.toFixed(2)+'deg) rotateZ('+rotateZ.toFixed(2)+'deg) scale('+scale.toFixed(3)+')';
   el.style.opacity=opacity.toFixed(3);
   el.style.zIndex=String(Math.round(1000-dif*10));
   el.setAttribute('aria-selected',String(i===front));
  }
  u.railCount.textContent=(front+1)+' / '+len;
  // The sidebar stays physically fixed. Swap up to three visible meals
  // in stationary rows instead of translating the whole thumbnail track.
  const visibleStart=clamp(Math.round(position)-1,0,Math.max(0,len-3));
  thumbEls.forEach((el,i)=>{
   el.style.display=i>=visibleStart&&i<visibleStart+3?'grid':'none';
   el.style.visibility='visible';
   el.style.opacity='';
   el.style.transform='none';
   el.setAttribute('aria-current',String(i===front));
  });
  u.thumbTrack.style.transform='none';
  const unit=34;
  for(const label of u.labels.children){
   const i=Number(label.dataset.index);
   label.style.top=((i-visibleStart)*unit)+'px';
   label.style.display=i>=visibleStart&&i<visibleStart+3?'grid':'none';
   label.setAttribute('aria-current',String(i===front));
  }
  const fade=Math.min(1,Math.abs(k-Math.round(k))*2.6+(k<-.4?1:0));
  for(const el of [u.title,u.desc,u.price]){
   el.style.opacity=(1-fade).toFixed(3);
   el.style.transform='translateY('+(fade*12).toFixed(1)+'px)';
  }
  const pulse=Math.min(Math.abs(velocity),.4);
  u.shadow.style.transform='translateX(-50%) scale('+(1+pulse*.15).toFixed(3)+','+(1-pulse*.1).toFixed(3)+')';
 }
 function tick(now){
  if(!active||destroyed){frame=0;return;}
  const dt=clamp((now-(lastTime||now))/16.67,.5,3);lastTime=now;
  if(!pointer||pointer.axis!=='y'){
   velocity+=(target-k)*.07*dt;
   velocity*=Math.pow(.8,dt);
   k+=velocity*dt;
   // Hard stops prevent rubber-band movement on fast flings at either edge.
   const maxIndex=Math.max(0,(group()?.items.length||1)-1);
   if(k<=0){k=0;if(velocity<0)velocity=0;}
   if(k>=maxIndex){k=maxIndex;if(velocity>0)velocity=0;}
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
  const g=group();if(!g)return;
  target=clamp(index,0,g.items.length-1);
  if(reduced.matches){k=target;velocity=0;updateFront(target);draw();}
 }
 const step=delta=>goTo(Math.round(target)+delta);
 async function changeGroup(index){
  if(swapping||destroyed||index<0||index>=groups.length||index===groupIndex)return;
  swapping=true;const serial=++swapToken,direction=index>groupIndex?1:-1;
  root.style.setProperty('--rm-shift-out',-direction*115+'px');
  root.style.setProperty('--rm-shift-in',direction*125+'px');
  root.classList.remove('rm-category-in');root.classList.add('rm-category-out');
  await new Promise(r=>setTimeout(r,reduced.matches?0:220));
  if(serial!==swapToken||destroyed)return;
  groupIndex=index;front=0;k=reduced.matches?0:2.2;target=0;velocity=-.02;
  paintStage();info();selectCategoryTab();
  root.classList.remove('rm-category-out');root.classList.add('rm-category-in');
  await new Promise(r=>setTimeout(r,reduced.matches?0:550));
  if(serial!==swapToken||destroyed)return;
  root.classList.remove('rm-category-in');swapping=false;
 }
 function pointerDown(event){
  if(event.button!==0||swapping||!active)return;
  const el=event.target.closest('.rm-dish');
  pointer={id:event.pointerId,x:event.clientX,y:event.clientY,lastT:performance.now(),startK:k,axis:null,index:el?Number(el.dataset.idx):null};
  u.stage.setPointerCapture?.(event.pointerId);
 }
 function pointerMove(event){
  const p=pointer;if(!p||event.pointerId!==p.id)return;
  const dx=event.clientX-p.x,dy=event.clientY-p.y;
  if(!p.axis){
   if(Math.hypot(dx,dy)<8)return;
   p.axis=Math.abs(dy)>Math.abs(dx)?'y':'x';
  }
  if(p.axis==='y'){
   const len=group()?.items.length||1;
   // No elastic overshoot: a rapid edge swipe stays on the end meal.
   const value=clamp(p.startK+dy/160,0,len-1);
   const now=performance.now(),dt=Math.max((now-p.lastT)/16.67,.5);
   velocity=velocity*.5+(value-k)/dt*.5;
   k=value;
   if((k===0&&velocity<0)||(k===len-1&&velocity>0))velocity=0;
   p.lastT=now;
  }
 }
 function pointerUp(event){
  const p=pointer;if(!p||event.pointerId!==p.id)return;
  pointer=null;
  if(u.stage.hasPointerCapture?.(event.pointerId))u.stage.releasePointerCapture(event.pointerId);
  if(p.axis==='y')goTo(Math.round(k+velocity*7));
  else if(p.axis==='x'){
   const delta=event.clientX-p.x;
   if(Math.abs(delta)>50)changeGroup(groupIndex+(delta<0?1:-1));
  }else if(p.index!=null){
   const selected=group()?.items[p.index];
   if(selected){goTo(p.index);scheduleMealOpen(selected);}
  }
 }
 function wheel(event){
  if(!active||swapping)return;
  event.preventDefault();const now=performance.now();
  if(now-lastWheel<260||Math.abs(event.deltaY)<8)return;
  lastWheel=now;step(event.deltaY>0?-1:1);
 }
 function key(event){
  if(!active||document.activeElement?.matches('input,textarea,select'))return;
  if(event.key==='ArrowUp')step(-1);
  else if(event.key==='ArrowDown')step(1);
  else if(event.key==='ArrowLeft')changeGroup(groupIndex+1);
  else if(event.key==='ArrowRight')changeGroup(groupIndex-1);
  else if(event.key==='Enter'||event.key===' '){if(dish())openRichSheet('order',dish());}
  else return;
  event.preventDefault();
 }
 at(root,'.rm-exit').addEventListener('click',()=>{if(typeof onExit==='function')onExit();});
 const platformInfo={
  sonbol:{ar:'سنبل',en:'Sonbol',icon:'/assets/sonbol.svg'},
  makook:{ar:'مكوك',en:'Makook',icon:'/assets/makook.svg'},
  whatsapp:{ar:'واتساب',en:'WhatsApp',icon:'/assets/whatsapp.svg'}
 };
 const restaurantLink=channel=>snapshot.links?.find(item=>item.channel===channel)?.url||'';
 const safeLink=url=>{const link=validImage(url);return link&&/^https?:\/\//.test(link)?link:'';};
 let pendingMealOpen=0,lastSheetOpenedAt=0;
 const closeSheet=()=>{
  if(!u.sheet.open)return;
  u.sheet.close();
  u.sheet.classList.remove('rm-sheet-entering');
 };
 // Finish the original burger's pointer/click sequence before opening the
 // modal. Otherwise its synthetic click can hit the newly opened backdrop.
 const scheduleMealOpen=meal=>{
  if(pendingMealOpen)clearTimeout(pendingMealOpen);
  pendingMealOpen=setTimeout(()=>{
   pendingMealOpen=0;
   if(active&&!destroyed&&!u.sheet.open)openRichSheet('order',meal);
  },0);
 };
 const linkCard=(channel,meal)=>{
   const info=platformInfo[channel];
   const direct=meal&&(channel==='sonbol'?meal.sonbol_url:channel==='makook'?meal.makook_url:null);
   const href=safeLink(direct)||safeLink(restaurantLink(channel));
   if(!href)return null;
   const isDirect=!!safeLink(direct);
   const el=mk('a','rm-sheet-link');el.href=href;el.target='_blank';el.rel='noopener noreferrer';
   el.dataset.platform=channel;
   const mark=mk('span','rm-sheet-link-mark');
   const img=mk('img');img.src=info.icon;img.alt='';img.loading='lazy';mark.append(img);
   const copy=mk('span','rm-sheet-link-copy');
   copy.append(mk('strong',null,isEnglish()?info.en:info.ar));
   const detail=channel==='whatsapp'
    ?isEnglish()?'Chat on WhatsApp':'تواصل عبر واتساب'
    :isDirect
     ?isEnglish()?'Order this selected meal':'اطلب هذه الوجبة مباشرة'
     :isEnglish()?'Restaurant ordering page':'صفحة طلبات المطعم';
   copy.append(mk('small',null,detail));
   const arrow=mk('span','rm-sheet-link-arrow','↗');arrow.setAttribute('aria-hidden','true');
   el.append(mark,copy,arrow);return el;
 };
 function openRichSheet(kind,meal){
   if(destroyed)return;
   const english=isEnglish();
   u.sheetTitle.textContent=kind==='order'?(english?'Where to order':'أماكن الطلب'):(english?'Location & contact':'موقعنا و التواصل');
   u.sheetSubtitle.textContent=kind==='order'?(meal?getName(meal):''):(snapshot.settings?.name||'مطعم سنونو');
   u.sheetBody.replaceChildren();
   if(kind==='contact'){
     const place=mk('div','rm-sheet-information');
     const hours=mk('section','rm-sheet-detail');
     hours.append(mk('span','rm-sheet-detail-icon','◷'));
     const hoursBody=mk('div');hoursBody.append(mk('strong',null,english?'Opening hours':'ساعات العمل'));
     hoursBody.append(mk('p',null,snapshot.settings?.hours|| (english?'Not provided':'غير محددة')));
     hours.append(hoursBody);place.append(hours);
     const location=mk('section','rm-sheet-detail');
     location.append(mk('span','rm-sheet-detail-icon','⌖'));
     const locationBody=mk('div');locationBody.append(mk('strong',null,english?'Address':'موقعنا'));
     locationBody.append(mk('p',null,snapshot.settings?.address|| (english?'Not provided':'غير محدد')));
     location.append(locationBody);place.append(location);
     u.sheetBody.append(place);
   }
   const heading=mk('h3','rm-sheet-links-heading',english?(kind==='order'?'Choose an ordering service':'Order or contact us'):(kind==='order'?'اختار التطبيق المناسب للطلب':'اطلب أو تواصل معنا'));
   u.sheetBody.append(heading);
   const channels=kind==='order'?['sonbol','makook']:['makook','sonbol','whatsapp'];
   const links=mk('div','rm-sheet-links');
   for(const channel of channels){const link=linkCard(channel,kind==='order'?meal:null);if(link)links.append(link);}
   if(!links.children.length)links.append(mk('p','rm-sheet-empty',english?'Ordering links are not currently available.':'روابط الطلب غير متاحة حالياً.'));
   u.sheetBody.append(links);
   if(kind==='order'&&meal?.available===false){
     const note=mk('p','rm-sheet-warning',english?'This meal is marked unavailable. Please confirm with the restaurant before ordering.':'هذه الوجبة محددة كغير متوفرة. تأكد من المطعم قبل الطلب.');
     u.sheetBody.prepend(note);
   }
   if(u.sheet.open)return;
   // Restart the entrance animation cleanly for every re-open.
   u.sheet.classList.remove('rm-sheet-entering');
   u.sheet.showModal();
   u.sheetBody.scrollTop=0;
   void u.sheet.offsetWidth;
   u.sheet.classList.add('rm-sheet-entering');
   lastSheetOpenedAt=performance.now();
 }
 at(u.sheet,'.rm-sheet-close').addEventListener('click',closeSheet);
 u.sheet.addEventListener('close',()=>{
  if(!u.sheet.open)u.sheet.classList.remove('rm-sheet-entering');
 });
 u.sheet.addEventListener('click',event=>{
  if(event.target!==u.sheet||performance.now()-lastSheetOpenedAt<250)return;
  const bounds=u.sheet.getBoundingClientRect();
  if(event.clientX<bounds.left||event.clientX>bounds.right||
     event.clientY<bounds.top||event.clientY>bounds.bottom)closeSheet();
 });

 u.stage.addEventListener('pointerdown',pointerDown);
 u.stage.addEventListener('pointermove',pointerMove);
 u.stage.addEventListener('pointerup',pointerUp);
 u.stage.addEventListener('pointercancel',()=>{if(pointer?.axis==='y')goTo(Math.round(k));pointer=null;});
 u.stage.addEventListener('wheel',wheel,{passive:false});
 u.stage.addEventListener('keydown',key);
 u.catPrev.onclick=()=>changeGroup(groupIndex-1);
 u.catNext.onclick=()=>changeGroup(groupIndex+1);
 u.railUp.onclick=()=>step(-1);u.railDown.onclick=()=>step(1);
 u.details.onclick=()=>openRichSheet('contact');
 u.customize.onclick=()=>{if(dish())openRichSheet('order',dish());};
 u.fav.onclick=()=>{
  if(!dish())return;
  onFavorite(dish());
  snapshot.favorites=getData().favorites;
  info();
 };
 function refresh(){
  snapshot=getData();
  const oldGroup=group()?.id,oldDish=dish()?.id;
  const all=snapshot.dishes||[];
  groups=(snapshot.categories||[]).map(cat=>({
   ...cat,english:snapshot.categoryEnglish?.[cat.name]||cat.name,
   items:all.filter(d=>String(d.category_id)===String(cat.id))
  })).filter(c=>c.items.length);
  const favorites=all.filter(d=>snapshot.favorites?.has(d.id));
  if(favorites.length)groups.unshift({id:'favorites',name:'المفضلة',english:'FAVORITES',items:favorites});
  const retained=groups.findIndex(c=>String(c.id)===String(oldGroup));
  groupIndex=retained>=0?retained:0;
  const matching=group()?.items.findIndex(d=>d.id===oldDish)??0;
  front=matching>=0?matching:0;target=front;k=front;velocity=0;
  const photo=validImage(snapshot.settings?.logo);if(photo)u.logo.src=photo;
  drawCategoryTabs();paintStage();info();draw();
 }
 function setActive(on){
  active=!!on&&!destroyed;
  if(active){lastTime=0;if(!frame)frame=requestAnimationFrame(tick);}
  else{
   cancelAnimationFrame(frame);frame=0;
   if(pendingMealOpen){clearTimeout(pendingMealOpen);pendingMealOpen=0;}
  }
 }
 function destroy(){destroyed=true;setActive(false);closeSheet();++swapToken;root.remove();}
 refresh();
 return {refresh,setActive,destroy,get selected(){return dish();}};
}
