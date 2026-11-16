const endpoint = 'https://wknpuzdyemwkllmxehyy.supabase.co';
const apiKey = 'sb_publishable_FJg5RC-dTvsINEy9D8_rXw_xM03B4Ip';
const $ = id => document.getElementById(id);
const sections = {
  dishes: ['الأطباق', [['name','اسم الطبق'],['description','الوصف','textarea'],['sonbol_url','رابط طلب هذا الطبق من سنبل','url'],['ingredients','المكونات'],['badge','شارة الطبق'],['rating','التقييم المعروض','optionalRating'],['old_price','السعر السابق','optionalPrice'],['category_id','الصنف','select'],['price','السعر بالشيكل','number'],['image','صورة الطبق','image'],['position','ترتيب العرض','integer'],['available','متوفر','checkbox']]],
  categories: ['الأصناف', [['name','اسم الصنف'],['icon','رمز الصنف'],['position','ترتيب العرض','integer']]],
  menu_settings: ['تفاصيل المنيو', [['name','اسم المطعم'],['welcome','عبارة الترحيب'],['contact','نص صفحة التواصل','textarea'],['address','العنوان'],['hours','ساعات العمل'],['logo','الشعار','image'],['hero','صورة الترحيب','image'],['hotline','رقم التواصل السريع'],['welcome_button','زر الترحيب'],['credit','تذييل الصفحات','locked']]],
  menu_links: ['روابط الطلب والتواصل', [['url','الرابط','url']]],
  menu_ads: ['إدارة الإعلانات', [['name','عنوان الإعلان'],['image','صورة الإعلان','image'],['dish_id','الطبق المرتبط','product'],['position','ترتيب العرض','integer']]],
  rankings: ['تقييمات الأطباق', []],
  submissions: ['رسائل التواصل', []],
  menu_staff: ['المستخدمون', [['email','بريد المحرر','email'],['password','كلمة مرور للحساب الجديد (12 حرفاً على الأقل)','password']]]
};
let session = JSON.parse(sessionStorage.getItem('snouno-session') || 'null');
let role, section = 'dishes', generation = 0;
const notice = message => { $('status').textContent = message; };
function node(tag, text) { const el=document.createElement(tag); if(text!==undefined) el.textContent=text; return el; }
function action(label, fn) { const b=node('button',label); b.type='button'; b.onclick=()=>Promise.resolve(fn()).catch(e=>notice(e.message)); return b; }
function persist(value) { session=value; if(value) sessionStorage.setItem('snouno-session',JSON.stringify(value)); else sessionStorage.removeItem('snouno-session'); }
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
  const own=await api('/rest/v1/menu_staff?select=role&email=eq.'+encodeURIComponent(session.user.email.toLowerCase()));
  if(!own.length) throw new Error('لا توجد صلاحية لهذا الحساب');
  role=own[0].role; $('login').hidden=true; $('logout').hidden=false; $('tabs').replaceChildren();
  for(const [key,[label]] of Object.entries(sections)){
    if(key==='menu_staff'&&role!=='owner') continue;
    const b=action(label,()=>openSection(key)); b.dataset.section=key; $('tabs').append(b);
  }
  const saved=location.hash.slice(1);
  await openSection(Object.hasOwn(sections,saved)&&(saved!=='menu_staff'||role==='owner')?saved:'dishes');
}
$('access').onsubmit=async e=>{
  e.preventDefault(); const form=e.currentTarget;
  try {persist(await request('/auth/v1/token?grant_type=password',{method:'POST',body:Object.fromEntries(new FormData(form))})); form.reset(); await enter();}
  catch(err){persist(null);loggedOut();notice(err.message);}
};
$('register').onclick=async()=>{
 const form=$('access'); if(!form.reportValidity()) return;
 try {await request('/auth/v1/signup?redirect_to='+encodeURIComponent(location.origin+'/admin/'),{method:'POST',body:Object.fromEntries(new FormData(form))});notice('تحقق من بريدك لتفعيل الحساب، ثم سجّل الدخول.');} catch(e){notice(e.message);}
};
$('logout').onclick=async()=>{try{await api('/auth/v1/logout',{method:'POST'});} finally {persist(null);loggedOut();notice('تم تسجيل الخروج');}};
async function openSection(key){
 const ticket=++generation; section=key; history.replaceState(null,'','#'+key); notice(''); $('body').replaceChildren(); $('title').textContent=sections[key][0];
 for(const b of $('tabs').children)b.setAttribute('aria-current',String(b.dataset.section===key));
 const feedback=['rankings','submissions'].includes(key);
 const table=feedback?'menu_feedback':key;
 const condition=feedback?'&kind='+ (key==='rankings'?'eq.':'neq.') +encodeURIComponent('تقييم'):'';
 const order=feedback?'created_at.desc':key==='menu_staff'?'email':key==='menu_settings'?'id':'position,name';
 const rows=await api('/rest/v1/'+table+'?select=*&order='+order+condition);
 if(ticket!==generation)return;
 const area=$('body');
 if(!feedback&&!['menu_settings','menu_links'].includes(key))area.append(action('إضافة',()=>edit(key,{})));
 if(!rows.length)area.append(node('p','لا توجد عناصر بعد.'));
 for(const row of rows){
   const card=node('article');
   if(key==='dishes'&&row.image){const photo=node('img');photo.src=row.image;photo.className='dish-thumb';photo.alt='';card.append(photo);}
   if(key==='menu_links'&&row.channel){const icon=node('img');icon.src='/assets/'+row.channel+'.svg';icon.className='channel-icon';icon.alt='';card.append(icon);}
   card.append(node('strong',key==='rankings'?(row.meal_name||'طبق محذوف قبل تسجيل اسمه'):(row.name||row.email||row.kind)));
   if(feedback){card.style.flexWrap='wrap';card.append(node('span',[row.kind,row.phone,row.stars?row.stars+' ★':'',row.message].filter(Boolean).join(' · ')));}
   if(key==='dishes') {
     const item=node('bdi',row.price+' ₪');item.dir='ltr';item.className='price';card.append(item);
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
   area.append(card);
 }
}
const filter=row=>row.id!==undefined?'id=eq.'+row.id:'email=eq.'+encodeURIComponent(row.email);
async function edit(key,row){
 const form=$('edit');form.replaceChildren(node('h2',(row.id?'تعديل':'إضافة')+' · '+sections[key][0]));
 const cats=key==='dishes'?await api('/rest/v1/categories?select=id,name&order=position,name'):[];
 if(key==='dishes'&&!cats.length){notice('أضف صنفاً أولاً لتضع الطبق فيه.');return;}
 const dishes=key==='menu_ads'?await api('/rest/v1/dishes?select=id,name&order=name'):[];
 const uploads={};
 const sizes={image:key==='menu_ads'?'1080 × 285':'1200 × 740',hero:'1024 × 1536',logo:'564 × 183',banner:'1080 × 285',banner_two:'1080 × 285',banner_three:'1080 × 285'};
 if(key==='menu_links')form.append(node('p',row.name));

 for(const [field,caption,type='text'] of sections[key][1]){
   const label=node('label',caption);const input=node(type==='textarea'?'textarea':['select','product'].includes(type)?'select':'input');
   input.name=field;if(input.tagName==='INPUT')input.type=({image:'text',integer:'number',optionalRating:'number',optionalPrice:'number'}[type]||type);
   if(type==='select')for(const cat of cats){const option=node('option',cat.name);option.value=cat.id;input.append(option);}
   if(type==='product'){
     const empty=node('option','عرض الإعلان مع روابط الطلب');empty.value='';input.append(empty);
     for(const dish of dishes){const option=node('option',dish.name);option.value=dish.id;input.append(option);}
   }
   if(type==='locked'){input.readOnly=true;input.title='للقراءة فقط';}
   if(type==='checkbox'){input.checked=row[field]??true;label.classList.add('availability-field');}
   else input.value=row[field]??(type==='select'?cats[0].id:field==='position'?0:'');
   if(type==='number'){input.step='0.01';input.min='0';}
   if(type==='optionalPrice'||type==='optionalRating'){input.step=type==='optionalPrice'?'0.01':'0.1';input.min=0;if(type==='optionalRating')input.max=5;}
   if(field==='sonbol_url'){input.dir='ltr';input.pattern='https://.+';}
   if(type==='password')input.minLength=12;
   input.required=['name','price','email','password','url','category_id','position'].includes(field);
   label.append(input);
   if(field==='sonbol_url')label.append(node('small','الصق رابط الوجبة من سنبل ليظهر زر طلبها في نافذة الطبق.'));
   if(field==='ingredients')label.append(node('small','افصل المكونات بفاصلة، أو اكتب «خضار: خس، خيار» في سطر لكل مجموعة.'));
   if(type==='image'){const hint=node('small', 'المقاس المقترح '+sizes[field]+' بكسل');label.append(hint);const upload=node('input');upload.type='file';upload.accept='image/png,image/jpeg,image/webp';label.append(upload);uploads[field]=upload;}
   form.append(label);
 }
 const error=node('p');error.setAttribute('role','alert'); const save=node('button','حفظ');
 const footer=node('footer');footer.append(save,action('إلغاء',()=>$('dialog').close()));form.append(error,footer);
 form.onsubmit=async event=>{
   event.preventDefault();save.disabled=true;error.textContent='';
   try {
     const data={};
     for(const [field,,type] of sections[key][1]){
       if(type==='locked')continue;
       const input=form.elements.namedItem(field);
       data[field]=type==='product'?(input.value||null):['optionalRating','optionalPrice'].includes(type)?(input.value===''?null:Number(input.value)):type==='checkbox'?input.checked:['number','integer'].includes(type)?Number(input.value):type==='password'?input.value:input.value.trim();
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
     if(key==='dishes'&&!data.sonbol_url)data.sonbol_url=null;
     if(key==='menu_ads'&&!data.image)throw new Error('أضف صورة للإعلان');
     const result=key==='menu_staff'?await api('/functions/v1/menu-staff',{method:'POST',body:data}):await api('/rest/v1/'+key+(row.id?'?'+filter(row):''),{method:row.id?'PATCH':'POST',body:data});
     $('dialog').close();await openSection(key);notice(result?.message||'تم الحفظ');
   }catch(e){error.textContent=e.message;}finally{save.disabled=false;}
 };
 setupPreview(key,row,uploads);
 $('dialog').showModal();
}
if(location.hash.includes('access_token='))history.replaceState(null,'',location.pathname);
if(session)enter().catch(e=>{persist(null);loggedOut();notice(e.message);});else loggedOut();

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
