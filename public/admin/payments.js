import {
  el,
  amount,
  when,
  statuses,
  button,
  field,
  invoice,
} from "../payment-ui.js?v=receipt80-20261122";
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
  root.classList.add("pay-orders-v2");
  const search=input("","search");
  search.placeholder="رقم الطلب، العميل أو الجوال";
  search.setAttribute("aria-label","ابحث في الطلبات");
  const filter=el("select");
  filter.setAttribute("aria-label","حالة الدفع");
  filter.append(...list({"":"جميع حالات الدفع",pending:"قيد المراجعة",approved:"تم اعتماد الدفع",rejected:"رفض الدفع",cancelled:"ملغي"}));
  const stageFilter=el("select");
  stageFilter.setAttribute("aria-label","مرحلة الطلب");
  stageFilter.append(...list({"":"كل مراحل الطلب",awaiting_visit:"بانتظار الحضور",awaiting_payment:"بانتظار الدفع",awaiting_approval:"مراجعة الدفع",preparing:"قيد التحضير",completed:"تم التسليم",stopped:"متوقف"}));
  const title=el("div");title.className="orders-v2-title";
  const titleText=el("div");
  titleText.append(el("h2","إدارة الطلبات"),el("p","متابعة المدفوعات والطلبات والتسليم بسهولة."));
  const refresh=button("تحديث الطلبات",()=>load());refresh.className="orders-v2-refresh";
  title.append(titleText,refresh);
  const labeled=(label,control)=>{
    const holder=el("label");holder.className="orders-v2-field";
    holder.append(el("span",label),control);return holder;
  };
  const filters=el("div");filters.className="orders-v2-filters";
  filters.append(labeled("البحث",search),labeled("حالة الدفع",filter),labeled("مرحلة الطلب",stageFilter));
  const stats=el("div");stats.className="orders-v2-stats";
  const hint=el("p");hint.className="orders-v2-hint";hint.setAttribute("role","status");
  const results=el("div");results.className="pay-results orders-v2-results";
  const pager=el("nav");pager.className="orders-v2-pager";pager.setAttribute("aria-label","صفحات الطلبات");
  root.replaceChildren(title,filters,stats,hint,results,pager);
  let page=0,revision=0;
  const stages={awaiting_visit:"بانتظار الحضور",awaiting_payment:"بانتظار الدفع",awaiting_approval:"مراجعة الدفع",preparing:"قيد التحضير",completed:"تم التسليم",stopped:"متوقف"};
  const date=s=>s?new Date(s).toLocaleString("ar-PS",{timeZone:"Asia/Gaza",year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"—";
  const pill=(name,tone,secondary=false)=>{
    const tag=el("span",name);
    tag.className="orders-v2-pill orders-v2-pill--"+tone+(secondary?" is-stage":"");
    return tag;
  };
  const info=(label,value)=>{
    const field=el("div");field.className="orders-v2-info";
    field.append(el("small",label),el("strong",value||"—"));return field;
  };
  function orderCard(o){
    const card=el("article");card.className="orders-v2-card";
    card.setAttribute("aria-label","طلب رقم "+o.number);
    if(o.status==="pending")card.classList.add("needs-review");
    const head=el("header");head.className="orders-v2-card-head";
    const id=el("div");id.className="orders-v2-id";
    id.append(el("strong","طلب #"+o.number),el("small",date(o.created_at)));
    const badges=el("div");badges.className="orders-v2-badges";
    badges.append(pill(labels[o.status]||o.status,o.status));
    if(o.fulfillment_status)badges.append(pill(stages[o.fulfillment_status]||o.fulfillment_status,o.fulfillment_status,true));
    head.append(id,badges);
    const main=el("div");main.className="orders-v2-main";
    const customer=el("div");customer.className="orders-v2-customer";
    customer.append(el("small","العميل"),el("h3",o.customer||"عميل"));
    if(o.phone){
      const phone=el("a",o.phone);phone.className="orders-v2-phone";phone.dir="ltr";
      phone.href="tel:"+String(o.phone).replace(/[^\d+]/g,"");customer.append(phone);
    }
    const price=el("div");price.className="orders-v2-price";
    price.append(el("small","قيمة الطلب"));
    const value=el("strong",amount(o.total));value.dir="ltr";price.append(value);
    main.append(customer,price);
    const meals=el("div");meals.className="orders-v2-meals";
    meals.append(el("small","محتوى الطلب"));
    const summary=(o.pay_items||[]).map(i=>(i.name||"وجبة")+" × "+i.qty).join(" · ");
    const text=el("p",summary||"لا توجد وجبات");text.title=summary;meals.append(text);
    const meta=el("div");meta.className="orders-v2-meta";
    meta.append(
      info("نوع الطلب",o.service_type==="delivery"?"توصيل":o.service_type==="dine_in"?"تناول بالمطعم":"غير محدد"),
      info("طريقة الدفع",o.method||"غير محددة")
    );
    if(o.expected_arrival_at)meta.append(info("موعد الوصول",date(o.expected_arrival_at)));
    const foot=el("footer");foot.className="orders-v2-foot";
    const note=el("div");note.className="orders-v2-note";
    const reports=(o.pay_order_reports||[]).filter(r=>!r.resolved_at).length;
    if(reports)note.append(pill("بلاغ مفتوح · "+reports,"report"));
    else note.append(el("span",o.status==="pending"?"بانتظار المراجعة":o.fulfillment_status==="completed"?"تم تسليم الطلب":"عرض السجل من التفاصيل"));
    const action=button("عرض تفاصيل الطلب",()=>details(o));action.className="orders-v2-action";
    action.setAttribute("aria-label","عرض تفاصيل الطلب رقم "+o.number);
    foot.append(note,action);
    card.append(head,main,meals,meta,foot);
    return card;
  }
  async function details(o) {
    const dialog = el("dialog");
    dialog.className = "pay-admin-dialog";
    root.append(dialog);
    const urls = [];
    dialog.onclose = () => {
      urls.forEach(URL.revokeObjectURL);
      dialog.remove();
    };
    dialog.append(
      button("إغلاق", () => dialog.close()),
      el("h2", "طلب #" + o.number),
      el("p", o.customer + " · " + o.phone),
      el("p", when(o.created_at) + " · " + labels[o.status]),
      el("p", "مرحلة الطلب: " + ({awaiting_visit:"بانتظار وصول العميل",awaiting_payment:"بانتظار الدفع في المطعم",awaiting_approval:"بانتظار مراجعة الدفع",preparing:"قيد التحضير",completed:"تم تسليم الطلب",stopped:"متوقف"}[o.fulfillment_status] || "غير محددة")),
      el("p", "طريقة الدفع: " + (o.payment_mode==="at_restaurant"?"الدفع عند الوصول":"دفع إلكتروني")),
      ...(o.payment_mode==="at_restaurant"&&o.arrival_eta_minutes?[
        el("p","المدة المتوقعة للوصول: "+o.arrival_eta_minutes+" دقيقة"),
        ...(o.expected_arrival_at?[el("p","موعد الوصول التقريبي: "+when(o.expected_arrival_at))]:[])
      ]:[]),
      el("p", o.method + " · " + amount(o.total)),
      el("p", "نوع الطلب: " + (o.service_type === "delivery" ? "توصيل" : o.service_type === "dine_in" ? "تناول بالمطعم" : "غير محدد (طلب قديم)")),
      ...(o.service_type === "delivery" ? [
        el("p", "عنوان التوصيل: " + (o.delivery_address || "")),
        ...(o.delivery_landmark ? [el("p", "أقرب مبنى معروف أو معلم: " + o.delivery_landmark)] : []),
        ...(o.backup_phone ? [el("p", "رقم الجوال الاحتياطي: " + o.backup_phone)] : [])
      ] : []),
      el("p", o.notes),
      el("p", o.reason),
    );
    dialog.append(
      table(
        ["الوجبة", "العدد", "السعر"],
        o.pay_items.map((i) => [[i.name,...(i.choices||[]).map(c=>c.label),i.special_instructions].filter(Boolean).join(" · "), i.qty, amount(i.price)]),
      ),
    );
    const proof = [...o.pay_proofs].sort((a, b) =>
      b.uploaded_at.localeCompare(a.uploaded_at),
    )[0];
    if (proof) {
      const preview = button("معاينة إثبات الدفع", async () => {
        try {
          const s = await api(
            "/storage/v1/object/sign/" + bucket + "/" + proof.path,
            { method: "POST", body: { expiresIn: 60 } },
          );
          const r = await fetch(endpoint + "/storage/v1" + s.signedURL, {
            cache: "no-store",
          });
          if (!r.ok) throw Error("تعذر تحميل الوصل");
          const blob = await r.blob(),
            url = URL.createObjectURL(blob);
          urls.push(url);
          const item = el(blob.type === "application/pdf" ? "iframe" : "img");
          item.src = url;
          item.title = "إثبات الدفع";
          preview.replaceWith(item);
        } catch (e) {
          notice(e.message);
        }
      });
      dialog.append(preview);
    }
    if(canManage && o.service_type==="dine_in" && !o.arrived_at &&
      ["pending","approved"].includes(o.status)){
      dialog.append(button("تأكيد حضور العميل",async ()=>{
        if(!confirm("هل حضر العميل بالفعل للطلب #"+o.number+"؟"))return;
        try{
          await api(rootPath+"rpc/pay_mark_arrived",{method:"POST",body:{p_id:o.id}});
          dialog.close();await load();notice("تم تأكيد حضور العميل");
        }catch(e){notice(e.message);}
      }));
    }
    if (o.status === "pending" && canManage) {
      const reason = input("");
      field(dialog, "سبب الرفض", reason);
      for (const [target, label] of [
        ["approved",o.payment_mode==="at_restaurant"?"تأكيد استلام الدفع في المطعم":"اعتماد الدفع"],
        ["rejected","رفض الدفع"],
        ["cancelled","إلغاء الطلب"],
      ])
        dialog.append(
          button(label, async (e) => {
            if(target==="approved"&&o.payment_mode==="at_restaurant"&&!o.arrived_at){
              notice("أكّد وصول العميل أولاً قبل تسجيل الدفع.");return;
            }
            if (target === "rejected" && !reason.value.trim()) {
              reason.focus();
              return;
            }
            if (!confirm(label + " للطلب #" + o.number + "؟")) return;
            e.currentTarget.disabled = true;
            try {
              await api(rootPath + "rpc/pay_decide", {
                method: "POST",
                body: {
                  p_id: o.id,
                  p_target: target,
                  p_reason: target === "rejected" ? reason.value.trim() : "",
                },
              });
              dialog.close();
              await load();
            } catch (e) {
              dialog.close();
              notice(e.message);
              await load();
            }
          }),
        );
    }
    if (o.status === "approved")
      dialog.append(
        button("طباعة الإيصال الحراري (80 مم)", () => {
          const w = invoice(o);
          if (w)
            Promise.all(
              [...w.document.images].map((i) => i.decode().catch(() => {})),
            ).then(() => w.print());
        }),
      );
    if(canManage&&o.status==="approved"&&o.fulfillment_status!=="completed"){
      const done=button("تأكيد تسليم الطلب للعميل",async()=>{
        if(!confirm("هل استلم العميل طلبه بالفعل؟ هذه الرسالة ستصل إلى شاشة العميل."))return;
        try{
          await api(rootPath+"rpc/pay_mark_completed",{method:"POST",body:{p_id:o.id}});
          dialog.close();await load();notice("تم تسجيل تسليم الطلب وإخطار العميل");
        }catch(err){notice(err.message);}
      });
      done.className="pay-primary";
      dialog.append(done);
    }
    const reports=(o.pay_order_reports||[]).slice().sort((a,b)=>
      b.created_at.localeCompare(a.created_at));
    if(reports.length){
      dialog.append(el("h3","بلاغات العملاء"));
      for(const report of reports){
        const box=el("section");box.className="pay-admin-report";
        box.append(el("strong",({not_received:"الطلب لم يصل",incorrect_order:"الطلب غير صحيح",other:"مشكلة أخرى"}[report.category]||"بلاغ")+
          (report.resolved_at?" · تم إغلاقه":" · مفتوح")),
          el("small",when(report.created_at)),el("p",report.message));
        if(canManage&&!report.resolved_at){
          box.append(button("وضع علامة تم حل المشكلة",async()=>{
            try{
              await api(rootPath+"rpc/pay_resolve_report",{method:"POST",body:{p_id:report.id}});
              dialog.close();await load();notice("تم إغلاق البلاغ");
            }catch(e){notice(e.message);}
          }));
        }
        dialog.append(box);
      }
    }
    dialog.append(el("h3", "سجل الطلب"));
    for (const h of o.pay_history.sort((a, b) =>
      a.occurred_at.localeCompare(b.occurred_at),
    ))
      dialog.append(
        el(
          "p",
          [when(h.occurred_at), labels[h.status], h.actor || "العميل", h.reason]
            .filter(Boolean)
            .join(" · "),
        ),
      );
    dialog.showModal();
  }
  async function load(){
    const ticket=++revision;
    refresh.disabled=true;hint.textContent="جارٍ تحميل الطلبات...";
    results.setAttribute("aria-busy","true");
    const q=new URLSearchParams({
      select:"id,number,customer,phone,service_type,delivery_address,delivery_landmark,backup_phone,payment_mode,arrival_eta_minutes,expected_arrival_at,fulfillment_status,arrived_at,completed_at,notes,total,method,status,reason,created_at,approved_at,invoice,pay_items(*),pay_proofs(*),pay_history(*),pay_order_reports(*)",
      order:"created_at.desc",limit:"26",offset:String(page*25)
    });
    if(filter.value)q.set("status","eq."+filter.value);
    if(stageFilter.value)q.set("fulfillment_status","eq."+stageFilter.value);
    const term=search.value.replace(/[^\p{L}\p{N} +\-]/gu,"").trim();
    if(term){
      const clauses=["customer.ilike.*"+term+"*","phone.ilike.*"+term+"*","backup_phone.ilike.*"+term+"*"];
      if(/^\d{1,16}$/.test(term))clauses.push("number.eq."+term);
      q.set("or","("+clauses.join(",")+")");
    }
    try{
      const rows=await api(rootPath+"pay_orders?"+q);
      if(ticket!==revision)return;
      const visible=rows.slice(0,25);
      const stat=(name,value,kind)=>{
        const item=el("div");item.className="orders-v2-stat "+kind;
        item.append(el("small",name),el("strong",String(value)));return item;
      };
      stats.replaceChildren(
        stat("طلبات هذه الصفحة",visible.length,""),
        stat("قيد المراجعة",visible.filter(o=>o.status==="pending").length,"pending"),
        stat("مدفوعات معتمدة",visible.filter(o=>o.status==="approved").length,"approved"),
        stat("تم تسليمها",visible.filter(o=>o.fulfillment_status==="completed").length,"complete")
      );
      const grid=el("div");grid.className="orders-v2-grid";
      visible.forEach(o=>grid.append(orderCard(o)));
      if(!visible.length){
        const empty=el("section");empty.className="orders-v2-empty";
        empty.append(el("strong","لا توجد طلبات مطابقة"),el("p","جرّب تغيير البحث أو الفلاتر."));
        results.replaceChildren(empty);
      }else results.replaceChildren(grid);
      pager.replaceChildren();
      if(page){
        const previous=button("السابق",()=>{page--;void load();});
        pager.append(previous);
      }
      pager.append(el("span","الصفحة "+(page+1)));
      if(rows.length>25){
        const next=button("التالي",()=>{page++;void load();});
        pager.append(next);
      }
      hint.textContent="يتم عرض "+visible.length+" طلب في الصفحة الحالية";
    }catch(error){
      if(ticket!==revision)return;
      notice(error.message);
      hint.textContent="تعذّر تحميل الطلبات";
      const retry=button("إعادة المحاولة",()=>load());
      const empty=el("section");empty.className="orders-v2-empty";empty.append(el("strong","تعذّر تحميل البيانات"),retry);
      results.replaceChildren(empty);pager.replaceChildren();
    }finally{
      if(ticket===revision){refresh.disabled=false;results.setAttribute("aria-busy","false");}
    }
  }
  let timer;
  search.oninput=()=>{
    clearTimeout(timer);
    timer=setTimeout(()=>{page=0;void load();},280);
  };
  filter.onchange=()=>{page=0;void load();};
  stageFilter.onchange=()=>{page=0;void load();};
  await load();
}
export async function settings({ root, api, notice, endpoint }) {
  const [methods, [cfg]] = await Promise.all([
    api(rootPath + "pay_methods?order=position,id"),
    api(rootPath + "pay_settings?id=eq.1"),
  ]);
  root.replaceChildren();
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
    for (const [pick, setPreview] of [[iconFile,setIconPreview],[qrFile,setQrPreview]]) {
      let temporary = "";
      pick.addEventListener("change", () => {
        if (temporary) URL.revokeObjectURL(temporary);
        temporary = pick.files[0] ? URL.createObjectURL(pick.files[0]) : "";
        if (temporary) setPreview(temporary); else setPreview("");
        pick.removeAttribute("aria-invalid");
      });
    }
    return form;
  }
  for (const m of methods) method(m);
  const add = button("إضافة طريقة دفع", () => {
    const newly = method();
    newly.scrollIntoView({ behavior: "smooth", block: "center" });
    add.disabled = true;
  });
  root.append(add);
  const formats = ["image/jpeg","image/png","image/webp","application/pdf"];
  createForm("إعدادات الفاتورة والطلبات", [
    ["max_quantity","الحد الأقصى للكمية لكل بند (1–99)",cfg.max_quantity || 99,"number"],
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
  } catch (e) {
    host.append(el("p", e.message));
  }
}
