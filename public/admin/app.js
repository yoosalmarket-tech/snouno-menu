const endpoint = 'https://wknpuzdyemwkllmxehyy.supabase.co';
const apiKey = 'sb_publishable_FJg5RC-dTvsINEy9D8_rXw_xM03B4Ip';
const $ = id => document.getElementById(id);
const sections = {
  dishes: ['الأطباق', [['name','اسم الطبق'],['description','الوصف','textarea'],['sonbol_url','رابط طلب هذا الطبق من سنبل','url'],['makook_url','رابط الوجبة المباشر من مكوك (اختياري)','url'],['ingredients','المكونات'],['badge','شارة الطبق'],['rich_badge_x','موضع الشارة التفاعلية — أفقي','position'],['rich_badge_y','موضع الشارة التفاعلية — عمودي','position'],['rating','التقييم المعروض','optionalRating'],['old_price','السعر السابق','optionalPrice'],['category_id','الصنف','select'],['price','السعر بالشيكل','number'],['image','صورة الطبق — المنيو العادي','image'],['rich_image','صورة الوضع التفاعلي (خلفية شفافة)','image'],['available','متوفر','checkbox']]],
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
  submissions: ['رسائل التواصل', []],
  menu_staff: ['المستخدمون', [['email','بريد المحرر','email'],['password','كلمة مرور للحساب الجديد (12 حرفاً على الأقل)','password']]],
  account: ['حساب المالك', []]
};
const sessionKey='snouno-session';
let rememberMe=!!localStorage.getItem(sessionKey);
let session=JSON.parse(localStorage.getItem(sessionKey)||sessionStorage.getItem(sessionKey)||'null');
let role, section = 'dishes', generation = 0;
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
function loggedOut(){ generation++; role=null; $('login').hidden=false; $('logout').hidden=true; $('tabs').replaceChildren(); $('body').replaceChildren(); $('title').textContent='تسجيل الدخول'; }
async function enter(){
  const user=await api('/auth/v1/user');
  if(!user?.email)throw new Error('تعذّر التحقق من الحساب');
  session.user=user;persist(session);
  const own=await api('/rest/v1/menu_staff?select=role&email=eq.'+encodeURIComponent(user.email.toLowerCase()));
  if(!own.length) throw new Error('لا توجد صلاحية لهذا الحساب');
  role=own[0].role; $('login').hidden=true; $('logout').hidden=false; $('tabs').replaceChildren();
  for(const [key,[label]] of Object.entries(sections)){
    if(['menu_staff','account'].includes(key)&&role!=='owner') continue;
    const b=action(label,()=>openSection(key)); b.dataset.section=key; $('tabs').append(b);
  }
  const saved=location.hash.slice(1);
  await openSection(Object.hasOwn(sections,saved)&&(!['menu_staff','account'].includes(saved)||role==='owner')?saved:'dishes');
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
$('logout').onclick=async()=>{try{await api('/auth/v1/logout',{method:'POST'});} finally {persist(null);loggedOut();notice('تم تسجيل الخروج');}};
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
     await api('/rest/v1/rpc/transfer_snouno_ownership',{method:'POST',body:{p_target_email:chosen}});
     transferBox.result.textContent='تم نقل الملكية بنجاح';
     role='editor';
     await enter();
     notice('تم نقل الملكية. حسابك الآن محرر.');
   }catch(error){transferBox.result.textContent=error.message;}
   finally{transferPassword.value='';transferSubmit.disabled=false;}
 };
}
async function openSection(key){
 if(['menu_staff','account'].includes(key)&&role!=='owner'){
  notice('هذه الصفحة متاحة للمالك فقط');return;
 }
 const ticket=++generation; section=key; history.replaceState(null,'','#'+key); notice(''); $('body').replaceChildren(); $('title').textContent=sections[key][0];
 for(const b of $('tabs').children)b.setAttribute('aria-current',String(b.dataset.section===key));
 if(key==='account'){await renderOwnerAccount();return;}
 const feedback=['rankings','submissions'].includes(key);
 const table=feedback?'menu_feedback':key;
 const condition=feedback?'&kind='+ (key==='rankings'?'eq.':'neq.') +encodeURIComponent('تقييم'):'';
 const order=feedback?'created_at.desc':key==='menu_staff'?'email':key==='menu_settings'?'id':'position,name';
 const rows=await api('/rest/v1/'+table+'?select=*&order='+order+condition);
 const categoryRows=key==='dishes'?await api('/rest/v1/categories?select=id,name,position&order=position,name'):[];
 if(ticket!==generation)return;
 const area=$('body');
 if(!feedback&&!['menu_settings','menu_links'].includes(key))area.append(action('إضافة',()=>edit(key,{})));
 if(!rows.length)area.append(node('p','لا توجد عناصر بعد.'));
 if(key==='menu_settings'){
   if(rows[0])await edit('menu_settings',rows[0],true);
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
   const card=node('article');
   if(['dishes','categories','menu_ads'].includes(key)){
     if(key==='dishes')card.dataset.dishId=row.id;
     else card.dataset.sortId=row.id;
     card.classList.add('dish-sort-card');
     const handle=node('button','⋮⋮');handle.type='button';
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
     const input=node('input');input.type='checkbox';input.className='availability-toggle';input.checked=row.available!==false;
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
 const error=node('p');error.setAttribute('role','alert'); const save=node('button',inline?'حفظ جميع الإعدادات':'حفظ');
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
     await openSection(key);notice(result?.message||'تم الحفظ');
   }catch(e){error.textContent=e.message;}finally{save.disabled=false;}
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
   for(const frame of frames)frame.contentWindow?.postMessage({type:'snouno-draft',key,data,field:latestField},location.origin);
 };
 const ready=e=>{
   if(e.origin!==location.origin)return;
   const frame=frames.find(f=>f.contentWindow===e.source);if(!frame)return;
   if(e.data==='snouno-preview-ready')send();
   if(key==='dishes'&&e.data?.type==='snouno-preview-height'&&Number.isFinite(e.data.height)&&e.data.height>0)frame.style.height=(e.data.height+2)+'px';
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
