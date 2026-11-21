// EDIT ALL PAYMENT 12 — owner-only natural Groq assistant with private restaurant context.
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
    create('p','','تحدث مع Groq بحرية، واستفد من بيانات المنيو والمبيعات والمشاهدات ومعلومات المطعم في أي فكرة أو قرار.'));
  hero.append(heroCopy,create('span','snounu-ai-glyph','✦'));
  const badges=create('div','snounu-ai-meta');
  badges.append(create('span','','قراءة فقط · بدون تعديل البيانات'),
    create('span','','حتى 100 إجابة ذكية ناجحة يومياً'));
  const briefPanel=create('details','snounu-ai-brief');
  const briefTitle=create('summary','','معلومات ثابتة للمساعد · يحررها مالك المطعم');
  const briefIntro=create('p','','أضف أهداف المطعم، الجمهور المستهدف، هوامش الربح التقريبية، حدود ميزانية التسويق أو قيود التصوير. هذه المعلومات تُرسل إلى Groq ضمن سياق الأسئلة، فلا تكتب بيانات عملاء أو كلمات مرور.');
  const briefInput=create('textarea','snounu-ai-brief-input');
  briefInput.rows=5;briefInput.maxLength=3000;
  briefInput.placeholder='مثال: هدفنا زيادة طلبات البرجر، الجمهور طلاب وعائلات، ميزانية التجربة 100 شيكل، لا يمكن التصوير داخل المطعم...';
  briefInput.setAttribute('aria-label','الحقائق والأهداف الثابتة للمطعم');
  const briefSave=create('button','snounu-ai-brief-save','حفظ معلومات المطعم');
  briefSave.type='button';
  const briefStatus=create('small','snounu-ai-brief-status','');
  const briefActions=create('div','snounu-ai-brief-actions');
  briefActions.append(briefSave,briefStatus);
  briefPanel.append(briefTitle,briefIntro,briefInput,briefActions);
  const briefEndpoint='https://wknpuzdyemwkllmxehyy.supabase.co/rest/v1/rpc/';
  const briefApiKey='sb_publishable_FJg5RC-dTvsINEy9D8_rXw_xM03B4Ip';
  async function briefRequest(functionName,params){
    const token=await getToken();
    const response=await fetch(briefEndpoint+functionName,{
      method:'POST',
      headers:{Authorization:'Bearer '+token,apikey:briefApiKey,'Content-Type':'application/json'},
      cache:'no-store',body:JSON.stringify(params)
    });
    if(!response.ok)throw new Error('تعذّر الوصول إلى معلومات المالك. تحقق من تسجيل الدخول.');
    return response.json();
  }
  let briefLoaded=false,briefLoading=false;
  async function loadBrief(){
    if(briefLoaded||briefLoading)return;
    briefLoading=true;
    briefStatus.textContent='تحميل معلومات المطعم…';
    try{
      const text=await briefRequest('snounu_ai_get_brief',{});
      if(typeof text!=='string')throw new Error('لم يتم استلام نص المعلومات الثابتة.');
      briefInput.value=text;briefLoaded=true;
      briefStatus.textContent=text?'المعلومات محفوظة ويمكن تعديلها.':'لم تُضف معلومات ثابتة بعد.';
    }catch(e){briefStatus.textContent=e.message;}
    finally{briefLoading=false;}
  }
  briefPanel.addEventListener('toggle',()=>{
    if(briefPanel.open)void loadBrief();
  });
  briefSave.addEventListener('click',async()=>{
    if(briefLoading)return;
    if(!briefLoaded){await loadBrief();return;}
    const old=briefSave.textContent;
    briefSave.disabled=true;briefSave.textContent='جارٍ الحفظ…';
    briefStatus.textContent='';
    try{
      await briefRequest('snounu_ai_set_brief',{p_brief:briefInput.value});
      briefStatus.textContent='تم حفظ المعلومات. سيستخدمها المساعد في الأسئلة التالية.';
    }catch(e){briefStatus.textContent=e.message;}
    finally{briefSave.disabled=false;briefSave.textContent=old;}
  });
  const toolbar=create('div','snounu-ai-toolbar');
  const reset=create('button','snounu-ai-reset','محادثة جديدة');
  reset.type='button';
  const archive=create('details','snounu-ai-history');
  const archiveLabel=create('summary','','المحادثات السابقة');
  const archiveList=create('div','snounu-ai-history-list');
  const archiveStatus=create('small','','');
  archiveStatus.setAttribute('role','status');
  archive.append(archiveLabel,archiveList,archiveStatus);
  toolbar.append(reset,archive);
  const log=create('div','snounu-ai-log');
  log.setAttribute('role','log');
  log.setAttribute('aria-label','محادثة مساعد سنونو');
  log.setAttribute('aria-live','polite');
  const welcome=create('div','snounu-ai-welcome');
  welcome.append(create('h3','','ماذا تريد أن تعرف؟'),
    create('p','','هذه أسئلة مقترحة فقط. اكتب أي سؤال أو فكرة تسويقية وسيجيبك المساعد بشكل طبيعي باستخدام بيانات سنونو عند الحاجة.'));
  const suggestions=create('div','snounu-ai-suggestions');
  const starters=[
    ['فكرة ريلز','بفكر أصوّر ريلز عن بوكس المشاركة بكرة. شو رأيك؟'],
    ['الوجبة الجاية للإعلان','أي وجبة بتنصح نعلن عنها هالأسبوع؟ وليش؟'],
    ['نتيجة حملة','كيف بعرف إذا الريلز جاب طلبات؟']
  ];
  const buttons=create('div','snounu-ai-question-buttons');
  for(const [label,question] of starters){
    const button=create('button','snounu-ai-suggest',label);
    button.type='button';button.onclick=()=>void ask(question,true);
    buttons.append(button);
  }
  suggestions.append(buttons);
  welcome.append(suggestions);log.append(welcome);
  const form=create('form','snounu-ai-form');
  const prompt=create('textarea','snounu-ai-prompt');
  prompt.rows=2;prompt.required=true;prompt.maxLength=2000;
  prompt.placeholder='اسأل بحرية: فكرة ريلز، تحليل وجبة، ميزانية حملة، نص إعلان أو أي سؤال…';
  prompt.setAttribute('aria-label','السؤال');
  const controls=create('div','snounu-ai-controls');
  const counter=create('small','','0 / 2000');
  const send=create('button','snounu-ai-submit','إرسال السؤال');
  send.type='submit';controls.append(counter,send);
  form.append(prompt,controls);
  panel.append(hero,badges,briefPanel,toolbar,log,form,
    create('p','snounu-ai-disclaimer',
      'تُرسل إلى Groq الإحصاءات المجمعة وبيانات المنيو العامة والمعلومات الثابتة التي يضيفها المالك. لا تُرسل أسماء العملاء أو إثباتات الدفع أو الأسرار، وتنحفظ محادثاتك بحسابك. بتقدر ترجع إلها أو تحذفها من المحادثات السابقة.'));
  root.append(panel);
  let active=null,busy=false,listVersion=0;
  function clearChat(){
    active=null;log.replaceChildren(welcome);
    prompt.value='';counter.textContent='0 / 2000';
  }
  function setBusy(value){
    busy=value;send.disabled=value;reset.disabled=value;prompt.disabled=value;
    for(const button of panel.querySelectorAll('.snounu-ai-history button,.snounu-ai-suggest'))button.disabled=value;
  }
  async function loadChats(offset=0){
    const version=++listVersion;
    archiveStatus.textContent='عم نحمّل المحادثات…';
    try{
      const rows=await briefRequest('snounu_chats_list',{p_offset:offset});
      if(version!==listVersion)return;
      if(!offset)archiveList.replaceChildren();
      archiveList.querySelector('.snounu-ai-more')?.remove();
      for(const chat of rows.slice(0,30)){
        const row=create('div','snounu-ai-history-row');
        const open=create('button','snounu-ai-reset',chat.title);
        open.dir='auto';open.disabled=busy;open.type='button';
        open.onclick=async()=>{
          if(busy)return;
          setBusy(true);
          try{
            const saved=await briefRequest('snounu_chat_read',{p_id:chat.id});
            if(!saved)throw Error('المحادثة مش موجودة.');
            clearChat();active=saved;log.replaceChildren();
            for(const turn of saved.turns){addMessage('user',turn.question);addMessage('assistant',turn.answer);}
            archive.open=false;
          }catch(e){archiveStatus.textContent=e.message;}
          finally{setBusy(false);}
        };
        const del=create('button','snounu-ai-reset','حذف');
        del.type='button';del.disabled=busy;del.setAttribute('aria-label','حذف المحادثة '+chat.title);
        del.onclick=async()=>{
          if(busy||!window.confirm('تحذف محادثة «'+chat.title+'» بكل رسائلها؟'))return;
          setBusy(true);
          try{
            await briefRequest('snounu_chat_delete',{p_id:chat.id});
            if(active?.id===chat.id)clearChat();
            await loadChats();
          }catch(e){archiveStatus.textContent=e.message;}
          finally{setBusy(false);}
        };
        row.append(open,del);archiveList.append(row);
      }
      if(rows.length>30){
        const more=create('button','snounu-ai-reset snounu-ai-more','محادثات أقدم');
        more.type='button';more.disabled=busy;more.onclick=()=>{more.disabled=true;void loadChats(offset+30);};
        archiveList.append(more);
      }
      archiveStatus.textContent=archiveList.childElementCount?'':'لسّه ما في محادثات محفوظة.';
    }catch{if(version===listVersion){
      archiveStatus.textContent='تعذّر تحميل المحادثات. سكّر السجل وافتحه للمحاولة مرة ثانية.';
      const more=archiveList.querySelector('.snounu-ai-more');if(more)more.disabled=false;
    }}
  }
  archive.addEventListener('toggle',()=>{if(archive.open)void loadChats();});
  function addMessage(role,text){
    const item=create('div','snounu-ai-message snounu-ai-'+role);
    item.append(create('small','',role==='assistant'?'مساعد سنونو':'أنت'),
      create('div','snounu-ai-text',text));
    item.lastElementChild.dir='auto';
    log.append(item);log.scrollTop=log.scrollHeight;
    return item;
  }
  async function ask(text,isStarter=false){
    const question=String(text||'').trim();
    if(busy||!question||question.length>2000)return;
    setBusy(true);archive.open=false;
    if(welcome.isConnected)welcome.remove();
    addMessage('user',question);
    const bubble=addMessage('assistant','لحظة…');
    bubble.classList.add('is-loading');
    if(!isStarter){prompt.value='';counter.textContent='0 / 2000';}
    try{
      const token=await getToken();
      const response=await fetch('/api/ai-assistant',{
        method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
        cache:'no-store',body:JSON.stringify({question,chatId:active?.id??null,revision:active?.revision??0})
      });
      const result=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(result?.message||'تعذر الاتصال بالمساعد، حاول مرة أخرى.');
      if(typeof result?.answer!=='string'||!result.answer.trim())throw new Error('لم يصل جواب من المساعد.');
      bubble.querySelector('.snounu-ai-text').textContent=result.answer.trim();
      active=result.chat;
      if(archive.open)void loadChats();
    }catch(e){
      bubble.classList.add('is-error');
      bubble.querySelector('.snounu-ai-text').textContent=e.message||'حدث خطأ، حاول مجدداً.';
    }finally{
      bubble.classList.remove('is-loading');
      setBusy(false);
      log.scrollTop=log.scrollHeight;
    }
  }
  prompt.addEventListener('input',()=>counter.textContent=prompt.value.length+' / 2000');
  prompt.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){
      event.preventDefault();
      if(prompt.value.trim())void ask(prompt.value);
    }
  });
  form.addEventListener('submit',event=>{event.preventDefault();void ask(prompt.value);});
  reset.onclick=()=>{
    if(busy)return;
    clearChat();archive.open=false;prompt.focus();
  };
}
