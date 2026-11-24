import {
  el,
  amount,
  when,
  statuses,
  button,
  field,
  invoice,
} from "../payment-ui.js?v=advance-analytics-01-20261124";
const labels = {
  pending: "قيد المراجعة",
  approved: "تم اعتماد الدفع",
  rejected: "رفض الدفع",
  cancelled: "ملغي",
  arrived: "حضر العميل",
  completed: "تم تسليم الطلب",
};
const list = (s) =>
  Object.entries(s).map(([v, k]) => {
    const o = el("option", k);
    o.value = v;
    return o;
  });
const input = (value, type = "text") => {
  const i = el("input");
  i.type = type;
  if (type === "checkbox") i.checked = value;
  else i.value = value ?? "";
  return i;
};
const rootPath = "/rest/v1/";
const bucket = "snounu-payment-proofs";
const table = (headers, rows) => {
  const t = el("table"),
    head = el("tr");
  headers.forEach((v) => head.append(el("th", v)));
  t.append(head);
  const paymentIndex = headers.indexOf("حالة الدفع");
  const stageIndex = headers.indexOf("مرحلة الطلب");
  const isOrdersTable = paymentIndex !== -1 && stageIndex !== -1;
  if (isOrdersTable) t.classList.add("pay-orders-grid");
  const colorByStatus = (status) => ({
    "تم التسليم": "completed",
    "متوقف": "stopped",
    "قيد المراجعة": "pending",
    "رفض الدفع": "rejected",
  })[status] || "";
  for (const row of rows) {
    const tr = el("tr");
    if (isOrdersTable) {
      const payStatus = String(row[paymentIndex] || "");
      const stageStatus = String(row[stageIndex] || "");
      const tone = stageStatus === "تم التسليم" ? "completed"
        : payStatus === "رفض الدفع" ? "rejected"
        : stageStatus === "متوقف" ? "stopped"
        : payStatus === "قيد المراجعة" ? "pending" : "";
      if (tone) tr.classList.add("pay-order-row--" + tone);
    }
    row.forEach((v, index) => {
      const td = el("td");
      const tone = isOrdersTable && (index === paymentIndex || index === stageIndex)
        ? colorByStatus(String(v || "")) : "";
      if (tone) {
        const badge = el("span", String(v));
        badge.className = "pay-status-pill pay-status-pill--" + tone;
        td.classList.add("pay-status-cell");
        td.append(badge);
      } else if (v instanceof Node) td.append(v);
      else td.textContent = v;
      tr.append(td);
    });
    t.append(tr);
  }
  return t;
};
export async function orders({root,api,notice,endpoint,canManage=false}){
  root.className="pay-orders-refined";
  const statusesArabic={
    pending:"قيد المراجعة",approved:"تم اعتماد الدفع",rejected:"رفض الدفع",cancelled:"ملغي"
  };
  const stages={
    awaiting_visit:"بانتظار الحضور",awaiting_payment:"بانتظار الدفع",
    awaiting_approval:"مراجعة الدفع",queued:"بانتظار الدور",preparing:"قيد التحضير",ready:"جاهز للتسليم",
    completed:"تم التسليم",stopped:"متوقف"
  };
  const date=s=>s?new Date(s).toLocaleString("ar-PS",{
    timeZone:"Asia/Gaza",day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"
  }):"—";
  const named=(tag,text,cls)=>{
    const e=el(tag,text);if(cls)e.className=cls;return e;
  };
  const badge=(text,tone,kind="")=>named("span",text,"ord-badge ord-badge--"+tone+" "+kind);
  const line=(label,value,link)=>{
    const row=named("div",null,"ord-info-line");
    row.append(named("span",label,"ord-info-label"));
    const right=named(link?"a":"strong",value===null||value===undefined||value===""?"—":String(value),"ord-info-value");
    if(link){right.href=link;right.dir="ltr";}
    row.append(right);return row;
  };
  const search=input("","search");
  search.placeholder="الاسم أو رقم الهاتف أو رقم الطلب";
  search.setAttribute("aria-label","البحث في الطلبات");
  const statusFilter=el("select");
  statusFilter.setAttribute("aria-label","حالة الدفع");
  statusFilter.append(...list({"":"كل حالات الدفع",...statusesArabic}));
  const stageFilter=el("select");
  stageFilter.setAttribute("aria-label","مرحلة الطلب");
  stageFilter.append(...list({"":"كل مراحل الطلب",...stages}));

  const advanceFilter=el("select");
  advanceFilter.setAttribute("aria-label","الطلبات المسبقة");
  advanceFilter.append(...list({"":"جميع الطلبات","advance":"الطلبات المسبقة","queue":"قائمة الانتظار الحالية"}));
  let queuePositions={};
  const header=named("div",null,"ord-page-toolbar");
  const intro=named("div",null,"ord-page-intro");
  intro.append(named("h2","إدارة الطلبات"),named("p","الطلبات والمدفوعات في جدول واضح. اضغط عرض للاطلاع على التفاصيل."));
  const reload=button("تحديث الطلبات",()=>load());reload.className="ord-refresh";
  header.append(intro,reload);
  const filterRow=named("div",null,"ord-filters");
  const labeled=(title,control)=>{
    const wrap=named("label",null,"ord-filter");
    wrap.append(named("span",title),control);return wrap;
  };
  filterRow.append(labeled("ابحث عن طلب",search),labeled("حالة الدفع",statusFilter),labeled("مرحلة الطلب",stageFilter),labeled("الطلبات المسبقة",advanceFilter));
  const metrics=named("div",null,"ord-metrics");
  const state=named("p","جارٍ تحميل الطلبات…","ord-state");
  state.setAttribute("role","status");
  const results=named("div",null,"ord-results pay-results");
  const pagination=named("nav",null,"ord-pager");pagination.setAttribute("aria-label","صفحات الطلبات");
  root.replaceChildren(header,filterRow,metrics,state,results,pagination);
  let page=0,revision=0;

  // Refresh in place every minute while this tab is visible, even with no mouse/keyboard activity.
  // Refresh immediately on return to a previously hidden tab or focused browser window.
  // The timer and listeners are removed when the Orders section is unmounted.
  const AUTO_REFRESH_MS=60_000;
  const RETURN_DEBOUNCE_MS=1_500;
  let autoRefreshTimer=null;
  let lastRefreshStartedAt=0;
  let disposed=false;
  let detachObserver=null;

  function stopAutoRefresh(){
    if(disposed)return;
    disposed=true;
    clearTimeout(autoRefreshTimer);
    document.removeEventListener("visibilitychange",onVisibilityChange);
    window.removeEventListener("focus",onWindowFocus);
    window.removeEventListener("pageshow",onWindowFocus);
    detachObserver?.disconnect();
  }

  function scheduleAutoRefresh(){
    clearTimeout(autoRefreshTimer);
    if(disposed)return;
    autoRefreshTimer=setTimeout(()=>{
      if(!root.isConnected){stopAutoRefresh();return;}
      if(document.visibilityState!=="visible")return; // Refresh on returning to tab instead.
      if(results.getAttribute("aria-busy")==="true"){
        scheduleAutoRefresh();
        return;
      }
      void load();
    },AUTO_REFRESH_MS);
  }

  function refreshWhenReturning(){
    if(disposed)return;
    if(!root.isConnected){stopAutoRefresh();return;}
    if(document.visibilityState!=="visible")return;
    if(results.getAttribute("aria-busy")==="true")return;
    if(Date.now()-lastRefreshStartedAt<RETURN_DEBOUNCE_MS)return;
    void load();
  }

  function onVisibilityChange(){
    if(document.visibilityState==="visible")refreshWhenReturning();
  }

  function onWindowFocus(){
    refreshWhenReturning();
  }

  function metric(title,num,kind){
    const box=named("div",null,"ord-metric "+(kind||""));
    box.append(named("span",title),named("strong",String(num)));
    return box;
  }
  function renderTable(orders){
    const frame=named("div",null,"ord-table-wrap");
    const tableEl=named("table",null,"ord-table");
    const thead=el("thead"),head=el("tr");
    for(const name of ["رقم الطلب","العميل","تفاصيل الوجبات","الإجمالي","نوع الطلب","الحالة","وقت الطلب",""]){
      head.append(named("th",name));
    }
    thead.append(head);
    const tbody=el("tbody");
    for(const o of orders){
      const tr=named("tr",null,"ord-row");
      tr.dataset.status=o.status||"";
      const number=named("td",null,"ord-number");number.dataset.label="رقم الطلب";
      const orderNum=named("strong","#"+o.number);orderNum.dir="ltr";number.append(orderNum);
      if(o.advance_order)number.append(named("small","طلب مسبق"));
      if(o.advance_exception&&o.status==="pending")number.append(named("small","بحاجة لمراجعة الحجز"));
      if(o.refund_resolution==="review_required")number.append(named("small","تسوية دفعة معلّقة"));
      if(queuePositions[o.id]!=null)number.append(named("small","الدور #"+queuePositions[o.id]));

      const customer=named("td",null,"ord-customer");customer.dataset.label="العميل";
      customer.append(named("strong",o.customer||"عميل"));
      if(o.phone){
        const tel=named("a",o.phone,"ord-phone");tel.dir="ltr";
        tel.href="tel:"+String(o.phone).replace(/[^\d+]/g,"");customer.append(tel);
      }

      const meals=named("td",null,"ord-meals");meals.dataset.label="الوجبات";
      const items=Array.isArray(o.pay_items)?o.pay_items:[];
      const summary=items.map(x=>(x.name||"وجبة")+" × "+(x.qty||1)).join("، ");
      const itemTitle=named("span",summary||"—");
      itemTitle.title=summary;meals.append(itemTitle);
      if(items.length>1)meals.append(named("small",items.length+" أصناف"));

      const total=named("td",null,"ord-total");total.dataset.label="الإجمالي";
      const amountTag=named("strong",amount(o.total));amountTag.dir="ltr";total.append(amountTag);

      const kind=named("td",null,"ord-kind");kind.dataset.label="نوع الطلب";
      kind.append(named("span",o.service_type==="delivery"?"توصيل":o.service_type==="dine_in"?"داخل المطعم":"غير محدد"),
        named("small",o.payment_mode==="at_restaurant"?"الدفع عند الوصول":o.method||""));

      const status=named("td",null,"ord-status");status.dataset.label="الحالة";
      const badges=named("div",null,"ord-badges");
      badges.append(badge(statusesArabic[o.status]||o.status,o.status||"other"));
      if(o.fulfillment_status)badges.append(badge(stages[o.fulfillment_status]||o.fulfillment_status,o.fulfillment_status,"ord-stage"));
      const openReports=(o.pay_order_reports||[]).filter(x=>!x.resolved_at).length;
      if(openReports)badges.append(badge("بلاغ مفتوح","report"));
      status.append(badges);

      const time=named("td",null,"ord-date");time.dataset.label="الوقت";
      time.textContent=date(o.created_at);
      const action=named("td",null,"ord-actions");
      const view=button("عرض",()=>showOrder(o));view.className="ord-view";
      view.setAttribute("aria-label","عرض تفاصيل طلب رقم "+o.number);
      action.append(view);
      tr.append(number,customer,meals,total,kind,status,time,action);
      tbody.append(tr);
    }
    tableEl.append(thead,tbody);frame.append(tableEl);
    return frame;
  }

  function showOrder(o){
    const dialog=named("dialog",null,"pay-admin-dialog ord-detail-dialog");
    dialog.setAttribute("aria-label","تفاصيل الطلب رقم "+o.number);
    root.append(dialog);
    const blobs=[];
    dialog.onclose=()=>{blobs.forEach(URL.revokeObjectURL);dialog.remove();};

    const dialogHead=named("div",null,"ord-detail-header");
    const heading=named("div",null,"ord-detail-title");
    heading.append(named("small","تفاصيل الطلب"),named("h2","طلب #"+o.number),named("span",date(o.created_at),"ord-detail-date"));
    const close=button("×",()=>dialog.close());close.className="ord-detail-close";
    close.setAttribute("aria-label","إغلاق تفاصيل الطلب");
    dialogHead.append(heading,close);

    const inner=named("div",null,"ord-detail-body");
    const hero=named("section",null,"ord-detail-hero");
    const moneyBox=named("div",null,"ord-detail-total");
    moneyBox.append(named("span","قيمة الطلب"),named("strong",amount(o.total)));
    const heroBadges=named("div",null,"ord-detail-badges");
    heroBadges.append(badge(statusesArabic[o.status]||o.status,o.status||"other"));
    if(o.fulfillment_status)heroBadges.append(badge(stages[o.fulfillment_status]||o.fulfillment_status,o.fulfillment_status,"ord-stage"));
    hero.append(moneyBox,heroBadges);

    const summary=named("section",null,"ord-detail-section");
    summary.append(named("h3","بيانات العميل والطلب"));
    const data=named("div",null,"ord-info-grid");
    const customer=named("div",null,"ord-info-box");
    customer.append(line("العميل",o.customer),line("الجوال",o.phone,
      o.phone?"tel:"+String(o.phone).replace(/[^\d+]/g,""):null));
    const fulfillment=named("div",null,"ord-info-box");
    fulfillment.append(
      line("نوع الطلب",o.service_type==="delivery"?"توصيل":o.service_type==="dine_in"?"داخل المطعم":"غير محدد"),
      line("الدفع",o.payment_mode==="at_restaurant"?"الدفع عند الوصول":o.method||"دفع إلكتروني")
    );
    if(o.method && o.payment_mode==="at_restaurant" && o.method!=="الدفع عند الوصول")fulfillment.append(line("وسيلة الدفع",o.method));
    data.append(customer,fulfillment);
    const extras=named("div",null,"ord-info-extra");
    if(o.advance_order)extras.append(line("نوع الحجز","طلب مسبق"),line("موعد الافتتاح عند الطلب",date(o.advance_opening_at)));
    if(queuePositions[o.id]!=null)extras.append(line("ترتيب الدور",queuePositions[o.id]));
    if(o.invoice?.employee_name)extras.append(line("الموظف الذي اعتمد الدفع",o.invoice.employee_name));
    if(o.invoice?.employee_role)extras.append(line("دور الموظف",o.invoice.employee_role));
    if(o.status==="rejected"){
      const rejection=(o.pay_history||[]).filter(h=>h.status==="rejected").sort((a,b)=>b.occurred_at.localeCompare(a.occurred_at)||Number(b.id)-Number(a.id))[0];
      if(rejection?.employee_name)extras.append(line("الموظف الذي رفض الطلب",rejection.employee_name));
      if(rejection?.employee_role)extras.append(line("دور الموظف",rejection.employee_role));
    }
    if(o.arrival_eta_minutes&&o.payment_mode==="at_restaurant")extras.append(line("مدة الوصول",o.arrival_eta_minutes+" دقيقة"));
    if(o.expected_arrival_at)extras.append(line("وقت الوصول المتوقع",date(o.expected_arrival_at)));
    if(o.service_type==="delivery"){
      if(o.delivery_address)extras.append(line("عنوان التوصيل",o.delivery_address));
      if(o.delivery_landmark)extras.append(line("أقرب معلم",o.delivery_landmark));
      if(o.backup_phone)extras.append(line("هاتف بديل",o.backup_phone));
    }
    if(extras.childElementCount)data.append(extras);
    summary.append(data);

    const meals=named("section",null,"ord-detail-section");
    meals.append(named("h3","الوجبات المطلوبة"));
    const wrap=named("div",null,"ord-detail-items-wrap");
    const itemsTable=named("table",null,"ord-detail-items");
    const head=el("thead"),headRow=el("tr");
    for(const label of ["الوجبة والتفاصيل","الكمية","سعر الوحدة","الإجمالي"])headRow.append(named("th",label));
    head.append(headRow);
    const tbody=el("tbody");
    for(const item of (o.pay_items||[])){
      const tr=el("tr");
      const itemCell=el("td");
      itemCell.append(named("strong",item.name||"وجبة"));
      const options=[...(item.choices||[]).map(c=>c.label).filter(Boolean),item.special_instructions].filter(Boolean).join(" · ");
      if(options)itemCell.append(named("small",options));
      tr.append(itemCell,named("td",item.qty),named("td",amount(item.price)),
        named("td",amount((Number(item.qty)||0)*(Number(item.price)||0))));
      tbody.append(tr);
    }
    itemsTable.append(head,tbody);wrap.append(itemsTable);meals.append(wrap);

    const detailNotes=named("div",null,"ord-detail-notes");
    if(o.notes)detailNotes.append(line("ملاحظات العميل",o.notes));
    if(o.reason)detailNotes.append(line("سبب الرفض أو الإلغاء",o.reason));

    const actions=named("section",null,"ord-detail-section ord-detail-actions-section");
    actions.append(named("h3","الإجراءات"));
    const actionButtons=named("div",null,"ord-detail-buttons");

    const proof=(o.pay_proofs||[]).slice().sort((a,b)=>b.uploaded_at.localeCompare(a.uploaded_at))[0];
    let proofReviewed=false;
    let approveTrigger=null;
    let proofHint=null;
    if(proof){
      const proofSection=named("section",null,"ord-detail-section");
      proofSection.append(named("h3","إثبات الدفع"));
      const proofBody=named("div",null,"ord-proof-body");
      const preview=button("عرض إثبات الدفع",async()=>{
        preview.disabled=true;
        try{
          const signed=await api("/storage/v1/object/sign/"+bucket+"/"+proof.path,{
            method:"POST",body:{expiresIn:60}
          });
          const result=await fetch(endpoint+"/storage/v1"+signed.signedURL,{cache:"no-store"});
          if(!result.ok)throw Error("تعذر تحميل إثبات الدفع");
          const blob=await result.blob();
          const url=URL.createObjectURL(blob);blobs.push(url);
          if(blob.type!=="application/pdf"&&!blob.type.startsWith("image/"))
            throw Error("نوع ملف الإثبات غير مدعوم للمعاينة");
          const media=named(blob.type==="application/pdf"?"iframe":"img");
          media.title="إثبات الدفع";
          const rendered=new Promise((resolve,reject)=>{
            if(blob.type==="application/pdf"){
              const timeout=setTimeout(()=>reject(Error("لم يكتمل تحميل ملف PDF، حاول مجدداً")),15000);
              media.addEventListener("load",()=>{clearTimeout(timeout);resolve();},{once:true});
              media.addEventListener("error",()=>{clearTimeout(timeout);reject(Error("تعذّر عرض ملف PDF"));},{once:true});
            }else{
              media.addEventListener("load",resolve,{once:true});
              media.addEventListener("error",()=>reject(Error("تعذّر عرض صورة الإثبات")),{once:true});
            }
          });
          media.src=url;proofBody.replaceChildren(media);
          await rendered;
          // Record the successful proof preview on the server; only then enable approval.
          await api(rootPath+"rpc/pay_record_proof_review",{
            method:"POST",body:{p_id:o.id,p_path:proof.path}
          });
          proofReviewed=true;
          if(approveTrigger){
            approveTrigger.disabled=false;
            approveTrigger.removeAttribute("title");
          }
          if(proofHint){
            proofHint.textContent="تم عرض إثبات الدفع، يمكنك الآن اعتماد الدفع.";
            proofHint.className="ord-proof-reviewed";
          }
          proofBody.append(named("p","تم عرض إثبات الدفع بنجاح","ord-proof-reviewed"));
        }catch(err){
          notice(err.message);
          preview.disabled=false;
          proofBody.replaceChildren(preview);
        }
      });
      preview.className="ord-proof-preview";
      proofBody.append(preview);proofSection.append(proofBody);
      inner.append(hero,summary,meals);
      if(detailNotes.childElementCount)inner.append(detailNotes);
      inner.append(proofSection);
    }else{
      inner.append(hero,summary,meals);
      if(detailNotes.childElementCount)inner.append(detailNotes);
    }

    if(canManage && o.service_type==="dine_in" && !o.arrived_at &&
      ["pending","approved"].includes(o.status)){
      const arrived=button("تأكيد حضور العميل",async()=>{
        if(!confirm("هل حضر العميل بالفعل للطلب #"+o.number+"؟"))return;
        arrived.disabled=true;
        try{
          await api(rootPath+"rpc/pay_mark_arrived",{method:"POST",body:{p_id:o.id}});
          dialog.close();await load();notice("تم تأكيد حضور العميل");
        }catch(e){arrived.disabled=false;notice(e.message);}
      });
      arrived.className="ord-detail-arrival";actionButtons.append(arrived);
    }
    if(canManage&&o.advance_exception&&o.status==="pending"){
      const admit=button("قبول الحجز في قائمة الانتظار",async()=>{
        if(!confirm("قبول الحجز بعد مراجعة إثبات الدفع وتوفر السعة؟"))return;
        admit.disabled=true;
        try{await api(rootPath+"rpc/pay_admit_advance",{method:"POST",body:{p_id:o.id}});dialog.close();await load();}catch(e){admit.disabled=false;notice(e.message);}
      });actionButtons.append(admit);
    }
    if(canManage&&o.refund_resolution==="review_required"){
      for(const [value,label] of [["refunded","تسجيل رد الدفعة يدوياً"],["no_refund_required","تسجيل عدم الحاجة لرد الدفعة"]]){
        const resolve=button(label,async()=>{if(!confirm("هل تمت التسوية فعلاً خارج النظام؟"))return;resolve.disabled=true;try{await api(rootPath+"rpc/pay_refund_resolution",{method:"POST",body:{p_id:o.id,p_resolution:value}});dialog.close();await load();}catch(e){resolve.disabled=false;notice(e.message);}});actionButtons.append(resolve);
      }
    }
    if(o.status==="pending"&&canManage){
      const declineBox=named("div",null,"ord-decline-box");
      const reason=input("");
      reason.placeholder="سبب الرفض (مطلوب عند الرفض)";
      reason.setAttribute("aria-label","سبب رفض الدفع");
      const paymentActions=named("div",null,"ord-decision-buttons");
      for(const [target,label] of [
        ["approved",o.payment_mode==="at_restaurant"?"تأكيد استلام الدفع في المطعم":"اعتماد الدفع"],
        ["rejected","رفض الدفع"],
        ["cancelled","إلغاء الطلب"]
      ]){
        const trigger=button(label,async()=>{
          if(target==="approved"&&o.advance_exception){notice("يجب قبول الحجز في قائمة الانتظار أولاً.");return;}
          if(target==="approved"&&o.payment_mode==="at_restaurant"&&!o.arrived_at){
            notice("أكّد وصول العميل أولاً قبل تسجيل الدفع.");return;
          }
          if(target==="approved"&&o.payment_mode!=="at_restaurant"&&!proofReviewed){
            notice("يجب عرض إثبات الدفع ومراجعته قبل اعتماد الدفع.");return;
          }
          if(target==="rejected"&&!reason.value.trim()){reason.focus();return;}
          let employeeName="";
          if(target==="approved"||target==="rejected"){
            const entered=prompt(target==="rejected"?"اسم الموظف الذي رفض الطلب:":"اسم الموظف الذي راجع الدفعة:");
            if(entered===null)return;
            employeeName=entered.trim();
            if(employeeName.length<2||employeeName.length>120){notice("يرجى إدخال اسم الموظف الصحيح.");return;}
          }
          if(!confirm(label+" للطلب #"+o.number+"؟"))return;
          trigger.disabled=true;
          try{
            await api(rootPath+"rpc/pay_decide",{
              method:"POST",body:{p_id:o.id,p_target:target,p_reason:target==="rejected"?reason.value.trim():"",p_employee_name:employeeName}
            });
            dialog.close();await load();
          }catch(e){trigger.disabled=false;notice(e.message);}
        });
        trigger.className="ord-decision ord-decision--"+target;
        if(target==="approved"&&o.payment_mode!=="at_restaurant"){
          approveTrigger=trigger;
          trigger.disabled=!proofReviewed;
          trigger.title=proof?"اعرض إثبات الدفع أولاً قبل الاعتماد":"لا يمكن الاعتماد بدون إثبات دفع مرفق";
        }
        paymentActions.append(trigger);
      }
      if(o.payment_mode!=="at_restaurant"){
        proofHint=named("p",
          proof?"يجب عرض إثبات الدفع قبل اعتماد الدفع.":"لا يوجد إثبات دفع مرفق. لا يمكن اعتماد الدفع.",
          "ord-proof-required"
        );
        declineBox.append(proofHint);
      }
      declineBox.append(reason,paymentActions);
      actionButtons.append(declineBox);
    }
    if(o.status==="approved"){
      const print=button("طباعة الإيصال (80 مم)",()=>{
        const w=invoice(o);
        if(w)Promise.all([...w.document.images].map(img=>img.decode().catch(()=>{})))
          .then(()=>w.print());
      });
      print.className="ord-detail-print";actionButtons.append(print);
    }
    if(canManage&&o.queue_managed&&o.status==="approved"&&["queued","preparing"].includes(o.fulfillment_status)){
      const stage=o.fulfillment_status==="queued"?"preparing":"ready";
      const change=button(stage==="preparing"?"بدء تجهيز الطلب":"تأكيد جهوزية الطلب",async()=>{
        if(!confirm("تأكيد تحديث حالة الطلب #"+o.number+"؟"))return;
        change.disabled=true;
        try{await api(rootPath+"rpc/pay_queue_stage",{method:"POST",body:{p_id:o.id,p_stage:stage}});dialog.close();await load();}
        catch(e){change.disabled=false;notice(e.message);}
      });change.className="ord-decision ord-decision--approved";actionButtons.append(change);
    }
    if(canManage&&o.status==="approved"&&o.fulfillment_status!=="completed"&&(!o.queue_managed||o.fulfillment_status==="ready")){
      const done=button("تأكيد تسليم الطلب",async()=>{
        if(!confirm("هل استلم العميل طلبه بالفعل؟ هذه الرسالة ستصل إلى شاشة العميل."))return;
        done.disabled=true;
        try{
          await api(rootPath+"rpc/pay_mark_completed",{method:"POST",body:{p_id:o.id}});
          dialog.close();await load();notice("تم تسجيل تسليم الطلب وإخطار العميل");
        }catch(e){done.disabled=false;notice(e.message);}
      });
      done.className="ord-decision ord-decision--approved";actionButtons.append(done);
    }
    if(actionButtons.childElementCount){actions.append(actionButtons);inner.append(actions);}

    const reports=(o.pay_order_reports||[]).slice().sort((a,b)=>b.created_at.localeCompare(a.created_at));
    if(reports.length){
      const reportsSection=named("section",null,"ord-detail-section");
      reportsSection.append(named("h3","بلاغات العملاء"));
      for(const report of reports){
        const box=named("article",null,"ord-report-box");
        box.append(named("strong",({not_received:"الطلب لم يصل",incorrect_order:"الطلب غير صحيح",other:"مشكلة أخرى"}[report.category]||"بلاغ")+
          (report.resolved_at?" · مغلق":" · مفتوح")),
          named("small",date(report.created_at)),
          named("p",report.message));
        if(canManage&&!report.resolved_at){
          const resolve=button("وضع علامة تم حل المشكلة",async()=>{
            resolve.disabled=true;
            try{
              await api(rootPath+"rpc/pay_resolve_report",{method:"POST",body:{p_id:report.id}});
              dialog.close();await load();notice("تم إغلاق البلاغ");
            }catch(err){resolve.disabled=false;notice(err.message);}
          });
          resolve.className="ord-detail-secondary";box.append(resolve);
        }
        reportsSection.append(box);
      }
      inner.append(reportsSection);
    }

    const history=named("details",null,"ord-detail-history");
    const summaryButton=named("summary","سجل الطلب ("+(o.pay_history||[]).length+")");
    history.append(summaryButton);
    const historyBody=named("div",null,"ord-history-list");
    for(const item of (o.pay_history||[]).slice().sort((a,b)=>a.occurred_at.localeCompare(b.occurred_at))){
      const entry=named("div",null,"ord-history-entry");
      entry.append(named("time",date(item.occurred_at)),
        named("strong",statusesArabic[item.status]||labels[item.status]||item.status),
        named("span",[item.employee_name||item.actor||"العميل",item.employee_role,item.reason].filter(Boolean).join(" · ")));
      historyBody.append(entry);
    }
    if(!historyBody.childElementCount)historyBody.append(named("p","لا توجد تحديثات سابقة."));
    history.append(historyBody);inner.append(history);

    dialog.append(dialogHead,inner);
    dialog.showModal();
  }

  async function load(){
    if(disposed||!root.isConnected)return;
    const ticket=++revision;
    lastRefreshStartedAt=Date.now();
    scheduleAutoRefresh();
    reload.disabled=true;state.textContent="جارٍ تحميل الطلبات...";
    results.setAttribute("aria-busy","true");
    const q=new URLSearchParams({
      select:"id,number,customer,phone,service_type,delivery_address,delivery_landmark,backup_phone,payment_mode,arrival_eta_minutes,expected_arrival_at,fulfillment_status,arrived_at,completed_at,advance_order,advance_opening_at,queue_managed,queue_joined_at,advance_exception,refund_resolution,notes,total,method,status,reason,created_at,approved_at,invoice,pay_items(*),pay_proofs(*),pay_history(*),pay_order_reports(*)",
      order:"created_at.desc",limit:"26",offset:String(page*25)
    });
    if(statusFilter.value)q.set("status","eq."+statusFilter.value);
    if(stageFilter.value)q.set("fulfillment_status","eq."+stageFilter.value);
    if(advanceFilter.value==="advance")q.set("advance_order","eq.true");
    if(advanceFilter.value==="queue"){
      q.set("queue_joined_at","not.is.null");q.set("advance_exception","eq.false");q.set("order","queue_joined_at.asc,number.asc");
      if(!statusFilter.value)q.set("status","in.(pending,approved)");
      if(!stageFilter.value)q.set("fulfillment_status","not.in.(completed,stopped)");
    }
    const term=search.value.replace(/[^\p{L}\p{N} +\-]/gu,"").trim();
    if(term){
      const clauses=[
        "customer.ilike.*"+term+"*","phone.ilike.*"+term+"*","backup_phone.ilike.*"+term+"*"
      ];
      if(/^\d{1,16}$/.test(term))clauses.push("number.eq."+term);
      q.set("or","("+clauses.join(",")+")");
    }
    try{
      const [rows,positions]=await Promise.all([api(rootPath+"pay_orders?"+q),api(rootPath+"rpc/pay_staff_queue",{method:"POST",body:{}})]);
      queuePositions=positions||{};
      if(ticket!==revision||disposed||!root.isConnected)return;
      const visible=rows.slice(0,25);
      metrics.replaceChildren(
        metric("طلبات الصفحة",visible.length),
        metric("قيد المراجعة",visible.filter(o=>o.status==="pending").length,"warn"),
        metric("مدفوعات معتمدة",visible.filter(o=>o.status==="approved").length,"success"),
        metric("تم التسليم",visible.filter(o=>o.fulfillment_status==="completed").length,"complete")
      );
      if(visible.length)results.replaceChildren(renderTable(visible));
      else {
        const empty=named("div",null,"ord-empty");
        empty.append(named("strong","لا توجد طلبات مطابقة"),named("p","جرّب تعديل البحث أو الفلاتر."));
        results.replaceChildren(empty);
      }
      pagination.replaceChildren();
      if(page>0)pagination.append(button("السابق",()=>{page--;void load();}));
      pagination.append(named("span","الصفحة "+(page+1)));
      if(rows.length>25)pagination.append(button("التالي",()=>{page++;void load();}));
      const refreshedAt=new Date().toLocaleTimeString("ar-PS",{
        timeZone:"Asia/Gaza",hour:"2-digit",minute:"2-digit"
      });
      state.textContent="عرض "+visible.length+" طلب · الإحصائيات تخص الصفحة الحالية · آخر تحديث: "+refreshedAt;
    }catch(error){
      if(ticket!==revision||disposed||!root.isConnected)return;
      state.textContent="تعذّر تحميل الطلبات.";
      notice(error.message);
      results.replaceChildren(button("إعادة المحاولة",()=>load()));
      pagination.replaceChildren();
    }finally{
      if(ticket===revision&&!disposed&&root.isConnected){
        reload.disabled=false;
        results.setAttribute("aria-busy","false");
      }
    }
  }
  let timer;
  search.oninput=()=>{
    clearTimeout(timer);
    timer=setTimeout(()=>{page=0;void load();},280);
  };
  statusFilter.onchange=()=>{page=0;void load();};
  stageFilter.onchange=()=>{page=0;void load();};
  advanceFilter.onchange=()=>{page=0;void load();};

  // The admin router removes this panel when navigating away; clean up immediately.
  if(root.parentNode){
    detachObserver=new MutationObserver(()=>{
      if(!root.isConnected)stopAutoRefresh();
    });
    detachObserver.observe(root.parentNode,{childList:true});
  }
  document.addEventListener("visibilitychange",onVisibilityChange);
  window.addEventListener("focus",onWindowFocus);
  window.addEventListener("pageshow",onWindowFocus);
  await load();
}
export async function settings({ root, api, notice, endpoint }) {
  const [methods, [cfg]] = await Promise.all([
    api(rootPath + "pay_methods?order=position,id"),
    api(rootPath + "pay_settings?id=eq.1"),
  ]);
  root.classList.add("pay-settings-v3");
  root.replaceChildren();
  const pageIntro=el("section");
  pageIntro.className="ps3-intro";
  const introText=el("div");
  introText.className="ps3-intro-copy";
  introText.append(el("span","إدارة وسائل الدفع"),el("h2","طرق الدفع والتحويل"),
    el("p","أضف المحافظ الإلكترونية، عدّل بيانات التحويل، وتحكّم بما يظهر للزبائن عند إتمام الطلب."));
  const metrics=el("div");
  metrics.className="ps3-summary";
  const smallStat=(n,label)=>{const tile=el("div");tile.className="ps3-stat";tile.append(el("strong",n),el("span",label));return tile;};
  metrics.append(
    smallStat(methods.length,"طريقة دفع"),
    smallStat(methods.filter(m=>m.enabled).length,"مفعّلة"),
    smallStat(methods.filter(m=>m.qr_url).length,"رمز QR")
  );
  pageIntro.append(introText,metrics);
  const methodsSection=el("section");methodsSection.className="ps3-methods";
  const methodsHeading=el("div");methodsHeading.className="ps3-section-header";
  const methodsHeadingText=el("div");
  methodsHeadingText.append(el("h2","وسائل الدفع"),el("p","اختر طريقة الدفع لتعديل حسابها، شعارها، ورمز التحويل الخاص بها."));
  methodsHeading.append(methodsHeadingText);
  const methodGrid=el("div");methodGrid.className="ps3-method-grid";
  methodsSection.append(methodsHeading,methodGrid);
  root.append(pageIntro,methodsSection);
  const block=(title,description,nodes,cls="")=>{
    const section=el("section");section.className="ps3-block "+cls;
    const header=el("div");header.className="ps3-block-header";
    header.append(el("h4",title));
    if(description)header.append(el("p",description));
    const content=el("div");content.className="ps3-block-fields";
    for(const node of nodes){if(node)content.append(node);}
    section.append(header,content);
    return section;
  };
  const ownLabel=control=>control?.closest("label")||null;
  const switchify=control=>{
    const label=ownLabel(control);
    if(!label)return null;
    label.classList.add("ps3-switch");
    const text=label.firstChild?.textContent||"";
    const span=el("span",text.trim());
    label.replaceChildren(span,control);
    return label;
  };
  function flash(message, good) {
    const banner = el("p", message);
    banner.className = "pay-save-feedback " + (good ? "is-saved" : "is-error");
    banner.setAttribute("role", "status");
    root.prepend(banner);
    notice(message);
  }
  function createForm(title, items, onSave) {
    const form = el("form");
    form.className = "pay-config";
    form.noValidate = true; // Show explicit Arabic errors, not a generic browser-only tooltip.
    form.append(el("h3", title));
    form.dataset.title=title;
    const fields = {};
    for (const [key, label, value, type = "text"] of items) {
      const control = input(value, type);
      control.name = key;
      control.id = "pay-" + key + "-" + crypto.randomUUID().slice(0, 8);
      if (key === "name" || key === "restaurant" || key === "address" || key === "phone") control.required = true;
      if (key === "max_quantity") {
        control.min = "1";
        control.max = "99";
        control.step = "1";
      }
      field(form, label, control);
      fields[key] = control;
    }
    const status = el("p", "لا توجد تغييرات جديدة");
    status.className = "pay-save-feedback";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const save = el("button", "حفظ");
    save.type = "submit";
    save.className = "pay-save-button";
    form.append(status, save);
    const mark = (message, state) => {
      status.textContent = message;
      status.className = "pay-save-feedback " + state;
    };
    function markChanged() {
      for (const control of Object.values(fields)) control.removeAttribute("aria-invalid");
      mark("غير محفوظ — لديك تغييرات لم تُحفظ بعد", "is-unsaved");
    }
    form.addEventListener("input", markChanged);
    form.addEventListener("change", markChanged);
    form.onsubmit = async (event) => {
      event.preventDefault();
      save.disabled = true;
      mark("جارٍ الحفظ…", "is-saving");
      try {
        for (const control of Object.values(fields)) {
          control.removeAttribute("aria-invalid");
          if (!control.validity.valid) {
            control.setAttribute("aria-invalid", "true");
            control.focus();
            throw Error("تحقق من الحقل «" + control.closest("label")?.textContent?.trim() + "» وأكمل قيمته بشكل صحيح.");
          }
        }
        const values = Object.fromEntries(Object.entries(fields).map(([key, control]) => [
          key, control.type === "checkbox" ? control.checked
            : control.type === "number" ? Number(control.value) : control.value.trim()
        ]));
        await onSave(values, fields);
        await settings({ root, api, notice, endpoint });
        flash("تم الحفظ بنجاح ✓", true);
      } catch (err) {
        mark("لم يتم الحفظ: " + (err.message || "تحقق من البيانات وأعد المحاولة"), "is-error");
        notice("لم يتم الحفظ: " + (err.message || "خطأ غير معروف"));
      } finally {
        save.disabled = false;
      }
    };
    root.append(form);
    return { form, fields, mark };
  }
  // Public menu-images bucket is for logos/QRs only; payment proof receipts stay private.
  async function upload(file, folder, pngOnly) {
    if (!file || !file.size) throw Error("اختر صورة صحيحة قبل الحفظ");
    const allowed = pngOnly ? { "image/png": "png" } :
      { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
    const ext = allowed[file.type];
    if (!ext) throw Error(pngOnly ? "أيقونة الدفع يجب أن تكون PNG فقط" : "اختر صورة QR بصيغة PNG أو JPG أو WebP");
    if (file.size > 5 * 1024 * 1024) throw Error("حجم الصورة أكبر من 5 MB");
    if (pngOnly) {
      const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
      const expected = [137, 80, 78, 71, 13, 10, 26, 10];
      if (!expected.every((byte, i) => signature[i] === byte)) throw Error("الملف ليس صورة PNG صالحة");
    }
    const path = "/menu-images/payment-" + folder + "/" + crypto.randomUUID() + "." + ext;
    await api("/storage/v1/object" + path, { method: "POST", body: file });
    return endpoint + "/storage/v1/object/public" + path;
  }
  function imagePreview(parent, url, alt) {
    const preview = el("div");
    preview.className = "pay-upload-preview";
    const show = (source) => {
      preview.replaceChildren();
      if (!/^(https:\/\/|blob:)/i.test(source || "")) {
        preview.append(el("small", "لم تُرفع صورة بعد"));
        return;
      }
      const photo = el("img");
      photo.alt = alt;
      photo.loading = "lazy";
      photo.src = source;
      photo.onerror = () => preview.replaceChildren(el("small", "هذه الصورة لا تعمل. ارفع صورة جديدة."));
      preview.append(photo);
    };
    show(url);
    parent.append(preview);
    return show;
  }
  async function downloadQr(url, name) {
    if (!/^https:\/\//i.test(url || "")) throw Error("لا توجد صورة QR صالحة للتنزيل");
    const response = await fetch(url, { mode: "cors", cache: "no-store" });
    if (!response.ok) throw Error("تعذّر تنزيل صورة QR");
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) throw Error("الرابط لا يشير إلى صورة QR");
    const objectURL = URL.createObjectURL(blob);
    const link = el("a");
    link.href = objectURL;
    link.download = "snounu-" + (name || "payment").replace(/[^\p{L}\p{N}-]/gu, "-").slice(0, 40) + "-qr." +
      (blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg");
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectURL), 30000);
  }
  function method(m = {}) {
    const { form, fields, mark } = createForm(m.name || "طريقة دفع جديدة", [
      ["name", "اسم الطريقة *", m.name || ""],
      ["account", "رقم الحساب أو المحفظة (إلزامي عند التفعيل)", m.account || ""],
      ["holder", "صاحب الحساب (إلزامي عند التفعيل)", m.holder || ""],
      ["instructions", "تعليمات التحويل (اختياري)", m.instructions || ""],
      ["url", "رابط الدفع الرسمي (اختياري، يجب أن يبدأ بـ https://)", m.url || "", "url"],
      ["position", "الترتيب", m.position ?? methods.length + 1, "number"],
      ["enabled", "مفعّلة", !!m.enabled, "checkbox"],
    ], async (values) => {
      const name = values.name?.trim();
      if (!name) { fields.name.setAttribute("aria-invalid","true"); fields.name.focus(); throw Error("اسم طريقة الدفع مطلوب"); }
      if (values.enabled && !values.account.trim()) {
        fields.account.setAttribute("aria-invalid","true"); fields.account.focus();
        throw Error("لا يمكن تفعيل طريقة الدفع دون رقم حساب أو محفظة حقيقي");
      }
      if (values.enabled && !values.holder.trim()) {
        fields.holder.setAttribute("aria-invalid","true"); fields.holder.focus();
        throw Error("اكتب اسم صاحب الحساب قبل تفعيل طريقة الدفع");
      }
      if (values.url && !/^https:\/\/\S+$/i.test(values.url)) {
        fields.url.setAttribute("aria-invalid","true"); fields.url.focus();
        throw Error("رابط الدفع الرسمي يجب أن يبدأ بـ https://");
      }
      if (!Number.isInteger(values.position) || values.position < 0) {
        fields.position.setAttribute("aria-invalid","true"); fields.position.focus();
        throw Error("ترتيب العرض يجب أن يكون عدداً صحيحاً غير سالب");
      }
      const previousIcon = /^https:\/\/\S+\.png(?:\?[^ ]*)?$/i.test(m.icon || "") ? m.icon : "";
      if (values.enabled && !previousIcon && !iconFile.files[0]) {
        iconFile.setAttribute("aria-invalid", "true"); iconFile.focus();
        throw Error("ارفع شعار PNG لطريقة الدفع قبل تفعيلها");
      }
      const newIcon = iconFile.files[0] ? await upload(iconFile.files[0], "logo", true) : previousIcon;
      const newQr = qrFile.files[0] ? await upload(qrFile.files[0], "qr", false)
        : clearQr.checked ? "" : (m.qr_url || "");
      const body = { ...values, icon: newIcon || "", qr_url: newQr };
      await api(rootPath + "pay_methods" + (m.id ? "?id=eq." + m.id : ""), {
        method: m.id ? "PATCH" : "POST",
        body
      });
    });
    const iconFile = input("", "file");
    iconFile.accept = "image/png,.png";
    iconFile.setAttribute("aria-label", "اختر شعار طريقة الدفع بصيغة PNG");
    const iconLabel = el("label");
    iconLabel.append(el("strong", "شعار طريقة الدفع PNG *"), iconFile,
      el("small", "يظهر بجانب اسم الطريقة في شاشة الدفع. ارفع شعار PNG بدلاً من كتابة رمز أو إيموجي."));
    const setIconPreview = imagePreview(iconLabel, m.icon, "شعار طريقة الدفع");
    form.insertBefore(iconLabel, form.querySelector(".pay-save-feedback"));
    const qrFile = input("", "file");
    qrFile.accept = "image/png,image/jpeg,image/webp";
    const qrLabel = el("label");
    qrLabel.append(el("strong", "صورة QR للدفع (اختياري)"), qrFile,
      el("small", "يمكن للعميل مسح الصورة أو تنزيلها ليستخدمها في تطبيق الدفع."));
    const setQrPreview = imagePreview(qrLabel, m.qr_url, "QR");
    form.insertBefore(qrLabel, form.querySelector(".pay-save-feedback"));
    const clearQr = input(false, "checkbox");
    if (m.qr_url) {
      const clear = el("label");
      clear.append(clearQr, el("span", "إزالة صورة QR عند الحفظ"));
      form.insertBefore(clear, form.querySelector(".pay-save-feedback"));
      const download = button("تنزيل صورة QR", async () => {
        try { await downloadQr(m.qr_url, m.name); }
        catch (e) { notice(e.message); }
      });
      download.className = "pay-download-qr";
      form.insertBefore(download, form.querySelector(".pay-save-feedback"));
    }
    iconLabel.classList.add("ps3-upload-field","ps3-upload-icon");
    qrLabel.classList.add("ps3-upload-field","ps3-upload-qr");
    for (const [pick, setPreview] of [[iconFile,setIconPreview],[qrFile,setQrPreview]]) {
      let temporary = "";
      pick.addEventListener("change", () => {
        if (temporary) URL.revokeObjectURL(temporary);
        temporary = pick.files[0] ? URL.createObjectURL(pick.files[0]) : "";
        if (temporary) setPreview(temporary); else setPreview("");
        pick.removeAttribute("aria-invalid");
      });
    }
    // Organize existing controls without replacing their values or save handlers.
    form.classList.add("ps3-method-card");
    const title=form.querySelector("h3");
    const status=form.querySelector(".pay-save-feedback");
    const save=form.querySelector(".pay-save-button");
    const cardHead=el("div");cardHead.className="ps3-card-head";
    const logo=el("div");logo.className="ps3-method-logo";
    if(/^https:\/\//i.test(m.icon||"")){
      const img=el("img");img.src=m.icon;img.alt="شعار "+(m.name||"طريقة الدفع");
      img.onerror=()=>logo.replaceChildren(el("span","₪"));
      logo.append(img);
    }else logo.append(el("span","₪"));
    const titleText=el("div");titleText.className="ps3-method-title";
    title.textContent=m.name||"طريقة دفع جديدة";
    titleText.append(title);
    titleText.append(el("small",m.enabled?"هذه الطريقة ظاهرة للزبائن":"هذه الطريقة غير مفعّلة حالياً"));
    const indicator=el("span",m.enabled?"مفعّلة":"غير مفعّلة");
    indicator.className="ps3-method-state "+(m.enabled?"is-on":"is-off");
    cardHead.append(logo,titleText,indicator);

    const account=block("معلومات الحساب","البيانات التي يستخدمها الزبون لإرسال المبلغ.",
      ["name","account","holder"].map(k=>ownLabel(fields[k])),"ps3-account");
    const options=block("العرض والتعليمات","تحكّم في الظهور، ترتيب الطريقة، وكيفية إتمام التحويل.",
      ["instructions","url","position"].map(k=>ownLabel(fields[k]))
        .concat(switchify(fields.enabled)),"ps3-options");
    const media=block("الصور المرتبطة بالدفع","شعار المحفظة يظهر بجانب اسمها، ورمز QR يساعد الزبون في التحويل.",
      [iconLabel,qrLabel],"ps3-media");
    const qrActions=el("div");qrActions.className="ps3-qr-actions";
    const clearLabel=ownLabel(clearQr);
    if(clearLabel){clearLabel.classList.add("ps3-remove-qr");qrActions.append(clearLabel);}
    const qrDownload=form.querySelector(".pay-download-qr");
    if(qrDownload)qrActions.append(qrDownload);
    if(qrActions.childElementCount)media.append(qrActions);
    const footer=el("footer");footer.className="ps3-card-footer";
    footer.append(status,save);
    form.replaceChildren(cardHead,account,options,media,footer);
    methodGrid.append(form);
    return form;
  }
  for (const m of methods) method(m);
  if(!methods.length){
    const empty=el("div");empty.className="ps3-empty";
    empty.append(el("strong","لم تُضف أي وسائل دفع بعد"),
      el("p","ابدأ بإضافة محفظة أو حساب بنكي ليتمكن العملاء من اختيار طريقة الدفع."));
    methodGrid.append(empty);
  }
  const add=button("+ إضافة طريقة دفع جديدة",()=>{
    const newly=method();
    newly.scrollIntoView({behavior:"smooth",block:"start"});
    add.disabled=true;
  });
  add.className="ps3-add-method";
  methodsHeading.append(add);
  const settingsSection=el("section");settingsSection.className="ps3-general";
  const settingsHead=el("div");settingsHead.className="ps3-section-header";
  const settingsText=el("div");
  settingsText.append(el("h2","إعدادات الطلب والإيصال"),
    el("p","بيانات المطعم، الحد الأقصى للكمية، والإشعارات وصيغ إثبات الدفع."));
  settingsHead.append(settingsText);
  settingsSection.append(settingsHead);
  root.append(settingsSection);
  const formats = ["image/jpeg","image/png","image/webp","application/pdf"];
  const {form: configForm,fields: configFields}=createForm("إعدادات الطلب والإيصال", [
    ["max_quantity","الحد الأقصى للكمية لكل بند (1–99)",cfg.max_quantity || 99,"number"],
    ["advance_enabled","تفعيل الطلب المسبق",cfg.advance_enabled,"checkbox"],
    ["advance_suspended","إيقاف الطلبات المسبقة مؤقتاً",cfg.advance_suspended,"checkbox"],
    ["advance_capacity","الحد الأقصى للطلبات المسبقة النشطة",cfg.advance_capacity||30,"number"],
    ["advance_window_hours","الحد الأقصى قبل الافتتاح (بالساعات)",cfg.advance_window_hours||24,"number"],
    ["restaurant","اسم المطعم *",cfg.restaurant],
    ["address","عنوان المطعم *",cfg.address],
    ["phone","هاتف المطعم *",cfg.phone],
    ["logo","مسار أو رابط شعار الفاتورة",cfg.logo],
    ["cancellation","السماح بإلغاء الطلب قيد المراجعة",cfg.cancellation,"checkbox"],
    ["live_updates","إشعارات الحالة الفورية داخل المنيو",cfg.live_updates,"checkbox"],
    ...formats.map(m => [m,"قبول "+m.split("/")[1].toUpperCase(),cfg.formats.includes(m),"checkbox"]),
  ], async (values, fields) => {
    if (!Number.isInteger(values.max_quantity) || values.max_quantity < 1 || values.max_quantity > 99) {
      fields.max_quantity.setAttribute("aria-invalid","true");
      fields.max_quantity.focus();
      throw Error("الحد الأقصى للكمية يجب أن يكون بين 1 و99");
    }
    if(!Number.isInteger(values.advance_capacity)||values.advance_capacity<1||values.advance_capacity>500)throw Error("سعة الطلبات المسبقة يجب أن تكون بين 1 و500");
    if(!Number.isInteger(values.advance_window_hours)||values.advance_window_hours<1||values.advance_window_hours>168)throw Error("مدة الطلب المسبق يجب أن تكون بين 1 و168 ساعة");
    for (const k of ["restaurant","address","phone"]) {
      if (!values[k]) {
        fields[k].setAttribute("aria-invalid","true"); fields[k].focus();
        throw Error("الحقل «" + {restaurant:"اسم المطعم",address:"العنوان",phone:"الهاتف"}[k] + "» مطلوب");
      }
    }
    values.formats = formats.filter(m => values[m]);
    if (!values.formats.length) throw Error("اختر على الأقل نوعاً واحداً لإثبات الدفع");
    formats.forEach(m => delete values[m]);
    values.paper = "80mm";
    await api(rootPath + "pay_settings?id=eq.1", { method: "PATCH", body: values });
  });
  configForm.classList.add("ps3-general-form");
  const configStatus=configForm.querySelector(".pay-save-feedback");
  const configSave=configForm.querySelector(".pay-save-button");
  const configSections=el("div");configSections.className="ps3-general-grid";
  configSections.append(
    block("بيانات المطعم","تظهر بيانات المطعم في إيصالات الدفع.",
      ["restaurant","address","phone","logo"].map(k=>ownLabel(configFields[k])),"ps3-restaurant-settings"),
    block("إعدادات الطلبات","اضبط حد الكمية وأدوات التواصل الفوري.",
      ["max_quantity"].map(k=>ownLabel(configFields[k]))
        .concat(["cancellation","live_updates"].map(k=>switchify(configFields[k]))),"ps3-order-settings"),
    block("الطلبات المسبقة","تحكم بالطلبات خلال الإغلاق. راجع قائمة الانتظار في إدارة الطلبات.",["advance_enabled","advance_suspended"].map(k=>switchify(configFields[k])).concat(["advance_capacity","advance_window_hours"].map(k=>ownLabel(configFields[k]))),"ps3-order-settings"),
    block("صيغ إثبات الدفع","اختر أنواع الملفات المسموح للزبائن برفعها عند التحويل.",
      formats.map(k=>switchify(configFields[k])),"ps3-format-settings")
  );
  const configFooter=el("footer");configFooter.className="ps3-card-footer";
  configFooter.append(configStatus,configSave);
  configForm.replaceChildren(configSections,configFooter);
  settingsSection.append(configForm);
}
export async function sales(host, api) {
  host.className = "analytics-report pay-sales-dashboard";
  host.replaceChildren(el("h2", "المبيعات من الطلبات المباشرة"));
  try {
    const s = await api(rootPath + "rpc/pay_sales", { method: "POST", body: {} });
    const hero = el("section");
    hero.className = "pay-sales-hero";
    hero.append(el("span", "إجمالي المبيعات المعتمدة"), el("strong", amount(s.value || 0)));
    hero.append(el("small", "المبلغ يشمل فقط المدفوعات التي اعتمدتها إدارة المطعم."));
    host.append(hero);

    const metrics = el("div");
    metrics.className = "pay-sales-metrics";
    for (const [label, value] of [
      ["الطلبات المعتمدة", s.approved || 0],
      ["قيد المراجعة", s.pending || 0],
      ["متوسط الطلب", amount(s.average || 0)],
      ["إجمالي الطلبات", s.total || 0],
    ]) {
      const tile = el("div");
      tile.className = "pay-sales-metric";
      tile.append(el("small", label), el("strong", String(value)));
      metrics.append(tile);
    }
    host.append(metrics);

    const details = el("section");
    details.className = "pay-sales-details";
    details.append(el("h3", "تفاصيل المبيعات"));
    details.append(table(["المؤشر", "القيمة"], [
      ["تم اعتماد الدفع", s.approved || 0],
      ["مرفوض", s.rejected || 0],
      ["ملغي", s.cancelled || 0],
      ["قيمة المدفوعات المعتمدة", amount(s.value || 0)],
    ]));
    const period = el("select"), trend = el("div");
    period.setAttribute("aria-label", "الفترة الزمنية للمبيعات");
    period.append(...list({ day: "يومي", week: "أسبوعي", month: "شهري" }));
    const draw = () => trend.replaceChildren(
      table(["بداية الفترة", "المبيعات المعتمدة"], (s.trends || [])
        .filter(r => r.period === period.value)
        .map(r => [r.day, amount(r.value)]))
    );
    period.onchange = draw;
    draw();
    details.append(el("h3", "اتجاه المبيعات"), period, trend,
      el("h3", "الوجبات الأكثر طلباً"),
      table(["الوجبة", "الكمية", "المبيعات المعتمدة"],
        (s.meals || []).map(r => [r.name, r.quantity, amount(r.value)])));
    host.append(details);
    const advance=await api(rootPath+"rpc/pay_advance_analytics",{method:"POST",body:{p_days:28}});
    const section=el("section");section.className="pay-sales-details";section.append(el("h3","أداء الطلبات المسبقة · آخر 28 يوماً"),table(["المؤشر","القيمة"],[
      ["زيارات المنيو أثناء الإغلاق (مشاهدات وليست أفراداً)",advance.closed_views],["إضافات السلة أثناء الإغلاق",advance.closed_cart_additions],["بدء الدفع أثناء الإغلاق",advance.checkout_starts],["الطلبات المسبقة المستلمة",advance.submitted],["الطلبات المسبقة المعتمدة",advance.approved],["المبيعات المعتمدة",amount(advance.revenue)],["نسبة الإرسال إلى بدء الدفع (تقريبية)",advance.checkout_ratio==null?"—":advance.checkout_ratio+"%"],["متوسط وقت الانتظار حتى التحضير (دقائق)",advance.wait_minutes??"—"],["المرفوضة",advance.rejected],["الملغاة",advance.cancelled]]),el("h3","الوجبات الأكثر طلباً"),table(["الوجبة","الكمية المعتمدة"],(advance.meals||[]).map(m=>[m.name,m.quantity])),el("h3","أوقات الطلب المسبق (توقيت غزة)"),table(["الساعة","عدد الطلبات"],(advance.hours||[]).map(h=>[h.hour,h.count])));host.append(section);
  } catch (e) {
    host.append(el("p", e.message));
  }
}
