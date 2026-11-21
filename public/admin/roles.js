// EDIT ALL PAYMENT 06: Owner-managed custom roles.
const CAPABILITIES = [
 ['dishes','الوجبات','إضافة الوجبات وتعديل الأسعار والصور وتوفر الوجبات'],
 ['categories','الأصناف','إنشاء الأصناف وتغيير ترتيبها'],
 ['menu_settings','المطعم','معلومات المطعم وساعات العمل والإعدادات العامة'],
 ['menu_links','روابط التواصل','تعديل روابط التواصل الخاصة بالمطعم'],
 ['menu_ads','الإعلانات','إضافة وتعديل إعلانات المنيو'],
 ['rankings','التقييمات','عرض التقييمات وإزالة الرسائل غير المناسبة'],
 ['submissions','رسائل الزوار','قراءة رسائل التواصل والرد عليها خارج الموقع'],
 ['events','إحصائيات التفاعل','عرض إحصائيات التفاعل في المنيو'],
 ['orders','الطلبات — قراءة فقط','عرض الطلبات والإيصالات دون قبول أو رفض الدفع']
];
const el=(tag,text,cls)=>{
 const n=document.createElement(tag);
 if(text!==undefined)n.textContent=text;
 if(cls)n.className=cls;
 return n;
};
export async function renderRoles({root,api,notice}){
 root.replaceChildren();
 const page=el('section',undefined,'roles-manager');
 const intro=el('p','أنشئ أدواراً مخصّصة وحدّد الأقسام التي يمكن لكل دور الوصول إليها. لا يمكن تغيير حساب المالك أو منح صلاحية اعتماد الدفع من هنا.');
 const heading=el('h2','إدارة الأدوار والصلاحيات');
 const list=el('div',undefined,'roles-grid');
 const people=el('section',undefined,'roles-people');
 page.append(heading,intro,list,people);
 root.append(page);
 async function reload(){
   const [roles,users]=await Promise.all([
     api('/rest/v1/menu_roles?select=role,label,permissions,built_in&order=built_in.desc,label'),
     api('/rest/v1/menu_staff?select=email,role&order=email')
   ]);
   list.replaceChildren();
   for(const role of roles){
     const card=el('article',undefined,'role-card');
     const header=el('div',undefined,'role-header');
     header.append(el('strong',role.label),el('small',role.role==='owner'?'محمي · صلاحيات كاملة':role.role==='editor'?'دور أساسي':'دور مخصّص'));
     card.append(header);
     const form=el('form',undefined,'role-editor');
     const title=el('input');
     title.type='text';title.value=role.label;title.maxLength=60;title.minLength=2;
     title.required=true;title.disabled=role.role==='owner';
     title.setAttribute('aria-label','اسم الدور');
     const label=el('label','اسم الدور');label.append(title);
     form.append(label);
     const permissions=el('div',undefined,'roles-permissions');
     for(const [key,name,desc] of CAPABILITIES){
       const item=el('label',undefined,'roles-permission');
       const checkbox=el('input');checkbox.type='checkbox';checkbox.value=key;
       checkbox.checked=role.role==='owner'||role.permissions?.includes(key);
       checkbox.disabled=role.role==='owner';
       const copy=el('span');
       copy.append(el('strong',name),el('small',desc));
       item.append(checkbox,copy);permissions.append(item);
     }
     form.append(permissions);
     const foot=el('div',undefined,'roles-actions');
     const feedback=el('span','', 'roles-feedback');
     feedback.setAttribute('role','status');
     if(role.role!=='owner'){
       const save=el('button','حفظ الصلاحيات','role-save');
       save.type='submit';foot.append(save);
       form.onsubmit=async event=>{
         event.preventDefault();save.disabled=true;feedback.textContent='جارٍ الحفظ…';
         try{
           const selected=[...form.querySelectorAll('input[type="checkbox"]:checked')].map(x=>x.value);
           await api('/rest/v1/rpc/menu_role_save',{method:'POST',
             body:{p_role:role.role,p_label:title.value.trim(),p_permissions:selected}});
           feedback.textContent='تم الحفظ بنجاح ✓';notice('تم حفظ صلاحيات الدور');await reload();
         }catch(err){feedback.textContent='لم يتم الحفظ: '+err.message;}
         finally{save.disabled=false;}
       };
       if(!role.built_in){
         const remove=el('button','حذف الدور','role-delete');
         remove.type='button';remove.onclick=async()=>{
           if(!confirm('حذف الدور «'+role.label+'»؟ يجب نقل أعضائه إلى دور آخر أولاً.'))return;
           try{await api('/rest/v1/rpc/menu_role_remove',{method:'POST',body:{p_role:role.role}});
             notice('تم حذف الدور');await reload();}
           catch(err){feedback.textContent='تعذّر الحذف: '+err.message;}
         };
         foot.append(remove);
       }
     }
     foot.append(feedback);form.append(foot);card.append(form);list.append(card);
   }
   const create=el('article',undefined,'role-card roles-create');
   create.append(el('h3','إضافة دور مخصّص'));
   const form=el('form',undefined,'role-editor');
   const name=el('input');name.required=true;name.minLength=2;name.maxLength=60;name.placeholder='مثلاً: مصوّر المطعم';
   const nameLabel=el('label','اسم الدور الجديد');nameLabel.append(name);
   form.append(nameLabel);
   const selected=el('div',undefined,'roles-permissions');
   for(const [key,label,help] of CAPABILITIES){
     const row=el('label',undefined,'roles-permission');
     const input=el('input');input.type='checkbox';input.value=key;
     const copy=el('span');copy.append(el('strong',label),el('small',help));
     row.append(input,copy);selected.append(row);
   }
   form.append(selected);
   const btn=el('button','إنشاء الدور','role-save');btn.type='submit';
   const message=el('p','', 'roles-feedback');message.setAttribute('role','status');
   form.append(btn,message);
   form.onsubmit=async event=>{
     event.preventDefault();btn.disabled=true;message.textContent='جارٍ الإنشاء…';
     try{
       const roleId='role_'+crypto.randomUUID().replace(/-/g,'').slice(0,12);
       await api('/rest/v1/rpc/menu_role_save',{method:'POST',body:{
         p_role:roleId,p_label:name.value.trim(),
         p_permissions:[...selected.querySelectorAll('input:checked')].map(x=>x.value)
       }});
       notice('تم إنشاء الدور الجديد');await reload();
     }catch(err){message.textContent='لم يتم الإنشاء: '+err.message;}
     finally{btn.disabled=false;}
   };
   create.append(form);list.append(create);
   people.replaceChildren(el('h3','أدوار أعضاء الفريق'),el('p','تغيير الدور يغيّر الصلاحيات فور إعادة تحميل الصفحة لدى المستخدم.'));
   for(const member of users){
     const row=el('div',undefined,'roles-member');
     row.append(el('span',member.email));
     if(member.role==='owner'){row.append(el('strong','مالك · محمي'));people.append(row);continue;}
     const select=el('select');
     select.setAttribute('aria-label','دور '+member.email);
     for(const role of roles.filter(x=>x.role!=='owner')){
       const option=el('option',role.label);option.value=role.role;select.append(option);
     }
     select.value=member.role;
     const change=el('button','تحديث الدور','role-save');change.type='button';
     const result=el('small','','roles-feedback');
     change.onclick=async()=>{
       change.disabled=true;result.textContent='جارٍ التحديث…';
       try{await api('/rest/v1/rpc/menu_staff_set_role',{method:'POST',body:{p_email:member.email,p_role:select.value}});
         result.textContent='تم تحديث الدور ✓';notice('تم تغيير دور الموظف');await reload();}
       catch(err){result.textContent='لم يتم التغيير: '+err.message;}
       finally{change.disabled=false;}
     };
     row.append(select,change,result);people.append(row);
   }
 }
 try{await reload();}catch(err){page.append(el('p','تعذّر تحميل الأدوار: '+err.message));}
}
