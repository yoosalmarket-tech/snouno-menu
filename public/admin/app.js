import {installActionReporting,menuLink} from '../action-tracking.js?v=links-actions-20261116';
const endpoint = 'https://wknpuzdyemwkllmxehyy.supabase.co';
const apiKey = 'sb_publishable_FJg5RC-dTvsINEy9D8_rXw_xM03B4Ip';
const $ = id => document.getElementById(id);
const sections = {
  overview: ['اللوحة الرئيسية', []],
  dishes: ['الأطباق', [['name','اسم الطبق'],['description','الوصف','textarea'],['sonbol_url','رابط طلب هذا الطبق من سنبل','url'],['makook_url','رابط الوجبة المباشر من مكوك (اختياري)','url'],['utlob_url','رابط الوجبة المباشر من تطبيق اطلب (اختياري)','url'],['ingredients','المكونات'],['badge','شارة الطبق'],['rich_badge_x','موضع الشارة التفاعلية — أفقي','position'],['rich_badge_y','موضع الشارة التفاعلية — عمودي','position'],['rating','التقييم المعروض','optionalRating'],['old_price','السعر السابق','optionalPrice'],['category_id','الصنف','select'],['price','السعر بالشيكل','number'],['image','صورة الطبق — المنيو العادي','image'],['rich_image','صورة الوضع التفاعلي (خلفية شفافة)','image'],['available','متوفر','checkbox']]],
  categories: ['الأصناف', [['name','اسم الصنف'],['icon','رمز الصنف']]],
  menu_settings: ['مطعم السنونو', [
    ['name','اسم المطعم'],
    ['welcome','عبارة الترحيب'],
    ['welcome_caption','العبارة الصغيرة أعلى شاشة الترحيب'],
    ['welcome_subtitle','النص تحت اسم المطعم'],
    ['welcome_question','السؤال على ملصق الوجبة'],
    ['welcome_label','العبارة بجانب الوجبة (مثل: من سنونو)'],
    ['welcome_meal_1','اسم الوجبة الأولى (بوكس المشاركة)'],
    ['welcome_image_1','صورة الترحيب الأولى — بوكس المشاركة','image'],
    ['welcome_label_x_1','موضع النص للوجبة 1 — أفقي','position'],
    ['welcome_label_y_1','موضع النص للوجبة 1 — عمودي','position'],
    ['welcome_meal_2','اسم الوجبة الثانية (نوك أوت)'],
    ['welcome_image_2','صورة الترحيب الثانية — نوك أوت','image'],
    ['welcome_label_x_2','موضع النص للوجبة 2 — أفقي','position'],
    ['welcome_label_y_2','موضع النص للوجبة 2 — عمودي','position'],
    ['welcome_meal_3','اسم الوجبة الثالثة (ناشفيل)'],
    ['welcome_image_3','صورة الترحيب الثالثة — ناشفيل','image'],
    ['welcome_label_x_3','موضع النص للوجبة 3 — أفقي','position'],
    ['welcome_label_y_3','موضع النص للوجبة 3 — عمودي','position'],
    ['welcome_desktop_accent','السطر الأصفر الكبير في ترحيب الكمبيوتر'],
    ['welcome_description','وصف صفحة الترحيب للكمبيوتر','textarea'],
    ['welcome_button','نص زر تصفح المنيو'],
    ['logo','شعار سنونو','image'],
    ['contact','نص صفحة التواصل','textarea'],
    ['address','العنوان'],['hours','ساعات العمل'],
    ['hotline','رقم التواصل السريع']
  ]],
  menu_links: ['روابط الطلب والتواصل', [['url','الرابط','url']]],
  menu_ads: ['إدارة الإعلانات', [['name','عنوان الإعلان'],['image','صورة الإعلان','image'],['dish_id','الطبق المرتبط','product']]],
  rankings: ['تقييمات الأطباق', []],
  events: ['إحصائيات التفاعل', []],
  submissions: ['رسائل التواصل', []],
  menu_staff: ['المستخدمون', [['email','بريد المحرر','email'],['password','كلمة مرور للحساب الجديد (12 حرفاً على الأقل)','password']]],
  account: ['حساب المالك', []]
};
// Keep an existing dashboard session when updating the brand-prefixed storage key.
try {
 if (localStorage.getItem('snounu-session')===null && localStorage.getItem('snouno-session')!==null)
  localStorage.setItem('snounu-session',localStorage.getItem('snouno-session'));
 localStorage.removeItem('snouno-session');
} catch (error) { console.warn('Dashboard session migration unavailable',error); }
const sessionKey='snounu-session';
let rememberMe=!!localStorage.getItem(sessionKey);
let session=JSON.parse(localStorage.getItem(sessionKey)||sessionStorage.getItem(sessionKey)||'null');
let role, section = 'dishes', generation = 0;
const adminReporting=installActionReporting({
 route:()=> 'admin',mode:()=> 'dashboard',
 token:()=>session?.access_token||null,preview:()=>!session?.access_token
});
const notice = message => { $('status').textContent = message; };
function node(tag, text) { const el=document.createElement(tag); if(text!==undefined) el.textContent=text; return el; }
function action(label, fn) { const b=node('button',label); b.type='button'; b.onclick=()=>Promise.resolve(fn()).catch(e=>notice(e.message)); return b; }
function persist(value){
 session=value;
 if(!value){localStorage.removeItem(sessionKey);sessionStorage.removeItem(sessionKey);return;}
 const chosen=rememberMe?localStorage:sessionStorage;
 (rememberMe?sessionStorage:localStorage).removeItem(sessionKey);
 chosen.setItem(sessionKey,JSON.stringify(value));
}
async function request(path, {method='GET', body, token, headers={}}={}) {
  const raw=body instanceof File;
  const response=await fetch(endpoint+path,{method,headers:{apikey:apiKey,...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':raw?body.type:'application/json'}:{}),...headers},body:body?(raw?body:JSON.stringify(body)):undefined});
  const data=await response.text();
  const result=data?JSON.parse(data):null;
  if(!response.ok) throw new Error(result?.message||result?.msg||result?.error_description||'تعذّر تنفيذ الطلب');
  return result;
}
let refreshing;
async function api(path, options={}) {
  if(!session) throw new Error('يلزم تسجيل الدخول');
  if(session.expires_at*1000<Date.now()+60000) {
    refreshing ||= request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}}).then(persist).finally(()=>{refreshing=null;});
    await refreshing;
  }
  return request(path,{...options,token:session.access_token});
}
function loggedOut(){ generation++; role=null; $('body').classList.remove('ga-overview'); $('login').hidden=false; $('tabs').replaceChildren(); $('body').replaceChildren(); $('title').textContent='تسجيل الدخول'; }
function adminSidebarIcon(key){
 const icons={
  overview:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  dishes:'<path d="M3 6h18M3 12h18M3 18h18"/><circle cx="7" cy="6" r="1"/><circle cx="7" cy="12" r="1"/><circle cx="7" cy="18" r="1"/>',
  categories:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  menu_settings:'<path d="M4 7h16M7 7V4m0 6V7M4 17h16m-5-3v6"/><circle cx="7" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
  menu_links:'<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-2 2"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l2-2"/>',
  menu_ads:'<path d="M3 11h5l10-5v12L8 13H3zM8 13l2 7h4M20 9v6"/>',
  rankings:'<path d="M4 21V11m6 10V5m6 16v-8m5 8H2"/><path d="m3 7 4-4 4 3 4-3"/>',
  events:'<path d="M3 4h18v16H3zM3 9h18"/><path d="M7 13h4m-4 4h8"/>',
  submissions:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  menu_staff:'<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M2 20c0-5 3-7 6-7s6 2 6 7M15 14c3 0 6 2 6 6"/>',
  account:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
 };
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','19');svg.setAttribute('height','19');
 svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');
 svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
 svg.classList.add('admin-nav-icon');
 svg.innerHTML=icons[key]||icons.overview;
 return svg;
}
function buildAdminSidebar(email){
 const tabs=$('tabs');tabs.replaceChildren();
 const brand=node('a');brand.className='admin-sidebar-brand';brand.href='/menu';brand.target='_blank';brand.rel='noopener noreferrer';
 const brandLogo=node('img');brandLogo.src='/assets/snounu-icon.png';brandLogo.alt='';brandLogo.width=43;brandLogo.height=43;
 const brandText=node('span');brandText.className='admin-brand-text';
 brandText.append(node('strong','سنونو'),node('small','لوحة تحكم المنيو'));
 brand.append(brandLogo,brandText);tabs.append(brand);
 const links=node('div');links.className='admin-sidebar-links';links.id='admin-sidebar-links';
 let prevGroup='';
 const groups={
  overview:'نظرة عامة',dishes:'محتوى المنيو',categories:'محتوى المنيو',
  menu_settings:'محتوى المنيو',menu_links:'محتوى المنيو',menu_ads:'محتوى المنيو',
  rankings:'التقارير والتفاعل',events:'التقارير والتفاعل',submissions:'التقارير والتفاعل',
  menu_staff:'إدارة الحساب',account:'إدارة الحساب'
 };
 for(const [key,[label]] of Object.entries(sections)){
  if(['menu_staff','account','events','overview'].includes(key)&&role!=='owner')continue;
  const group=groups[key]||'المزيد';
  if(group!==prevGroup){const groupLabel=node('span',group);groupLabel.className='admin-sidebar-group';links.append(groupLabel);prevGroup=group;}
  const btn=action('',()=>openSection(key));btn.id='admin-tab-'+key;btn.dataset.section=key;btn.className='admin-nav-button';
  btn.append(adminSidebarIcon(key),node('span',label));links.append(btn);
 }
 tabs.append(links);
 const profile=node('div');profile.className='admin-sidebar-profile';
 const avatar=node('span',role==='owner'?'م':'ف');avatar.className='admin-profile-avatar';
 const info=node('span');info.className='admin-profile-info';
 info.append(node('strong',role==='owner'?'مدير الموقع':'فريق المطعم'),node('small',String(email||'')));
 const logout=action('↪',async()=>{try{await api('/auth/v1/logout',{method:'POST'});}finally{persist(null);loggedOut();notice('تم تسجيل الخروج');}});
 logout.id='logout';logout.className='admin-profile-logout';logout.title='تسجيل الخروج';logout.setAttribute('aria-label','تسجيل الخروج');
 profile.append(avatar,info,logout);tabs.append(profile);
}

async function enter(){
  const user=await api('/auth/v1/user');
  if(!user?.email)throw new Error('تعذّر التحقق من الحساب');
  session.user=user;persist(session);
  const own=await api('/rest/v1/menu_staff?select=role&email=eq.'+encodeURIComponent(user.email.toLowerCase()));
  if(!own.length) throw new Error('لا توجد صلاحية لهذا الحساب');
  role=own[0].role; $('login').hidden=true;
  buildAdminSidebar(user.email);
  const saved=location.hash.slice(1);
  await openSection(Object.hasOwn(sections,saved)&&(!['menu_staff','account','events','overview'].includes(saved)||role==='owner')?saved:(role==='owner'?'overview':'dishes'));
}
$('remember-me').checked=rememberMe;
$('access').onsubmit=async e=>{
 e.preventDefault();
 const form=e.currentTarget;
 rememberMe=$('remember-me').checked;
 try{
  const credentials={email:form.elements.email.value.trim().toLowerCase(),password:form.elements.password.value};
  const loggedIn=await request('/auth/v1/token?grant_type=password',{method:'POST',body:credentials});
  persist(loggedIn);
  form.elements.password.value='';
  await enter();
 }catch(err){persist(null);loggedOut();notice(err.message);}
};

/* Drag handles preserve category membership while updating real menu order.
   Mouse, touch, pen, and keyboard are supported. */
/* Drag-to-reorder with a stable drag source: do not move a captured
   element during pointermove. Move it only on pointerup; this fixes lost
   pointer capture on Chrome/mobile and makes every drop reliably persist. */
function wireSortableList(list, selector, persist, canDrag=()=>true){
 const cards=[...list.querySelectorAll(':scope > '+selector)];
 if(cards.length<2)return;
 let active=null,marker=null,position='before',startY=0,changing=false;
 const clearMarker=()=>{
  if(marker)marker.classList.remove('sort-drop-before','sort-drop-after');
  marker=null;
 };
 const finish=async event=>{
  if(!active||active.pointer!==event.pointerId)return;
  const state=active;active=null;
  window.removeEventListener('pointermove',move,true);
  window.removeEventListener('pointerup',finish,true);
  window.removeEventListener('pointercancel',cancel,true);
  window.removeEventListener('blur',cancel,true);
  state.card.classList.remove('is-dragging');
  document.body.classList.remove('is-sorting');
  if(marker&&marker!==state.card&&state.didMove){
   const target=marker;
   if(position==='before')target.before(state.card);
   else target.after(state.card);
   clearMarker();
   await persist();
  }else clearMarker();
 };
 const cancel=()=>{
  if(!active)return;
  active.card.classList.remove('is-dragging');
  active=null;clearMarker();document.body.classList.remove('is-sorting');
  window.removeEventListener('pointermove',move,true);
  window.removeEventListener('pointerup',finish,true);
  window.removeEventListener('pointercancel',cancel,true);
  window.removeEventListener('blur',cancel,true);
 };
 const move=event=>{
  if(!active||event.pointerId!==active.pointer)return;
  event.preventDefault();
  const elements=[...list.querySelectorAll(':scope > '+selector)].filter(x=>x!==active.card);
  if(!elements.length)return;
  const y=event.clientY;
  // Always choose a target, even if the pointer falls in a gap between cards.
  let target=elements.reduce((best,card)=>{
   const r=card.getBoundingClientRect(),center=r.top+r.height/2;
   const distance=Math.abs(center-y);
   return !best||distance<best.distance?{card,distance}:best;
  },null)?.card;
  if(!target)return;
  const bounds=target.getBoundingClientRect();
  const desired=y<bounds.top+bounds.height/2?'before':'after';
  if(marker!==target||position!==desired){
   clearMarker();marker=target;position=desired;
   marker.classList.add('sort-drop-'+position);
  }
  active.didMove=Math.abs(y-startY)>7;
  if(y<68)window.scrollBy(0,-12);
  else if(y>window.innerHeight-68)window.scrollBy(0,12);
 };
 for(const card of cards){
  const handle=card.querySelector('.dish-drag-handle');
  if(!handle)continue;
  handle.draggable=false;
  handle.addEventListener('keydown',async event=>{
   if(!['ArrowUp','ArrowDown'].includes(event.key)||changing||!canDrag())return;
   event.preventDefault();
   const peer=event.key==='ArrowUp'?card.previousElementSibling:card.nextElementSibling;
   if(!peer?.matches(selector))return;
   if(event.key==='ArrowUp')peer.before(card);else peer.after(card);
   handle.focus();
   await persist();
  });
  const begin=event=>{
   if(active||changing||!canDrag()||event.button!==0)return;
   if(matchMedia('(max-width:700px)').matches && !event.target.closest('.dish-drag-handle'))return;
   // Any non-interactive part of the meal card is now a drag surface.
   if(event.target.closest('button,a,input,select,textarea,label')&&
      !event.target.closest('.dish-drag-handle'))return;
   event.preventDefault();event.stopPropagation();
   active={pointer:event.pointerId,card,didMove:false};
   startY=event.clientY;
   card.classList.add('is-dragging');
   document.body.classList.add('is-sorting');
   window.addEventListener('pointermove',move,{capture:true,passive:false});
   window.addEventListener('pointerup',finish,true);
   window.addEventListener('pointercancel',cancel,true);
   window.addEventListener('blur',cancel,true);
  };
  card.addEventListener('pointerdown',begin);
 }
}
function setupDishSorting(categoryGroups,rows){
 let saving=false;
 const original=new Map(rows.map(row=>[String(row.id),Number(row.position)]));
 const save=async()=>{
  if(saving)return;
  const updates=[];
  for(const group of categoryGroups.values()){
   [...group.querySelectorAll(':scope > article[data-dish-id]')].forEach((card,index)=>{
    const id=card.dataset.dishId,position=index+1;
    if(original.get(id)!==position)updates.push({id,position});
   });
  }
  if(!updates.length)return;
  saving=true;const area=$('body');area.classList.add('is-saving-order');
  notice('جارٍ حفظ ترتيب الأطباق...');
  try{
   for(const row of updates){
    await api('/rest/v1/dishes?id=eq.'+encodeURIComponent(row.id),
      {method:'PATCH',body:{position:row.position}});
    original.set(row.id,row.position);
   }
   notice('تم حفظ ترتيب الأطباق ✓');
  }catch(error){
   notice('تعذّر حفظ الترتيب: '+error.message);
   await openSection('dishes');
  }finally{saving=false;area.classList.remove('is-saving-order');}
 };
 for(const group of categoryGroups.values()){
  wireSortableList(group,'article[data-dish-id]',save,()=>!saving);
 }
}
function setupFlatSorting(key,rows){
 const container=$('body');
 let saving=false;
 const original=new Map(rows.map(row=>[String(row.id),Number(row.position)]));
 const save=async()=>{
  if(saving)return;
  const order=[...container.querySelectorAll(':scope > article[data-sort-id]')];
  const updates=order.map((card,i)=>({id:card.dataset.sortId,position:i+1}))
   .filter(x=>original.get(x.id)!==x.position);
  if(!updates.length)return;
  saving=true;container.classList.add('is-saving-order');notice('جارٍ حفظ ترتيب العرض...');
  try{
   for(const row of updates){
    await api('/rest/v1/'+key+'?id=eq.'+encodeURIComponent(row.id),
      {method:'PATCH',body:{position:row.position}});
    original.set(row.id,row.position);
   }
   notice('تم حفظ ترتيب العرض ✓');
  }catch(error){
   notice('تعذّر حفظ ترتيب العرض: '+error.message);
   await openSection(key);
  }finally{saving=false;container.classList.remove('is-saving-order');}
 };
 wireSortableList(container,'article[data-sort-id]',save,()=>!saving);
}
// Verify the current password against Auth before sensitive account changes.
async function verifyOwnerPassword(password){
 if(role!=='owner'||!session?.user?.email)throw new Error('هذه العملية متاحة للمالك فقط');
 const credentials={email:session.user.email.toLowerCase(),password};
 const verified=await request('/auth/v1/token?grant_type=password',{method:'POST',body:credentials});
 if(!verified.access_token)throw new Error('تعذّر تأكيد كلمة المرور');
 persist(verified);
 return verified;
}
function accountField(form,caption,name,type,required=true){
 const label=node('label',caption);
 const input=node('input');input.type=type;input.name=name;input.required=required;
 if(type==='password')input.autocomplete='off';
 if(type==='email')input.dir='ltr';
 label.append(input);form.append(label);
 return input;
}
function accountCard(parent,title,description){
 const card=node('section');card.className='account-card';
 card.append(node('h2',title),node('p',description));
 const form=node('form');card.append(form);
 const result=node('p');result.className='account-message';
 card.append(result);parent.append(card);
 return {form,result};
}
async function renderOwnerAccount(){
 if(role!=='owner')throw new Error('للمالك فقط');
 const area=$('body'),box=node('div');
 box.className='account-settings';area.append(box);
 const user=await api('/auth/v1/user');
 if(section!=='account')return;
 session.user=user;persist(session);
 const emailBox=accountCard(box,'تغيير البريد الإلكتروني','سترسل Supabase رسالة تأكيد إلى البريد الجديد، وقد يلزم تأكيد التغيير من البريد القديم أيضاً.');
 const newEmail=accountField(emailBox.form,'البريد الإلكتروني الجديد','email','email');
 newEmail.value=user.email||'';
 const verifyEmail=accountField(emailBox.form,'كلمة المرور الحالية','current_password','password');
 const emailSubmit=node('button','إرسال طلب تغيير البريد');
 emailBox.form.append(emailSubmit);
 emailBox.form.onsubmit=async event=>{
   event.preventDefault();emailSubmit.disabled=true;emailBox.result.textContent='';
   try{
     const address=newEmail.value.trim().toLowerCase();
     if(address===(session.user?.email||'').toLowerCase())throw new Error('أدخل بريداً مختلفاً عن الحالي');
     await verifyOwnerPassword(verifyEmail.value);
     await api('/auth/v1/user',{method:'PUT',body:{email:address}});
     verifyEmail.value='';
     emailBox.result.textContent='أُرسل طلب تغيير البريد. أكمل التأكيد من رسالة البريد الإلكتروني قبل استخدام العنوان الجديد.';
   }catch(error){emailBox.result.textContent=error.message;}
   finally{verifyEmail.value='';emailSubmit.disabled=false;}
 };
 const passwordBox=accountCard(box,'تغيير كلمة المرور','استخدم كلمة مرور قوية من 12 حرفاً على الأقل. سنطلب كلمة المرور الحالية للتحقق.');
 const currentPassword=accountField(passwordBox.form,'كلمة المرور الحالية','current_password','password');
 const newPassword=accountField(passwordBox.form,'كلمة المرور الجديدة','new_password','password');
 newPassword.minLength=12;
 const confirmPassword=accountField(passwordBox.form,'تأكيد كلمة المرور الجديدة','confirm_password','password');
 confirmPassword.minLength=12;
 const passwordSubmit=node('button','تغيير كلمة المرور');
 passwordBox.form.append(passwordSubmit);
 passwordBox.form.onsubmit=async event=>{
   event.preventDefault();passwordSubmit.disabled=true;passwordBox.result.textContent='';
   try{
     if(newPassword.value!==confirmPassword.value)throw new Error('كلمتا المرور غير متطابقتين');
     if(newPassword.value.length<12)throw new Error('استخدم 12 حرفاً على الأقل');
     await verifyOwnerPassword(currentPassword.value);
     await api('/auth/v1/user',{method:'PUT',body:{password:newPassword.value}});
     passwordBox.result.textContent='تم تحديث كلمة المرور بنجاح.';
   }catch(error){passwordBox.result.textContent=error.message;}
   finally{
     currentPassword.value='';newPassword.value='';confirmPassword.value='';
     passwordSubmit.disabled=false;
   }
 };
 const transferBox=accountCard(box,'نقل الملكية إلى محرر آخر','اختر حساب محرر مؤكد، ثم أكد العملية بكلمة المرور الحالية. ستصبح أنت محرراً ويصبح الحساب المختار المالك الجديد.');
 const warning=node('p','تنبيه: سيحصل المالك الجديد على صلاحيات إدارة المستخدمين والملكية. لا يمكن التراجع إلا بواسطة المالك الجديد.');
 warning.className='account-warning';transferBox.form.append(warning);
 const recipientLabel=node('label','المالك الجديد');
 const recipient=node('select');recipient.name='recipient';recipient.required=true;
 const empty=node('option','اختر أحد المحررين');empty.value='';recipient.append(empty);
 recipientLabel.append(recipient);transferBox.form.append(recipientLabel);
 const editors=await api('/rest/v1/menu_staff?select=email,role&role=eq.editor&order=email');
 for(const editor of editors){
   const opt=node('option',editor.email);opt.value=editor.email;recipient.append(opt);
 }
 const transferPassword=accountField(transferBox.form,'كلمة المرور الحالية','current_password','password');
 const typed=accountField(transferBox.form,'اكتب بريد المالك الجديد للتأكيد','confirmation','email');
 typed.placeholder='اكتب البريد كما يظهر في القائمة';
 const transferSubmit=node('button','نقل ملكية لوحة التحكم');
 transferBox.form.append(transferSubmit);
 transferBox.form.onsubmit=async event=>{
   event.preventDefault();transferBox.result.textContent='';
   const chosen=recipient.value.toLowerCase();
   if(!chosen||typed.value.trim().toLowerCase()!==chosen){
     transferBox.result.textContent='اكتب البريد المختار حرفياً لتأكيد نقل الملكية';return;
   }
   if(!confirm('هل أنت متأكد من نقل ملكية لوحة التحكم إلى '+chosen+'؟'))return;
   transferSubmit.disabled=true;
   try{
     await verifyOwnerPassword(transferPassword.value);
     await api('/rest/v1/rpc/transfer_snounu_ownership',{method:'POST',body:{p_target_email:chosen}});
     transferBox.result.textContent='تم نقل الملكية بنجاح';
     role='editor';
     await enter();
     notice('تم نقل الملكية. حسابك الآن محرر.');
   }catch(error){transferBox.result.textContent=error.message;}
   finally{transferPassword.value='';transferSubmit.disabled=false;}
 };

 setupUnusedUploadCleanup(box);
}
function setupUnusedUploadCleanup(box){
 const cleanup=accountCard(box,'تنظيف الصور القديمة','يُبقي التنظيف الصور المستخدمة في الأطباق، الترحيب والإعلانات. الملفات المحذوفة لا يمكن استعادتها.');
 const scan=action('فحص الصور غير المستخدمة',async()=>{
  scan.disabled=true;cleanup.result.textContent='جارٍ الفحص...';
  try{
   const [objects,meals,ads,settings]=await Promise.all([
    api('/storage/v1/object/list/menu-images',{method:'POST',body:{prefix:'',limit:1000,offset:0}}),
    api('/rest/v1/dishes?select=image,rich_image'),
    api('/rest/v1/menu_ads?select=image'),
    api('/rest/v1/menu_settings?select=*')
   ]);
   const refs=[...meals,...ads,...settings].flatMap(row=>Object.values(row)).filter(x=>typeof x==='string');
   const unused=objects.filter(obj=>/^[0-9a-f-]{36}\.(png|jpg|webp)$/i.test(obj.name)&&!refs.some(ref=>ref.includes('/menu-images/'+obj.name)));
   const mb=unused.reduce((total,obj)=>total+Number(obj.metadata?.size||0),0)/1048576;
   cleanup.result.textContent=unused.length?unused.length+' ملف غير مستخدم ('+mb.toFixed(2)+' MB)':'لا توجد صور غير مستخدمة.';
   cleanup.form.querySelector('.cleanup-delete')?.remove();
   if(!unused.length)return;
   const remove=action('حذف الصور غير المستخدمة',async()=>{
    if(!confirm('حذف '+unused.length+' صور قديمة نهائياً؟ قد تنقطع روابط خارجية لها.'))return;
    remove.disabled=true;
    try{
     // Recheck every reference immediately before removal.
     const [d,a,m]=await Promise.all([
      api('/rest/v1/dishes?select=image,rich_image'),
      api('/rest/v1/menu_ads?select=image'),
      api('/rest/v1/menu_settings?select=*')
     ]);
     const latest=[...d,...a,...m].flatMap(row=>Object.values(row)).filter(x=>typeof x==='string');
     const names=unused.map(o=>o.name).filter(name=>!latest.some(ref=>ref.includes('/menu-images/'+name)));
     if(names.length)await api('/storage/v1/object/menu-images',{method:'DELETE',body:{prefixes:names}});
     cleanup.result.textContent='تم حذف '+names.length+' صورة قديمة غير مستخدمة.';
     remove.remove();
    }catch(e){cleanup.result.textContent=e.message;remove.disabled=false;}
   });
   remove.className='cleanup-delete';cleanup.form.append(remove);
  }catch(e){cleanup.result.textContent='فشل فحص الملفات: '+e.message;}
  finally{scan.disabled=false;}
 });
 cleanup.form.append(scan);
}

const gaEventLabels={
 'page_view':'مشاهدات الصفحات','view_item':'عرض تفاصيل طبق',
 'delivery_app_click':'نقرات تطبيقات التوصيل',
 'delivery_referral_unique':'الإحالات الفريدة',
 'add_to_wishlist':'إضافة إلى المفضلة',
 'meal_share_click':'مشاركة طبق','scroll':'التمرير في المنيو'
};
function gaNumber(number){return Number(number||0).toLocaleString('en-US',{maximumFractionDigits:0});}
function gaMoney(number){return Number(number||0).toLocaleString('en-US',{maximumFractionDigits:2})+' ₪';}
// Charts use the actual GA4 response only. Never fill missing history with sample data.
// Friendly acquisition labels based only on the source/medium recorded by GA4.
// Do NOT infer QR scans from (direct)/(none), nor infer Instagram placement from a referrer.
function gaFriendlyTrafficSource(raw){
 const name=String(raw||'').trim();
 const pieces=name.split(/\s+\/\s+/);
 const source=(pieces[0]||name).toLowerCase().trim();
 const medium=(pieces[1]||'').toLowerCase().trim();
 const both=(source+' / '+medium).toLowerCase();
 const qr=/(?:^|[^a-z0-9])(?:qr|qrcode|qr-code|qr_code|qrmenu|menu-qr|menu_qr)(?:$|[^a-z0-9])/.test(both);
 if(qr)return 'QR scans';
 if(/instagram|instagr\.am/.test(both) || /^social\s*\/\s*(?:ig|instagram)\b/i.test(name) ||
    /^(ig|ig\.me)$/.test(source))return 'Instagram Feeds';
 if(/(^|[^a-z])facebook|(^|[^a-z])fb(?:\.|\b)|m\.facebook/.test(source))return 'Facebook';
 if(/whatsapp|wa\.me/.test(source))return 'WhatsApp';
 if(/tiktok/.test(source))return 'TikTok';
 if(/youtube|youtu\.be/.test(source))return 'YouTube';
 if(/snapchat/.test(source))return 'Snapchat';
 if(/^(?:www\.)?google(?:\.[a-z.]+)?$/.test(source)){
  return /^(cpc|ppc|paid|paid search)$/.test(medium)?'Google Ads':'Google Search';
 }
 if(/bing\.com|^bing$/.test(source))return 'Bing Search';
 if(/^(direct|\(direct\))$/.test(source))return 'Direct / Unknown';
 if(/^(not set|\(not set\))$/.test(source)||!source)return 'Unknown Source';
 if(/^social$/.test(source))return 'Social Media';
 const cleaned=source.replace(/^https?:\/\//,'').replace(/^www\./,'')
  .split(/[?#]/)[0].split('/')[0].replace(/^l\./,'').trim();
 if(/^(?:referral|other|unassigned)$/.test(cleaned)||/^[a-f0-9]{12,}$/.test(cleaned)||/^[a-z0-9_-]{28,}$/.test(cleaned))return 'Other Sources';
 if(/^[-_a-z0-9.]{1,80}$/i.test(cleaned)){
  if(cleaned==='sonbol.ps')return 'Sonbol';
  if(cleaned==='makook.app')return 'Makook';
  return cleaned.replace(/\.(com|net|org|ps|me|io|co|app)$/i,'').replace(/[-_.]+/g,' ')
   .replace(/\b\w/g,c=>c.toUpperCase()).slice(0,42);
 }
 return 'Other Sources';
}
function gaGroupedTrafficSources(raw){
 const counts=new Map();
 for(const entry of raw||[]){
  const count=Number(entry?.count)||0;
  if(!(count>0))continue;
  const name=gaFriendlyTrafficSource(entry.name);
  counts.set(name,(counts.get(name)||0)+count);
 }
 return [...counts].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
}
function gaTopThreeSources(items,available,total){
 const box=node('section');box.id='ga-top-three-sources';box.className='ga-top-three';
 const heading=node('div');heading.className='ga-top-three-heading';
 const meta=node('div');meta.className='ga-top-three-text';
 meta.append(node('span','ACQUISITION HIGHLIGHTS'),node('h2','أقوى 3 مصادر للزيارات'));
 const details=action('كل المصادر',()=>document.getElementById('ga-top-traffic-sources')?.scrollIntoView({behavior:'smooth',block:'start'}));
 details.className='ga-view-sources';details.id='ga-view-sources';
 heading.append(meta,details);box.append(heading);
 if(!available){box.append(node('p','ترتيب المصادر لم يتوفر من GA4 بعد.'));return box;}
 const top=(items||[]).filter(i=>Number(i.count)>0).slice(0,3);
 if(!top.length){box.append(node('p','لا توجد زيارات معالجة لإظهار المصادر الأعلى بعد.'));return box;}
 const strip=node('div');strip.className='ga-top-three-grid';
 top.forEach((entry,index)=>{
  const card=node('div');card.className='ga-top-source-card';
  card.append(node('span',String(index+1).padStart(2,'0')));
  const label=node('strong',entry.name);label.title=entry.name;card.append(label);
  const volume=node('div');volume.className='ga-top-source-volume';
  volume.append(node('b',gaNumber(entry.count)),node('small','زيارة'));
  if(Number(total)>0)volume.append(node('em',(entry.count/total*100).toFixed(1)+'%'));
  card.append(volume);strip.append(card);
 });
 box.append(strip);return box;
}

function gaRankGraph(title,subtitle,items,{available=true,kind='meal',total=null}={}){
 const isSource=kind==='source';
 const section=node('section');section.className='analytics-report ga-chart-panel ga-rank-panel';
 const heading=node('div');heading.className='ga-chart-heading';
 heading.append(node('h2',title),node('p',subtitle));section.append(heading);
 if(!available){section.append(node('p','بيانات هذا التصنيف لم تصبح متاحة من GA4 بعد.'));return section;}
 const ranked=(items||[]).filter(i=>i&&Number(i.count)>0).slice(0,isSource?100:7);
 if(!ranked.length){section.append(node('p',isSource?'لا تتوفر مصادر زيارات معالجة لهذه الفترة بعد.':'لا توجد إحالات معالجة لهذا التصنيف خلال الفترة المحددة.'));return section;}
 const winner=ranked[0];
 const hero=node('div');hero.className='ga-rank-hero';
 hero.append(node('span',isSource?'المصدر الأول للزيارات':kind==='meal'?'الوجبة الأكثر إحالة':'تطبيق التوصيل الأكثر إحالة'));
 hero.append(node('strong',winner.name));
 hero.append(node('small',isSource?gaNumber(winner.count)+' زيارة'+(Number(total)>0?' · '+(100*winner.count/total).toFixed(1)+'% من إجمالي الزيارات':''):gaNumber(winner.count)+' إحالة أولى'));
 section.append(hero);
 const bars=node('div');bars.className='ga-horizontal-bars';
 const max=Math.max(...ranked.map(x=>Number(x.count)),1);
 for(const [index,r] of ranked.entries()){
  const line=node('div');line.className='ga-bar-line';
  const names=node('div');names.className='ga-bar-label';
  names.append(node('span',String(r.name)),node('strong',gaNumber(r.count)));
  const rail=node('div');rail.className='ga-bar-rail';rail.setAttribute('role','img');
  rail.setAttribute('aria-label',String(r.name)+': '+gaNumber(r.count)+(isSource?' زيارة':' إحالة'));
  const fill=node('div');fill.className='ga-bar-fill'+(index===0?' ga-bar-first':'');
  fill.style.width=(100*Number(r.count)/max).toFixed(2)+'%';
  rail.append(fill);line.append(names,rail);bars.append(line);
 }
 section.append(bars);
 return section;
}
function gaDailyLineChart(daily){
 const section=node('section');section.id='ga-daily-trend';section.className='analytics-report ga-chart-panel ga-line-panel';
 const heading=node('div');heading.className='ga-chart-heading';
 heading.append(node('h2','اتجاه الزيارات والزوار'),
  node('p','جلسات الزيارة والزوار في كل يوم — حسب بيانات GA4 المعالجة'));
 section.append(heading);
 const points=(daily||[]).filter(x=>/^\d{8}$/.test(String(x.date))&&Number.isFinite(Number(x.sessions))&&Number.isFinite(Number(x.users)));
 if(!points.length){section.append(node('p','لا توجد بيانات يومية معالجة بعد لهذه الفترة.'));return section;}
 const legend=node('div');legend.className='ga-line-legend';
 for(const [type,label] of [['visits','زيارات (Sessions)'],['users','زوار في اليوم']]){
  const item=node('span',label);item.className='ga-line-key '+type;legend.append(item);
 }
 section.append(legend);
 const NS='http://www.w3.org/2000/svg';
 const svg=(tag,attrs={})=>{
  const el=document.createElementNS(NS,tag);
  for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));
  return el;
 };
 const chart=svg('svg',{viewBox:'0 0 760 255',preserveAspectRatio:'xMidYMid meet',role:'img','aria-label':'رسم بياني للزيارات والزوار حسب اليوم'});
 chart.classList.add('ga-traffic-svg');
 const left=43,right=744,top=15,bottom=208;
 const max=Math.max(1,...points.flatMap(p=>[Number(p.sessions),Number(p.users)]));
 const x=i=>points.length===1?(left+right)/2:left+i*(right-left)/(points.length-1);
 const y=v=>bottom-(Number(v)/max)*(bottom-top);
 for(let i=0;i<=4;i++){
  const val=max*i/4,yy=y(val);
  chart.append(svg('line',{x1:left,y1:yy,x2:right,y2:yy,class:'ga-grid-line'}));
  const label=svg('text',{x:left-8,y:yy+4,'text-anchor':'end',class:'ga-axis-label'});
  label.textContent=gaNumber(Math.round(val));chart.append(label);
 }
 const formatDate=raw=>raw.slice(6,8)+'/'+raw.slice(4,6);
 const labelEvery=Math.max(1,Math.ceil(points.length/6));
 for(let i=0;i<points.length;i++){
  if(i%labelEvery!==0&&i!==points.length-1)continue;
  const label=svg('text',{x:x(i),y:237,'text-anchor':'middle',class:'ga-axis-label'});
  label.textContent=formatDate(points[i].date);chart.append(label);
 }
 const draw=(field,kind)=>{
  const commands=points.map((p,i)=>(i===0?'M':'L')+x(i).toFixed(1)+','+y(p[field]).toFixed(1)).join(' ');
  if(points.length>1&&kind==='visits'){
   const area=svg('path',{d:commands+' L'+x(points.length-1)+','+bottom+' L'+x(0)+','+bottom+' Z',class:'ga-line-area'});
   chart.append(area);
  }
  chart.append(svg('path',{d:commands,fill:'none',class:'ga-line-stroke '+kind}));
  points.forEach((p,i)=>{
   const c=svg('circle',{cx:x(i),cy:y(p[field]),r:points.length<12?3.8:2.5,class:'ga-line-point '+kind});
   const t=svg('title');t.textContent=formatDate(p.date)+' — '+(kind==='visits'?'زيارات: ':'زوار: ')+gaNumber(p[field]);
   c.append(t);chart.append(c);
  });
 };
 draw('sessions','visits');draw('users','users');
 section.append(chart);return section;
}
function gaEventsGraph(events){
 const ranked=Object.entries(events||{}).filter(([key,e])=>e&&Number(e.count)>0)
  .map(([key,e])=>({name:gaEventLabels[key]||key,count:e.count}))
  .sort((a,b)=>b.count-a.count).slice(0,6);
 const section=node('section');section.className='analytics-report ga-chart-panel ga-event-panel';
 const heading=node('div');heading.className='ga-chart-heading';
 heading.append(node('h2','أهم التفاعلات'),node('p','مقارنة عدد الأحداث المسجلة في الفترة'));
 section.append(heading);
 if(!ranked.length){section.append(node('p','لا توجد أحداث معالجة لعرض الرسم بعد.'));return section;}
 const max=Math.max(...ranked.map(x=>x.count),1);
 const bars=node('div');bars.className='ga-horizontal-bars';
 for(const r of ranked){
  const line=node('div');line.className='ga-bar-line';
  const names=node('div');names.className='ga-bar-label';
  names.append(node('span',r.name),node('strong',gaNumber(r.count)));
  const rail=node('div');rail.className='ga-bar-rail';
  const fill=node('div');fill.className='ga-bar-fill ga-event-fill';fill.style.width=(r.count/max*100).toFixed(2)+'%';
  rail.append(fill);line.append(names,rail);bars.append(line);
 }
 section.append(bars);return section;
}

// A scenario model, not actual sales. GA4 only provides first-referral events;
// conversion to completed orders and average order value remain explicit assumptions.
function gaEstimatedSalesPanel(data,pending){
 const panel=node('section');panel.id='ga-potential-sales';panel.className='analytics-report ga-sales-estimate';
 const heading=node('div');heading.className='ga-chart-heading';
 heading.append(node('h2','المبيعات المحتملة (تقديرية)'));
 heading.append(node('p','توقع مبني على إحالات التوصيل الأولى × نسبة التحويل المفترضة × متوسط قيمة الطلب. ليس مبيعات مؤكدة.'));
 panel.append(heading);
 const countReady=!pending&&data.reportStatus?.eventsAvailable===true&&
  data.totals?.uniqueReferrals!=null&&Number.isFinite(Number(data.totals.uniqueReferrals));
 const count=countReady?Math.max(0,Number(data.totals.uniqueReferrals)):null;
 const recordedAverage=data.totals?.averageReferralPrice;
 // GA4 recorded prices, not an editable assumption. A missing custom metric is unknown, not zero.
 const average=count>0&&data.reportStatus?.referralValueAvailable===true&&
  recordedAverage!=null&&Number.isFinite(Number(recordedAverage))
  ?Number(recordedAverage):null;
 let preferences={};
 try{preferences=JSON.parse(localStorage.getItem('snounu-estimated-sales-settings-v1')||'{}')||{};}catch{}
 const clamp=(v,minimum,maximum,fallback)=>{
  const n=Number(v);return Number.isFinite(n)&&n>=minimum&&n<=maximum?n:fallback;
 };
 let rate=clamp(preferences.conversionRate,10,20,15);
 const controls=node('div');controls.className='ga-estimate-controls';
 const conversion=node('label');conversion.className='ga-estimate-control';
 const rateLabel=node('span','نسبة التحويل المفترضة من إحالة إلى طلب');
 const rateValue=node('strong',rate+'%');rateValue.id='ga-conversion-rate-display';
 const slider=node('input');slider.type='range';slider.min='10';slider.max='20';slider.step='1';slider.value=String(rate);
 slider.id='ga-conversion-rate';slider.setAttribute('aria-label','نسبة التحويل المفترضة، من 10 إلى 20 بالمئة');
 const rangeLabels=node('div');rangeLabels.className='ga-estimate-range';
 rangeLabels.append(node('small','10%'),node('small','20%'));
 conversion.append(rateLabel,rateValue,slider,rangeLabels);
 const orderValue=node('div');orderValue.className='ga-estimate-control ga-estimate-calculated';
 orderValue.append(node('span','متوسط سعر الوجبة المُحال إليها (₪)'));
 const averageOutput=node('output',average===null?'—':gaMoney(average));
 averageOutput.id='ga-average-order-value';
 averageOutput.setAttribute('aria-label','متوسط قيمة الإحالة المحسوب تلقائياً من أسعار الوجبات');
 orderValue.append(averageOutput,node('small',average===null
  ?'بانتظار معالجة أسعار الإحالات من GA4'
  :'محسوب تلقائياً: '+gaMoney(data.totals.referralValue)+' ÷ '+gaNumber(count)+' إحالة فريدة. لا يمكن تعديله.'));
 controls.append(conversion,orderValue);
 panel.append(controls);
 const summary=node('p','إحالات التوصيل الفريدة حسب GA4: '+(count===null?'لم تتوفر بعد':gaNumber(count)));
 summary.className='ga-estimate-referrals';panel.append(summary);
 const cases=node('div');cases.className='ga-estimate-scenarios';
 const low=node('div'),selected=node('div'),high=node('div');
 for(const [box,title] of [[low,'المتحفظ (10%)'],[selected,'السيناريو المختار'],[high,'المتفائل (20%)']]){
  box.className='ga-estimate-scenario';
  box.append(node('span',title),node('strong','—'),node('small','—'));
  cases.append(box);
 }
 selected.classList.add('ga-estimate-selected');
 panel.append(cases);
 const explanation=node('p','الحساب: الإحالات الفريدة × نسبة التحويل × متوسط سعر الوجبة المُحال إليها. المتوسط يُحتسب من مجموع أسعار الإحالات المسجلة في GA4 ÷ عدد الإحالات الفريدة للفترة نفسها، بافتراض تسجيل سعر لكل إحالة. هذه قيمة محتملة وليست مبيعات حقيقية، والتعديل متاح لنسبة التحويل فقط.');
 explanation.className='ga-estimate-disclaimer';panel.append(explanation);
 const store=()=>{try{localStorage.setItem('snounu-estimated-sales-settings-v1',JSON.stringify({conversionRate:rate}));}catch{}};
 function update(){
  rateValue.textContent=rate+'%';
  const values=[[low,10],[selected,rate],[high,20]];
  for(const [box,pct] of values){
   const value=box.querySelector('strong'),caption=box.querySelector('small');
   value.textContent=average===null?'—':gaMoney(count*pct/100*average);
   caption.textContent=average===null?'بانتظار أسعار الإحالات المسجلة في GA4':(count*pct/100).toLocaleString('en-US',{maximumFractionDigits:2})+' طلب متوقع عند '+pct+'%';
  }
  selected.querySelector('span').textContent='السيناريو المختار ('+rate+'%)';
 }
 slider.addEventListener('input',()=>{
  rate=clamp(slider.value,10,20,15);
  update();store();
 });
 update();
 return panel;
}

function gaDeviceDonutPanel(devices,available){
 const panel=node('section');panel.id='ga-devices';panel.className='analytics-report ga-device-panel';
 panel.append(node('h2','الأجهزة'),node('p','توزيع المستخدمين النشطين حسب نوع الجهاز'));
 if(!available){panel.append(node('p','لا تتوفر بيانات الأجهزة بعد.'));return panel;}
 const map={mobile:'الجوال',desktop:'الكمبيوتر',tablet:'الجهاز اللوحي','smart tv':'التلفاز'};
 const items=(devices||[]).filter(r=>Number(r.count)>0).map(r=>({
  name:map[String(r.name).toLowerCase()]||String(r.name),
  count:Number(r.count)
 })).sort((a,b)=>b.count-a.count);
 if(!items.length){panel.append(node('p','لا تتوفر بيانات الأجهزة لهذه الفترة.'));return panel;}
 const sum=items.reduce((n,r)=>n+r.count,0);
 const colors=['#ec6937','#232c54','#6b8f9b','#c6b078','#a6a8b0'];
 let position=0;
 const gradients=items.map((r,i)=>{
  const from=position;position+=(r.count/sum)*100;
  return colors[i%colors.length]+' '+from.toFixed(2)+'% '+position.toFixed(2)+'%';
 });
 const ring=node('div');ring.className='ga-device-ring';
 ring.style.background='conic-gradient('+gradients.join(',')+')';
 ring.setAttribute('role','img');
 ring.setAttribute('aria-label',items.map(r=>r.name+' '+gaNumber(r.count)).join('، '));
 const middle=node('div');middle.className='ga-device-center';
 middle.append(node('strong',Math.round(items[0].count/sum*100)+'%'),node('span',items[0].name));
 ring.append(middle);panel.append(ring);
 const legend=node('div');legend.className='ga-device-legend';
 items.forEach((r,i)=>{
  const line=node('div');line.className='ga-device-legend-row';
  const label=node('span',r.name);label.style.setProperty('--device-color',colors[i%colors.length]);
  line.append(label,node('strong',Math.round(r.count/sum*100)+'%'));legend.append(line);
 });
 panel.append(legend);return panel;
}
function gaLanguagePanel(languages,available){
 const panel=node('section');panel.id='ga-languages';panel.className='analytics-report ga-language-panel';
 panel.append(node('h2','اللغة والمتصفح'),node('p','لغة المستخدم حسب تقارير GA4'));
 if(!available){panel.append(node('p','لم تتوفر بيانات اللغة بعد.'));return panel;}
 const mapping={ar:'العربية',en:'English',he:'עברית',fr:'Français',tr:'Türkçe',es:'Español',de:'Deutsch'};
 const totals=new Map();
 for(const r of languages||[]){
  const count=Number(r.count)||0;
  if(count<=0)continue;
  const code=String(r.name||'').toLowerCase().split(/[-_]/)[0];
  const name=mapping[code]||code.toUpperCase();
  totals.set(name,(totals.get(name)||0)+count);
 }
 const items=[...totals].sort((a,b)=>b[1]-a[1]).slice(0,6);
 if(!items.length){panel.append(node('p','لا تتوفر لغات معالجة لهذه الفترة.'));return panel;}
 const maximum=Math.max(...items.map(r=>r[1]),1);
 const body=node('div');body.className='ga-mini-bars';
 for(const [name,value] of items){
  const line=node('div');line.className='ga-mini-bar';
  const labels=node('div');labels.className='ga-mini-bar-top';
  labels.append(node('span',name),node('strong',gaNumber(value)));
  const track=node('div');track.className='ga-mini-bar-track';
  const fill=node('div');fill.className='ga-mini-bar-fill';fill.style.width=(100*value/maximum).toFixed(2)+'%';
  track.append(fill);line.append(labels,track);body.append(line);
 }
 panel.append(body);return panel;
}

async function renderGaOverview(days=28){
 const area=$('body'),ticket=generation;
 const top=node('div');top.className='ga-heading';
 const description=node('p','إحصائيات مباشرة من تقارير Google Analytics 4 (قد يتأخر تحديث البيانات).');
 const interval=node('select');interval.id='ga-date-range';interval.setAttribute('aria-label','الفترة الزمنية');
 for(const [count,label] of [[7,'آخر 7 أيام'],[28,'آخر 28 يوماً'],[90,'آخر 90 يوماً']]){
  const option=node('option',label);option.value=String(count);interval.append(option);
 }
 interval.value=String(days);
 interval.onchange=()=>renderGaOverview(Number(interval.value));
 const refresh=action('تحديث',()=>renderGaOverview(Number(interval.value)));
 refresh.id='ga-refresh';refresh.dataset.trackAction='ga_overview_refresh';
 top.append(description,interval,refresh);
 const status=node('p','جارٍ تحميل الإحصائيات من GA4…');status.id='ga-loading';
 area.replaceChildren(top,status);
 try{
  // Use the same authenticated session as the menu admin; no GA credentials in the browser.
  if(session?.expires_at*1000<Date.now()+60000)await api('/auth/v1/user');
  const response=await fetch('/api/ga4?days='+encodeURIComponent(days),{
   headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'
  });
  const data=await response.json();
  if(ticket!==generation)return;
  if(!response.ok){
   const msg=data.error==='not_configured'
    ?'الاتصال بـ GA4 لم يكتمل بعد. يجب تفعيل Google Analytics Data API وإضافة حساب خدمة Google بصلاحية Viewer، ثم ضبط GA4_SERVICE_ACCOUNT_JSON في إعدادات Vercel وإعادة النشر.'
    :'تعذر جلب بيانات GA4. تأكد من صلاحية حساب الخدمة، رقم الخاصية، وإعدادات الاتصال.';
   status.textContent=msg;status.className='ga-notice';return;
  }
  const realtime=data.realtime||{};
  const live=node('section');live.id='ga-realtime';live.className='analytics-report ga-live';
  live.append(node('h2','نشاط آخر 30 دقيقة (مباشر)'));
  if(realtime.available){
   const liveMetrics=node('div');liveMetrics.className='ga-live-metrics';
   const liveCards=[
    ['المستخدمون النشطون',realtime.activeUsers],
    ['مشاهدات الصفحة',realtime.eventCounts?.page_view],
    ['نقرات التوصيل',realtime.eventCounts?.delivery_app_click],
    ['الإحالات الأولى',realtime.eventCounts?.delivery_referral_unique]
   ];
   for(const [label,value] of liveCards){
    const card=node('div');card.className='ga-live-metric';
    card.append(node('span',label),node('strong',gaNumber(value||0)));liveMetrics.append(card);
   }
   live.append(liveMetrics);
   live.append(node('p','هذه أرقام آخر 30 دقيقة فقط؛ لا تمثل إجمالي الزيارات أو قيمة الإحالات للفترة المختارة.'));
  }else{
   live.append(node('p','تعذّر تحميل بيانات الوقت الفعلي حالياً. قد تكون خدمة GA4 Realtime غير متاحة مؤقتاً.'));
  }
  const pending=data.processedHasRows===false;
  const hero=node('section');hero.id='ga-overview-hero';hero.className='ga-overview-hero';
  const heroHeading=node('div');heroHeading.className='ga-hero-heading';
  heroHeading.append(node('span','SNOUNU  /  MENU INTELLIGENCE'),node('h2','المنيو بالأرقام.'));
  heroHeading.append(node('p','من الزيارة الأولى حتى إحالة الطلب — صورة أوضح عن أداء منيو سنونو.'));
  const heroSnapshot=node('div');heroSnapshot.className='ga-hero-snapshot';
  const snapshot=[
   ['الزيارات',pending?'—':gaNumber(data.summary?.sessions)],
   ['الزوار',pending?'—':gaNumber(data.summary?.totalUsers)],
   ['نشطون الآن',realtime.available?gaNumber(realtime.activeUsers||0):'—']
  ];
  for(const [label,value] of snapshot){
   const item=node('div');item.className='ga-hero-snapshot-item';
   item.append(node('span',label),node('strong',value));heroSnapshot.append(item);
  }
  const heroTop=node('div');heroTop.className='ga-hero-top';
  heroTop.append(heroHeading,heroSnapshot);
  hero.append(heroTop,top);
  const pendingNote=pending?node('p','لم تتوفر بيانات مُعالجة للفترة المحددة بعد. الأحداث التي تصل إلى Realtime قد تحتاج 24–48 ساعة لتظهر في تقارير الزيارات والإحالات وقيمتها. الرموز (—) أدناه تعني أن البيانات لم تصل، وليست صفراً مؤكداً.'):null;
  if(pendingNote)pendingNote.className='ga-notice';
  const historyTitle=node('h2','التقارير التاريخية — آخر '+String(days)+' يوماً');
  historyTitle.className='ga-history-title';
  const estimate=gaEstimatedSalesPanel(data,pending);
  const metrics=node('section');metrics.id='ga-summary-cards';metrics.className='ga-stats-grid';
  const cards=[
   ['الزيارات (Sessions)',gaNumber(data.summary.sessions),'عدد الجلسات، وليس عدد الأشخاص'],
   ['الزوار الفريدون',gaNumber(data.summary.totalUsers),'مستخدمون مميزون ضمن الفترة المحددة'],
   ['الزوار الجدد',gaNumber(data.summary.newUsers),'أول زيارة مقاسة'],
   ['مشاهدات الصفحات',gaNumber(data.summary.views),'تشمل المشاهدات المتكررة'],
   ['الجلسات المتفاعلة',gaNumber(data.summary.engagedSessions),'حسب تعريف GA4 للجلسة المتفاعلة'],
   ['الأحداث الرئيسية',gaNumber(data.summary.keyEvents),'جميع الأحداث المحددة كأحداث رئيسية'],
   ['نقرات التوصيل',gaNumber(data.eventCounts?.delivery_app_click?.count),'تشمل النقرات المتكررة'],
   ['إحالات التوصيل الفريدة',gaNumber(data.eventCounts?.delivery_referral_unique?.count),'أول إحالة من كل نافذة جلسة في المنيو'],
   ['قيمة الإحالات',data.reportStatus?.referralValueAvailable?gaMoney(data.totals.referralValue):'—','قيمة سعر الطبق، وليست إيرادات مبيعات مثبتة']
  ];
  if(pending)for(const card of cards){
   card[1]='—';
   card[2]='التقرير التاريخي لم يُعالج بعد';
  }
  for(const [name,value,detail] of cards){
   const card=node('article');card.className='ga-stat';
   card.append(node('span',name),node('strong',value),node('small',detail));metrics.append(card);
  }
  const makeTable=(heading,headers,rows)=>{
   const block=node('section');block.className='analytics-report ga-table';
   block.append(node('h2',heading));
   if(!rows.length){block.append(node('p','لا تتوفر بيانات معالجة لهذه الفترة بعد.'));return block;}
   const table=node('table');table.className='action-report-table';
   const head=node('thead'),tr=node('tr');headers.forEach(h=>tr.append(node('th',h)));head.append(tr);table.append(head);
   const body=node('tbody');
   for(const entry of rows){
    const row=node('tr');for(const cellValue of entry)row.append(node('td',cellValue));body.append(row);
   }
   table.append(body);block.append(table);return block;
  };
  const eventCounts=Object.entries(data.eventCounts||{}).map(([key,entry])=>[
   gaEventLabels[key]||key,gaNumber(entry.count),gaNumber(entry.keyEvents)
  ]);
  const eventsTable=makeTable('الأحداث المهمة',['الحدث','مرات التنفيذ','أحداث رئيسية'],eventCounts);
  const topReferrals=(data.referrals||[]).slice(0,30).map(r=>[
   r.meal,r.platform,gaNumber(r.count),r.value==null?'—':gaMoney(r.value)
  ]);
  const refTable=makeTable('الإحالات حسب الطبق والتطبيق',['الطبق','تطبيق التوصيل','إحالات','قيمة الإحالات'],topReferrals);
  // Rank by the first attributed referral, never by repeated outbound clicks.
  const ranks=node('div');ranks.id='ga-referral-rankings';ranks.className='ga-charts-grid';
  ranks.append(
   gaRankGraph('الوجبات الأكثر إحالة','الوجبات التي دفعت الزوار إلى تطبيق طلب لأول مرة في جلستهم',data.topMeals,{
    available:data.reportStatus?.mealRankingAvailable===true,kind:'meal'
   }),
   gaRankGraph('تطبيقات التوصيل الأكثر إحالة','التطبيق الذي اختاره الزائر أولاً خلال الجلسة',data.topPlatforms,{
    available:data.reportStatus?.platformRankingAvailable===true,kind:'platform'
   })
  );
  const friendlySources=gaGroupedTrafficSources(data.trafficSources||[]);
  const topSources=gaTopThreeSources(friendlySources,data.reportStatus?.trafficSourcesAvailable===true,data.summary?.sessions);
  const sources=gaRankGraph('مصادر الزيارات بالتفصيل','المصادر المسجلة في GA4، بعد جمع الزيارات المتشابهة وتبسيط أسمائها',friendlySources,{
   available:data.reportStatus?.trafficSourcesAvailable===true,kind:'source',total:data.summary?.sessions
  });
  sources.id='ga-top-traffic-sources';
  const sourceNote=node('p','QR scans لا تُحتسب إلا لروابط QR الموسومة في GA4. وDirect / Unknown تعني أن مصدر الزيارة غير معروف. تسمية Instagram Feeds للتبسيط ولا تثبت مكان ظهور الرابط داخل إنستغرام.');
  sourceNote.className='ga-traffic-source-note';sources.append(sourceNote);
  const trend=gaDailyLineChart(data.daily||[]);
  const eventsGraph=gaEventsGraph(data.eventCounts||{});
  const foot=node('p','المصدر: Google Analytics 4 · آخر جلب: '+new Date(data.asOf).toLocaleString('ar')+' · لا تمثل قيمة الإحالات مبيعات فعلية.');
  foot.className='ga-footnote';
  const notes=(data.warning||[]).length?node('p','ملاحظة: بعض بيانات GA4 لا تزال غير متاحة أو قيد المعالجة، خاصةً الأبعاد والمقاييس المخصصة.') :null;
  if(notes)notes.className='ga-notice';
  area.classList.add('ga-overview');
  area.replaceChildren(hero,topSources,live,...(pendingNote?[pendingNote]:[]),historyTitle,estimate,ranks,trend,metrics,eventsGraph,refTable,eventsTable,sources,foot,...(notes?[notes]:[]));
 }catch(error){
  if(ticket===generation){status.textContent='حدث خطأ أثناء قراءة GA4. '+(error?.message||'');status.className='ga-notice';}
 }
}

async function renderActionReports(){
 const area=$('body'),ticket=generation;
 const [events,meals]=await Promise.all([
  api('/rest/v1/menu_action_events?select=created_at,action,element_id,route,mode,meal_id,category_id&order=created_at.desc&limit=1000'),
  api('/rest/v1/dishes?select=id,name')
 ]);
 if(ticket!==generation)return;
 const names=new Map(meals.map(m=>[String(m.id),m.name]));
 const cutoff=Date.now()-7*86400000;
 const week=events.filter(e=>new Date(e.created_at).getTime()>=cutoff);
 const grouped=(rows,key)=>{const m=new Map();for(const r of rows){const k=r[key];if(k)m.set(k,(m.get(k)||0)+1);}return [...m].sort((a,b)=>b[1]-a[1]);};
 const table=(titles,rows)=>{
  const el=node('table');el.className='action-report-table';
  const head=node('thead'),tr=node('tr');
  for(const text of titles)tr.append(node('th',text));
  head.append(tr);el.append(head);
  const body=node('tbody');
  for(const items of rows){const row=node('tr');for(const value of items){
   const cell=node('td');if(value instanceof Node)cell.append(value);else cell.textContent=String(value??'—');row.append(cell);
  }body.append(row);}
  el.append(body);return el;
 };
 const block=(id,heading,headers,rows)=>{
  const box=node('section');box.id=id;box.className='analytics-report';
  box.append(node('h2',heading),table(headers,rows));return box;
 };
 const summary=node('section');summary.id='action-report-summary';summary.className='analytics-report';
 summary.append(
  node('h2','الإجراءات المسجلة خلال آخر 7 أيام'),
  node('p','الإجراءات: '+week.length+' | الطلب: '+week.filter(e=>e.action==='order_platform_click').length+' | المفضلة: '+week.filter(e=>e.action==='favorite_toggle').length),
  node('p','يعرض التقرير آخر 1000 إجراء مسجل كحد أقصى. لا نخزن أسماء الزوار أو أرقام الهواتف أو الرسائل أو معرّفات المستخدمين.')
 );
 const actions=block('action-report-types','الإجراءات الأكثر استخداماً',['الإجراء','العدد'],grouped(week,'action').slice(0,40));
 const controls=block('action-report-controls','الأزرار والروابط الأكثر استخداماً',['معرّف العنصر','العدد'],grouped(week,'element_id').slice(0,40));
 const dishRows=grouped(week,'meal_id').slice(0,30).map(([id,n])=>{
  const link=node('a',names.get(id)||id);link.href=menuLink('meal',id);link.target='_blank';link.rel='noopener noreferrer';
  return [link,n];
 });
 const dishesBox=block('action-report-meals','الوجبات الأكثر تفاعلاً',['الوجبة','الإجراءات'],dishRows);
 const recent=block('action-report-recent','آخر الإجراءات',['التاريخ','الإجراء','المعرّف','الوضع'],events.slice(0,60).map(e=>[
  new Date(e.created_at).toLocaleString('ar'),e.action,e.element_id,e.mode
 ]));
 const refresh=action('تحديث التقرير',()=>renderActionReports());
 refresh.id='admin-report-refresh';refresh.dataset.trackAction='admin_report_refresh';
 area.replaceChildren(refresh,summary,actions,controls,dishesBox,recent);
}
async function openSection(key){
 if(['menu_staff','account','events','overview'].includes(key)&&role!=='owner'){
  notice('هذه الصفحة متاحة للمالك فقط');return;
 }
 $('body').classList.toggle('ga-overview',key==='overview');
 const sameSection=section===key;
 const ticket=++generation; section=key; history.replaceState(null,'','#'+key); notice(''); if(!sameSection||key==='account'||key==='events')$('body').replaceChildren(); $('title').textContent=sections[key][0];
 for(const b of $('tabs').querySelectorAll('[data-section]'))b.setAttribute('aria-current',String(b.dataset.section===key));
 if(key==='account'){await renderOwnerAccount();return;}
 if(key==='overview'){await renderGaOverview();return;}
  if(key==='events'){await renderActionReports();return;}
 const feedback=['rankings','submissions'].includes(key);
 const table=feedback?'menu_feedback':key;
 const condition=feedback?'&kind='+ (key==='rankings'?'eq.':'neq.') +encodeURIComponent('تقييم'):'';
 const order=feedback?'created_at.desc':key==='menu_staff'?'email':key==='menu_settings'?'id':'position,name';
 const rows=await api('/rest/v1/'+table+'?select=*&order='+order+condition);
 const categoryRows=key==='dishes'?await api('/rest/v1/categories?select=id,name,position&order=position,name'):[];
 if(ticket!==generation)return;
 const area=$('body');
 const previousY=sameSection?window.scrollY:0;
 area.replaceChildren();
 if(!feedback&&!['menu_settings','menu_links'].includes(key))area.append(action('إضافة',()=>edit(key,{})));
 if(!rows.length)area.append(node('p','لا توجد عناصر بعد.'));
 if(key==='menu_settings'){
   if(rows[0])await edit('menu_settings',rows[0],true);
   if(ticket===generation&&sameSection)window.scrollTo({top:previousY,behavior:'instant'});
   return;
 }
 const categoryGroups=new Map();
 if(['categories','menu_ads'].includes(key)){
   const hint=node('p','اسحب العنصر من المقبض ⋮⋮ وضعه فوق أو تحت العنصر الآخر لتغيير ترتيب العرض. يتم الحفظ تلقائياً، دون إدخال أرقام.');
   hint.className='dish-sort-hint';area.append(hint);
 }
 if(key==='dishes'){
   const hint=node('p','اسحب الطبق من المقبض ⋮⋮ وضعه فوق أو تحت طبق آخر داخل نفس الصنف. يتم حفظ الترتيب تلقائياً.');
   hint.className='dish-sort-hint';area.append(hint);
   for(const category of categoryRows){
     const section=node('section');section.className='dish-sort-section';
     section.append(node('h2',category.name));
     const group=node('div');group.className='dish-sort-list';
     group.dataset.categoryId=category.id;
     section.append(group);area.append(section);
     categoryGroups.set(category.id,group);
   }
 }
 for(const row of rows){
   const card=node('article');card.id='admin-'+key+'-'+(row.id||'row');
   if(['dishes','categories','menu_ads'].includes(key)){
     if(key==='dishes')card.dataset.dishId=row.id;
     else card.dataset.sortId=row.id;
     card.classList.add('dish-sort-card');
     const handle=node('button','⋮⋮');handle.type='button';handle.id='admin-drag-'+key+'-'+row.id;handle.dataset.trackAction='admin_reorder_handle';
     handle.className='dish-drag-handle';
     handle.title='اسحب لتغيير الترتيب';
     handle.setAttribute('aria-label','تغيير ترتيب '+row.name+' بالسحب أو بأسهم لوحة المفاتيح');
     card.append(handle);
   }
   if(key==='dishes'&&row.image){const photo=node('img');photo.src=row.image;photo.className='dish-thumb';photo.alt='';photo.draggable=false;card.append(photo);}
   if(key==='menu_links'&&row.channel){const icon=node('img');icon.src='/assets/'+row.channel+'.svg';icon.className='channel-icon';icon.alt='';card.append(icon);}
   card.append(node('strong',key==='rankings'?(row.meal_name||'طبق محذوف قبل تسجيل اسمه'):(row.name||row.email||row.kind)));
   if(feedback){card.style.flexWrap='wrap';card.append(node('span',[row.kind,row.phone,row.stars?row.stars+' ★':'',row.message].filter(Boolean).join(' · ')));}
   if(key==='dishes') {
     const item=node('bdi',row.price+' ₪');item.dir='ltr';item.className='price';card.append(item);
     if(row.old_price!==null&&row.old_price!==undefined&&row.old_price!==''&&Number(row.old_price)!==Number(row.price)){
       const old=node('del',row.old_price+' ₪');old.className='previous-price';
       old.title='السعر السابق';card.append(old);
     }
     const control=node('label');control.className='availability-control';
     const input=node('input');input.type='checkbox';input.className='availability-toggle';input.id='admin-availability-'+row.id;input.checked=row.available!==false;
     input.setAttribute('aria-label','توفر '+row.name);
     const rail=node('span');rail.className='availability-track';rail.setAttribute('aria-hidden','true');
     const status=node('span',input.checked?'متوفر':'غير متوفر');status.className='availability-status';
     control.append(input,rail,status);control.dataset.available=String(input.checked);
     input.onchange=async()=>{
       const next=input.checked;input.disabled=true;
       try {
         await api('/rest/v1/dishes?'+filter(row),{method:'PATCH',body:{available:next}});
         row.available=next;control.dataset.available=String(next);
         status.textContent=next?'متوفر':'غير متوفر';
         notice(next?'الطبق متوفر الآن':'تم تعيين الطبق غير متوفر');
       }catch(err){
         input.checked=!next;
         notice('تعذّر تغيير التوفر: '+err.message);
       }finally{input.disabled=false;}
     };
     card.append(control);
   }
   if(['dishes','categories'].includes(key)){
    const copy=action('نسخ الرابط',async()=>{
      const url=menuLink(key==='dishes'?'meal':'category',row.id);
      if(navigator.clipboard?.writeText){
       try{await navigator.clipboard.writeText(url);notice('تم نسخ رابط '+row.name);return;}catch{}
      }
      prompt('انسخ الرابط',url);
    });
    copy.id='admin-copy-'+key+'-'+row.id;copy.dataset.trackAction='admin_copy_permalink';
    card.append(copy);
   }
   if(key==='menu_staff')card.append(node('span',row.role==='owner'?'مالك':'محرر'));
   else if(!feedback) card.append(action('تعديل',()=>edit(key,row)));
   if(!['menu_settings','menu_links'].includes(key)&&row.role!=='owner')card.append(action(key==='menu_staff'?'إلغاء الصلاحية':'حذف',async()=>{
     if(!confirm('تأكيد إزالة '+(row.meal_name||row.name||row.email||row.kind)+'؟'))return;
     await api('/rest/v1/'+table+'?'+filter(row)+condition,{method:'DELETE'});await openSection(key);
   }));
   if(key==='dishes'){
     const group=categoryGroups.get(row.category_id);
     (group||area).append(card);
   }else area.append(card);
 }
 if(key==='dishes')setupDishSorting(categoryGroups,rows);
 if(['categories','menu_ads'].includes(key))setupFlatSorting(key,rows);
 if(sameSection)window.scrollTo({top:previousY,behavior:'instant'});
}
const filter=row=>row.id!==undefined?'id=eq.'+row.id:'email=eq.'+encodeURIComponent(row.email);
async function edit(key,row,inline=false){
 const form=inline?node('form'):$('edit');
 form.replaceChildren(node('h2',inline?'إعدادات مطعم السنونو':(row.id?'تعديل':'إضافة')+' · '+sections[key][0]));
 if(inline){form.className='inline-settings-form';$('body').append(form);}
 const cats=key==='dishes'?await api('/rest/v1/categories?select=id,name&order=position,name'):[];
 if(key==='dishes'&&!cats.length){notice('أضف صنفاً أولاً لتضع الطبق فيه.');return;}
 const dishes=key==='menu_ads'?await api('/rest/v1/dishes?select=id,name&order=name'):[];
 const uploads={};
 const sizes={image:key==='menu_ads'?'1080 × 285':'1200 × 740',rich_image:'صورة PNG/WebP شفافة 900 × 900 أو أكبر',logo:'564 × 183',welcome_image_1:'صورة شفافة 720 × 720',welcome_image_2:'صورة شفافة 720 × 720',welcome_image_3:'صورة شفافة 720 × 720',banner:'1080 × 285',banner_two:'1080 × 285',banner_three:'1080 × 285'};
 if(key==='menu_links')form.append(node('p',row.name));

 for(const [field,caption,type='text'] of sections[key][1]){
   const label=node('label',caption);const input=node(type==='textarea'?'textarea':['select','product'].includes(type)?'select':'input');
   input.name=field;if(input.tagName==='INPUT')input.type=({image:'text',integer:'number',optionalRating:'number',optionalPrice:'number',position:'range'}[type]||type);
   if(type==='select')for(const cat of cats){const option=node('option',cat.name);option.value=cat.id;input.append(option);}
   if(type==='product'){
     const empty=node('option','عرض الإعلان مع روابط الطلب');empty.value='';input.append(empty);
     for(const dish of dishes){const option=node('option',dish.name);option.value=dish.id;input.append(option);}
   }
   if(type==='locked'){input.readOnly=true;input.title='للقراءة فقط';}
   if(type==='checkbox'){input.checked=row[field]??true;label.classList.add('availability-field');}
   else input.value=row[field]??(type==='select'?cats[0].id:field==='position'?0:'');
   if(type==='position'){
     input.min='5';input.max='95';input.step='1';
     input.value=row[field]??(field.startsWith('rich_badge_')?(field.endsWith('_x')?77:36):(field.includes('_x_')?82:28));
     const value=node('output',input.value+'%');value.className='position-value';
     input.addEventListener('input',()=>{value.textContent=input.value+'%';});
     label.classList.add('position-setting');label.append(value);
   }
   if(type==='number'){input.step='0.01';input.min='0';}
   if(type==='optionalPrice'||type==='optionalRating'){input.step=type==='optionalPrice'?'0.01':'0.1';input.min=0;if(type==='optionalRating')input.max=5;}
   if(['sonbol_url','makook_url'].includes(field)){input.dir='ltr';input.pattern='https://.+';}
   if(type==='password')input.minLength=12;
   input.required=['name','price','email','password','url','category_id','position'].includes(field);
   label.append(input);
   if(field==='sonbol_url')label.append(node('small','الصق رابط الوجبة من سنبل ليظهر زر طلبها في نافذة الطبق.'));
   if(field==='makook_url')label.append(node('small','اختياري: رابط وجبة مباشر من مكوك؛ عند تركه فارغاً يظهر رابط مطعم سنونو العام على مكوك في الوضع التفاعلي.'));
   if(field==='rich_image')label.append(node('small','خاص بالوضع التفاعلي فقط. حمّل صورة PNG/WebP شفافة مع الحفاظ على صورة الطبق العادي كما هي؛ عند تركه فارغاً نعرض الصورة العادية.'));
   if(field==='old_price')label.append(node('small','السعر السابق يظهر مشطوباً بالرمادي حتى لو كان أقل من الحالي (ارتفاع سعر). اتركه فارغاً إن لم يكن هناك سعر سابق.'));
   if(field==='rich_badge_x')label.append(node('small','لكل طبق موضع مستقل. يمكنك سحب الشارة فوق الصورة في المعاينة بالأسفل أو تعديل النسبة.'));
   if(field==='ingredients')label.append(node('small','افصل المكونات بفاصلة، أو اكتب «خضار: خس، خيار» في سطر لكل مجموعة.'));
   if(type==='image'){const hint=node('small', 'المقاس المقترح: '+(sizes[field]||'1200 × 740')+' — يُفضّل WebP أو PNG بخلفية شفافة');label.append(hint);const upload=node('input');upload.type='file';upload.accept='image/png,image/jpeg,image/webp';label.append(upload);uploads[field]=upload;}
   form.append(label);
 }
 const error=node('p');error.setAttribute('role','alert'); const save=node('button',inline?'حفظ جميع الإعدادات':'حفظ');save.id='admin-save-'+key+'-'+(row.id||'new');save.dataset.trackAction='admin_save_click';
 const footer=node('footer');footer.append(save);
 if(!inline)footer.append(action('إلغاء',()=>$('dialog').close()));
 form.append(error,footer);
 form.onsubmit=async event=>{
   event.preventDefault();save.disabled=true;error.textContent='';
   try {
     const data={};
     for(const [field,,type] of sections[key][1]){
       if(type==='locked')continue;
       const input=form.elements.namedItem(field);
       data[field]=type==='product'?(input.value||null):['optionalRating','optionalPrice'].includes(type)?(input.value===''?null:Number(input.value)):type==='checkbox'?input.checked:['number','integer','position'].includes(type)?Number(input.value):type==='password'?input.value:input.value.trim();
       const file=uploads[field]?.files[0];
       if(file){
         if(file.size>5242880)throw new Error('الحد الأقصى للصورة 5 ميغابايت');
         const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
         if(!ext)throw new Error('اختر صورة PNG أو JPEG أو WebP');
         const path='/menu-images/'+crypto.randomUUID()+'.'+ext;
         await api('/storage/v1/object'+path,{method:'POST',body:file});
         data[field]=endpoint+'/storage/v1/object/public'+path;
       }
     }
     if(key==='dishes'){
       if(!data.sonbol_url)data.sonbol_url=null;
       if(!data.makook_url)data.makook_url=null;
       if(!data.utlob_url)data.utlob_url=null;
       if(!data.rich_image)data.rich_image=null;
       if(!row.id){
         const existing=await api('/rest/v1/dishes?select=position&category_id=eq.'+encodeURIComponent(data.category_id)+'&order=position.desc&limit=1');
         data.position=(Number(existing[0]?.position)||0)+1;
       }
     }
     if(['categories','menu_ads'].includes(key)&&!row.id){
       const existing=await api('/rest/v1/'+key+'?select=position&order=position.desc&limit=1');
       data.position=(Number(existing[0]?.position)||0)+1;
     }
     if(key==='menu_ads'&&!data.image)throw new Error('أضف صورة للإعلان');
     const result=key==='menu_staff'?await api('/functions/v1/menu-staff',{method:'POST',body:data}):await api('/rest/v1/'+key+(row.id?'?'+filter(row):''),{method:row.id?'PATCH':'POST',body:data,headers:{Prefer:'return=representation'}});
     if(key!=='menu_staff'&&(!Array.isArray(result)||result.length===0))throw new Error('لم يؤكد الخادم حفظ التغييرات. تحقق من الصلاحيات وأعد المحاولة.');
     if(!inline)$('dialog').close();
     adminReporting.report('admin_save_success',save,{meal_id:key==='dishes'?(row.id||result?.[0]?.id||null):null});
     await openSection(key);notice(result?.message||'تم الحفظ');
   }catch(e){error.textContent=e.message;adminReporting.report('admin_save_error',save,{meal_id:key==='dishes'?row.id||null:null});}finally{save.disabled=false;}
 };
 if(inline){
   setupWelcomeLabelPositionPreviews(form,row,uploads);
 }else{
   if(key==='dishes')setupRichBadgePositionPreview(form,row,uploads);
   setupPreview(key,row,uploads);
   $('dialog').showModal();
 }
}
if(location.hash.includes('access_token='))history.replaceState(null,'',location.pathname);
if(session)enter().catch(e=>{persist(null);loggedOut();notice(e.message);});else loggedOut();

/* Dedicated draggable label preview for each of the three welcome meals. */
function setupWelcomeLabelPositionPreviews(form,row,uploads){
 const labels=['بوكس المشاركة','نوك أوت','ناشفيل'];
 const title=node('p','موضع النص مستقل لكل وجبة. اسحب البطاقة فوق الصورة أو استخدم شريطي الموضع. تُحفظ جميع التغييرات عند الضغط على «حفظ جميع الإعدادات».');
 title.className='inline-settings-help';
 form.insertBefore(title,form.querySelector('label'));
 for(let n=1;n<=3;n++){
   const x=form.elements.namedItem('welcome_label_x_'+n);
   const y=form.elements.namedItem('welcome_label_y_'+n);
   const image=form.elements.namedItem('welcome_image_'+n);
   const name=form.elements.namedItem('welcome_meal_'+n);
   if(!x||!y||!image)continue;
   const field=x.closest('label');
   const widget=node('div');widget.className='label-position-preview';
   const picture=node('img');picture.className='label-position-food';
   picture.alt='معاينة وجبة '+labels[n-1];picture.draggable=false;
   picture.src=row['welcome_image_'+n]||'/assets/welcome/'+[2468,2465,2472][n-1]+'.webp';
   const floating=node('div');floating.className='label-position-badge';
   const prefix=node('strong',row.welcome_label||'من سنونو');
   const mealName=node('span',name.value||labels[n-1]);
   floating.append(prefix,mealName);
   floating.tabIndex=0;floating.setAttribute('role','slider');
   floating.setAttribute('aria-label','اسحب لتغيير موضع النص للوجبة '+n);
   widget.append(picture,floating);
   const clamp=v=>Math.min(95,Math.max(5,Math.round(v)));
   const sync=()=>{
     floating.style.left=x.value+'%';
     floating.style.top=y.value+'%';
     floating.setAttribute('aria-valuetext','أفقي '+x.value+' بالمئة وعمودي '+y.value+' بالمئة');
     x.dispatchEvent(new Event('input',{bubbles:false}));
     y.dispatchEvent(new Event('input',{bubbles:false}));
   };
   const start=event=>{
     if(event.button!==0)return;
     event.preventDefault();floating.setPointerCapture(event.pointerId);
     const move=e=>{
       const r=widget.getBoundingClientRect();
       x.value=clamp((e.clientX-r.left)/r.width*100);
       y.value=clamp((e.clientY-r.top)/r.height*100);
       sync();
     };
     move(event);
     floating.addEventListener('pointermove',move);
     floating.addEventListener('pointerup',()=>floating.removeEventListener('pointermove',move),{once:true});
     floating.addEventListener('pointercancel',()=>floating.removeEventListener('pointermove',move),{once:true});
   };
   floating.addEventListener('pointerdown',start);
   floating.addEventListener('keydown',event=>{
     const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
     if(!delta)return;event.preventDefault();
     x.value=clamp(Number(x.value)+delta[0]);
     y.value=clamp(Number(y.value)+delta[1]);sync();
   });
   x.addEventListener('input',()=>{floating.style.left=x.value+'%';});
   y.addEventListener('input',()=>{floating.style.top=y.value+'%';});
   name.addEventListener('input',()=>mealName.textContent=name.value||labels[n-1]);
   form.elements.namedItem('welcome_label')?.addEventListener('input',e=>prefix.textContent=e.target.value||'من سنونو');
   image.addEventListener('input',()=>{if(!uploads['welcome_image_'+n]?.files?.length)picture.src=image.value||picture.src;});
   uploads['welcome_image_'+n]?.addEventListener('change',event=>{
     const file=event.target.files[0];
     if(file)picture.src=URL.createObjectURL(file);
   });
   sync();
   field.parentNode.insertBefore(widget,field);
 }
}
/* Per-dish interactive badge position editor. The preview uses the same
   image-box percentage coordinates and Qatar badge style as rich-menu. */
function setupRichBadgePositionPreview(form,row,uploads){
 const x=form.elements.namedItem('rich_badge_x');
 const y=form.elements.namedItem('rich_badge_y');
 const badgeText=form.elements.namedItem('badge');
 const richImage=form.elements.namedItem('rich_image');
 const normalImage=form.elements.namedItem('image');
 if(!x||!y||!badgeText)return;
 const section=node('section');section.className='rich-badge-editor';
 const title=node('h3','معاينة موضع الشارة في الوضع التفاعلي');
 const hint=node('p','اسحب الشارة إلى المكان المناسب فوق الصورة، أو استخدم شريطي الموضع الأفقي والعمودي. التعديل خاص بهذا الطبق وبالوضع التفاعلي فقط.');
 const stage=node('div');stage.className='rich-badge-preview';
 const image=node('img');image.className='rich-badge-preview-image';image.alt='معاينة الطبق';image.draggable=false;
 const badge=node('span');badge.className='rich-badge-preview-tag';
 badge.tabIndex=0;badge.setAttribute('role','slider');badge.setAttribute('aria-label','موضع شارة هذا الطبق');
 stage.append(image,badge);section.append(title,hint,stage);
 const yLabel=y.closest('label');
 yLabel.after(section);
 const clamp=v=>Math.min(95,Math.max(5,Math.round(v)));
 const redraw=()=>{
   badge.style.left=x.value+'%';
   badge.style.top=y.value+'%';
   badge.textContent=badgeText.value.trim()||'شارة الطبق';
   badge.classList.toggle('is-placeholder',!badgeText.value.trim());
   badge.setAttribute('aria-valuetext','أفقي '+x.value+' بالمئة، عمودي '+y.value+' بالمئة');
 };
 x.addEventListener('input',redraw);
 y.addEventListener('input',redraw);
 badgeText.addEventListener('input',redraw);
 let activePointer=null;
 const move=e=>{
   const r=stage.getBoundingClientRect();
   x.value=clamp((e.clientX-r.left)/r.width*100);
   y.value=clamp((e.clientY-r.top)/r.height*100);
   x.dispatchEvent(new Event('input',{bubbles:true}));
   y.dispatchEvent(new Event('input',{bubbles:true}));
 };
 badge.addEventListener('pointerdown',e=>{
   if(e.button!==0)return;
   e.preventDefault();e.stopPropagation();
   activePointer=e.pointerId;
   badge.setPointerCapture(e.pointerId);
   move(e);
 });
 badge.addEventListener('pointermove',e=>{
   if(activePointer===e.pointerId)move(e);
 });
 const release=e=>{if(activePointer===e.pointerId)activePointer=null;};
 badge.addEventListener('pointerup',release);
 badge.addEventListener('pointercancel',release);
 badge.addEventListener('keydown',e=>{
   const step={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
   if(!step)return;
   e.preventDefault();x.value=clamp(Number(x.value)+step[0]);y.value=clamp(Number(y.value)+step[1]);
   x.dispatchEvent(new Event('input',{bubbles:true}));
   y.dispatchEvent(new Event('input',{bubbles:true}));
 });
 let previewUrl='';
 const loadImage=()=>{
   if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl='';}
   const richFile=uploads.rich_image?.files?.[0];
   const normalFile=uploads.image?.files?.[0];
   const file=richFile||(!richImage?.value?normalFile:null);
   if(file){previewUrl=URL.createObjectURL(file);image.src=previewUrl;}
   else image.src=richImage?.value||normalImage?.value||'/assets/welcome/2468.webp';
 };
 richImage?.addEventListener('input',loadImage);
 normalImage?.addEventListener('input',loadImage);
 uploads.rich_image?.addEventListener('change',loadImage);
 uploads.image?.addEventListener('change',loadImage);
 $('dialog').addEventListener('close',()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);},{once:true});
 redraw();loadImage();
}

function setupPreview(key,row,uploads){
 const panel=$('preview'),dialog=$('dialog'),form=$('edit');
 const enabled=['dishes','categories','menu_settings','menu_links'].includes(key);
 panel.hidden=!enabled;dialog.classList.toggle('has-preview',enabled);
 if(!enabled)return;
 panel.replaceChildren();
 const views=key==='dishes'?[['card','معاينة بطاقة الطبق'],['popup','معاينة نافذة الطبق']]:[['page','معاينة مباشرة']];
 const frames=views.map(([view,title])=>{
   const heading=node('h3',title),frame=node('iframe');frame.title=title;frame.tabIndex=-1;frame.inert=true;
   frame.dataset.view=view;panel.append(heading,frame);return frame;
 });
 const resources=new Map();let latestField='';
 const send=()=>{
   const data={...row};
   for(const [field,,type] of sections[key][1]){
     const input=form.elements.namedItem(field);
     data[field]=type==='checkbox'?input.checked:input.value;
     const file=uploads[field]?.files[0],cached=resources.get(field);
     if(cached?.file!==file){
       if(cached)URL.revokeObjectURL(cached.url);
       if(file)resources.set(field,{file,url:URL.createObjectURL(file)});else resources.delete(field);
     }
     if(file)data[field]=resources.get(field).url;
   }
   for(const frame of frames)frame.contentWindow?.postMessage({type:'snounu-draft',key,data,field:latestField},location.origin);
 };
 const ready=e=>{
   if(e.origin!==location.origin)return;
   const frame=frames.find(f=>f.contentWindow===e.source);if(!frame)return;
   if(e.data==='snounu-preview-ready')send();
   if(key==='dishes'&&e.data?.type==='snounu-preview-height'&&Number.isFinite(e.data.height)&&e.data.height>0)frame.style.height=(e.data.height+2)+'px';
 };
 const changed=e=>{latestField=e.target.name||Object.keys(uploads).find(k=>uploads[k]===e.target)||latestField;send();};
 window.addEventListener('message',ready);
 form.addEventListener('input',changed);form.addEventListener('change',changed);
 for(const frame of frames)frame.src='/?preview=1&view='+frame.dataset.view+'#menu';
 dialog.addEventListener('close',()=>{
   window.removeEventListener('message',ready);form.removeEventListener('input',changed);form.removeEventListener('change',changed);
   panel.replaceChildren();resources.forEach(v=>URL.revokeObjectURL(v.url));
 },{once:true});
}
