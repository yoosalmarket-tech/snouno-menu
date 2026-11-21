import {
  el,
  amount,
  when,
  statuses,
  button,
  field,
  invoice,
} from "./payment-ui.js?v=02";
const endpoint = "https://wknpuzdyemwkllmxehyy.supabase.co",
  key = "sb_publishable_FJg5RC-dTvsINEy9D8_rXw_xM03B4Ip";
const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const t = (ar, en) => (document.documentElement.lang === "en" ? en : ar);
async function call(data, proof) {
  let body,
    headers = { apikey: key };
  if (proof) {
    body = new FormData();
    body.set("data", JSON.stringify(data));
    body.set("proof", proof);
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(data);
  }
  const r = await fetch(endpoint + "/functions/v1/payment-review", {
    method: "POST",
    headers,
    body,
    cache: "no-store",
  });
  const value = await r.json();
  if (!r.ok) throw Error(value.error || t("تعذر الاتصال", "Connection failed"));
  return value;
}
export function installCart({ catalog, name, description, closed, page }) {
  const dialog = el("dialog");
  dialog.className = "pay-dialog";
  dialog.setAttribute("aria-label", t("السلة والطلبات", "Cart and orders"));
  const badge = button("", open);
  badge.className = "pay-footer";
  const history = button("", () => {
    if (!dialog.open) dialog.showModal();
    showHistory();
  });
  history.className = "pay-orders-link";
  document.body.append(dialog, badge, history);
  const key = "snounu-cart-v2";
  function restore() {
    const saved = read(key, null);
    if (Array.isArray(saved)) return saved;
    return Object.entries(read("snounu-cart-v1", {})).map(([id, qty]) => ({
      line: id,
      id,
      qty,
      options: [],
      note: "",
    }));
  }
  let cart = restore(),
    tracking = read("snounu-orders-v1", []),
    cleanup = () => {},
    generation = 0,
    locked = false;
  let draft = { customer: "", phone: "", notes: "" },
    cfg,
    method = "",
    proof = null,
    maxQty = 99;
  const localized = (o) => t(o.label, o.en || o.label);
  function unit(d, ids) {
    const options = (d?.order_options || [])
      .flatMap((g) => g.choices)
      .filter((o) => ids.includes(o.id));
    return {
      price:
        (Math.round((d?.price || 0) * 100) +
          options.reduce((c, o) => c + Math.round(o.price * 100), 0)) /
        100,
      selected: options,
    };
  }
  const lines = () =>
    cart.map((l) => {
      const d = catalog().find((d) => d.id === l.id);
      return { ...l, d, ...unit(d, l.options) };
    });
  const items = () =>
    lines().map(({ id, qty, price, options, note }) => ({
      id,
      qty,
      price,
      options,
      note,
    }));
  const total = () =>
    lines().reduce((sum, l) => sum + l.qty * Math.round(l.price * 100), 0) /
    100;
  const count = () => cart.reduce((v, l) => v + l.qty, 0);
  const motion = () => !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pulse = (node) => {
    if (motion())
      node.animate(
        [
          { opacity: 0.65, transform: "translateY(3px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 200 },
      );
  };
  function refresh() {
    const show = page() === "menu" && count() > 0;
    badge.replaceChildren(
      el("strong", t("عرض السلة", "View cart") + " · " + count()),
      el("span", amount(total()) + "  ‹"),
    );
    badge.firstChild.prepend(el("span", "🛒 "));
    document.body.classList.toggle("has-cart-footer", show);
    if (show) {
      badge.hidden = false;
      badge.classList.add("visible");
    } else {
      const wasVisible = badge.classList.contains("visible");
      badge.classList.remove("visible");
      if (wasVisible && motion())
        setTimeout(() => {
          if (!badge.classList.contains("visible")) badge.hidden = true;
        }, 220);
      else badge.hidden = true;
    }
    history.hidden = !tracking.length || page() === "welcome";
    const pendingOrders = tracking.filter((r) => r.status === "pending").length;
    history.dataset.pending = String(pendingOrders > 0);
    history.replaceChildren(
      el("span", "▤"),
      el("strong", t("طلباتي", "My orders")),
      el("small", pendingOrders
        ? t("قيد المراجعة", "Pending") + " · " + pendingOrders
        : t("متابعة الطلبات", "Track orders"))
    );
    history.setAttribute("aria-label", t("عرض حالة طلباتي", "View my order status"));
  }
  function save() {
    localStorage.setItem(key, JSON.stringify(cart));
    localStorage.removeItem("snounu-cart-v1");
    refresh();
    pulse(badge);
  }
  function modal() {
    if (!dialog.open) dialog.showModal();
  }
  async function dismiss() {
    if (locked || dialog.classList.contains("closing")) return;
    dialog.classList.add("closing");
    if (motion())
      await dialog
        .animate(
          [
            { opacity: 1, transform: "none" },
            { opacity: 0, transform: "translateY(28px) scale(.98)" },
          ],
          { duration: 180, easing: "ease-in" },
        )
        .finished.catch(() => {});
    dialog.close();
    dialog.classList.remove("closing");
  }
  function add(d, existing) {
    if (!d || d.available === false || closed()) return;
    const previous = document.getElementById("dish");
    if (previous?.open) previous.close();
    modal();
    const body = layout(name(d)),
      form = el("form");
    const photo = el("img");
    photo.className = "pay-meal-photo";
    photo.alt = name(d);
    photo.src = d.image || d.rich_image || "/assets/logo.webp";
    body.append(
      photo,
      el("p", description(d)),
      el("strong", amount(d.price)),
      form,
    );
    let qty = existing?.qty || 1;
    const chosen = new Set(existing?.options || []);
    for (const group of d.order_options || []) {
      const section = el("fieldset");
      section.append(
        el("legend", localized(group) + (group.required ? " *" : "")),
      );
      for (const opt of group.choices) {
        const selector = el("input");
        selector.type = group.multiple ? "checkbox" : "radio";
        selector.name = "option-" + d.order_options.indexOf(group);
        selector.disabled = opt.available === false;
        selector.checked = chosen.has(opt.id) && !selector.disabled;
        if (selector.disabled) chosen.delete(opt.id);
        selector.onchange = () => {
          if (!group.multiple)
            for (const other of group.choices) chosen.delete(other.id);
          if (selector.checked) chosen.add(opt.id);
          else chosen.delete(opt.id);
          draw();
        };
        field(
          section,
          localized(opt) + (opt.price ? " +" + amount(opt.price) : ""),
          selector,
        );
      }
      if (!group.multiple && !group.required)
        section.append(
          button(t("بدون", "None"), () => {
            section
              .querySelectorAll("input")
              .forEach((i) => (i.checked = false));
            group.choices.forEach((o) => chosen.delete(o.id));
            draw();
          }),
        );
      form.append(section);
    }
    const note = el("textarea");
    note.maxLength = 300;
    note.value = existing?.note || "";
    field(
      form,
      t("تعليمات خاصة (اختياري)", "Special instructions (optional)"),
      note,
    );
    const controls = el("div");
    controls.className = "pay-controls";
    const n = el("output");
    const minus = button("−", () => {
        qty = Math.max(1, qty - 1);
        draw();
      }),
      plus = button("+", () => {
        qty = Math.min(maxQty, qty + 1);
        draw();
      });
    controls.append(minus, n, plus);
    form.append(controls);
    const confirm = el("button");
    confirm.className = "pay-primary";
    form.append(confirm);
    function draw() {
      n.textContent = qty;
      minus.disabled = qty <= 1;
      plus.disabled = qty >= maxQty;
      confirm.textContent =
        (existing
          ? t("حفظ التعديل", "Save changes")
          : t("أضف للسلة", "Add to cart")) +
        " · " +
        amount(qty * unit(d, [...chosen]).price);
      pulse(n);
    }
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (confirm.disabled || locked) return;
      for (const group of d.order_options || [])
        if (group.required && !group.choices.some((o) => chosen.has(o.id)))
          return error(Error(t("اختر من ", "Choose from ") + localized(group)));
      const options = [...chosen].sort(),
        instruction = note.value.trim();
      const same = cart.find(
        (l) =>
          l.id === d.id &&
          JSON.stringify(l.options) === JSON.stringify(options) &&
          l.note === instruction &&
          l.line !== existing?.line,
      );
      if (same && same.qty + qty > maxQty)
        return error(Error(t("تجاوزت حد الكمية", "Quantity limit exceeded")));
      if (existing) cart = cart.filter((l) => l.line !== existing.line);
      if (same) same.qty += qty;
      else
        cart.push({
          line: existing?.line || crypto.randomUUID(),
          id: d.id,
          qty,
          options,
          note: instruction,
        });
      save();
      confirm.disabled = true;
      confirm.textContent = t("تمت الإضافة ✓", "Added ✓");
      if (existing) {
        showCart();
        return;
      }
      await dismiss();
    };
    draw();
  }
  function open() {
    modal();
    showCart();
  }
  function showHistory() {
    const b = layout(t("طلباتي", "My orders"));
    for (const ref of tracking)
      b.append(button("#" + (ref.number || "…") + " — " + t(...(statuses[ref.status] || statuses.pending)), () => status(ref)));
  }
  function layout(title) {
    cleanup();
    cleanup = () => {};
    generation++;
    dialog.dir = t("rtl", "ltr");
    dialog.replaceChildren();
    const top = el("div");
    top.className = "pay-top";
    const h = el("h2", title);
    top.append(
      h,
      button("×", () => {
        void dismiss();
      }),
    );
    dialog.append(top);
    const body = el("div");
    body.className = "pay-body";
    const msg = el("p");
    msg.className = "pay-msg";
    msg.setAttribute("role", "status");
    dialog.append(body, msg);
    return body;
  }
  function error(e) {
    dialog.querySelector(".pay-msg").textContent = e.message;
  }
  function task(fn, b) {
    return async () => {
      if (locked) return;
      locked = true;
      if (b) b.disabled = true;
      try {
        await fn();
      } catch (e) {
        error(e);
      } finally {
        locked = false;
        if (b) b.disabled = false;
      }
    };
  }
  dialog.oncancel = (e) => {
    e.preventDefault();
    void dismiss();
  };
  dialog.addEventListener("click", (e) => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      void dismiss();
  });
  let swipe;
  dialog.addEventListener(
    "touchstart",
    (e) => {
      swipe = e.target.closest(".pay-top") ? e.touches[0].clientY : null;
    },
    { passive: true },
  );
  dialog.addEventListener(
    "touchend",
    (e) => {
      if (swipe != null && e.changedTouches[0].clientY - swipe > 60)
        void dismiss();
      swipe = null;
    },
    { passive: true },
  );
  dialog.onclose = () => {
    cleanup();
    generation++;
  };
  function showCart() {
    const b = layout(t("سلّتك", "Your cart"));
    for (const l of lines()) {
      const { line, qty, d, price, selected, note } = l;
      const row = el("section");
      row.className = "pay-row";
      if (d?.image) {
        const i = el("img");
        i.src = d.image;
        i.alt = "";
        row.append(i);
      }
      const info = el("div");
      info.append(
        el("strong", d ? name(d) : t("وجبة غير متوفرة", "Unavailable meal")),
        el("small", amount(price)),
        el("small", selected.map(localized).join(" · ")),
        el("small", note),
      );
      const controls = el("div");
      controls.className = "pay-controls";
      const change = (n) => {
        if (n <= 0) cart = cart.filter((i) => i.line !== line);
        else cart.find((i) => i.line === line).qty = Math.min(n, maxQty);
        save();
        if (!cart.length) {
          void dismiss();
          return;
        }
        showCart();
      };
      controls.append(
        button("−", () => change(qty - 1)),
        el("span", qty),
        button("+", () => change(qty + 1)),
        button(t("تعديل", "Edit"), () => add(d, l)),
        button(t("حذف", "Remove"), () => change(0)),
      );
      row.append(info, controls);
      b.append(row);
    }
    if (!count()) b.append(el("p", t("سلّتك فارغة", "Your cart is empty")));
    else {
      const next = button(
        t("متابعة", "Continue") + " · " + amount(total()),
        () => checkout(),
      );
      next.className = "pay-primary";
      next.disabled = closed() || lines().some((l) => !l.d?.available);
      b.append(next);
      if (next.disabled)
        b.append(
          el(
            "p",
            t("الطلب غير متاح حالياً", "Ordering is currently unavailable"),
          ),
        );
    }
    for (const ref of tracking)
      b.append(
        button(
          t("متابعة طلب", "Track order") + " #" + (ref.number || "…"),
          () => status(ref),
        ),
      );
  }
  function checkout() {
    const b = layout(t("تأكيد الطلب", "Confirm order")),
      f = el("form");
    b.append(f);
    for (const [k, label, type] of [
      ["customer", t("الاسم", "Name"), "text"],
      ["phone", t("رقم الجوال", "Phone"), "tel"],
      ["notes", t("ملاحظات (اختياري)", "Notes (optional)"), "textarea"],
    ]) {
      const input = el(type === "textarea" ? "textarea" : "input");
      if (type !== "textarea") input.type = type;
      input.required = k !== "notes";
      input.maxLength = k === "notes" ? 1000 : k === "phone" ? 25 : 100;
      if (k === "phone") input.pattern = "[+0-9 \\(\\)\\-]{7,25}";
      input.value = draft[k];
      input.oninput = () => (draft[k] = input.value);
      field(f, label, input);
    }
    for (const { d, qty, price, selected, note } of lines())
      f.append(
        el(
          "p",
          name(d) +
            " × " +
            qty +
            " · " +
            amount(price * qty) +
            [...selected.map(localized), note]
              .filter(Boolean)
              .map((s) => " · " + s)
              .join(""),
        ),
      );
    f.append(el("strong", t("الإجمالي", "Total") + " " + amount(total())));
    const next = el("button", t("متابعة لطريقة الدفع", "Continue to payment"));
    next.className = "pay-primary";
    f.append(next, button(t("رجوع", "Back"), showCart));
    f.onsubmit = (e) => {
      e.preventDefault();
      task(async () => {
        cfg = await call({ action: "config" });
        if (cfg.methods.length) {
          const q = await call({
            action: "quote",
            items: items(),
          });
          if (Number(q.total) !== total())
            throw Error(
              t(
                "تغيّر السعر. حدّث المنيو قبل التحويل.",
                "Refresh the menu before transferring.",
              ),
            );
        }
        payment();
      }, next)();
    };
  }
  function attach(b, formats) {
    const input = el("input");
    input.type = "file";
    input.accept = formats.join(",");
    field(
      b,
      t("إثبات الدفع · حتى 4 MB", "Payment receipt · up to 4 MB"),
      input,
    );
    const preview = el("div");
    b.append(preview);
    let url = "";
    function draw() {
      if (url) URL.revokeObjectURL(url);
      preview.replaceChildren();
      if (!proof) return;
      url = URL.createObjectURL(proof);
      const pdf = proof.type === "application/pdf",
        item = el(pdf ? "iframe" : "img");
      item.src = url;
      item.title = t("معاينة الوصل", "Receipt preview");
      if (pdf) item.setAttribute("sandbox", "");
      preview.append(el("small", proof.name), item);
    }
    cleanup = () => {
      if (url) URL.revokeObjectURL(url);
    };
    draw();
    input.onchange = () => {
      proof = input.files[0];
      if (proof && (proof.size > 4194304 || !formats.includes(proof.type))) {
        proof = null;
        input.value = "";
        error(
          Error(t("تحقق من نوع وحجم الملف", "Check the file type and size")),
        );
      }
      draw();
    };
  }
  function payment() {
    const b = layout(t("الدفع", "Payment"));
    b.append(
      el(
        "h3",
        t("المبلغ المطلوب تحويله", "Amount to transfer") +
          " " +
          amount(total()),
      ),
    );
    if (!cfg.methods.length) {
      b.append(
        el(
          "p",
          t(
            "لم يفعّل المطعم وسيلة دفع بعد. ستبقى اختياراتك محفوظة في السلة.",
            "Payment methods are not available yet. Your cart is saved.",
          ),
        ),
        button(t("رجوع", "Back"), checkout),
      );
      return;
    }
    if (!cfg.methods.some((m) => m.id === method)) method = cfg.methods[0].id;
    const methods = el("fieldset");
    methods.className = "pay-methods";
    methods.append(el("legend", t("طريقة الدفع", "Payment method")));
    for (const entry of cfg.methods) {
      const radio = el("input");
      radio.type = "radio";
      radio.name = "method";
      radio.checked = method === entry.id;
      radio.onchange = () => {
        method = entry.id;
        proof = null;
        payment();
      };
      const option = el("label");
      option.className = "pay-method-choice";
      const emblem = /^https:\/\//i.test(entry.icon || "") ? el("img") : el("span", entry.icon || "▣");
      if (emblem.tagName === "IMG") {
        emblem.src = entry.icon;
        emblem.alt = "";
        emblem.onerror = () => emblem.replaceWith(el("span", "▣"));
      }
      emblem.className = "pay-method-icon";
      option.append(radio, emblem, el("span", entry.name));
      methods.append(option);
    }
    b.append(methods);
    const m = cfg.methods.find((m) => m.id === method);
    if (/^https:\/\//i.test(m.qr_url || "")) {
      const qrBox = el("figure");
      qrBox.className = "pay-qr-box";
      const qr = el("img");
      qr.alt = "";
      qr.loading = "lazy";
      qr.className = "pay-qr";
      qr.onload = () => { qrBox.hidden = false; };
      qr.onerror = () => qrBox.remove(); // Never show a broken image or its alt text.
      qrBox.hidden = true;
      qr.src = m.qr_url;
      qrBox.append(qr, el("figcaption", t("امسح رمز QR للدفع", "Scan QR to pay")));
      b.append(qrBox);
    }
    b.append(
      el("strong", m.holder),
      el("code", m.account),
      button(
        t("نسخ الرقم", "Copy number"),
        task(() => navigator.clipboard.writeText(m.account)),
      ),
      el("p", m.instructions),
    );
    if (m.url) {
      const a = el("a", t("فتح رابط الدفع", "Open payment link"));
      a.href = m.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      b.append(a);
    }
    attach(b, cfg.formats);
    const submit = button(t("إرسال للمراجعة", "Submit for review"), null);
    submit.className = "pay-primary";
    submit.onclick = task(async () => {
      if (!proof)
        throw Error(t("ارفع وصل التحويل أولاً", "Choose a receipt first"));
      const payload = {
          ...draft,
          method,
          total: total(),
          items: items(),
        },
        fingerprint = JSON.stringify(payload);
      let ref = read("snounu-pending-request", null);
      if (ref?.fingerprint !== fingerprint) {
        ref = {
          id: crypto.randomUUID(),
          secret: Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
            n.toString(16).padStart(2, "0"),
          ).join(""),
          fingerprint,
        };
        localStorage.setItem("snounu-pending-request", JSON.stringify(ref));
      }
      const o = await call(
        { ...payload, id: ref.id, secret: ref.secret, action: "submit" },
        proof,
      );
      const saved = {
        id: ref.id,
        secret: ref.secret,
        number: o.number,
        status: o.status,
      };
      tracking = [saved, ...tracking.filter((r) => r.id !== ref.id)];
      localStorage.setItem("snounu-orders-v1", JSON.stringify(tracking));
      localStorage.removeItem("snounu-pending-request");
      cart = [];
      save();
      proof = null;
      draft = { customer: "", phone: "", notes: "" };
      announce(saved, o);
      await status(saved, o);
    }, submit);
    b.append(submit, button(t("رجوع", "Back"), checkout));
  }
  async function status(ref, initial) {
    const b = layout(t("متابعة الطلب", "Order status")),
      ticket = generation;
    b.textContent = t("جارٍ التحميل…", "Loading…");
    let current = "",
      socket,
      timer,
      heartbeat,
      busy = false;
    async function update(order) {
      if (busy) return;
      busy = true;
      try {
        const o = order || (await call({ ...ref, action: "status" }));
        if (ticket !== generation) return;
        if (current === o.status) return;
        const previousStatus = current;
        current = o.status;
        if (previousStatus && previousStatus !== o.status) announce(ref, o);
        ref.status = o.status;
        localStorage.setItem("snounu-orders-v1", JSON.stringify(tracking));
        b.replaceChildren();
        pulse(b);
        b.append(
          el("h3", t(...statuses[o.status])),
          el("strong", "#" + o.number + " · " + amount(o.total)),
          el("p", o.method + " · " + when(o.created_at)),
        );
        if (o.status === "pending") {
          b.append(
            el(
              "p",
              t(
                "تم استلام طلبك وإثبات الدفع بنجاح. سيقوم المطعم بمراجعة عملية الدفع، وسنخبرك عند الموافقة عليها.",
                "We received your order and receipt. Check here for the restaurant’s decision.",
              ),
            ),
          );
          if (o.cancellation)
            b.append(
              button(
                t("إلغاء الطلب", "Cancel order"),
                task(async () => {
                  if (
                    confirm(
                      t(
                        "إلغاء الطلب لا يعيد الحوالة البنكية أو دفعة المحفظة تلقائياً. هل تريد الإلغاء؟",
                        "Cancelling will not reverse the transfer. Cancel this order?",
                      ),
                    )
                  ) {
                    await call({ ...ref, action: "cancel" });
                    await update();
                  }
                }),
              ),
            );
        } else if (o.status === "approved") {
          b.append(
            el(
              "p",
              t(
                "تم التحقق من دفعتك والموافقة عليها. رقم طلبك:",
                "Your payment has been approved. Order",
              ) +
                " #" +
                o.number,
            ),
            button(t("عرض الفاتورة", "View invoice"), () => invoice(o)),
          );
        } else if (o.status === "rejected") {
          b.append(
            el("p", o.reason),
            button(
              t("إرسال إثبات جديد", "Submit new proof"),
              task(async () => {
                cfg = await call({ action: "config" });
                const panel = layout(t("تحديث إثبات الدفع", "Replace receipt"));
                proof = null;
                attach(panel, cfg.formats);
                panel.append(
                  button(
                    t("إرسال", "Submit"),
                    task(async () => {
                      if (!proof) throw Error(t("اختر ملفاً", "Select a file"));
                      await call({ ...ref, action: "replace" }, proof);
                      proof = null;
                      await status(ref);
                    }),
                  ),
                );
              }),
            ),
          );
        } else
          b.append(
            el(
              "p",
              t(
                "إلغاء الطلب لا يعيد مبلغ التحويل تلقائياً.",
                "Cancellation does not reverse your transfer.",
              ),
            ),
          );
        b.append(
          el(
            "small",
            t(
              "يمكنك متابعة الطلب من «طلباتي» على هذا المتصفح.",
              "Open My orders on this browser to track your order.",
            ),
          ),
          button(t("العودة للسلة", "Back to cart"), showCart),
        );
        if (o.live_updates && !socket && o.status === "pending") {
          socket = new WebSocket(
            endpoint.replace("https", "wss") +
              "/realtime/v1/websocket?apikey=" +
              key +
              "&vsn=1.0.0",
          );
          const topic = "realtime:payment-" + o.topic;
          socket.onopen = () => {
            socket.send(
              JSON.stringify({
                topic,
                event: "phx_join",
                payload: { config: { broadcast: { self: false } } },
                ref: "1",
              }),
            );
            heartbeat = setInterval(() => {
              if (socket.readyState === 1)
                socket.send(
                  JSON.stringify({
                    topic: "phoenix",
                    event: "heartbeat",
                    payload: {},
                    ref: "hb",
                  }),
                );
            }, 25000);
          };
          socket.onmessage = (e) => {
            try {
              if (JSON.parse(e.data).event === "broadcast") void update();
            } catch {}
          };
        }
      } catch (e) {
        if (ticket === generation) error(e);
      } finally {
        busy = false;
      }
    }
    const wake = () => {
      if (!document.hidden) void update();
    };
    timer = setInterval(wake, 12000);
    document.addEventListener("visibilitychange", wake);
    cleanup = () => {
      clearInterval(timer);
      clearInterval(heartbeat);
      socket?.close();
      document.removeEventListener("visibilitychange", wake);
    };
    await update(initial);
  }
  function announce(ref, order) {
    const note = button(t(...(statuses[order.status] || statuses.pending)) + " · #" + order.number, () => {
      note.remove();
      if (!dialog.open) dialog.showModal();
      void status(ref, order);
    });
    note.className = "pay-notification";
    note.setAttribute("aria-label", t("تحديث حالة طلبك", "Order status update"));
    note.title = t("اضغط لعرض تفاصيل الطلب", "View order details");
    document.body.append(note);
    setTimeout(() => note.remove(), 14000);
    refresh();
  }
  let checking = false;
  async function notifications() {
    if (checking || document.hidden || dialog.open) return;
    checking = true;
    try {
      for (const ref of tracking.filter(r => r.status === "pending").slice(0, 5)) {
        const o = await call({ ...ref, action: "status" });
        if (o.status === ref.status) continue;
        ref.status = o.status;
        localStorage.setItem("snounu-orders-v1", JSON.stringify(tracking));
        announce(ref, o);
      }
    } catch {
    } finally {
      checking = false;
    }
  }
  setInterval(notifications, 15000);
  document.addEventListener("visibilitychange", notifications);
  window.addEventListener("pagechange", refresh);
  window.addEventListener("storage", () => {
    cart = restore();
    tracking = read("snounu-orders-v1", []);
    refresh();
  });
  new MutationObserver(refresh).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
  call({ action: "config" })
    .then((c) => {
      maxQty = c.max_quantity || 99;
    })
    .catch(() => {});
  refresh();
  return {
    add,
    button(d) {
      const b = button(t("أضف إلى السلة", "Add to cart"), () => add(d));
      b.disabled = d.available === false || closed();
      b.className = "pay-primary";
      return b;
    },
  };
}
