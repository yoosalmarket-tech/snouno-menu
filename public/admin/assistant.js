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
    create('span','','حتى 100 إجابة ذكية ناجحة يومياً · الإحصاءات المباشرة متاحة دائماً'));
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
  reset.type='button';toolbar.append(reset);
  const log=create('div','snounu-ai-log');
  log.setAttribute('role','log');
  log.setAttribute('aria-label','محادثة مساعد سنونو');
  log.setAttribute('aria-live','polite');
  const welcome=create('div','snounu-ai-welcome');
  welcome.append(create('h3','','ماذا تريد أن تعرف؟'),
    create('p','','هذه أسئلة مقترحة فقط. اكتب أي سؤال أو فكرة تسويقية وسيجيبك المساعد بشكل طبيعي باستخدام بيانات سنونو عند الحاجة.'));
  const suggestions=create('div','snounu-ai-suggestions');
  const questionGroups=[
    {title:'التحضير للاجتماع القادم',items:[
      ['أفضل وجبة للإعلان','للاجتماع القادم: احسب أفضل وجبة متاحة تستحق التصوير والإعلان القادم، مع ترتيب أول 3 وجبات بالأرقام وأسباب الاختيار وحدود الثقة.'],
      ['ملخص الأداء','جهّز ملخصاً للاجتماع من مشاهدات GA4 وتفاعل الوجبات والمبيعات المعتمدة خلال 7 أيام وما ينبغي أن نناقشه.'],
      ['وجبات تحتاج اهتماماً','ما الوجبات التي لديها نقرات طلب أو فتح تفاصيل مرتفع لكن مبيعات معتمدة قليلة؟ وما التفسير الذي نختبره؟'],
      ['الوجبات الأكثر تفاعلاً','قارن أفضل الوجبات في فتح التفاصيل ونقرات الطلب ونقرات المشاركة خلال آخر أسبوع.'],
      ['نتائج الأسبوع','ما أهم نتائج سنونو آخر 7 أيام وماذا ينبغي أن يتغير في خطة الأسبوع القادم؟']
    ]},
    {title:'التصوير والحملة القادمة',items:[
      ['اختيار التصوير القادم','ما الوجبة التي نختارها للتصوير القادم؟ احسب الأولوية من المبيعات ونقرات الطلب والتفاعل، ولا تفترض أن النقرات مبيعات.'],
      ['فكرة ريلز للوجبة','للوَجبة الأعلى أولوية في سنونو، اقترح فكرة ريلز قصيرة وهوك وتصوير خارجي ودعوة واضحة للطلب.'],
      ['حملة 7 أيام','اقترح حملة لمدة أسبوع للوجبة الأولى في ترتيب الأولوية مع فكرة محتوى وميزانية اختبار افتراضية وطريقة القياس.'],
      ['منتج يستحق إعلاناً مدفوعاً','أي وجبة متاحة لديها مبيعات معتمدة وتفاعل كافٍ لتستحق اختبار إعلان مدفوع؟ وما المعلومات الناقصة قبل تحديد الميزانية؟'],
      ['قياس نجاح الإعلان','ما المؤشرات التي نراقبها بعد نشر الريلز لنفرق بين المشاهدات ونقرات الطلب والمبيعات المعتمدة؟']
    ]},
    {title:'أسئلة الأرقام',items:[
      ['المشاهدات والزيارات','كم عدد مشاهدات الصفحات والجلسات والمستخدمين خلال آخر 7 أيام؟ وقارن بالـ 28 يوماً.'],
      ['المبيعات المعتمدة','قارن مبيعات سنونو المعتمدة خلال 7 أيام و30 يوماً.'],
      ['الطلبات قيد المراجعة','كم عدد الطلبات التي تنتظر اعتماد الدفع الآن؟']
    ]}
  ];
  for(const groupData of questionGroups){
    const group=create('section','snounu-ai-question-group');
    group.append(create('h4','',groupData.title));
    const groupButtons=create('div','snounu-ai-question-buttons');
    for(const [label,question] of groupData.items){
      const button=create('button','snounu-ai-suggest',label);
      button.type='button';button.onclick=()=>void ask(question);
      groupButtons.append(button);
    }
    group.append(groupButtons);suggestions.append(group);
  }
  welcome.append(suggestions);log.append(welcome);
  const form=create('form','snounu-ai-form');
  const prompt=create('textarea','snounu-ai-prompt');
  prompt.rows=2;prompt.required=true;prompt.maxLength=500;
  prompt.placeholder='اسأل بحرية: فكرة ريلز، تحليل وجبة، ميزانية حملة، نص إعلان أو أي سؤال…';
  prompt.setAttribute('aria-label','السؤال');
  const controls=create('div','snounu-ai-controls');
  const counter=create('small','','0 / 500');
  const send=create('button','snounu-ai-submit','إرسال السؤال');
  send.type='submit';controls.append(counter,send);
  form.append(prompt,controls);
  panel.append(hero,badges,briefPanel,toolbar,log,form,
    create('p','snounu-ai-disclaimer',
      'تُرسل إلى Groq الإحصاءات المجمعة وبيانات المنيو العامة والمعلومات الثابتة التي يضيفها المالك. لا تُرسل أسماء العملاء أو إثباتات الدفع أو الأسرار، ولا تُحفظ المحادثة في قاعدة بيانات المطعم.'));
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
      if(result.mode==='summary'){
        const hint=create('small','snounu-ai-mode',
          'تقارير سنونو المباشرة · لا يستخدم نموذج الذكاء الاصطناعي الآن');
        bubble.append(hint);
      } else if(result.mode==='report'){
        bubble.append(create('small','snounu-ai-mode','إجابة مباشرة من قاعدة بيانات سنونو'));
      } else if(result.mode==='media_priority'){
        bubble.append(create('small','snounu-ai-mode','ترتيب محسوب من بيانات سنونو · لا يستهلك سؤالاً ذكياً'));
      } else if(result.mode==='ai' && result.provider==='groq'){
        bubble.append(create('small','snounu-ai-mode','تحليل تسويقي عبر Groq'));
      }
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
