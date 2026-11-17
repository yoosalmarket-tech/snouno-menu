/* Stable UI identifiers, direct menu permalinks and privacy-minimal action logging.
   Never sends form values, visitor IDs, search terms, emails or phone numbers. */
const BASE='https://wknpuzdyemwkllmxehyy.supabase.co';
const KEY='sb_publishable_FJg5RC-dTvsINEy9D8_rXw_xM03B4Ip';
const findables='button,a[href],input,select,textarea,form,section,article,nav,dialog';
const keepId=str=>String(str||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,86);
export function menuLink(kind,id,mode=''){
 const link=new URL('/menu',location.origin);
 if(kind==='meal')link.searchParams.set('dish',String(id));
 else if(kind==='category')link.searchParams.set('category',String(id));
 if(mode==='interactive'||mode==='standard')link.searchParams.set('mode',mode);
 return link.href;
}
export async function copyMenuLink(kind,id,mode=''){
 const url=menuLink(kind,id,mode);
 if(navigator.clipboard?.writeText){
  try{await navigator.clipboard.writeText(url);return {url,copied:true};}catch{}
 }
 // Manual selection is the fallback on browsers without clipboard permission.
 window.prompt('انسخ الرابط:',url);
 return {url,copied:false};
}

/* Use native OS sharing when possible. WhatsApp and Email receive the meal name
   and its deep link together. Desktop browsers without Web Share get direct options. */
export async function shareMeal(meal, mode=''){
 if(!meal?.id)return {shared:false};
 const name=String(meal.name||'').trim()||'الوجبة';
 const url=menuLink('meal',meal.id,mode);
 const title='خلينا نجرب '+name;
 const message=title+'\n'+url;
 if(typeof navigator.share==='function'){
  try{
   await navigator.share({title,text:message});
   return {shared:true};
  }catch(error){
   if(error?.name==='AbortError')return {shared:false,canceled:true};
   console.warn('Native share unavailable; showing share options',error);
  }
 }
 const dialog=document.createElement('dialog');
 dialog.className='meal-share-dialog';
 dialog.setAttribute('aria-label','مشاركة الوجبة');
 const panel=document.createElement('div');
 panel.className='meal-share-panel';
 const heading=document.createElement('h2');heading.textContent='مشاركة الوجبة';
 const summary=document.createElement('p');summary.textContent=title;
 const choices=document.createElement('div');choices.className='meal-share-options';
 const whatsapp=document.createElement('a');
 whatsapp.id='meal-share-whatsapp';
 whatsapp.dataset.trackAction='share_whatsapp_click';
 whatsapp.textContent='واتساب';
 whatsapp.href='https://wa.me/?text='+encodeURIComponent(message);
 whatsapp.target='_blank';whatsapp.rel='noopener noreferrer';
 whatsapp.addEventListener('click',()=>dialog.close());
 const email=document.createElement('a');
 email.id='meal-share-email';email.dataset.trackAction='share_email_click';
 email.textContent='البريد الإلكتروني';
 email.href='mailto:?subject='+encodeURIComponent(title)+'&body='+encodeURIComponent(message);
 email.addEventListener('click',()=>dialog.close());
 const close=document.createElement('button');
 close.type='button';close.id='meal-share-cancel';
 close.textContent='إلغاء';close.addEventListener('click',()=>dialog.close());
 choices.append(whatsapp,email);
 panel.append(heading,summary,choices,close);dialog.append(panel);
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
 document.body.append(dialog);dialog.showModal();
 return {shared:false,optionsShown:true};
}

export function installActionReporting({route=()=> 'menu',mode=()=> 'standard',preview=()=>false,token=()=>null,onAction}={}){
 const generated=new WeakMap();
 function idFor(element){
  if(element.id)return element.id;
  if(generated.has(element))return generated.get(element);
  const nearest=element.parentElement?.closest('[id]');
  const parentId=keepId(nearest?.id)||'page';
  const scope=nearest||document.body;
  const siblings=[...scope.querySelectorAll(findables)];
  const index=siblings.indexOf(element)+1;
  const base='ui-'+parentId+'-'+element.tagName.toLowerCase()+'-'+Math.max(index,1);
  let id=base,n=2;
  while(document.getElementById(id)&&document.getElementById(id)!==element)id=base+'-'+n++;
  element.id=id;generated.set(element,id);
  return id;
 }
 function assignIds(root=document){
  for(const el of root.querySelectorAll(findables))if(!el.id)idFor(el);
 }
 function infer(el){
  if(el.dataset.trackAction)return el.dataset.trackAction;
  if(el.matches('[data-channel],.rm-sheet-link'))return 'order_platform_click';
  if(el.matches('.card-open,.rm-dish'))return 'meal_open';
  if(el.matches('.heart,.rm-info-fav'))return 'favorite_toggle';
  if(el.matches('.rm-cat,.chip'))return 'category_select';
  if(el.matches('.rm-thumb'))return 'meal_select';
  if(el.matches('.rm-customize'))return 'order_now_click';
  if(el.matches('.rm-info-details'))return 'contact_open';
  if(el.matches('.rm-share,.share-meal-link'))return 'share_meal_click';
  if(el.matches('.language-switch'))return 'language_toggle';
  if(el.matches('#rich-mode-toggle'))return 'mode_toggle';
  if(el.matches('[type=submit],.yellow.send-rating'))return 'form_submit_click';
  if(el.hasAttribute('data-page'))return 'navigation_click';
  if(el.matches('a[href]'))return 'link_click';
  return 'button_click';
 }
 function report(action,element,extra={}){
  if(preview())return;
  const target=typeof element==='string'?document.getElementById(element):element;
  const elementId=extra.element_id|| (target?idFor(target):'page_action');
  const parent=target?.closest('[data-meal-id],[data-dish-id]');
  const cat=target?.closest('[data-category-id],[data-category]');
  const mealId=String(extra.meal_id||target?.dataset.mealId||target?.dataset.dishId||parent?.dataset.mealId||parent?.dataset.dishId||'')||null;
  const categoryId=String(extra.category_id||target?.dataset.categoryId||cat?.dataset.categoryId||cat?.dataset.category||'')||null;
  const payload={p_action:action,p_element_id:elementId,p_route:route(),p_mode:mode(),p_meal_id:mealId,p_category_id:categoryId};
  window.dataLayer=window.dataLayer||[];
  window.dataLayer.push({event:'snounu_action',action,element_id:elementId,route:payload.p_route,mode:payload.p_mode,meal_id:mealId,category_id:categoryId});
  document.dispatchEvent(new CustomEvent('snounu:action',{detail:{action,element_id:elementId,route:payload.p_route,mode:payload.p_mode,meal_id:mealId,category_id:categoryId}}));
  onAction?.(action,target,mealId);
  // Server-side append-only log, with no cookies or personal identifiers.
  const auth=token();
  fetch(BASE+'/rest/v1/rpc/record_menu_action',{
   method:'POST',keepalive:true,headers:{apikey:KEY,'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},body:JSON.stringify(payload)
  }).catch(()=>{}); // Analytics must never block navigation.
 }
 function onClick(event){
  const el=event.target.closest('button,a[href]');
  if(!el||el.disabled)return;
  report(infer(el),el);
 }
 function onChange(event){
  const el=event.target;
  if(el.matches('input[type=checkbox],input[type=radio],select'))report('control_change',el);
 }
 document.addEventListener('click',onClick,true);
 document.addEventListener('change',onChange,true);
 assignIds();
 const observer=new MutationObserver(records=>{
  for(const record of records)for(const child of record.addedNodes){
   if(child.nodeType!==1)continue;
   if(child.matches?.(findables))idFor(child);
   if(child.querySelectorAll)assignIds(child);
  }
 });
 observer.observe(document.body,{subtree:true,childList:true});
 return {report,assignIds,idFor,destroy(){observer.disconnect();document.removeEventListener('click',onClick,true);document.removeEventListener('change',onChange,true)}};
}
