import {
  el,
  amount,
  when,
  statuses,
  button,
  field,
  invoice,
} from "../payment-ui.js?v=02";
const labels = {
  pending: "قيد المراجعة",
  approved: "تم اعتماد الدفع",
  rejected: "مرفوض",
  cancelled: "ملغي",
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
  for (const row of rows) {
    const tr = el("tr");
    for (const v of row) {
      const td = el("td");
      if (v instanceof Node) td.append(v);
      else td.textContent = v;
      tr.append(td);
    }
    t.append(tr);
  }
  return t;
};
export async function orders({ root, api, notice, endpoint }) {
  const search = input("", "search");
  search.placeholder = "رقم الطلب، الاسم أو الجوال";
  const filter = el("select");
  filter.append(...list({ "": "كل الحالات", ...labels }));
  const results = el("div");
  results.className = "pay-results";
  root.replaceChildren(search, filter, results);
  let page = 0,
    revision = 0;
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
      el("p", o.method + " · " + amount(o.total)),
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
    if (o.status === "pending") {
      const reason = input("");
      field(dialog, "سبب الرفض", reason);
      for (const [target, label] of [
        ["approved", "اعتماد الدفع"],
        ["rejected", "رفض الدفع"],
        ["cancelled", "إلغاء الطلب"],
      ])
        dialog.append(
          button(label, async (e) => {
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
        button("طباعة الفاتورة", () => {
          const w = invoice(o);
          if (w)
            Promise.all(
              [...w.document.images].map((i) => i.decode().catch(() => {})),
            ).then(() => w.print());
        }),
      );
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
  async function load() {
    const ticket = ++revision;
    const q = new URLSearchParams({
      select:
        "id,number,customer,phone,notes,total,method,status,reason,created_at,approved_at,invoice,pay_items(*),pay_proofs(*),pay_history(*)",
      order: "created_at.desc",
      limit: "26",
      offset: String(page * 25),
    });
    if (filter.value) q.set("status", "eq." + filter.value);
    const term = search.value.replace(/[^\p{L}\p{N} +\-]/gu, "").trim();
    if (term) {
      const clauses = [
        "customer.ilike.*" + term + "*",
        "phone.ilike.*" + term + "*",
      ];
      if (/^\d{1,16}$/.test(term)) clauses.push("number.eq." + term);
      q.set("or", "(" + clauses.join(",") + ")");
    }
    try {
      const rows = await api(rootPath + "pay_orders?" + q);
      if (ticket !== revision) return;
      results.replaceChildren(
        table(
          [
            "رقم",
            "العميل",
            "الجوال",
            "الطلب",
            "المبلغ",
            "الدفع",
            "الوقت",
            "الحالة",
            "التفاصيل",
          ],
          rows
            .slice(0, 25)
            .map((o) => [
              o.number,
              o.customer,
              o.phone,
              o.pay_items.map((i) => i.name + " × " + i.qty).join("، "),
              amount(o.total),
              o.method,
              when(o.created_at),
              labels[o.status],
              button("عرض", () => details(o)),
            ]),
        ),
      );
      if (!rows.length) results.append(el("p", "لا توجد طلبات مطابقة"));
      if (page)
        results.append(
          button("السابق", () => {
            page--;
            load();
          }),
        );
      if (rows.length > 25)
        results.append(
          button("التالي", () => {
            page++;
            load();
          }),
        );
    } catch (e) {
      notice(e.message);
    }
  }
  let timer;
  search.oninput = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      page = 0;
      load();
    }, 250);
  };
  filter.onchange = () => {
    page = 0;
    load();
  };
  root.prepend(button("تحديث الطلبات", load));
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
      if (!/^https:\/\//i.test(source || "")) {
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
    ["thermal","طباعة 80 مم افتراضياً",cfg.paper === "80mm","checkbox"],
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
    values.paper = values.thermal ? "80mm" : "A4";
    delete values.thermal;
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
