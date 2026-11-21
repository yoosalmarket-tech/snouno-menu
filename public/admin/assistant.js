// EDIT ALL PAYMENT 05 — owner-only read-only assistant.
const create=(tag,cls,text)=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text!==undefined)node.textContent=text;
  return node;
};
export function renderAssistant({root,getToken}){
  root.replaceChildren();
  const panel=create('section','snounu-ai');
  panel.setAttribute('aria-label','مساعد سنونو الذكي');
  const hero=create('header','snounu-ai-hero');
  const heroCopy=create('div');
  heroCopy.append(create('small','','SNOUNU  ✦  AI'),
    create('h2','','اسأل عن مطعمك'),
    create('p','','مساعد يحوّل تقارير المبيعات والطلبات وتفاعل الزوار إلى أفكار عملية.'));
  hero.append(heroCopy,create('span','snounu-ai-glyph','✦'));
  const badges=create('div','snounu-ai-meta');
  badges.append(create('span','','قراءة فقط · بدون تعديل البيانات'),
    create('span','','حتى 20 سؤالاً يومياً'));
  const toolbar=create('div','snounu-ai-toolbar');
  const reset=create('button','snounu-ai-reset','محادثة جديدة');
  reset.type='button';toolbar.append(reset);
  const log=create('div','snounu-ai-log');
  log.setAttribute('role','log');
  log.setAttribute('aria-label','محادثة مساعد سنونو');
  log.setAttribute('aria-live','polite');
  const welcome=create('div','snounu-ai-welcome');
  welcome.append(create('h3','','ماذا تريد أن تعرف؟'),
    create('p','','اختر سؤالاً أو اكتب سؤالك أسفل المحادثة.'));
  const suggestions=create('div','snounu-ai-suggestions');
  const questions=[
    ['المبيعات هذا الأسبوع','كم بلغت المبيعات المعتمدة خلال آخر 7 أيام؟ وكم طلباً تمت الموافقة عليه؟'],
    ['الوجبات الأكثر مبيعاً','ما الوجبات الأكثر مبيعاً وإيراداتها حسب السجلات المتاحة؟'],
    ['الطلبات قيد المراجعة','كم عدد الطلبات التي تنتظر اعتماد الدفع الآن؟'],
    ['تفاعل الزوار','ما الوجبات الأكثر جذباً للتفاعل خلال الأيام الأخيرة؟'],
    ['أفكار تسويقية','اقترح ثلاث أفكار قابلة للتنفيذ هذا الأسبوع بناء على تقارير المطعم.']
  ];
  welcome.append(suggestions);log.append(welcome);
  const form=create('form','snounu-ai-form');
  const prompt=create('textarea','snounu-ai-prompt');
  prompt.rows=2;prompt.required=true;prompt.maxLength=500;
  prompt.placeholder='اسأل عن المبيعات، الطلبات، الوجبات أو أداء المنيو…';
  prompt.setAttribute('aria-label','السؤال');
  const controls=create('div','snounu-ai-controls');
  const counter=create('small','','0 / 500');
  const send=create('button','snounu-ai-submit','إرسال السؤال');
  send.type='submit';controls.append(counter,send);
  form.append(prompt,controls);
  panel.append(hero,badges,toolbar,log,form,
    create('p','snounu-ai-disclaimer',
      'تُرسل الإحصاءات المجمّعة والسؤال فقط إلى خدمة الذكاء الاصطناعي. لا تُرسل أسماء العملاء أو أرقام هواتفهم أو عناوينهم أو إثباتات الدفع، ولا تُحفظ المحادثة في قاعدة بيانات المطعم.'));
  root.append(panel);
  let history=[],busy=false;
  function addMessage(role,text){
    const item=create('div','snounu-ai-message snounu-ai-'+role);
    item.append(create('small','',role==='assistant'?'مساعد سنونو':'أنت'),
      create('div','snounu-ai-text',text));
    log.append(item);log.scrollTop=log.scrollHeight;
    return item;
  }
  async function ask(text){
    const question=String(text||'').trim();
    if(busy||question.length<3||question.length>500)return;
    busy=true;send.disabled=true;reset.disabled=true;prompt.disabled=true;
    for(const b of suggestions.querySelectorAll('button'))b.disabled=true;
    if(welcome.isConnected)welcome.remove();
    addMessage('user',question);
    const bubble=addMessage('assistant','أحلّل البيانات المتاحة…');
    bubble.classList.add('is-loading');
    prompt.value='';counter.textContent='0 / 500';
    const previous=history.slice(-6);
    try{
      const token=await getToken();
      const response=await fetch('/api/ai-assistant',{
        method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
        cache:'no-store',body:JSON.stringify({question,history:previous})
      });
      const result=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(result?.message||'تعذر الاتصال بالمساعد، حاول مرة أخرى.');
      if(typeof result?.answer!=='string'||!result.answer.trim())throw new Error('لم يصل جواب من المساعد.');
      bubble.querySelector('.snounu-ai-text').textContent=result.answer.trim();
      history.push({role:'user',content:question},{role:'assistant',content:result.answer.trim()});
      if(history.length>12)history=history.slice(-12);
    }catch(e){
      bubble.classList.add('is-error');
      bubble.querySelector('.snounu-ai-text').textContent=e.message||'حدث خطأ، حاول مجدداً.';
    }finally{
      bubble.classList.remove('is-loading');
      busy=false;send.disabled=false;reset.disabled=false;prompt.disabled=false;
      for(const b of suggestions.querySelectorAll('button'))b.disabled=false;
      log.scrollTop=log.scrollHeight;
    }
  }
  for(const [label,question] of questions){
    const b=create('button','snounu-ai-suggest',label);
    b.type='button';b.onclick=()=>void ask(question);suggestions.append(b);
  }
  prompt.addEventListener('input',()=>counter.textContent=prompt.value.length+' / 500');
  prompt.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){
      event.preventDefault();
      if(prompt.value.trim())void ask(prompt.value);
    }
  });
  form.addEventListener('submit',event=>{event.preventDefault();void ask(prompt.value);});
  reset.onclick=()=>{
    if(busy)return;
    history=[];log.replaceChildren(welcome);
    prompt.value='';counter.textContent='0 / 500';prompt.focus();
  };
}
