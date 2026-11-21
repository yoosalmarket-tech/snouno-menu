import {
  el,
  amount,
  when,
  statuses,
  button,
  field,
  invoice,
} from "../payment-ui.js";
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
        o.pay_items.map((i) => [i.name, i.qty, amount(i.price)]),
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
  function method(m = {}) {
    return form(
      m.name || "طريقة دفع جديدة",
      [
        ["name", "اسم الطريقة", m.name],
        ["icon", "رمز الطريقة", m.icon || "▣"],
        ["account", "رقم الحساب أو المحفظة", m.account],
        ["holder", "صاحب الحساب", m.holder],
        ["instructions", "تعليمات التحويل", m.instructions],
        ["url", "رابط الدفع الرسمي (اختياري)", m.url, "url"],
        ["position", "الترتيب", m.position ?? methods.length + 1, "number"],
        ["enabled", "مفعّلة", m.enabled, "checkbox"],
      ],
      (body) =>
        api(rootPath + "pay_methods" + (m.id ? "?id=eq." + m.id : ""), {
          method: m.id ? "PATCH" : "POST",
          body,
        }),
    );
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
