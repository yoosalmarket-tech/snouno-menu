/* Snounu SEO settings and verified Google Search Console reporting. */
const baseUrl='https://snounu-restaurant.vercel.app';
const PAGES=[
 {id:'welcome',label:'الترحيب',route:'/welcome'},
 {id:'menu',label:'المنيو',route:'/menu'},
 {id:'contact',label:'التواصل',route:'/contact'}
];
function el(tag,text,cls){
 const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=String(text);
 if(cls)n.className=cls;return n;
}
function btn(text,click,cls='seo-button'){
 const n=el('button',text,cls);n.type='button';n.addEventListener('click',click);return n;
}
function panel(title,description){
 const n=el('section',null,'seo-panel');n.append(el('h2',title));
 if(description)n.append(el('p',description,'seo-muted'));return n;
}
function formField(host,key,label,value='',kind='text',hint=''){
 const wrap=el('label',null,'seo-field');wrap.append(el('span',label));
 const input=el(kind==='textarea'?'textarea':'input');
 input.name=key;
 if(kind!=='textarea')input.type=kind;
 if(kind==='checkbox'){input.checked=value!==false;wrap.classList.add('seo-check');}
 else input.value=String(value??'');
 if(kind==='url'||key.includes('canonical')||key.includes('image'))input.dir='ltr';
 wrap.append(input);if(hint)wrap.append(el('small',hint));host.append(wrap);return input;
}
function val(form,name){const input=form.elements.namedItem(name);return input?.type==='checkbox'?input.checked:String(input?.value??'').trim()}
const fileName=url=>{
 try{return decodeURIComponent(new URL(String(url||''),baseUrl).pathname.split('/').pop()||'—')}catch{return '—'}
};
const seoStorageOrigin='https://wknpuzdyemwkllmxehyy.supabase.co';
const seoStoragePublic=seoStorageOrigin+'/storage/v1/object/public/menu-images/';
const validImageSlug=value=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)&&value.length<=65;
async function publishRenamedImage(api,currentUrl,slug,variant){
 const url=new URL(currentUrl,baseUrl);
 const isWebsite=url.origin===baseUrl&&url.pathname.startsWith('/assets/');
 const isStored=url.origin===seoStorageOrigin&&url.pathname.startsWith('/storage/v1/object/public/menu-images/');
 if(!isWebsite&&!isStored)throw Error('الصورة خارج استضافة سنونو؛ أعد رفعها من إدارة الأطباق أولاً.');
 const source=await fetch(url.href);
 if(!source.ok)throw Error('تعذّر قراءة الصورة الحالية ('+source.status+').');
 const blob=await source.blob();
 const contentType=blob.type.split(';')[0].toLowerCase();
 const extension={'image/webp':'webp','image/png':'png','image/jpeg':'jpg'}[contentType];
 if(!extension)throw Error('نوع الصورة غير مدعوم. استخدم WebP أو PNG أو JPG.');
 if(!blob.size||blob.size>5242880)throw Error('حجم الصورة غير صالح أو يزيد عن 5 ميغابايت.');
 const name=slug+'-'+variant+'-'+crypto.randomUUID().slice(0,8)+'.'+extension;
 await api('/storage/v1/object/menu-images/'+encodeURIComponent(name),{
  method:'POST',body:new File([blob],name,{type:contentType})
 });
 return seoStoragePublic+encodeURIComponent(name);
}
function localCanonical(input,route){
 const url=new URL(input||route,baseUrl);
 if(url.origin!==baseUrl)throw Error('يجب أن يكون رابط Canonical من نفس الموقع');
 return url.pathname+url.search;
}
const safeImage=value=>{
 if(!value)return '';
 const url=new URL(value,baseUrl);
 if(url.protocol!=='https:'||!/^https?:$/.test(url.protocol))throw Error('روابط الصور يجب أن تستخدم HTTPS');
 return value;
};
export async function renderSeoEditor({api,root,notice,navigate,role}){
 root.replaceChildren();
 const [records,dishes]=await Promise.all([
  api('/rest/v1/seo_settings?select=data&id=eq.1&limit=1'),
  api('/rest/v1/dishes?select=id,name,image,rich_image,seo_title,seo_description,seo_alt,seo_image_filename&order=name&limit=200')
 ]);
 if(!records.length)throw Error('إعدادات SEO لم تُهيأ بعد في قاعدة البيانات');
 const old=records[0].data||{};
 const lead=panel('إعدادات ظهور المنيو في Google','المسار: لوحة التحكم ← SEO. هذه البيانات لا تظهر داخل تصميم المنيو، لكنها تظهر في مصدر HTML ونتائج البحث والمشاركة.');
 lead.classList.add('seo-hero-panel');
 lead.append(el('p','GOOGLE SEARCH · OPEN GRAPH · IMAGE SEO · STRUCTURED DATA','seo-eyebrow'));
 const links=el('div',null,'seo-link-row');
 for(const p of PAGES){const a=el('a','افتح '+p.label);a.href=p.route;a.target='_blank';a.rel='noopener noreferrer';links.append(a)}
 lead.append(links);
 if(role==='owner')lead.append(btn('عرض كلمات البحث الفعلية',()=>navigate('seo_queries'),'seo-button seo-outline'));
 root.append(lead);
 const form=el('form',null,'seo-settings-form');form.id='seo-settings-editor';
 const general=panel('الإعدادات غير المرئية العامة','عنوان البحث والوصف والصورة وبيانات المطعم المنظمة تُضاف إلى HTML بواسطة الخادم قبل وصوله للزائر أو Google.');
 formField(general,'site_name','اسم الموقع',old.site_name||'مطعم سنونو');
 formField(general,'default_image','رابط صورة المشاركة الافتراضية',old.default_image||'/assets/welcome/2468.webp','text','صورة Open Graph للواتساب وفيسبوك، مقاس 1200 × 630 مقترح.');
 formField(general,'default_image_alt','الوصف البديل لصورة المشاركة',old.default_image_alt||'وجبات مطعم سنونو');
 formField(general,'social_handle','اسم حساب X (إن وجد)',old.social_handle||'');
 formField(general,'restaurant_schema','بيانات المطعم المنظمة JSON-LD',old.restaurant_schema!==false,'checkbox','تستخدم معلومات المطعم الفعلية مثل العنوان وساعات العمل.');
 formField(general,'sitemap_enabled','تفعيل Sitemap لمحركات البحث',old.sitemap_enabled!==false,'checkbox');
 formField(general,'gsc_property','عنوان موقع Search Console (مرجع)',old.gsc_property||baseUrl+'/','url','تغيير العنوان هنا لا يمنح صلاحية Google تلقائياً.');
 formField(general,'gsc_verification','رمز Google Search Console (HTML tag)',old.gsc_verification||'','text','الصق رمز content فقط، وليس سطر HTML كاملاً. الرمز الحالي يُضمّن في HTML <head>.');
 const verify=el('div',null,'seo-source-code');
 verify.append(el('strong','رمز التحقق المنشور'));
 const verificationCode=el('code');verify.append(verificationCode);
 const syncVerification=()=>{const value=String(val(form,'gsc_verification')).replace(/^google-site-verification=/,'');
  verificationCode.textContent='<meta name="google-site-verification" content="'+value.replace(/"/g,'')+'">';};
 general.append(verify);
 form.append(general);
 const pagePanel=panel('SEO حسب الصفحة','يمكنك تحرير Title وMeta Description وCanonical وOpen Graph وضبط ظهور كل صفحة في فهرس البحث بشكل منفصل.');
 const tabs=el('div',null,'seo-tabbar');const contents=el('div');
 for(const p of PAGES){
  const tab=btn(p.label,()=>selectPage(p.id),'seo-tab');tab.dataset.page=p.id;tabs.append(tab);
  const sub=el('section',null,'seo-page-form');sub.dataset.page=p.id;
  const cfg=old.pages?.[p.id]||{};
  formField(sub,p.id+'_title','عنوان البحث (Title)',cfg.title||'','text','أفضل عادةً نص وصفي واضح لا يزيد عن 65 حرفاً.');
  formField(sub,p.id+'_description','الوصف في Google (Meta Description)',cfg.description||'','textarea','قد تختار Google وصفاً آخر حسب بحث الزائر.');
  formField(sub,p.id+'_canonical','Canonical URL',cfg.canonical||p.route,'text','مسار نسبي داخل النطاق الأصلي مثل '+p.route);
  formField(sub,p.id+'_og_title','عنوان المشاركة (Open Graph)',cfg.og_title||'','text','اتركه فارغاً لاستخدام عنوان البحث.');
  formField(sub,p.id+'_og_description','وصف المشاركة',cfg.og_description||'','textarea','اتركه فارغاً لاستخدام وصف البحث.');
  formField(sub,p.id+'_og_image','صورة مشاركة خاصة بهذه الصفحة',cfg.og_image||'','text','اتركه فارغاً لاستخدام الصورة الافتراضية.');
  formField(sub,p.id+'_index','السماح بالفهرسة (Index, follow)',cfg.index!==false,'checkbox','إلغاء التفعيل يضيف noindex,follow. لا يُحذف الموقع من Google فوراً.');
  const snippet=el('div',null,'seo-preview');
  snippet.append(el('small','معاينة تقريبية لنتيجة البحث وليست ضماناً لظهورها كما هي.'));
  const title=el('strong'),url=el('small'),description=el('p');
  snippet.append(title,url,description);sub.append(snippet);
  const update=()=>{title.textContent=val(form,p.id+'_title')||'عنوان الصفحة';
   url.textContent=baseUrl+localCanonicalSafe(val(form,p.id+'_canonical'),p.route);
   description.textContent=val(form,p.id+'_description')||'وصف الصفحة';};
  sub.addEventListener('input',update);sub.addEventListener('change',update);
  contents.append(sub);sub._update=update;
 }
 function localCanonicalSafe(v,r){try{return localCanonical(v,r)}catch{return r}}
 function selectPage(page){
  for(const t of tabs.children)t.classList.toggle('is-current',t.dataset.page===page);
  for(const el of contents.children){el.hidden=el.dataset.page!==page;if(!el.hidden)el._update();}
 }
 pagePanel.append(tabs,contents);form.append(pagePanel);
 const welcome=panel('SEO صور الترحيب','هذه أوصاف Alt للصور الثلاث، وهي مختلفة عن أسماء الملفات الأصلية.');
 for(let i=1;i<=3;i++)formField(welcome,'welcome_image_alt_'+i,'وصف الصورة '+i,old['welcome_image_alt_'+i]||'');
 form.append(welcome);
 const actions=el('div',null,'seo-actions');
 const save=btn('حفظ إعدادات SEO',async()=>{
  save.disabled=true;notice('');
  mainFeedback.textContent='جارٍ حفظ التغييرات...';
  mainFeedback.dataset.state='';
  try{
   validateDirtyMealSeo();
   const next={
    ...old,site_name:val(form,'site_name').slice(0,100),
    default_image:safeImage(val(form,'default_image')),
    default_image_alt:val(form,'default_image_alt').slice(0,200),
    social_handle:val(form,'social_handle').slice(0,40),
    restaurant_schema:val(form,'restaurant_schema'),
    sitemap_enabled:val(form,'sitemap_enabled'),
    gsc_property:val(form,'gsc_property').slice(0,500),
    gsc_verification:val(form,'gsc_verification').replace(/^google-site-verification=/,'').slice(0,200),
    pages:{...(old.pages||{})}
   };
   if(next.gsc_verification&&!/^[\w-]{15,150}$/.test(next.gsc_verification))throw Error('رمز Google غير صالح');
   for(let i=1;i<=3;i++)next['welcome_image_alt_'+i]=val(form,'welcome_image_alt_'+i).slice(0,200);
   for(const p of PAGES)next.pages[p.id]={
    ...(old.pages?.[p.id]||{}),
    title:val(form,p.id+'_title').slice(0,180),
    description:val(form,p.id+'_description').slice(0,350),
    canonical:localCanonical(val(form,p.id+'_canonical'),p.route),
    og_title:val(form,p.id+'_og_title').slice(0,180),
    og_description:val(form,p.id+'_og_description').slice(0,350),
    og_image:safeImage(val(form,p.id+'_og_image')),
    index:val(form,p.id+'_index')
   };
   await api('/rest/v1/seo_settings?id=eq.1',{method:'PATCH',body:{data:next,updated_at:new Date().toISOString()},headers:{Prefer:'return=representation'}});
   Object.assign(old,next);
   let savedMeals=0;
   try{savedMeals=await saveDirtyMealSeo();}
   catch(mealError){
    const message='تم حفظ إعدادات الصفحات العامة، لكن لم تُحفظ بعض بيانات الوجبات: '+mealError.message;
    mainFeedback.textContent=message;mainFeedback.dataset.state='error';notice(message);return;
   }
   const message='تم حفظ إعدادات SEO'+(savedMeals?' وبيانات '+savedMeals+' وجبة':'')+'. قد يستغرق تحديث نتائج Google بعض الوقت.';
   mainFeedback.textContent=message;mainFeedback.dataset.state='success';notice(message);
  }catch(e){const message='تعذر حفظ إعدادات SEO: '+e.message;mainFeedback.textContent=message;mainFeedback.dataset.state='error';notice(message)}
  finally{save.disabled=false}
 },'seo-button seo-primary');
 save.textContent='حفظ جميع تغييرات SEO';
 save.id='seo-save-settings';save.dataset.trackAction='seo_save_settings';
 const mainFeedback=el('p','','seo-save-message');mainFeedback.setAttribute('role','status');mainFeedback.setAttribute('aria-live','polite');
 actions.append(save,mainFeedback,btn('فتح Google Search Console',()=>window.open('https://search.google.com/search-console','_blank','noopener'),'seo-button seo-outline'));
 form.append(actions);form.addEventListener('submit',e=>e.preventDefault());
 root.append(form);form.addEventListener('input',syncVerification);syncVerification();selectPage('menu');
 const box=panel('صور الوجبات · الأسماء والأوصاف البديلة','أدخل اسماً إنجليزياً وصفياً، ثم اضغط «تطبيق الاسم على الصور الحالية» لإنشاء نسخ بأسماء جديدة وتحديث روابط الوجبة تلقائياً. الصور الأصلية تبقى متاحة للحماية من تعطل الروابط القديمة.');
 const search=formField(box,'image_search','البحث عن وجبة أو اسم صورة','','search');
 const list=el('div',null,'seo-image-list');box.append(list);
 const updated=new Map();
 const editInputs=new Map();
 const itemSearch=[];
 function invalidateFilename(id,message){
  const refs=editInputs.get(id);
  const input=refs?.filename;
  if(!input)return;
  refs.error.textContent=message;
  input.setAttribute('aria-invalid','true');
  input.focus();
  input.scrollIntoView({block:'center',behavior:'smooth'});
 }
 function validateDirtyMealSeo(){
  for(const [id,v] of updated){
   if(v.seo_image_filename&&!validImageSlug(v.seo_image_filename)){
    invalidateFilename(id,'استخدم اسماً بالإنجليزية بحروف صغيرة وأرقام وشرطات فقط، حتى 65 حرفاً. مثال: snounu-cheese-sticks-gaza');
    throw Error('اسم ملف صورة الوجبة «'+(dishes.find(d=>d.id===id)?.name||id)+'» غير صالح. صححه في الحقل المشار إليه.');
   }
   if(v.seo_image_filename.length>65||v.seo_alt.length>200||v.seo_title.length>180||v.seo_description.length>350)
    throw Error('هناك عنوان أو وصف أو اسم صورة يتجاوز الحد المسموح في '+(dishes.find(d=>d.id===id)?.name||'إحدى الوجبات'));
  }
 }
 async function saveDirtyMealSeo(){
  if(!updated.size)return 0;
  validateDirtyMealSeo();
  let savedCount=0;
  for(const [id,v] of updated){
   const rows=await api('/rest/v1/dishes?id=eq.'+encodeURIComponent(id),{
    method:'PATCH',
    body:{seo_title:v.seo_title,seo_description:v.seo_description,seo_alt:v.seo_alt,seo_image_filename:v.seo_image_filename},
    headers:{Prefer:'return=representation'}
   });
   if(!Array.isArray(rows)||!rows.length)throw Error('تعذر التحقق من حفظ بيانات وجبة '+(dishes.find(d=>d.id===id)?.name||id));
   const dish=dishes.find(d=>d.id===id);if(dish)Object.assign(dish,v);
   updated.delete(id);savedCount++;
  }
  return savedCount;
 }
 for(const dish of dishes){
  const item=el('article',null,'seo-image-row');item.dataset.search=(dish.name+' '+fileName(dish.image)+' '+fileName(dish.rich_image)).toLocaleLowerCase();
  const pic=el('img');pic.src=dish.image||'/assets/welcome/2468.webp';pic.alt=dish.name;pic.loading='lazy';
  const details=el('div');details.append(el('strong',dish.name));
  const regularName=el('small','العادي: '+fileName(dish.image));
  const interactiveName=el('small','التفاعلي: '+fileName(dish.rich_image));
  details.append(regularName,interactiveName);
  const seoTitle=formField(details,'title-'+dish.id,'عنوان مشاركة هذه الوجبة',dish.seo_title||'','text','يُستخدم عند فتح رابط الوجبة المباشر (?dish=...).');
  const seoDescription=formField(details,'description-'+dish.id,'وصف الوجبة لمحركات البحث',dish.seo_description||dish.description||'','textarea');
  const alt=formField(details,'alt-'+dish.id,'ALT · النص البديل',dish.seo_alt||dish.name);
  const filename=formField(details,'filename-'+dish.id,'اسم ملف الصور الحالي والجديد',dish.seo_image_filename||'','text','مثال: snounu-cheese-sticks-gaza — اكتب الاسم بدون امتداد الملف.');
  filename.dir='ltr';filename.placeholder='snounu-meal-gaza';
  const changed=()=>updated.set(dish.id,{id:dish.id,seo_title:seoTitle.value.trim(),seo_description:seoDescription.value.trim(),seo_alt:alt.value.trim(),seo_image_filename:filename.value.trim()});
  const filenameError=el('small','','seo-inline-error');
  filenameError.setAttribute('role','alert');
  filename.parentElement.append(filenameError);
  editInputs.set(dish.id,{filename,error:filenameError});
  const onEdit=()=>{
   if(validImageSlug(filename.value.trim())||!filename.value.trim()){filename.removeAttribute('aria-invalid');filenameError.textContent='';}
   changed();
  };
  for(const input of [seoTitle,seoDescription,alt,filename])input.addEventListener('input',onEdit);
  const rename=btn('تطبيق الاسم على الصور الحالية',async()=>{
   const slug=filename.value.trim();
   if(!validImageSlug(slug)){notice('اكتب اسم ملف إنجليزياً صغيراً من أحرف وأرقام وشرطات، بحد أقصى 65 حرفاً. مثال: snounu-cheese-sticks-gaza');return;}
   if(!dish.image&&!dish.rich_image){notice('هذه الوجبة ليس لها صور منشورة لإعادة تسميتها.');return;}
   rename.disabled=true;rename.textContent='جارٍ نسخ الصور وتحديث روابطها...';
   try{
    const images={};
    for(const [field,variant] of [['image','regular'],['rich_image','interactive']]){
     if(dish[field])images[field]=await publishRenamedImage(api,dish[field],slug,variant);
    }
    const data={
     seo_title:seoTitle.value.trim().slice(0,180),
     seo_description:seoDescription.value.trim().slice(0,350),
     seo_alt:alt.value.trim().slice(0,200),
     seo_image_filename:slug,...images
    };
    const rows=await api('/rest/v1/dishes?id=eq.'+encodeURIComponent(dish.id),{
     method:'PATCH',body:data,headers:{Prefer:'return=representation'}
    });
    if(!Array.isArray(rows)||!rows.length)throw Error('لم يتم تحديث بيانات الوجبة. لم يتم حذف الصور الأصلية.');
    Object.assign(dish,data);
    regularName.textContent='العادي: '+fileName(dish.image);
    interactiveName.textContent='التفاعلي: '+fileName(dish.rich_image);
    if(dish.image)pic.src=dish.image;
    item.dataset.search=(dish.name+' '+fileName(dish.image)+' '+fileName(dish.rich_image)).toLocaleLowerCase();
    updated.delete(dish.id);
    notice('تم تحديث أسماء الصور وروابط وجبة «'+dish.name+'». الصور القديمة محفوظة.');
   }catch(e){notice('تعذر تغيير أسماء صور «'+dish.name+'»: '+e.message)}
   finally{rename.disabled=false;rename.textContent='تطبيق الاسم على الصور الحالية';}
  },'seo-button seo-outline');
  rename.dataset.trackAction='seo_rename_meal_images';
  details.append(rename);
  item.append(pic,details);list.append(item);itemSearch.push(item);
 }
 const imageSave=btn('حفظ تغييرات الوجبات فقط',async()=>{
  if(!updated.size){imageFeedback.textContent='لا توجد تغييرات غير محفوظة في الوجبات.';return;}
  imageSave.disabled=true;
  imageFeedback.textContent='جارٍ حفظ بيانات الوجبات...';imageFeedback.dataset.state='';
  try{
   const count=await saveDirtyMealSeo();
   const message='تم حفظ بيانات '+count+' وجبة. لن تتغير روابط الصور المنشورة إلا عند الضغط على «تطبيق الاسم على الصور الحالية».';
   imageFeedback.textContent=message;imageFeedback.dataset.state='success';notice(message);
  }catch(e){
   const message='تعذر حفظ بعض التغييرات: '+e.message;
   imageFeedback.textContent=message;imageFeedback.dataset.state='error';notice(message);
  }finally{imageSave.disabled=false;}
 },'seo-button seo-primary');
 imageSave.dataset.trackAction='seo_save_images';
 const imageFeedback=el('p','','seo-save-message');imageFeedback.setAttribute('role','status');imageFeedback.setAttribute('aria-live','polite');
 box.append(imageSave,imageFeedback);root.append(box);
 search.addEventListener('input',()=>{
  const term=search.value.trim().toLocaleLowerCase();
  for(const item of itemSearch)item.hidden=!!term&&!item.dataset.search.includes(term);
 });
 const technical=panel('الملفات الفنية وما يراه محرك البحث','هذه المزايا تُخدم من الخادم وليست جزءاً من واجهة المنيو المرئية.');
 const technicalList=el('div',null,'seo-technical-grid');
 for(const [name,url,detail] of [
  ['sitemap.xml','/sitemap.xml','خريطة الروابط القابلة للفهرسة'],
  ['robots.txt','/robots.txt','تعليمات زواحف البحث'],
  ['Google HTML verification','/google4e9150f78d7ff579.html','ملف التحقق من ملكية Google في جذر الموقع'],
   ['Google verification tag','/welcome','وسم Google داخل HTML head'],
  ['JSON-LD Restaurant','/menu','بيانات المطعم بصيغة JSON-LD'],
  ['Canonical + Open Graph','/contact','روابط أساسية وبيانات مشاركة']
 ]){
  const a=el('a',null,'seo-technical-link');a.href=url;a.target='_blank';a.rel='noopener noreferrer';
  a.append(el('strong',name),el('span',detail));technicalList.append(a);
 }
 technical.append(technicalList);root.append(technical);
}
function parseCsv(source){
 const rows=[];let current=[],field='',quote=false;
 source=source.replace(/^\uFEFF/,'');
 for(let i=0;i<source.length;i++){
  const ch=source[i];
  if(ch==='"'){if(quote&&source[i+1]==='"'){field+='"';i++}else quote=!quote}
  else if(ch===','&&!quote){current.push(field);field=''}
  else if((ch==='\n'||ch==='\r')&&!quote){
   if(ch==='\r'&&source[i+1]==='\n')i++;
   current.push(field);if(current.some(x=>x.trim()))rows.push(current);
   current=[];field='';
  }else field+=ch;
 }
 if(field||current.length){current.push(field);rows.push(current)}
 return rows;
}
const numeric=v=>Number(String(v??'').replace(/,/g,'').trim());
function csvQueries(source,start,end){
 const matrix=parseCsv(source);
 if(matrix.length<2)throw Error('CSV فارغ أو لا يحتوي سجلات');
 const names=matrix[0].map(x=>x.toLowerCase().trim());
 const index=(...list)=>names.findIndex(v=>list.includes(v));
 const iq=index('top queries','query','queries','search query','الكلمة','طلب البحث'),
  ic=index('clicks','النقرات'),ii=index('impressions','مرات الظهور'),
  ict=index('ctr','نسبة النقر إلى الظهور'),ip=index('position','الموضع'),
  iurl=index('pages','page','landing page');
 if([iq,ic,ii,ict,ip].some(i=>i<0))throw Error('CSV يجب أن يحتوي Query وClicks وImpressions وCTR وPosition (ملف Google Search Console).');
 const results=[];
 for(const row of matrix.slice(1,2001)){
  const query=String(row[iq]||'').trim().slice(0,400);if(!query)continue;
  const clicks=numeric(row[ic]),impressions=numeric(row[ii]),position=numeric(row[ip]);
  let ctr=String(row[ict]||'').trim();
  const percent=ctr.includes('%');ctr=numeric(ctr.replace('%',''))/(percent?100:1);
  if(!Number.isFinite(clicks)||!Number.isFinite(impressions)||!Number.isFinite(position)||!Number.isFinite(ctr))continue;
  let page='/menu';try{
   if(iurl>=0&&row[iurl]){const u=new URL(row[iurl],baseUrl);if(u.origin!==baseUrl)continue;page=u.pathname}
  }catch{continue}
  results.push({query,page,start_date:start,end_date:end,clicks:Math.max(0,Math.round(clicks)),impressions:Math.max(0,Math.round(impressions)),ctr:Math.max(0,Math.min(1,ctr)),position:Math.max(0,position)});
 }
 if(!results.length)throw Error('CSV لم يحتو على كلمات بحث صالحة لهذا الموقع');
 return results;
}
export async function renderSeoQueries({api,root,notice,token,navigate}){
 root.replaceChildren();
 const lead=panel('الكلمات التي وجد بها الزوار المنيو','بيانات بحث Google الحقيقية فقط؛ وليست عمليات البحث داخل المنيو أو إحصاءات زيارات GA4.');
 lead.append(btn('← العودة لإعدادات SEO',()=>navigate('seo'),'seo-button seo-outline'));
 root.append(lead);
 const filters=panel('الأداء في نتائج البحث','يمكن البحث في الكلمات وفلترة النتائج حسب الصفحة وترتيبها حسب النقرات أو مرات الظهور أو CTR أو الموضع.');
 const controls=el('div',null,'seo-query-controls');
 const search=formField(controls,'search','ابحث في كلمات البحث','','search');
 const days=formField(controls,'days','الفترة الزمنية','28');
 days.type='number';days.min='7';days.max='90';days.step='1';
 const source=formField(controls,'source','مصدر البيانات','live');
 source.type='text';source.readOnly=true;source.value='Google Search Console';
 const sort=el('select');sort.setAttribute('aria-label','ترتيب الكلمات');
 for(const [key,label] of [['clicks','الأكثر نقرات'],['impressions','الأكثر ظهوراً'],['ctr','الأعلى CTR'],['position','أفضل ترتيب']]){
  const option=el('option',label);option.value=key;sort.append(option);
 }
 controls.append(sort);
 const refresh=btn('تحديث البيانات من Google',()=>void loadLive(),'seo-button seo-primary');controls.append(refresh);
 filters.append(controls);
 const status=el('p','جارٍ الاتصال بـ Search Console…','seo-muted');status.id='seo-query-status';filters.append(status);
 const summary=el('div',null,'seo-query-summary');filters.append(summary);
 const table=el('div',null,'seo-query-table-wrap');filters.append(table);root.append(filters);
 let rows=[],sourceLabel='';
 const render=()=>{
  const term=search.value.trim().toLocaleLowerCase();
  const order=sort.value;
  const filtered=rows.filter(row=>(row.query+' '+row.page).toLocaleLowerCase().includes(term));
  filtered.sort((a,b)=>order==='position'?a.position-b.position:b[order]-a[order]);
  summary.replaceChildren();
  summary.append(el('strong',filtered.length.toLocaleString('en-US')+' كلمة بحث'));
  if(rows.length)summary.append(el('span',sourceLabel));
  table.replaceChildren();
  if(!filtered.length){table.append(el('p','لا توجد كلمات بحث مطابقة.','seo-empty'));return}
  const grid=el('table',null,'seo-query-table'),thead=el('thead'),hdr=el('tr');
  for(const text of ['عبارة البحث','الصفحة','النقرات','مرات الظهور','CTR','متوسط الموضع'])hdr.append(el('th',text));
  thead.append(hdr);grid.append(thead);
  const tbody=el('tbody');
  for(const item of filtered.slice(0,1000)){
   const line=el('tr');
   for(const value of [item.query,item.page,item.clicks,item.impressions,(item.ctr*100).toFixed(2)+'%',Number(item.position).toFixed(1)])line.append(el('td',value));
   tbody.append(line);
  }
  grid.append(tbody);table.append(grid);
 };
 search.addEventListener('input',render);sort.addEventListener('change',render);
 let loading=false;
 async function loadLive(){
  if(loading)return;loading=true;refresh.disabled=true;status.textContent='جارٍ قراءة بيانات Search Console…';
  const daysNum=Math.max(7,Math.min(90,Number(days.value)||28));
  try{
   const response=await fetch('/api/search-console?days='+daysNum,{
    headers:{Authorization:'Bearer '+token()},cache:'no-store'
   });
   const data=await response.json();
   if(response.ok&&data.available){
    rows=(data.rows||[]).map(x=>({
     query:x.query,page:x.page,clicks:Number(x.clicks)||0,impressions:Number(x.impressions)||0,
     ctr:Number(x.ctr)||0,position:Number(x.position)||0
    }));
    sourceLabel='Google Search Console · '+data.startDate+' إلى '+data.endDate;
    status.textContent=rows.length?'بيانات حقيقية من Google Search Console. قد تتأخر البيانات نحو يومين أو ثلاثة.':'Google متصل، لكن لا توجد استعلامات معروضة لهذه الفترة.';
   }else{
    rows=[];sourceLabel='';
    status.textContent=data.message||'لم يتصل Google Search Console بعد. تحقق من ملكية النطاق وأضف حساب الخدمة كقارئ للبيانات.';
    if(data.serviceAccountEmail){
     const name=el('code',data.serviceAccountEmail,'seo-service-email');
     status.append(document.createTextNode('  أضف هذا البريد كمستخدم بصلاحية كاملة أو مقيّدة في Search Console: '),name);
    }
    await loadImported(false);
   }
  }catch(e){rows=[];status.textContent='تعذّر قراءة Google: '+e.message;await loadImported(false)}
  finally{loading=false;refresh.disabled=false;render()}
 }
 async function loadImported(showNotice=true){
  try{
   const saved=await api('/rest/v1/seo_queries?select=query,page,clicks,impressions,ctr,position,start_date,end_date&order=end_date.desc,clicks.desc&limit=1500');
   if(saved.length){
    const end=saved[0].end_date,visible=saved.filter(x=>x.end_date===end);
    rows=visible.map(x=>({...x,clicks:Number(x.clicks)||0,impressions:Number(x.impressions)||0,ctr:Number(x.ctr)||0,position:Number(x.position)||0}));
    sourceLabel='ملف Google Search Console مستورد · ينتهي '+end;
    if(showNotice)status.textContent='بيانات مستوردة من Google Search Console وليست اتصالاً مباشراً.';
   }else if(showNotice){rows=[];sourceLabel='';status.textContent='لم يتم استيراد أي بيانات بعد.'}
  }catch(e){if(showNotice)status.textContent='لا يمكن تحميل الملفات المستوردة: '+e.message}
 }
 const upload=panel('استيراد ملف Google Search Console','بديل آمن إذا لم تمنح حساب الخدمة صلاحية العقار بعد. نزّل تقرير Queries بصيغة CSV من Search Console. لا تُنشأ كلمات تخمينية.');
 const from=formField(upload,'date_from','بداية فترة التقرير',new Date(Date.now()-27*86400000).toISOString().slice(0,10),'date');
 const to=formField(upload,'date_to','نهاية فترة التقرير',new Date().toISOString().slice(0,10),'date');
 const file=formField(upload,'csv','ملف Google Search Console CSV','','file');
 file.accept='.csv,text/csv';
 const importBtn=btn('استيراد بيانات البحث الحقيقية',async()=>{
  if(!file.files?.[0]){notice('اختر ملف CSV أولاً');return}
  if(from.value>to.value){notice('تاريخ البداية بعد النهاية');return}
  importBtn.disabled=true;
  try{
   const sourceText=await file.files[0].text();
   if(sourceText.length>1024*1024*2)throw Error('ملف CSV أكبر من 2MB');
   const entries=csvQueries(sourceText,from.value,to.value);
   for(let i=0;i<entries.length;i+=100){
    await api('/rest/v1/seo_queries?on_conflict=query,page,start_date,end_date',{
     method:'POST',body:entries.slice(i,i+100),
     headers:{Prefer:'resolution=merge-duplicates,return=minimal'}
    });
   }
   notice('تم استيراد '+entries.length+' عبارة حقيقية من Search Console.');
   await loadImported();render();
  }catch(e){notice('تعذر استيراد ملف البحث: '+e.message)}
  finally{importBtn.disabled=false}
 },'seo-button seo-primary');
 upload.append(importBtn);
 const tip=el('p','لربط البيانات الحية: افتح Search Console، تحقق من خاصية عنوان URL لهذا الموقع، ثم أضف حساب الخدمة الظاهر أعلاه من الإعدادات ← المستخدمون والأذونات. قد لا تعرض Google جميع الكلمات لحماية الخصوصية.','seo-muted');
 upload.append(tip);root.append(upload);
 await loadLive();
}