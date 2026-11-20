import {normalizeClosureRules,isRestaurantClosed,gazaParts} from '../closure-schedule.js?v=closure1-20261120';
const el=(tag,text,cls)=>{
 const node=document.createElement(tag);
 if(text!==undefined&&text!==null)node.textContent=String(text);
 if(cls)node.className=cls;
 return node;
};
const button=(text,fn,cls)=>{const b=el('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;};
const field=(title,input,cls)=>{const label=el('label',null,cls);label.append(el('span',title),input);return label;};
const days=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const validTime=v=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v||'');
const today=()=>gazaParts(new Date()).date;
const currentDay=()=>new Date(today()+'T12:00:00Z').getUTCDay();
export function renderClosureManager({api,area,row}){
 const panel=el('section',null,'closure-manager');
 panel.id='restaurant-closures';
 panel.append(el('h2','مواعيد الإغلاق'),el('p','اختر أيامًا تتكرر أسبوعيًا أو تاريخًا محددًا لمرة واحدة، ويمكنك إضافة عدة فترات في اليوم نفسه. تعمل المواعيد بتوقيت غزة (Asia/Gaza). عند الإغلاق تصبح صور الوجبات بالأبيض والأسود في المنيو العادي والتفاعلي.'));
 const list=el('div',null,'closure-rules');panel.append(list);
 const feedback=el('p','','closure-feedback');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
 let rules=normalizeClosureRules(row.closure_rules).map(r=>({...r,weekdays:[...r.weekdays]}));
 const dirty=()=>{feedback.textContent='توجد تغييرات غير محفوظة. اضغط «حفظ مواعيد الإغلاق» لتطبيقها.';feedback.dataset.state='pending';};
 function draw(){
  list.replaceChildren();
  if(!rules.length)list.append(el('p','لا توجد فترات إغلاق. لا يحدث إغلاق تلقائيًا حتى تضيف فترة وتحفظها.','closure-empty'));
  rules.forEach((rule,index)=>{
   const card=el('div',null,'closure-rule');
   const head=el('div',null,'closure-rule-head');
   head.append(el('strong','فترة '+(index+1)),button('حذف الفترة',()=>{rules.splice(index,1);draw();dirty();},'closure-remove'));
   card.append(head);
   const mode=el('select');for(const [kind,label] of [['weekly','أيام تتكرر أسبوعيًا'],['date','تاريخ محدد لمرة واحدة']]){
    const option=el('option',label);option.value=kind;mode.append(option);
   }mode.value=rule.kind;
   card.append(field('نوع الإغلاق',mode,'closure-mode'));
   const weekdays=el('fieldset',null,'closure-weekdays');weekdays.append(el('legend','اختر أيام الأسبوع'));
   const choices=el('div',null,'closure-day-picks');
   days.forEach((name,day)=>{
    const input=el('input');input.type='checkbox';input.checked=rule.weekdays.includes(day);
    input.addEventListener('change',()=>{
     rule.weekdays=input.checked?[...new Set([...rule.weekdays,day])].sort():rule.weekdays.filter(d=>d!==day);
     dirty();
    });
    const choice=field(name,input,'closure-day-pick');choices.append(choice);
   });weekdays.append(choices);card.append(weekdays);
   const date=el('input');date.type='date';date.value=rule.date||today();
   const dateField=field('التاريخ المحدد',date,'closure-specific-date');card.append(dateField);
   date.addEventListener('change',()=>{rule.date=date.value;dirty();});
   const all=el('input');all.type='checkbox';all.checked=rule.allDay;
   const allField=field('مغلق طوال اليوم',all,'closure-all-day');card.append(allField);
   const times=el('div',null,'closure-time-fields');
   const start=el('input');start.type='time';start.value=rule.start||'15:00';start.step=60;
   const end=el('input');end.type='time';end.value=rule.end||'17:00';end.step=60;
   start.addEventListener('change',()=>{rule.start=start.value;dirty();});
   end.addEventListener('change',()=>{rule.end=end.value;dirty();});
   times.append(field('من الساعة',start),field('إلى الساعة',end));card.append(times);
   card.append(el('small','عندما تكون ساعة النهاية قبل البداية، يستمر الإغلاق إلى اليوم التالي.'));
   const toggle=()=>{weekdays.hidden=rule.kind!=='weekly';dateField.hidden=rule.kind!=='date';times.hidden=rule.allDay;};
   mode.addEventListener('change',()=>{
    rule.kind=mode.value;
    if(rule.kind==='date'&&!rule.date)rule.date=date.value||today();
    if(rule.kind==='weekly'&&!rule.weekdays.length)rule.weekdays=[currentDay()];
    toggle();dirty();
   });
   all.addEventListener('change',()=>{rule.allDay=all.checked;toggle();dirty();});
   toggle();list.append(card);
  });
 }
 const controls=el('div',null,'closure-controls');
 controls.append(button('＋ إضافة فترة إغلاق',()=>{
  rules.push({id:crypto.randomUUID(),kind:'weekly',weekdays:[currentDay()],date:'',allDay:false,start:'15:00',end:'17:00'});
  draw();dirty();list.lastElementChild?.scrollIntoView?.({block:'nearest',behavior:'smooth'});
 },'closure-add'));
 const save=button('حفظ مواعيد الإغلاق',async()=>{
  save.disabled=true;feedback.textContent='جارٍ حفظ مواعيد الإغلاق...';feedback.dataset.state='';
  try{
   if(rules.length>100)throw Error('يسمح بـ 100 فترة كحد أقصى.');
   for(const [i,rule] of rules.entries()){
    if(rule.kind==='weekly'&&!rule.weekdays.length)throw Error('اختر يومًا واحدًا على الأقل في الفترة '+(i+1));
    if(rule.kind==='date'&&!rule.date)throw Error('اختر تاريخًا في الفترة '+(i+1));
    if(!rule.allDay&&(!validTime(rule.start)||!validTime(rule.end)||rule.start===rule.end))
     throw Error('حدد ساعتين مختلفتين أو اختر «طوال اليوم» في الفترة '+(i+1));
   }
   const valid=normalizeClosureRules(rules);
   if(valid.length!==rules.length)throw Error('تحقق من التاريخ أو أيام الأسبوع أو ساعات الإغلاق.');
   const result=await api('/rest/v1/menu_settings?id=eq.'+encodeURIComponent(row.id),{
    method:'PATCH',body:{closure_rules:valid},headers:{Prefer:'return=representation'}
   });
   if(!Array.isArray(result)||!result.length)throw Error('لم يؤكد الخادم حفظ الجدول.');
   rules=valid;row.closure_rules=valid;
   feedback.textContent='تم حفظ '+valid.length+' فترة إغلاق. الحالة الحالية وفق الجدول: '+(isRestaurantClosed(valid)?'مغلق':'مفتوح')+' (توقيت غزة).';
   feedback.dataset.state='success';
  }catch(error){feedback.textContent='تعذر الحفظ: '+error.message;feedback.dataset.state='error';}
  finally{save.disabled=false;}
 },'closure-save');
 save.id='closure-save-rules';
 controls.append(save);panel.append(controls,feedback);
 panel.append(el('small','مواعيد الإغلاق منفصلة عن ساعات العمل المكتوبة للزوار وعن خيار «متوفر» لكل وجبة. الحفظ هنا لا يغيّر معلومات المطعم الأخرى.','closure-guidance'));
 area.append(panel);draw();
}
