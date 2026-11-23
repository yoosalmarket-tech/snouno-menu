// STAFF & ROLE MANAGEMENT 01.6 — editable role metadata and named staff.
// Security is enforced by Supabase RPCs; the UI is never the authority.
const CAPABILITIES=[];
const GROUPS={
 dashboard:'لوحة التحكم والتقارير',meals:'الوجبات والأصناف',orders:'الطلبات والمدفوعات',
 content:'محتوى الموقع',marketing:'التسويق وSEO',assistant:'المساعد الذكي',
 staff:'الموظفون والأدوار',system:'إدارة النظام'
};
// Suggested templates are editable starting points, not fixed built-in roles.
const TEMPLATES=[
 ['مدير المطعم','Restaurant Manager',[
  'dashboard.view_overview','reports.view_sales','reports.view_products','reports.view_customers',
  'meals.view','meals.add','meals.edit_details','meals.change_prices','meals.change_availability',
  'meals.delete','meals.reorder','meals.manage_categories','meals.manage_images','meals.manage_ingredients',
  'orders.view','orders.view_customers','orders.view_receipts','orders.approve','orders.reject',
  'orders.update_status','orders.cancel','orders.print_invoices','orders.view_history','orders.view_financial',
  'content.edit_welcome','content.manage_ads','content.edit_contact','content.manage_hours','content.manage_closures',
  'content.edit_social','staff.view','staff.view_activity'
 ]],
 ['مدير الفرع','Branch Manager',[
  'dashboard.view_overview','reports.view_products','meals.view','meals.change_availability',
  'orders.view','orders.view_customers','orders.view_receipts','orders.approve','orders.reject',
  'orders.update_status','orders.print_invoices','orders.view_financial'
 ]],
 ['أمين الصندوق','Cashier',[
  'orders.view','orders.view_customers','orders.view_receipts','orders.approve','orders.reject',
  'orders.print_invoices','orders.view_history','orders.view_financial'
 ]],
 ['خدمة العملاء','Customer Service',[
  'orders.view','orders.view_customers','orders.view_receipts','orders.update_status','orders.cancel'
 ]],
 ['مدير التسويق الرقمي','Marketing Manager',[
  'dashboard.view_overview','reports.view_visitors','reports.view_conversions','reports.view_products',
  'reports.view_attribution','content.manage_ads','content.manage_promotions',
  'marketing.view_ga4','marketing.view_search_console','marketing.manage_campaign_links',
  'marketing.generate_tagged_urls','marketing.view_sources','marketing.view_conversions',
  'marketing.edit_seo','marketing.edit_image_seo','marketing.export_reports',
  'assistant.access','assistant.ask_meals','assistant.ask_marketing','assistant.generate_campaigns'
 ]],
 ['محرر المحتوى','Content Editor',[
  'meals.view','meals.add','meals.edit_details','meals.manage_images','meals.manage_categories',
  'meals.manage_ingredients','content.edit_welcome','content.manage_ads',
  'content.edit_banners','content.manage_promotions','content.manage_images','content.edit_social'
 ]],
 ['محلل البيانات','Analyst',[
  'dashboard.view_overview','reports.view_visitors','reports.view_products',
  'reports.view_conversions','reports.view_attribution','reports.export',
  'marketing.view_ga4','marketing.view_search_console','marketing.view_sources',
  'marketing.view_conversions','marketing.export_reports'
 ]],
 ['مشاهد فقط','Read-only Viewer',[
  'dashboard.view_overview','reports.view_visitors','reports.view_products','meals.view'
 ]]
];
const el=(tag,text,cls)=>{
 const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=String(text);
 if(cls)n.className=cls;return n;
};
const button=(label,cls,click)=>{
 const b=el('button',label,cls);b.type='button';if(click)b.onclick=click;return b;
};
const input=(label,value='',max=100)=>{
 const wrapper=el('label',label,'role-field');
 const field=el('input');field.type='text';field.value=value||'';field.maxLength=max;
 wrapper.append(field);return [wrapper,field];
};
const fmt=s=>s?new Date(s).toLocaleString('ar-PS',{timeZone:'Asia/Gaza',dateStyle:'medium',timeStyle:'short'}):'—';
export async function renderRoles({root,api,notice}){
 root.replaceChildren();
 const page=el('section',null,'roles-manager');
 const header=el('div',null,'roles-manager-top');
 header.append(el('h2','إدارة الأدوار والصلاحيات'),
  el('p','أسماء الأدوار قابلة للتعديل دون تغيير معرف الدور. صلاحيات المالك الأساسية محمية.'));
 const createLink=el('a','إضافة موظف جديد','role-save');
 createLink.href='/admin/staff';header.append(createLink);page.append(header);
 const createPanel=el('section',null,'roles-people');
 const rolesGrid=el('div',null,'roles-grid');
 const employees=el('section',null,'roles-people');
 const activity=el('section',null,'roles-people');
 page.append(createPanel,rolesGrid,employees,activity);root.append(page);

 let roles=[],members=[];
 const send=(name,body)=>api('/rest/v1/rpc/'+name,{method:'POST',body});
 const currentRole=id=>roles.find(r=>r.role===id);
 function editor(role,onSave,{owner=false}={}){
   const form=el('form',null,'role-editor');
   const [arLabel,ar]=input('اسم الدور بالعربية',role?.label_ar||role?.label||'',100);
   const [enLabel,en]=input('Role name in English',role?.label_en||'',100);
   const [descLabel,desc]=input('وصف الدور',role?.description||'',500);
   ar.required=true;ar.minLength=2;
   form.append(arLabel,enLabel,descLabel);
   const search=el('input');search.type='search';search.placeholder='ابحث في الصلاحيات…';
   search.setAttribute('aria-label','البحث في الصلاحيات');
   const selected=el('div',null,'roles-permissions');
   const allChecks=[];
   const groupElements=[];
   for(const [group,label] of Object.entries(GROUPS)){
     const groupRows=CAPABILITIES.filter(item=>item[3]===group);
     const details=el('details',null,'role-permission-group');details.open=true;
     const summary=el('summary',label+' · '+groupRows.length);
     const actions=el('div',null,'roles-actions');
     const toggle=checked=>groupElements.find(g=>g.group===group)?.items.forEach(({checkbox})=>{if(!checkbox.disabled)checkbox.checked=checked;});
     actions.append(button('تحديد الكل','role-plain-button',()=>toggle(true)),
       button('إلغاء التحديد','role-plain-button',()=>toggle(false)));
     const list=el('div',null,'roles-permissions');
     const items=[];
     for(const [key,name,help] of groupRows){
       const item=el('label',null,'roles-permission');
       const checkbox=el('input');checkbox.type='checkbox';checkbox.value=key;
       checkbox.checked=owner||!!role?.permissions?.includes(key);
       checkbox.disabled=owner;
       const info=el('span');info.append(el('strong',name),el('small',help));
       item.append(checkbox,info);list.append(item);
       items.push({item,checkbox,name,help});
       allChecks.push(checkbox);
     }
     if(owner)actions.hidden=true;
     details.append(summary,actions,list);selected.append(details);
     groupElements.push({group,details,items});
   }
   search.oninput=()=>{
     const term=search.value.trim().toLowerCase();
     for(const group of groupElements){
       let visible=0;
       for(const row of group.items){
         row.item.hidden=!!term&&!(row.name+' '+row.help).toLowerCase().includes(term);
         if(!row.item.hidden)visible++;
       }
       group.details.hidden=!visible;
       if(term&&visible)group.details.open=true;
     }
   };
   const preview=el('p','','role-access-preview');
   function updatePreview(){
     preview.textContent=owner?'المالك · وصول كامل محمي':allChecks.filter(x=>x.checked).length+' من '+allChecks.length+' صلاحيات محددة';
   }
   for(const cb of allChecks)cb.onchange=updatePreview;
   updatePreview();
   form.append(search,selected,preview);
   const foot=el('div',null,'roles-actions');
   const save=el('button','حفظ التعديلات','role-save');save.type='submit';
   const cancel=button('إلغاء','role-plain-button',()=>reload());
   const result=el('small','','roles-feedback');result.setAttribute('role','status');
   foot.append(save,cancel,result);form.append(foot);
   form.onsubmit=async event=>{
     event.preventDefault();
     const selectedKeys=allChecks.filter(x=>x.checked).map(x=>x.value);
     if(role?.role&&!owner){
       const affected=members.filter(u=>u.role===role.role).length;
       if(affected&&!confirm('سيؤثر تغيير صلاحيات هذا الدور على '+affected+' موظف. متابعة؟'))return;
     }
     save.disabled=true;result.textContent='جارٍ الحفظ…';
     try{
       await onSave({
         label_ar:ar.value.trim(),label_en:en.value.trim(),
         description:desc.value.trim(),permissions:selectedKeys
       });
       notice('تم حفظ بيانات الدور');await reload();
     }catch(error){result.textContent='تعذّر الحفظ: '+error.message;}
     finally{save.disabled=false;}
   };
   return form;
 }
 async function reload(){
  const [roleRows,staffRows,catalog]=await Promise.all([
    api('/rest/v1/menu_roles?select=id,role,label,label_ar,label_en,description,permissions,built_in&order=built_in.desc,label'),
    api('/rest/v1/menu_staff?select=email,user_id,full_name,role,status,added_at&order=email'),
    api('/rest/v1/menu_permission_catalog?select=key,group_key,label_ar,label_en,sort_order&order=sort_order')
  ]);
  roles=roleRows;members=staffRows;
  CAPABILITIES.splice(0,CAPABILITIES.length,...catalog.map(p=>[p.key,p.label_ar,p.label_en,p.group_key]));
  createPanel.replaceChildren(el('h3','إنشاء دور جديد'),el('p','اختر قالباً قابلاً للتعديل، أو أنشئ دوراً من الصفر.'));
  const templateSelect=el('select');templateSelect.setAttribute('aria-label','قوالب الأدوار');
  const blank=el('option','دور فارغ');blank.value='';templateSelect.append(blank);
  TEMPLATES.forEach(([name,english],i)=>{
    const option=el('option',name+' / '+english);option.value=String(i);templateSelect.append(option);
  });
  createPanel.append(templateSelect);
  let draft={label_ar:'',label_en:'',description:'',permissions:[]};
  let createEditor=editor(draft,async values=>{
    const roleId='role_'+crypto.randomUUID().replace(/-/g,'').slice(0,12);
    await send('menu_role_save_v2',{p_role:roleId,p_name_ar:values.label_ar,p_name_en:values.label_en,p_description:values.description,p_permissions:values.permissions});
  });
  createPanel.append(createEditor);
  templateSelect.onchange=()=>{
    const entry=templateSelect.value===''?null:TEMPLATES[Number(templateSelect.value)];
    draft=entry?{label_ar:entry[0],label_en:entry[1],description:'',permissions:entry[2]}:{label_ar:'',label_en:'',description:'',permissions:[]};
    const next=editor(draft,async values=>{
      const roleId='role_'+crypto.randomUUID().replace(/-/g,'').slice(0,12);
      await send('menu_role_save_v2',{p_role:roleId,p_name_ar:values.label_ar,p_name_en:values.label_en,p_description:values.description,p_permissions:values.permissions});
    });
    createEditor.replaceWith(next);createEditor=next;
  };
  rolesGrid.replaceChildren();
  for(const role of roles){
    const card=el('article',null,'role-card');
    const top=el('div',null,'role-header');
    const count=members.filter(x=>x.role===role.role).length;
    top.append(el('strong',role.label_ar||role.label),
      el('small',(role.role==='owner'?'محمي · ':'')+count+' موظف'));
    card.append(top);
    const actions=el('div',null,'roles-actions');
    const editButton=button('تعديل الدور','role-save',()=>{
       card.querySelector('.role-editor')?.remove();
       card.append(editor(role,async changes=>{
         if(role.role!=='owner')await send('menu_role_save_v2',{
           p_role:role.role,p_name_ar:changes.label_ar,p_name_en:changes.label_en,
           p_description:changes.description,p_permissions:changes.permissions
         });
         if(role.role==='owner')await send('menu_role_save_details',{
           p_role:role.role,p_label_ar:changes.label_ar,p_label_en:changes.label_en,
           p_description:changes.description
         });
       },{owner:role.role==='owner'}));
    });
    const duplicate=button('نسخ الدور','role-plain-button',async()=>{
      const roleId='role_'+crypto.randomUUID().replace(/-/g,'').slice(0,12);
      try{
        await send('menu_role_save_v2',{p_role:roleId,p_name_ar:('نسخة '+(role.label_ar||role.label)).slice(0,100),p_name_en:role.label_en||'',p_description:role.description||'',p_permissions:role.permissions.filter(x=>CAPABILITIES.some(p=>p[0]===x))});
        notice('تم إنشاء نسخة من الدور');await reload();
      }catch(error){notice('تعذّر النسخ: '+error.message);}
    });
    actions.append(editButton,duplicate);
    if(!role.built_in&&role.role!=='owner'){
      const remove=button('حذف الدور','role-delete',async()=>{
        if(count){notice('انقل الموظفين إلى دور آخر قبل الحذف');return;}
        if(!confirm('حذف «'+role.label+'»؟'))return;
        try{await send('menu_role_remove',{p_role:role.role});notice('تم حذف الدور');await reload();}
        catch(error){notice('تعذّر حذف الدور: '+error.message);}
      });actions.append(remove);
    }
    card.append(actions);rolesGrid.append(card);
  }
  employees.replaceChildren(el('h3','الموظفون'),el('p','أسماء الموظفين مرتبطة بحساباتهم؛ البريد يبقى لتسجيل الدخول.'));
  for(const staff of members){
    const row=el('div',null,'roles-member');
    const person=el('div',null,'role-person');
    const label=currentRole(staff.role)?.label_ar||currentRole(staff.role)?.label||staff.role;
    person.append(el('strong',staff.full_name||staff.email),
      el('small',label+' · '+staff.email),
      el('small','أضيف: '+fmt(staff.added_at)+(staff.status==='disabled'?' · معطّل':'')));
    row.append(person);
    if(staff.role==='owner'){row.append(el('strong','المالك · محمي'));employees.append(row);continue;}
    const actions=el('div',null,'roles-actions');
    const roleSelect=el('select');roleSelect.setAttribute('aria-label','دور '+staff.email);
    for(const r of roles.filter(x=>x.role!=='owner')){
      const option=el('option',r.label_ar||r.label);option.value=r.role;roleSelect.append(option);
    }
    roleSelect.value=staff.role;
    actions.append(roleSelect,button('تحديث الدور','role-save',async()=>{
      if(roleSelect.value===staff.role)return;
      if(!confirm('تغيير دور '+(staff.full_name||staff.email)+'؟'))return;
      try{await send('menu_staff_set_role',{p_email:staff.email,p_role:roleSelect.value});notice('تم تغيير الدور');await reload();}
      catch(error){notice('تعذّر تغيير الدور: '+error.message);}
    }));
    const rename=button('تعديل الاسم','role-plain-button',async()=>{
      if(!staff.user_id){notice('لا يوجد معرف مستخدم مرتبط بهذا الحساب بعد');return;}
      const name=prompt('الاسم الكامل للموظف',staff.full_name||'');
      if(name===null)return;
      try{await send('menu_staff_set_name',{p_user_id:staff.user_id,p_full_name:name.trim()});notice('تم تعديل الاسم');await reload();}
      catch(error){notice('تعذّر تعديل الاسم: '+error.message);}
    });
    actions.append(rename);
    if(staff.user_id)actions.append(button(staff.status==='disabled'?'إعادة التفعيل':'تعطيل الحساب',
      'role-plain-button',async()=>{
        const status=staff.status==='disabled'?'active':'disabled';
        if(!confirm((status==='disabled'?'تعطيل':'إعادة تفعيل')+' حساب '+(staff.full_name||staff.email)+'؟'))return;
        try{await send('menu_staff_set_status',{p_user_id:staff.user_id,p_status:status});notice('تم تحديث حالة الحساب');await reload();}
        catch(error){notice('تعذّر تعديل الحساب: '+error.message);}
      }));
    row.append(actions);employees.append(row);
  }
  activity.replaceChildren(el('h3','سجل نشاط الموظفين'));
  const search=el('input');search.type='search';search.placeholder='ابحث عن موظف أو إجراء';
  search.setAttribute('aria-label','بحث سجل نشاط الموظفين');
  const filter=el('select');filter.setAttribute('aria-label','فلترة النشاط');
  for(const [v,name] of [['','كل الإجراءات'],['payment_approved','اعتماد الدفع'],['payment_rejected','رفض الدفع'],['meal_price_changed','تغيير الأسعار'],['meal_availability_changed','تغيير التوفر'],['meal_deleted','حذف الوجبات'],['update_menu_roles','تعديل الأدوار'],['update_menu_staff','تعديل الموظفين']]){
    const o=el('option',name);o.value=v;filter.append(o);
  }
  const dateFilter=el('input');dateFilter.type='date';dateFilter.setAttribute('aria-label','تاريخ الإجراء');
  const tools=el('div',null,'roles-actions');tools.append(search,filter,dateFilter);
  const logs=el('div',null,'roles-log-list');activity.append(tools,logs);
  let entries=[];
  try{entries=await api('/rest/v1/menu_staff_activity?select=actor_name,actor_role,action,created_at,target_table,target_id,previous_value,new_value&order=created_at.desc&limit=100');}
  catch(error){logs.append(el('p','تعذّر تحميل سجل النشاط: '+error.message));return;}
  function show(){
    logs.replaceChildren();
    const term=search.value.trim().toLowerCase();
    const matches=entries.filter(x=>(!term||(x.actor_name+' '+x.action+' '+x.target_id).toLowerCase().includes(term))&&
      (!filter.value||x.action===filter.value)&&
      (!dateFilter.value||x.created_at?.slice(0,10)===dateFilter.value));
    for(const event of matches){
      const detail=el('details',null,'role-log-entry');
      const summary=el('summary',(event.actor_name||'موظف')+' · '+event.action+' · '+fmt(event.created_at));
      const role=el('small',(event.actor_role||'')+' · '+event.target_table+' · '+event.target_id);
      const info=el('pre',JSON.stringify({before:event.previous_value,after:event.new_value},null,2));
      detail.append(summary,role,info);logs.append(detail);
    }
    if(!matches.length)logs.append(el('p','لا توجد إجراءات مطابقة'));
  }
  search.oninput=show;filter.onchange=show;dateFilter.onchange=show;show();
 }
 try{await reload();}catch(error){page.append(el('p','تعذّر تحميل إدارة الموظفين: '+error.message));}
}
