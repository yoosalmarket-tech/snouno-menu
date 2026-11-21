import {
  el,
  amount,
  when,
  statuses,
  button,
  field,
  invoice,
} from "./payment-ui.js";
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
export function installCart({ catalog, name, closed, page }) {
  const dialog = el("dialog");
  dialog.className = "pay-dialog";
  dialog.setAttribute("aria-label", t("السلة والطلبات", "Cart and orders"));
  const badge = button("", () => open());
  badge.className = "pay-badge";
  document.body.append(dialog, badge);
  let cart = read("snounu-cart-v1", {}),
    tracking = read("snounu-orders-v1", []),
    cleanup = () => {},
    generation = 0,
    locked = false;
  let draft = { customer: "", phone: "", notes: "" },
    cfg,
    method = "",
    proof = null;
  const lines = () =>
    Object.entries(cart).map(([id, qty]) => ({
      id,
      qty,
      d: catalog().find((d) => d.id === id),
    }));
  const total = () =>
    lines().reduce(
      (v, { qty, d }) => v + qty * Math.round(100 * (d?.price || 0)),
      0,
    ) / 100;
  const count = () => lines().reduce((v, l) => v + l.qty, 0);
  function refresh() {
    badge.textContent = t("السلة", "Cart") + " · " + count();
    badge.hidden = page() !== "menu";
  }
  function save() {
    localStorage.setItem("snounu-cart-v1", JSON.stringify(cart));
    refresh();
  }
  function add(d) {
    if (!d || d.available === false || closed()) return;
    cart[d.id] = Math.min(99, (cart[d.id] || 0) + 1);
    save();
    open();
  }
  function open() {
    if (!dialog.open) dialog.showModal();
    showCart();
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
        if (!locked) dialog.close();
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
    if (locked) e.preventDefault();
  };
  dialog.onclose = () => {
    cleanup();
    generation++;
  };
  function showCart() {
    const b = layout(t("سلّتك", "Your cart"));
    for (const { id, qty, d } of lines()) {
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
        el("small", amount(d?.price || 0)),
      );
      const controls = el("div");
      controls.className = "pay-controls";
      const change = (n) => {
        if (n <= 0) delete cart[id];
        else cart[id] = Math.min(n, 99);
        save();
        showCart();
      };
      controls.append(
        button("−", () => change(qty - 1)),
        el("span", qty),
        button("+", () => change(qty + 1)),
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
    for (const { d, qty } of lines())
      f.append(el("p", name(d) + " × " + qty + " · " + amount(d.price * qty)));
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
            items: lines().map(({ id, qty, d }) => ({
              id,
              qty,
              price: d.price,
            })),
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
            "لم يفعّل المطعم الدفع المباشر بعد. يمكنك الطلب من روابط التوصيل في صفحة الوجبة.",
            "Direct payments are not open yet. Delivery links are available in meal details.",
          ),
        ),
        button(t("رجوع", "Back"), checkout),
      );
      return;
    }
    const select = el("select");
    for (const m of cfg.methods) {
      const o = el("option", m.icon + " " + m.name);
      o.value = m.id;
      select.append(o);
    }
    if (cfg.methods.some((m) => m.id === method)) select.value = method;
    method = select.value;
    field(b, t("طريقة الدفع", "Payment method"), select);
    select.onchange = () => {
      method = select.value;
      proof = null;
      payment();
    };
    const m = cfg.methods.find((m) => m.id === method);
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
          items: lines().map(({ id, qty, d }) => ({ id, qty, price: d.price })),
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
      cart = {};
      save();
      proof = null;
      draft = { customer: "", phone: "", notes: "" };
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
        current = o.status;
        ref.status = o.status;
        localStorage.setItem("snounu-orders-v1", JSON.stringify(tracking));
        b.replaceChildren();
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
              "يمكنك العودة من السلة على هذا المتصفح.",
              "Reopen your cart on this browser to track this order.",
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
  let checking = false;
  async function notifications() {
    if (checking || document.hidden || dialog.open) return;
    checking = true;
    try {
      for (const ref of tracking
        .filter((r) => r.status === "pending")
        .slice(0, 4)) {
        const o = await call({ ...ref, action: "status" });
        if (o.status === ref.status) continue;
        ref.status = o.status;
        localStorage.setItem("snounu-orders-v1", JSON.stringify(tracking));
        const note = button(t(...statuses[o.status]) + " #" + o.number, () => {
          note.remove();
          if (!dialog.open) dialog.showModal();
          void status(ref, o);
        });
        note.className = "pay-notification";
        note.setAttribute("role", "status");
        document.body.append(note);
      }
    } catch {
    } finally {
      checking = false;
    }
  }
  setInterval(notifications, 45000);
  document.addEventListener("visibilitychange", notifications);
  window.addEventListener("pagechange", refresh);
  window.addEventListener("storage", () => {
    cart = read("snounu-cart-v1", {});
    tracking = read("snounu-orders-v1", []);
    refresh();
  });
  new MutationObserver(refresh).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
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
