// Organic referral links: GA4 visits + payment-approved order attribution.
// Owner-only page; no customer PII is returned to the reporting UI.
const HOST = "https://snounu-restaurant.vercel.app";
const $el = (tag,text,cls) => {
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=text;
  if(cls)node.className=cls;
  return node;
};
const slug = input => String(input||"").normalize("NFKC").toLowerCase().trim()
  .replace(/[^\p{L}\p{N}_-]+/gu,"-").replace(/^-+|-+$/g,"").slice(0,80);
const daysAllowed=new Set([7,28,90,365]);
const channels={instagram:"إنستغرام",facebook:"فيسبوك",whatsapp:"واتساب",qr:"QR",other:"أخرى"};
function makeLink(row){
  const url=new URL("/menu",HOST);
  url.searchParams.set("source",row.code);
  url.searchParams.set("utm_source",row.channel==="qr"?"offline":row.channel==="other"?"other":row.channel);
  url.searchParams.set("utm_medium",row.channel==="qr"?"qr":row.channel==="whatsapp"?"share":"organic");
  url.searchParams.set("utm_campaign",row.code);
  if(row.target_kind==="dish" && row.dish_id)url.searchParams.set("dish",row.dish_id);
  return url.href;
}
function field(label,child){
  const wrap=$el("label",undefined,"rf-field");
  wrap.append($el("span",label),child);
  return wrap;
}
function metric(label,value){
  const box=$el("div",undefined,"rf-metric");
  box.append($el("small",label),$el("strong",value));
  return box;
}
export async function renderReferralLinks({root,api,notice,getToken}){
  root.replaceChildren();
  const heading=$el("section",undefined,"rf-intro");
  heading.append($el("h2","روابط الإحالة"),$el("p","أنشئ رابطاً مستقلاً لكل فيديو أو رابط البايو أو QR. تُحفظ الزيارات في GA4، وتُربط الطلبات الجديدة بالمصدر حتى تتم الموافقة على الدفع."));
  const form=$el("form",undefined,"rf-form");
  const name=$el("input");name.name="label";name.placeholder="مثلاً: Sharing Box Campaign Video 1 أو bio";name.maxLength=120;name.required=true;
  const code=$el("input");code.name="code";code.placeholder="sharingboxcampaignvideo1";code.dir="ltr";code.maxLength=80;code.required=true;
  const channel=$el("select");channel.name="channel";
  for(const [value,label] of Object.entries(channels)){const option=$el("option",label);option.value=value;channel.append(option);}
  const target=$el("select");target.name="target";
  for(const [value,label] of [["menu","المنيو"],["dish","وجبة محددة"]]){const option=$el("option",label);option.value=value;target.append(option);}
  const dish=$el("select");dish.name="dish";dish.disabled=true;
  let codeWasEdited=false;
  name.addEventListener("input",()=>{if(!codeWasEdited)code.value=slug(name.value);});
  code.addEventListener("input",()=>{codeWasEdited=true;code.value=slug(code.value);});
  target.addEventListener("change",()=>{dish.disabled=target.value!=="dish";});
  form.append(field("اسم الفيديو أو الرابط",name),field("كود المصدر (يمكن تعديله)",code),
    field("مكان النشر",channel),field("يفتح الرابط",target),field("اختر الوجبة",dish));
  const create=$el("button","إنشاء الرابط","rf-primary");create.type="submit";form.append(create);
  const summary=$el("p","هذه إحصائيات روابط عضوية، وليست دليلاً على أن كل عملية شراء سببها المحتوى نفسه.","rf-note");
  const tools=$el("div",undefined,"rf-tools");
  const days=$el("select");days.setAttribute("aria-label","الفترة الزمنية");
  for(const [n,label] of [[7,"آخر 7 أيام"],[28,"آخر 28 يوماً"],[90,"آخر 90 يوماً"],[365,"آخر سنة"]]){const o=$el("option",label);o.value=n;days.append(o);}
  const refresh=$el("button","تحديث النتائج");refresh.type="button";tools.append(field("فترة التقرير",days),refresh);
  const list=$el("div",undefined,"rf-list");
  const status=$el("p","جارٍ تحميل روابط الإحالة...","rf-note");status.setAttribute("role","status");
  root.append(heading,form,summary,tools,status,list);
  const catalog=await api("/rest/v1/dishes?select=id,name&order=name.asc");
  const mealMap=new Map(catalog.map(x=>[x.id,x.name]));
  for(const meal of catalog){const o=$el("option",meal.name);o.value=meal.id;dish.append(o);}
  if(!catalog.length){dish.disabled=true;target.querySelector('[value="dish"]').disabled=true;}
  let currentDays=28;
  let requestGeneration=0;
  async function render(){
    const ticket=++requestGeneration;
    list.replaceChildren();status.textContent="جارٍ تحميل النتائج...";
    const [links,stats]=await Promise.all([
      api("/rest/v1/menu_referral_links?select=id,label,code,channel,target_kind,dish_id,created_at&order=created_at.desc&limit=200"),
      api("/rest/v1/rpc/snounu_referral_stats",{method:"POST",body:{p_days:currentDays}})
    ]);
    if(ticket!==requestGeneration)return;
    const counts=new Map((Array.isArray(stats)?stats:[]).map(s=>[s.source,s]));
    const sum={submitted:0,approved:0,revenue:0};
    for(const s of counts.values()){sum.submitted+=Number(s.submitted)||0;sum.approved+=Number(s.approved)||0;sum.revenue+=Number(s.revenue_ils)||0;}
    const totals=$el("section",undefined,"rf-totals");
    totals.append(metric("طلبات مرتبطة بمصادر",String(sum.submitted)),
      metric("مدفوعات معتمدة",String(sum.approved)),
      metric("إيرادات معتمدة",sum.revenue.toLocaleString("en-US",{maximumFractionDigits:2})+" ₪"));
    list.append(totals);
    if(!links.length)list.append($el("p","لم تُنشأ روابط إحالة بعد."));
    const money=n=>(Number(n)||0).toLocaleString("en-US",{maximumFractionDigits:2})+" ₪";
    for(const link of links){
      const record=counts.get(link.code)||{submitted:0,approved:0,revenue_ils:0};
      const card=$el("article",undefined,"rf-card");
      const header=$el("div",undefined,"rf-card-head");
      const title=$el("div");title.append($el("h3",link.label),$el("small",link.code+" · "+(channels[link.channel]||"أخرى")));
      const targetText=link.target_kind==="dish"?(mealMap.get(link.dish_id)||"وجبة محذوفة، يفتح المنيو"):"المنيو";
      header.append(title,$el("span",targetText,"rf-tag"));card.append(header);
      const url=makeLink(link);
      const urlRow=$el("div",undefined,"rf-url-row");
      const input=$el("input");input.readOnly=true;input.dir="ltr";input.value=url;input.setAttribute("aria-label","رابط الإحالة "+link.label);
      input.addEventListener("focus",()=>input.select());
      const copy=$el("button","نسخ الرابط");copy.type="button";
      copy.addEventListener("click",async()=>{
        try{await navigator.clipboard.writeText(url);copy.textContent="تم النسخ ✓";}
        catch{input.select();document.execCommand("copy");copy.textContent="تم تحديد الرابط";}
      });
      const open=$el("a","فتح الرابط");open.href=url;open.target="_blank";open.rel="noopener noreferrer";
      urlRow.append(input,copy,open);card.append(urlRow);
      const metrics=$el("div",undefined,"rf-metrics");
      const users=metric("زوار GA4","—");const pageViews=metric("مشاهدات الرابط","—");
      metrics.append(users,pageViews,metric("طلبات قُدّمت",String(record.submitted)),
        metric("مدفوعات معتمدة",String(record.approved)),metric("إيرادات مؤكدة",money(record.revenue_ils)));
      card.append(metrics);
      const buttons=$el("div",undefined,"rf-card-actions");
      const check=$el("button","جلب زيارات GA4");check.type="button";
      check.onclick=async()=>{
        check.disabled=true;check.textContent="جارٍ قراءة GA4...";
        try{
          const token=await getToken();
          const r=await fetch("/api/ga4?days="+(currentDays===365?90:currentDays)+"&visitSource="+encodeURIComponent(link.code),
            {headers:{Authorization:"Bearer "+token},cache:"no-store"});
          const data=await r.json();
          if(!r.ok)throw new Error("لم تتوفر بيانات GA4 لهذا الرابط");
          const found=(data.matches||[]).find(x=>x.source===link.code);
          users.querySelector("strong").textContent=found?String(found.users):"0";
          pageViews.querySelector("strong").textContent=found?String(found.pageViews):"0";
          check.textContent="تحديث الزيارات";
        }catch(e){check.textContent="إعادة محاولة جلب الزيارات";notice(e.message);}
        finally{check.disabled=false;}
      };
      const remove=$el("button","حذف الرابط","rf-delete");remove.type="button";
      remove.onclick=async()=>{
        if(!confirm("حذف رابط "+link.label+"؟ ستظل إحصائيات الطلبات السابقة مرتبطة بكود المصدر."))return;
        remove.disabled=true;
        try{
          await api("/rest/v1/menu_referral_links?id=eq."+encodeURIComponent(link.id),{method:"DELETE"});
          notice("تم حذف الرابط. الطلبات السابقة لم تُحذف.");
          await render();
        }catch(e){remove.disabled=false;notice(e.message);}
      };
      buttons.append(check,remove);
      card.append(buttons);
      list.append(card);
    }
    const other=[...counts.values()].filter(row=>!links.some(link=>link.code===row.source));
    if(other.length){
      const old=$el("section",undefined,"rf-old-sources");
      old.append($el("h3","مصادر قديمة غير مسجلة في المولّد"),$el("p","هذه المصادر مرتبطة بطلبات فعلية، حتى لو حُذف الرابط أو أُنشئ يدوياً."));
      for(const row of other)old.append($el("p",row.source+" — "+row.approved+" دفعات معتمدة — "+money(row.revenue_ils)));
      list.append(old);
    }
    status.textContent="إحصائيات الطلبات تخص تاريخ إنشاء الطلب خلال الفترة المحددة؛ الإيرادات من المدفوعات المعتمدة فقط. بيانات الزيارات من GA4 وتُجلب عند الطلب."
      +(currentDays===365?" (GA4 يدعم عرض 90 يوماً في هذا التقرير.)":"");
  }
  form.onsubmit=async event=>{
    event.preventDefault();
    const source=slug(code.value);
    if(source.length<2){notice("أدخل اسماً أو كوداً من حرفين على الأقل.");return;}
    if(target.value==="dish"&&!dish.value){notice("اختر الوجبة أولاً.");return;}
    const payload={label:name.value.trim(),code:source,channel:channel.value,
      target_kind:target.value,dish_id:target.value==="dish"?dish.value:null};
    create.disabled=true;create.textContent="جارٍ إنشاء الرابط...";
    try{
      await api("/rest/v1/menu_referral_links",{method:"POST",body:payload,headers:{Prefer:"return=representation"}});
      notice("تم إنشاء رابط الإحالة. انسخه من القائمة بالأسفل.");
      form.reset();codeWasEdited=false;dish.disabled=true;
      await render();
    }catch(e){notice(e.message.includes("duplicate")||e.message.includes("unique")
        ?"هذا الكود مستخدم مسبقاً. اختر كوداً مختلفاً.":e.message);}
    finally{create.disabled=false;create.textContent="إنشاء الرابط";}
  };
  days.onchange=()=>{const next=Number(days.value);if(daysAllowed.has(next)){currentDays=next;void render().catch(e=>notice(e.message));}};
  refresh.onclick=()=>render().catch(e=>notice(e.message));
  await render();
}
