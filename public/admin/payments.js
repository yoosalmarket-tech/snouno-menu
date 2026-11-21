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
export async function settings({ root, api, notice }) {
  const [methods, [cfg]] = await Promise.all([
    api(rootPath + "pay_methods?order=position,id"),
    api(rootPath + "pay_settings?id=eq.1"),
  ]);
  function form(title, items, onSave) {
    const f = el("form");
    f.className = "pay-config";
    f.append(el("h3", title));
    const fields = {};
    for (const [key, label, value, type] of items) {
      const i = input(value, type);
      field(f, label, i);
      fields[key] = i;
    }
    const submit = el("button", "حفظ");
    f.append(submit);
    root.append(f);
    f.onsubmit = async (e) => {
      e.preventDefault();
      submit.disabled = true;
      try {
        await onSave(
          Object.fromEntries(
            Object.entries(fields).map(([k, i]) => [
              k,
              i.type === "checkbox"
                ? i.checked
                : i.type === "number"
                  ? Number(i.value)
                  : i.value.trim(),
            ]),
          ),
        );
        await settings({ root, api, notice });
        notice("تم الحفظ");
      } catch (e) {
        notice(e.message);
      } finally {
        submit.disabled = false;
      }
    };
    return f;
  }
  root.replaceChildren();
  // Payment QR codes and logos are public-facing assets; payment proofs remain private.
  async function uploadPaymentImage(file, kind) {
    const ext = {"image/png":"png","image/jpeg":"jpg","image/webp":"webp"}[file.type];
    if (!ext) throw Error("اختر صورة PNG أو JPEG أو WebP");
    if (file.size > 5 * 1024 * 1024) throw Error("يجب أن تكون الصورة أقل من 5 MB");
    if (!file.size) throw Error("الصورة فارغة");
    const path = "/menu-images/payment-" + kind + "/" + crypto.randomUUID() + "." + ext;
    await api("/storage/v1/object" + path, {method:"POST", body:file});
    return endpoint + "/storage/v1/object/public" + path;
  }
  function imagePreview(root, url, description) {
    const preview = el("div");
    preview.className = "pay-upload-preview";
    if (/^https:\/\//i.test(url || "")) {
      const img = el("img");
      img.alt = description;
      img.loading = "lazy";
      img.src = url;
      img.onerror = () => {
        preview.replaceChildren(el("small", "تعذر تحميل الصورة الحالية — ارفع صورة صحيحة."));
      };
      preview.append(img);
    } else {
      preview.append(el("small", "لم يتم رفع صورة بعد"));
    }
    root.append(preview);
    return preview;
  }
  function method(m = {}) {
    const iconFile = input("", "file");
    iconFile.accept = "image/jpeg,image/png,image/webp";
    const qrFile = input("", "file");
    qrFile.accept = iconFile.accept;
    const clearQr = input(false, "checkbox");
    const f = form(
      m.name || "طريقة دفع جديدة",
      [
        ["name", "اسم الطريقة", m.name],
        ["icon", "أيقونة الطريقة (رمز مثل 🏦، أو رابط شعار مرفوع)", m.icon || "▣"],
        ["account", "رقم الحساب أو المحفظة", m.account],
        ["holder", "صاحب الحساب", m.holder],
        ["instructions", "تعليمات التحويل", m.instructions],
        ["qr_url", "رابط صورة QR (يُملأ تلقائياً بعد الرفع)", m.qr_url, "url"],
        ["url", "رابط الدفع الرسمي (اختياري)", m.url, "url"],
        ["position", "الترتيب", m.position ?? methods.length + 1, "number"],
        ["enabled", "مفعّلة", m.enabled, "checkbox"],
      ],
      async (body) => {
        if (iconFile.files[0]) body.icon = await uploadPaymentImage(iconFile.files[0], "logo");
        if (clearQr.checked) body.qr_url = "";
        if (qrFile.files[0]) body.qr_url = await uploadPaymentImage(qrFile.files[0], "qr");
        // A payment can only be enabled once Snounu's real receiving account is entered.
        await api(rootPath + "pay_methods" + (m.id ? "?id=eq." + m.id : ""), {
          method: m.id ? "PATCH" : "POST",
          body,
        });
      },
    );
    const iconRow = el("label");
    iconRow.append(el("strong", "رفع شعار طريقة الدفع (اختياري)"), iconFile);
    iconRow.append(el("small", "الأيقونة هي الرمز الصغير بجانب اسم طريقة الدفع. يمكنك إبقاء الرمز أو رفع شعار البنك أو المحفظة."));
    f.insertBefore(iconRow, f.lastElementChild);
    const iconPreview = imagePreview(f, m.icon, "شعار طريقة الدفع");
    const qrRow = el("label");
    qrRow.append(el("strong", "رفع صورة QR ليقوم العميل بمسحها"), qrFile);
    qrRow.append(el("small", "صورة خاصة بحساب سنونو فقط. PNG أو JPG أو WebP، حتى 5 MB. الصورة اختيارية ويمكن للعميل نسخ الرقم بدلاً منها."));
    f.insertBefore(qrRow, f.lastElementChild);
    const qrPreview = imagePreview(f, m.qr_url, "رمز QR الخاص بسنونو");
    f.insertBefore(qrPreview, f.lastElementChild);
    f.insertBefore(iconPreview, iconRow);
    if (m.qr_url) {
      const clearRow = el("label");
      clearRow.append(clearQr, el("span", "إزالة صورة QR الحالية عند الحفظ"));
      f.insertBefore(clearRow, f.lastElementChild);
    }
    function watch(fileInput, preview, fallback, alt) {
      let objectURL = "";
      fileInput.addEventListener("change", () => {
        if (objectURL) URL.revokeObjectURL(objectURL);
        preview.replaceChildren();
        objectURL = fileInput.files[0] ? URL.createObjectURL(fileInput.files[0]) : "";
        if (objectURL) {
          const img = el("img");
          img.alt = alt;
          img.src = objectURL;
          preview.append(img);
        } else if (fallback) imagePreview(preview, fallback, alt);
        else preview.append(el("small", "لم يتم اختيار صورة"));
      });
    }
    watch(iconFile, iconPreview, m.icon, "معاينة شعار طريقة الدفع");
    watch(qrFile, qrPreview, m.qr_url, "معاينة QR");
    return f;
  }
  methods.forEach(method);
  root.append(
    button("إضافة طريقة دفع", (e) => {
      method().scrollIntoView();
      e.currentTarget.disabled = true;
    }),
  );
  const formats = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  form(
    "إعدادات الفاتورة والطلبات",
    [
      ["max_quantity","الحد الأقصى للكمية لكل بند (١–٩٩)",cfg.max_quantity||99,"number"],
      ["restaurant", "اسم المطعم", cfg.restaurant],
      ["address", "العنوان", cfg.address],
      ["phone", "هاتف المطعم", cfg.phone],
      ["logo", "مسار أو رابط شعار الفاتورة", cfg.logo],
      ["thermal", "طباعة 80 مم افتراضياً", cfg.paper === "80mm", "checkbox"],
      [
        "cancellation",
        "السماح بإلغاء الطلب قيد المراجعة",
        cfg.cancellation,
        "checkbox",
      ],
      [
        "live_updates",
        "إشعارات الحالة الفورية داخل المنيو",
        cfg.live_updates,
        "checkbox",
      ],
      ...formats.map((m) => [
        m,
        "قبول " + m.split("/")[1].toUpperCase(),
        cfg.formats.includes(m),
        "checkbox",
      ]),
    ],
    async (body) => {
      body.formats = formats.filter((m) => body[m]);
      formats.forEach((m) => delete body[m]);
      body.paper = body.thermal ? "80mm" : "A4";
      delete body.thermal;
      await api(rootPath + "pay_settings?id=eq.1", { method: "PATCH", body });
    },
  );
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

  host.className = "analytics-report";
  host.append(
    el("h2", "المدفوعات المعتمدة إدارياً"),
    el(
      "p",
      "منذ تفعيل الطلب المباشر · المبالغ بالشيكل بحسب قرارات إدارة المطعم.",
    ),
  );
  try {
    const s = await api(rootPath + "rpc/pay_sales", {
      method: "POST",
      body: {},
    });
    host.append(
      table(
        ["المؤشر", "القيمة"],
        [
          ["إجمالي الطلبات", s.total],
          ...Object.entries(labels).map(([k, v]) => [v, s[k]]),
          ["قيمة المدفوعات المعتمدة", amount(s.value)],
          ["متوسط الطلب المعتمد", amount(s.average)],
        ],
      ),
    );
    const period = el("select"),
      trend = el("div");
    period.append(...list({ day: "يومي", week: "أسبوعي", month: "شهري" }));
    const draw = () =>
      trend.replaceChildren(
        table(
          ["بداية الفترة", "المبيعات المعتمدة"],
          s.trends
            .filter((r) => r.period === period.value)
            .map((r) => [r.day, amount(r.value)]),
        ),
      );
    period.onchange = draw;
    draw();
    host.append(
      el("h3", "اتجاه المبيعات"),
      period,
      trend,
      el("h3", "الوجبات الأكثر طلباً"),
      table(
        ["الوجبة", "الكمية", "المبيعات المعتمدة"],
        s.meals.map((r) => [r.name, r.quantity, amount(r.value)]),
      ),
    );
  } catch (e) {
    host.append(el("p", e.message));
  }
}
