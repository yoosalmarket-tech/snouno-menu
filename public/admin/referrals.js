// Owner-only organic referral report: a saved-link selector, GA4 visits, and approved payment totals.
// No personal/customer fields are requested by this module.
const HOST="https://snounu-restaurant.vercel.app";
const $el=(tag,text,cls)=>{
  const el=document.createElement(tag);
  if(text!==undefined)el.textContent=text;
  if(cls)el.className=cls;
  return el;
};
const slug=input=>String(input||"").normalize("NFKC").toLowerCase().trim()
  .replace(/[^\p{L}\p{N}_-]+/gu,"-").replace(/^-+|-+$/g,"").slice(0,80);
const channels={instagram:"إنستغرام",facebook:"فيسبوك",whatsapp:"واتساب",qr:"QR",other:"أخرى"};
const money=value=>(Number(value)||0).toLocaleString("en-US",{maximumFractionDigits:2})+" ₪";
const integer=value=>(Number(value)||0).toLocaleString("en-US",{maximumFractionDigits:0});
function makeLink(row){
  const url=new URL(row.target_kind==="dish"&&row.dish_id?"/menu":"/welcome",HOST);
  url.searchParams.set("source",row.code);
  url.searchParams.set("utm_source",row.channel==="qr"?"offline":row.channel==="other"?"other":row.channel);
  url.searchParams.set("utm_medium",row.channel==="qr"?"qr":row.channel==="whatsapp"?"share":"organic");
  url.searchParams.set("utm_campaign",row.code);
  if(row.target_kind==="dish"&&row.dish_id)url.searchParams.set("dish",row.dish_id);
  return url.href;
}
function field(label,control){
  const el=$el("label",undefined,"rf-field");
  el.append($el("span",label),control);
  return el;
}
function metric(label,value,description){
  const el=$el("div",undefined,"rf-metric");
  el.append($el("small",label),$el("strong",value));
  if(description)el.append($el("span",description,"rf-metric-description"));
  return el;
}
// Reliable copy affordance in the success box, selected report, and saved links.
async function copyReferral(url,button,input){
 try{
  if(!navigator.clipboard?.writeText)throw Error("Clipboard unavailable");
  await navigator.clipboard.writeText(url);
  button.textContent="تم النسخ ✓";
 }catch{
  input.focus();input.select();
  let ok=false;
  try{ok=typeof document.execCommand==="function"&&document.execCommand("copy");}catch{}
  button.textContent=ok?"تم النسخ ✓":"انسخ الرابط المحدد";
 }
}
function referralUrlRow(url,label,extraClass=""){
 const row=$el("div",undefined,"rf-quick-link "+extraClass);
 const input=$el("input");input.readOnly=true;input.type="text";input.dir="ltr";input.value=url;
 input.setAttribute("aria-label",label);input.addEventListener("focus",()=>input.select());
 const copy=$el("button","نسخ الرابط");copy.className="rf-copy-button";copy.type="button";
 copy.onclick=()=>copyReferral(url,copy,input);
 const open=$el("a","فتح");open.href=url;open.target="_blank";open.rel="noopener noreferrer";
 row.append(input,copy,open);
 return row;
}

const sourceKey="snounu-referral-selected-report-v1";
function savedSource(){
  try{return sessionStorage.getItem(sourceKey)||"";}catch{return "";}
}
function rememberSource(code){
  try{if(code)sessionStorage.setItem(sourceKey,code);else sessionStorage.removeItem(sourceKey);}catch{}
}
export async function renderReferralLinks({root,api,notice,getToken}){
  root.replaceChildren();
  const intro=$el("section",undefined,"rf-intro");
  intro.append($el("h2","تتبع مصادر الزيارات والمبيعات"),$el("p","تقرير المحتوى العضوي: اختر اسم رابط محفوظ لمعرفة زياراته وعدد الطلبات والمدفوعات المعتمدة الناتجة عن زياراته المسجّلة."));
  // The old free-text source lookup from Investment now lives here as a saved-source selector.
  const report=$el("section",undefined,"rf-report analytics-report ga-source-search");
  report.id="referral-source-report";
  const reportHead=$el("div",undefined,"rf-report-head");
  reportHead.append($el("h2","تقرير مصدر الزيارة"),$el("p","اختر اسم الفيديو أو البايو أو QR من الروابط التي أنشأتها. لا حاجة لكتابة كود المصدر."));
  const reportControls=$el("div",undefined,"rf-report-controls");
  const sourceSelect=$el("select");sourceSelect.id="referral-source-select";
  sourceSelect.setAttribute("aria-label","اختر اسم رابط الإحالة");sourceSelect.disabled=true;
  const period=$el("select");period.id="referral-report-days";period.setAttribute("aria-label","فترة التقرير");
  for(const [days,label] of [[7,"آخر 7 أيام"],[28,"آخر 28 يوماً"],[90,"آخر 90 يوماً"]]){
    const option=$el("option",label);option.value=String(days);if(days===28)option.selected=true;period.append(option);
  }
  const reload=$el("button","تحديث التقرير","rf-refresh");reload.type="button";
  reportControls.append(field("اسم المصدر / الرابط",sourceSelect),field("الفترة",period),reload);
  const reportStatus=$el("p","جارٍ تحميل المصادر...","rf-report-status");reportStatus.setAttribute("role","status");
  const reportContent=$el("div",undefined,"rf-report-content");
  const attributionNote=$el("p","زيارات GA4 تقريبية وقد تتأخر في الظهور. عدد المبيعات والإيرادات مأخوذ من الطلبات التي وافق عليها المطعم فقط. الربط بالمصدر لا يثبت أن المحتوى وحده تسبب بالشراء.","rf-note");
  report.append(reportHead,reportControls,reportStatus,reportContent,attributionNote);
  const creator=$el("section",undefined,"rf-create");
  creator.append($el("h2","إنشاء رابط إحالة جديد"),$el("p","بعد الحفظ سيظهر اسم الرابط مباشرة ضمن خيارات تقرير مصدر الزيارة.","rf-note"));
  const form=$el("form",undefined,"rf-form");
  const name=$el("input");name.name="label";name.placeholder="مثلاً: Sharing Box Campaign Video 1 أو bio";name.maxLength=120;name.required=true;
  const code=$el("input");code.name="code";code.placeholder="sharingboxcampaignvideo1";code.dir="ltr";code.maxLength=80;code.required=true;
  const channel=$el("select");channel.name="channel";
  for(const [value,label] of Object.entries(channels)){
    const option=$el("option",label);option.value=value;channel.append(option);
  }
  const target=$el("select");target.name="target";
  for(const [value,label] of [["menu","المنيو — صفحة الترحيب"],["dish","وجبة محددة"]]){
    const option=$el("option",label);option.value=value;target.append(option);
  }
  const dish=$el("select");dish.name="dish";dish.disabled=true;
  const dishPlaceholder=$el("option","اختر الوجبة");dishPlaceholder.value="";dish.append(dishPlaceholder);
  let codeEdited=false;
  name.addEventListener("input",()=>{if(!codeEdited)code.value=slug(name.value);});
  code.addEventListener("input",()=>{codeEdited=true;code.value=slug(code.value);});
  target.addEventListener("change",()=>{
    const choosing=target.value==="dish";
    dish.disabled=!choosing;dish.required=choosing;
    if(!choosing)dish.value="";
  });
  const create=$el("button","إنشاء الرابط","rf-primary");create.type="submit";
  form.append(field("اسم الفيديو أو الرابط",name),field("كود المصدر",code),
    field("يفتح الرابط",target),field("اختر الوجبة",dish),field("مكان النشر",channel),create);
  creator.append(form);
  const createdPanel=$el("section",undefined,"rf-created-link");
  createdPanel.hidden=true;
  createdPanel.setAttribute("aria-label","رابط الإحالة الجديد");
  const library=$el("section",undefined,"rf-library");
  library.append($el("h2","الروابط المحفوظة"),$el("p","انسخ رابط أي حملة أو افتح تقريره من هنا.","rf-note"));
  const linkList=$el("div",undefined,"rf-list");library.append(linkList);
  root.append(intro,creator,createdPanel,report,library);
  function showCreatedLink(link){
    createdPanel.hidden=false;
    const heading=$el("div",undefined,"rf-created-heading");
    heading.append($el("strong","تم إنشاء الرابط ✓"),$el("span",link.label));
    createdPanel.replaceChildren(heading,referralUrlRow(makeLink(link),"الرابط الجديد","rf-created-url"));
  }
  const catalog=await api("/rest/v1/dishes?select=id,name&order=name.asc");
  if(!root.isConnected)return;
  const mealMap=new Map(catalog.map(meal=>[meal.id,meal.name]));
  for(const meal of catalog){const option=$el("option",meal.name);option.value=meal.id;dish.append(option);}
  if(!catalog.length){
    dish.disabled=true;
    target.querySelector('[value="dish"]').disabled=true;
  }
  let currentDays=28;
  let links=[];
  let stats=new Map();
  let loadVersion=0;
  let reportVersion=0;
  function renderLibrary(){
    linkList.replaceChildren();
    if(!links.length){
      linkList.append($el("div","لا توجد روابط محفوظة بعد. أنشئ أول رابط وسيظهر هنا وفي قائمة التقرير.","rf-empty"));
      return;
    }
    const wrap=$el("div",undefined,"rf-library-table-wrap");
    const table=$el("table",undefined,"rf-library-table");
    const thead=$el("thead"),headRow=$el("tr");
    for(const title of ["الرابط والمصدر","مكان النشر","الوجهة","المدفوعات المعتمدة","الإيرادات","إجراءات"]){
      headRow.append($el("th",title));
    }
    thead.append(headRow);
    const tbody=$el("tbody");
    for(const link of links){
      const url=makeLink(link);
      const totals=stats.get(link.code)||{submitted:0,approved:0,revenue_ils:0};
      const tr=$el("tr");
      const campaign=$el("td",undefined,"rf-campaign-cell");campaign.dataset.label="الرابط والمصدر";
      campaign.append($el("strong",link.label),$el("span",link.code,"rf-library-code"));
      const path=$el("small",url,"rf-library-path");path.dir="ltr";path.title=url;campaign.append(path);
      const channelCell=$el("td");channelCell.dataset.label="مكان النشر";
      channelCell.append($el("span",channels[link.channel]||"أخرى","rf-library-channel"));
      const destination=$el("td");destination.dataset.label="الوجهة";
      destination.textContent=link.target_kind==="dish"?(mealMap.get(link.dish_id)||"المنيو"):"صفحة الترحيب";
      const approved=$el("td",undefined,"rf-table-number");approved.dataset.label="المدفوعات المعتمدة";
      approved.append($el("strong",integer(totals.approved)),
        $el("small","من "+integer(totals.submitted)+" طلب"));
      const revenue=$el("td",undefined,"rf-table-number");revenue.dataset.label="الإيرادات";
      revenue.append($el("strong",money(totals.revenue_ils)));
      const operations=$el("td",undefined,"rf-operations-cell");operations.dataset.label="الإجراءات";
      const buttons=$el("div",undefined,"rf-library-actions");
      const show=$el("button","تقرير");show.type="button";show.className="rf-action-main";
      show.onclick=()=>{
        sourceSelect.value=link.code;
        void selectSource().then(()=>report.scrollIntoView({behavior:"smooth",block:"start"}));
      };
      const copy=$el("button","نسخ");copy.type="button";
      copy.setAttribute("aria-label","نسخ رابط "+link.label);
      copy.onclick=async()=>{
        const input=$el("input");input.value=url;input.readOnly=true;
        input.style.position="fixed";input.style.opacity="0";input.style.pointerEvents="none";
        document.body.append(input);
        try{await copyReferral(url,copy,input);}finally{input.remove();}
      };
      const open=$el("a","فتح");open.href=url;open.target="_blank";open.rel="noopener noreferrer";
      const remove=$el("button","حذف");remove.type="button";remove.className="rf-action-danger";
      remove.onclick=async()=>{
        if(!confirm("حذف الرابط «"+link.label+"»؟ لن تُحذف طلباته وإيراداته السابقة."))return;
        remove.disabled=true;
        try{
          await api("/rest/v1/menu_referral_links?id=eq."+encodeURIComponent(link.id),{method:"DELETE"});
          notice("تم حذف الرابط دون تغيير سجل الطلبات.");
          await loadData();
        }catch(e){remove.disabled=false;notice(e.message);}
      };
      buttons.append(show,copy,open,remove);operations.append(buttons);
      tr.append(campaign,channelCell,destination,approved,revenue,operations);tbody.append(tr);
    }
    table.append(thead,tbody);wrap.append(table);linkList.append(wrap);
  }
  function renderDropdown(prefer){
    const code=prefer||sourceSelect.value||savedSource();
    sourceSelect.replaceChildren();
    const prompt=$el("option","اختر الرابط من القائمة");prompt.value="";sourceSelect.append(prompt);
    for(const link of links){
      const option=$el("option",link.label+" — "+link.code);
      option.value=link.code;sourceSelect.append(option);
    }
    const valid=links.some(link=>link.code===code);
    sourceSelect.value=valid?code:(links[0]?.code||"");
    sourceSelect.disabled=!links.length;
    rememberSource(sourceSelect.value);
  }
  async function selectSource(){
    const ticket=++reportVersion;
    const chosen=links.find(link=>link.code===sourceSelect.value);
    rememberSource(chosen?.code||"");
    reportContent.replaceChildren();
    if(!chosen){
      reportStatus.textContent="أنشئ رابط إحالة أولاً، ثم اختره من القائمة لرؤية النتائج.";
      return;
    }
    const orders=stats.get(chosen.code)||{submitted:0,approved:0,revenue_ils:0};
    const submitted=Number(orders.submitted)||0;
    const approved=Number(orders.approved)||0;
    const revenue=Number(orders.revenue_ils)||0;
    const head=$el("div",undefined,"rf-selected-source");
    head.append($el("h3",chosen.label),
      $el("p",chosen.code+" · "+(channels[chosen.channel]||"أخرى")+
        " · "+(chosen.target_kind==="dish"?(mealMap.get(chosen.dish_id)||"وجبة محذوفة"):"المنيو")));
    const metrics=$el("div",undefined,"rf-report-metrics");
    const visits=metric("الزيارات من هذا الرابط","…","جلسات GA4");
    const visitors=metric("الزوار المميزون","…","مستخدمو GA4");
    const views=metric("مشاهدات الرابط","…","مرات عرض الصفحات الموسومة");
    const ordersCard=metric("الطلبات المقدمة",integer(submitted));
    const approvedCard=metric("المدفوعات المعتمدة",integer(approved));
    const revenueCard=metric("الإيرادات المعتمدة",money(revenue));
    const conversion=metric("تحويل الزيارات إلى مبيعات","—","الطلبات المعتمدة ÷ الجلسات");
    const approval=metric("نسبة اعتماد الطلبات",submitted?(100*approved/submitted).toFixed(1)+"%":"—");
    const avg=metric("متوسط قيمة الطلب المعتمد",approved?money(revenue/approved):"—");
    metrics.append(visits,visitors,views,ordersCard,approvedCard,revenueCard,conversion,approval,avg);
    reportContent.append(head,referralUrlRow(makeLink(chosen),"رابط "+chosen.label,"rf-current-url"),metrics);
    reportStatus.textContent="جارٍ قراءة الزيارات من Google Analytics 4…";
    try{
      const token=await getToken();
      const response=await fetch("/api/ga4?days="+currentDays+"&visitSourceExact="+encodeURIComponent(chosen.code),{
        headers:{Authorization:"Bearer "+token},cache:"no-store"
      });
      const data=await response.json();
      if(ticket!==reportVersion||!report.isConnected)return;
      if(!response.ok)throw new Error(data?.message||"تعذّر قراءة زيارات هذا المصدر من GA4.");
      const visitsCount=Number(data.sessions)||0;
      visits.querySelector("strong").textContent=integer(visitsCount);
      visitors.querySelector("strong").textContent=integer(data.users);
      views.querySelector("strong").textContent=integer(data.pageViews);
      conversion.querySelector("strong").textContent=visitsCount>0
        ?(100*approved/visitsCount).toFixed(1)+"%":"—";
      reportStatus.textContent=visitsCount
        ?"آخر تحديث: "+new Date(data.asOf).toLocaleString("ar")+". يمكنك اختيار مصدر آخر من القائمة."
        :"لا توجد زيارات مسجلة بهذا المصدر خلال الفترة المحددة. قد تحتاج بيانات GA4 إلى وقت للظهور.";
    }catch(e){
      if(ticket!==reportVersion||!report.isConnected)return;
      for(const item of [visits,visitors,views])item.querySelector("strong").textContent="غير متاح";
      conversion.querySelector("strong").textContent="—";
      reportStatus.textContent="بيانات الطلبات المعتمدة متاحة، لكن لم نتمكن من قراءة زيارات GA4: "+(e.message||"خطأ غير معروف");
    }
  }
  async function loadData(preferredCode){
    const ticket=++loadVersion;
    ++reportVersion;
    reportStatus.textContent="جارٍ تحديث بيانات المصادر والطلبات...";
    reload.disabled=true;
    try{
      const [newLinks,newStats]=await Promise.all([
        api("/rest/v1/menu_referral_links?select=id,label,code,channel,target_kind,dish_id,created_at&order=created_at.desc&limit=1000"),
        api("/rest/v1/rpc/snounu_referral_stats",{method:"POST",body:{p_days:currentDays}})
      ]);
      if(ticket!==loadVersion||!root.isConnected)return;
      links=Array.isArray(newLinks)?newLinks:[];
      stats=new Map((Array.isArray(newStats)?newStats:[]).map(row=>[row.source,row]));
      renderDropdown(preferredCode);
      renderLibrary();
      await selectSource();
    }catch(e){
      if(ticket===loadVersion&&root.isConnected){
        reportStatus.textContent="تعذّر تحميل تقرير روابط الإحالة: "+e.message;
        notice(e.message);
      }
    }finally{
      if(ticket===loadVersion)reload.disabled=false;
    }
  }
  sourceSelect.onchange=()=>{void selectSource();};
  period.onchange=()=>{
    const next=Number(period.value);
    if([7,28,90].includes(next)){currentDays=next;void loadData(sourceSelect.value);}
  };
  reload.onclick=()=>loadData(sourceSelect.value);
  form.onsubmit=async event=>{
    event.preventDefault();
    const source=slug(code.value);
    if(source.length<2){notice("أدخل كود مصدر يتكون من حرفين على الأقل.");return;}
    if(target.value==="dish"&&!dish.value){notice("اختر الوجبة أولاً.");return;}
    const payload={label:name.value.trim(),code:source,channel:channel.value,
      target_kind:target.value,dish_id:target.value==="dish"?dish.value:null};
    create.disabled=true;create.textContent="جارٍ إنشاء الرابط...";
    try{
      const created=await api("/rest/v1/menu_referral_links",{method:"POST",body:payload,headers:{Prefer:"return=representation"}});
      showCreatedLink(Array.isArray(created)&&created[0]?created[0]:payload);
      notice("تم إنشاء رابط الإحالة. انسخه من الصندوق الظاهر تحت النموذج.");
      form.reset();codeEdited=false;dish.disabled=true;dish.required=false;dish.value="";
      await loadData(source);
      createdPanel.scrollIntoView({behavior:"smooth",block:"start"});
    }catch(e){notice(/duplicate|unique|23505/i.test(e.message)
      ?"كود المصدر مستخدم سابقاً. اختر كوداً مختلفاً.":e.message);}
    finally{create.disabled=false;create.textContent="إنشاء الرابط";}
  };
  await loadData(savedSource());
}
