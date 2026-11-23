// EDIT ALL PAYMENT 12 — owner-only natural Groq assistant with private restaurant context.
const create=(tag,cls,text)=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text!==undefined)node.textContent=text;
  return node;
};
function renderReply(target,text){
  target.replaceChildren();
  // Earlier transcripts sometimes place an entire numbered sequence on one line.
  let list=null;
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim();
    const inline=/(?:^|\s)[1١]\)\s/u.test(line)&&/\s[2٢]\)\s/u.test(line);
    const parts=inline?line.split(/\s+(?=[0-9٠-٩]+\)\s)/u):[line];
    if(inline){
      const tail=parts.at(-1).match(/^(.+?[.!؟])\s+(.+)$/u);
      if(tail)parts.splice(-1,1,tail[1],tail[2]);
    }
    for(const part of parts){
      if(!part){list=null;continue;}
      const item=part.match(/^(?:([0-9٠-٩]+)[.)]|([-*•]))\s+(.+)$/u);
      let block;
      if(item){
        const tag=item[1]?'ol':'ul';
        if(list?.localName!==tag){list=create(tag);target.append(list);}
        block=create('li');list.append(block);
        if(item[1])block.value=Number(item[1].replace(/[٠-٩]/g,c=>c.charCodeAt(0)-1632));
      }else{
        list=null;block=create('p');target.append(block);
      }
      const content=item?item[3]:part;
      for(const token of content.split(/(\*\*[^*]+\*\*)/g)){
        if(token.startsWith('**')&&token.endsWith('**')&&token.length>4)
          block.append(create('strong','',token.slice(2,-2)));
        else block.append(document.createTextNode(token));
      }
    }
  }
}

export function renderAssistant({root,getToken,staffMode=false}){
  root.replaceChildren();
  const panel=create('section','snounu-ai');
  panel.setAttribute('aria-label','مساعد سنونو الذكي');
  const title=create('h2','snounu-ai-title','مساعد سنونو');
  const briefPanel=create('details','snounu-ai-brief');
  const briefTitle=create('summary','','تعليمات المطعم');
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
  const tools=create('div','snounu-ai-actions');
  if(!staffMode)tools.append(briefPanel);
  tools.append(reset);
  toolbar.append(title,tools);
  const rail=create('div','snounu-ai-rail');
  if(!staffMode)rail.append(archive);
  const wide=()=>window.matchMedia?.('(min-width: 1050px)').matches??false;
  archive.open=!staffMode&&wide();
  panel.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      const open=event.target.closest('details[open]');
      if(open){open.open=false;open.querySelector('summary').focus();}
    }
  });
  panel.addEventListener('click',event=>{
    if(!briefPanel.contains(event.target))briefPanel.open=false;
    if(!wide()&&!archive.contains(event.target))archive.open=false;
  });
  const log=create('div','snounu-ai-log');
  log.setAttribute('role','log');
  log.setAttribute('aria-label','محادثة مساعد سنونو');
  log.setAttribute('aria-live','polite');
  const welcome=create('div','snounu-ai-welcome');
  const mark=create('span','snounu-ai-mark','✦');
  mark.setAttribute('aria-hidden','true');
  welcome.append(mark,create('h3','','شو بدّك نشتغل عليه اليوم؟'));
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
  prompt.rows=1;prompt.required=true;prompt.maxLength=2000;
  prompt.placeholder='اكتب رسالتك…';
  prompt.setAttribute('aria-label','السؤال');
  const controls=create('div','snounu-ai-controls');
  const counter=create('small','','0 / 2000');
  const send=create('button','snounu-ai-submit','↑');
  send.setAttribute('aria-label','إرسال السؤال');send.title='إرسال السؤال';
  send.type='submit';controls.append(counter,send);
  form.append(prompt,controls);
  const privacy=create('p','snounu-ai-privacy',staffMode?
   'تُرسل الأسئلة إلى Groq. محادثات الموظفين غير محفوظة، وتُطبق الصلاحيات على كل مصدر بيانات. حدّك اليومي ٢٠ إجابة.':
   'تُرسل رسائلك وتعليمات المطعم إلى Groq. المحادثات محفوظة بحسابك. حدّك اليومي ١٠٠ إجابة.');
  if(staffMode)panel.append(privacy);else briefPanel.append(privacy);
  const chat=create('div','snounu-ai-chat');
  chat.append(log,form);
  panel.append(toolbar,rail,chat);
  root.append(panel);
  let active=null,busy=false,listVersion=0;
  function resizePrompt(){
    prompt.style.height='auto';prompt.style.height=Math.min(prompt.scrollHeight,112)+'px';
  }
  function clearChat(){
    active=null;log.replaceChildren(welcome);
    prompt.value='';counter.textContent='0 / 2000';resizePrompt();
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
            if(!wide())archive.open=false;
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
    if(role==='assistant')renderReply(item.lastElementChild,text);
    log.append(item);log.scrollTop=log.scrollHeight;
    return item;
  }
  async function ask(text,isStarter=false){
    const question=String(text||'').trim();
    if(busy||!question||question.length>2000)return;
    setBusy(true);if(!wide())archive.open=false;
    if(welcome.isConnected)welcome.remove();
    addMessage('user',question);
    const bubble=addMessage('assistant','لحظة…');
    bubble.classList.add('is-loading');
    if(!isStarter){prompt.value='';counter.textContent='0 / 2000';resizePrompt();}
    try{
      const token=await getToken();
      const response=await fetch('/api/ai-assistant',{
        method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
        cache:'no-store',body:JSON.stringify({question,chatId:active?.id??null,revision:active?.revision??0})
      });
      const result=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(result?.message||'تعذر الاتصال بالمساعد، حاول مرة أخرى.');
      if(typeof result?.answer!=='string'||!result.answer.trim())throw new Error('لم يصل جواب من المساعد.');
      renderReply(bubble.querySelector('.snounu-ai-text'),result.answer.trim());
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
  prompt.addEventListener('input',()=>{counter.textContent=prompt.value.length+' / 2000';resizePrompt();});
  prompt.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){
      event.preventDefault();
      if(prompt.value.trim())void ask(prompt.value);
    }
  });
  form.addEventListener('submit',event=>{event.preventDefault();void ask(prompt.value);});
  reset.onclick=()=>{
    if(busy)return;
    clearChat();if(!wide())archive.open=false;prompt.focus();
  };
}
