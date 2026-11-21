import {
  el,
  amount,
  when,
  statuses,
  button,
  field,
  invoice,
} from "./payment-ui.js?v=06";
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
  let draft = { customer: "", phone: "", notes: "", service_type: "", delivery_address: "", delivery_landmark: "", backup_phone: "", payment_mode: "online", arrival_eta_minutes: null },
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
  async function submitOrder(receiptFile) {
      const payload = {
        ...draft,
        payment_mode: draft.payment_mode === "at_restaurant" ? "at_restaurant" : "online",
        arrival_eta_minutes: draft.payment_mode === "at_restaurant" ? draft.arrival_eta_minutes : null,
        method: draft.payment_mode === "at_restaurant" ? null : method,
        total: total(),
        items: items(),
      };
      const fingerprint = JSON.stringify(payload);
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
      const o = await call({ ...payload, id: ref.id, secret: ref.secret, action: "submit" }, receiptFile);
      const saved = {
        id: ref.id, secret: ref.secret, number: o.number, status: o.status,
        fulfillment_status: o.fulfillment_status,
      };
      tracking = [saved, ...tracking.filter((r) => r.id !== ref.id)];
      localStorage.setItem("snounu-orders-v1", JSON.stringify(tracking));
      localStorage.removeItem("snounu-pending-request");
      cart = [];
      save();
      proof = null;
      draft = { customer: "", phone: "", notes: "", service_type: "", delivery_address: "",
        delivery_landmark: "", backup_phone: "", payment_mode: "online", arrival_eta_minutes: null };
      announce(saved, o);
      await status(saved, o);
  }
  let proofAttempts=0,proofWarning=null,proofHelp=null;
  function checkout() {
    const b = layout(t("تأكيد الطلب", "Confirm order")),
      f = el("form");
    b.append(f);
    const service = el("fieldset");
    service.className = "pay-service-choice";
    service.append(el("legend", t("كيف تريد استلام طلبك؟ *", "How would you like your meal? *")));
    const deliveryAddress = el("textarea");
    deliveryAddress.name = "delivery_address";
    deliveryAddress.maxLength = 500;
    deliveryAddress.minLength = 8;
    deliveryAddress.placeholder = t("المنطقة، الشارع، أقرب معلم، رقم المبنى", "Area, street, landmark and building");
    deliveryAddress.value = draft.delivery_address || "";
    deliveryAddress.oninput = () => { draft.delivery_address = deliveryAddress.value; };
    const addressLabel = el("label");
    addressLabel.className = "pay-delivery-address";
    addressLabel.append(el("strong", t("عنوان التوصيل *", "Delivery address *")), deliveryAddress,
      el("small", t("رسوم التوصيل الإضافية غير مشمولة، وسيؤكد المطعم توفر الخدمة والرسوم.",
        "Delivery fees are not included. The restaurant confirms availability and fees.")));
    const landmarkInput = el("input");
    landmarkInput.type = "text";
    landmarkInput.name = "delivery_landmark";
    landmarkInput.maxLength = 160;
    landmarkInput.minLength = 3;
    landmarkInput.placeholder = t("مثلاً: بجانب المدرسة أو المستشفى المعروف في المنطقة",
      "For example: beside a well-known school or hospital");
    landmarkInput.value = draft.delivery_landmark || "";
    landmarkInput.oninput = () => { draft.delivery_landmark = landmarkInput.value; };
    const landmarkLabel = el("label");
    landmarkLabel.className = "pay-delivery-address";
    landmarkLabel.append(
      el("strong", t("أقرب مبنى معروف أو معلم واضح *", "Nearby well-known building or landmark *")),
      landmarkInput,
      el("small", t("اذكر مكاناً يستطيع عامل التوصيل التعرف عليه بسهولة بالقرب من عنوانك.",
        "Name a recognizable building or landmark close to your address."))
    );
    const backupPhoneInput = el("input");
    backupPhoneInput.type = "tel";
    backupPhoneInput.name = "backup_phone";
    backupPhoneInput.autocomplete = "tel";
    backupPhoneInput.inputMode = "tel";
    backupPhoneInput.maxLength = 25;
    backupPhoneInput.pattern = "[+0-9 \\\\(\\\\)\\\\-]{7,25}";
    backupPhoneInput.placeholder = t("رقم بديل يمكن الاتصال به عند تعذر الوصول إليك",
      "Another number to call if we can't reach you");
    backupPhoneInput.value = draft.backup_phone || "";
    backupPhoneInput.oninput = () => { draft.backup_phone = backupPhoneInput.value; };
    const backupLabel = el("label");
    backupLabel.className = "pay-delivery-address";
    backupLabel.append(
      el("strong", t("رقم جوال احتياطي *", "Backup phone number *")),
      backupPhoneInput,
      el("small", t("أدخل رقماً مختلفاً عن رقم الجوال الأساسي.", "Must be different from the primary phone number."))
    );
    const payPlace = el("fieldset");
    payPlace.className = "pay-service-choice pay-arrival-payment";
    payPlace.append(el("legend", t("كيف تريد الدفع؟", "How would you like to pay?")));
    const payOptions = [
      ["online", t("الدفع الإلكتروني الآن", "Pay online now")],
      ["at_restaurant", t("الدفع عند الوصول إلى المطعم", "Pay at the restaurant")]
    ];
    const ETA_OPTIONS = [10,15,20,30,45,60,90,120];
    const arrivalLabel=el("label");
    arrivalLabel.className="pay-arrival-time";
    const arrivalHeading=el("strong",t("بعد كم دقيقة ستصل إلى المطعم؟ *",
      "How many minutes until you arrive? *"));
    const arrivalSelect=el("select");
    arrivalSelect.name="arrival_eta_minutes";
    arrivalSelect.setAttribute("aria-label",t("الوقت المتوقع للوصول إلى المطعم",
      "Estimated time to arrive at the restaurant"));
    const placeholder=el("option",t("اختر مدة الوصول","Choose arrival time"));
    placeholder.value="";
    arrivalSelect.append(placeholder);
    for(const minutes of ETA_OPTIONS){
      const option=el("option",t("خلال "+minutes+" دقيقة","In "+minutes+" minutes"));
      option.value=String(minutes);
      arrivalSelect.append(option);
    }
    arrivalSelect.value=draft.arrival_eta_minutes==null?"":String(draft.arrival_eta_minutes);
    arrivalSelect.onchange=()=>{
      draft.arrival_eta_minutes=arrivalSelect.value?Number(arrivalSelect.value):null;
    };
    arrivalLabel.append(arrivalHeading,arrivalSelect,
      el("small",t("موعد وصول تقريبي وليس وقت تجهيز الوجبة. تجهيز الطلب يبدأ بعد تأكيد وصولك والدفع.",
        "This is an estimated arrival, not a meal preparation time. Preparation starts after your arrival and payment are confirmed.")));
    for(const [value,label] of payOptions){
      const line=el("label");
      const radio=el("input");radio.type="radio";radio.name="payment_mode";radio.value=value;
      radio.checked=(draft.payment_mode||"online")===value;
      radio.onchange=()=>{
        draft.payment_mode=value;
        if(value!=="at_restaurant"){draft.arrival_eta_minutes=null;arrivalSelect.value="";}
        arrivalLabel.hidden=value!=="at_restaurant";
        arrivalSelect.required=value==="at_restaurant";
        next.textContent=value==="at_restaurant"?
          t("تأكيد طلب الحضور","Place dine-in order"):
          t("متابعة لطريقة الدفع","Continue to payment");
      };
      line.append(radio,el("span",label));payPlace.append(line);
    }
    payPlace.append(arrivalLabel);
    payPlace.append(el("small",t("عند الدفع في المطعم لا تحتاج رفع إثبات. لن يبدأ تجهيز الطلب حتى تؤكد الإدارة حضورك واستلام الدفع.",
      "No payment proof required on arrival. Preparation starts after the restaurant confirms your arrival and payment.")));
    function updateService(type) {
      draft.service_type = type;
      if(type!=="dine_in"){
        draft.payment_mode="online";
        draft.arrival_eta_minutes=null;
        arrivalSelect.value="";
      }
      payPlace.hidden=type!=="dine_in";
      const needsEta=type==="dine_in"&&draft.payment_mode==="at_restaurant";
      arrivalLabel.hidden=!needsEta;
      arrivalSelect.required=needsEta;
      const currentNext=f.querySelector("button.pay-primary");
      if(currentNext)currentNext.textContent=needsEta?
        t("تأكيد طلب الحضور","Place dine-in order"):
        t("متابعة لطريقة الدفع","Continue to payment");
      for(const radio of payPlace.querySelectorAll("input[type=radio]"))radio.checked=radio.value===(draft.payment_mode||"online");
      addressLabel.hidden = type !== "delivery";
      deliveryAddress.required = type === "delivery";
      landmarkLabel.hidden = type !== "delivery";
      landmarkInput.required = type === "delivery";
      backupLabel.hidden = type !== "delivery";
      backupPhoneInput.required = type === "delivery";
      for (const radio of service.querySelectorAll("input[type=radio]")) radio.checked = radio.value === type;
    }
    for (const [value, ar, en] of [
      ["dine_in", "سآتي لتناول الطعام في المطعم", "I'll eat at the restaurant"],
      ["delivery", "أريد توصيل الطلب", "I want delivery"]
    ]) {
      const label = el("label");
      const radio = el("input");
      radio.type = "radio"; radio.name = "service_type"; radio.value = value; radio.required = true;
      radio.checked = draft.service_type === value;
      radio.onchange = () => updateService(value);
      label.append(radio, el("span", t(ar,en)));
      service.append(label);
    }
    service.append(addressLabel, landmarkLabel, backupLabel);
    f.append(service,payPlace);
    updateService(draft.service_type);
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
    if(draft.service_type==="dine_in"&&draft.payment_mode==="at_restaurant")
      next.textContent=t("تأكيد طلب الحضور","Place dine-in order");
    f.onsubmit = (e) => {
      e.preventDefault();
      if (!["dine_in","delivery"].includes(draft.service_type)) {
        service.querySelector("input[type=radio]").focus();
        error(Error(t("اختر تناول الطعام في المطعم أو التوصيل أولاً", "Choose dine-in or delivery")));
        return;
      }
      if(draft.service_type==="dine_in"&&draft.payment_mode==="at_restaurant" &&
        !ETA_OPTIONS.includes(Number(draft.arrival_eta_minutes))){
        arrivalSelect.focus();
        error(Error(t("اختر المدة المتوقعة لوصولك قبل تأكيد الطلب.",
          "Select how many minutes you need to reach the restaurant.")));
        return;
      }
      if (draft.service_type === "delivery") {
        if (draft.delivery_address.trim().length < 8) {
          deliveryAddress.focus();
          error(Error(t("اكتب عنوان التوصيل بالتفصيل (8 أحرف على الأقل)", "Enter a full delivery address (at least 8 characters)")));
          return;
        }
        if (draft.delivery_landmark.trim().length < 3) {
          landmarkInput.focus();
          error(Error(t("اكتب اسم مبنى معروف أو معلم قريب من العنوان", "Enter a nearby recognizable building or landmark")));
          return;
        }
        const secondaryDigits = draft.backup_phone.replace(/\D/g, "");
        if (!/^\+?[\d ()-]{7,25}$/.test(draft.backup_phone.trim()) || secondaryDigits.length < 7 || secondaryDigits.length > 15) {
          backupPhoneInput.focus();
          error(Error(t("أدخل رقم جوال احتياطي صحيحاً", "Enter a valid backup phone number")));
          return;
        }
        if (secondaryDigits === draft.phone.replace(/\D/g, "")) {
          backupPhoneInput.focus();
          error(Error(t("يجب أن يختلف رقم الجوال الاحتياطي عن الرقم الأساسي", "Backup phone must differ from the primary phone")));
          return;
        }
      }
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
        if(draft.service_type==="dine_in"&&draft.payment_mode==="at_restaurant")
          await submitOrder(null);
        else payment();
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
    proofWarning=el("small");
    proofWarning.className="pay-proof-error";
    proofWarning.hidden=true;
    proofHelp=el("a",t("تواجه مشكلة في اعتماد الدفع؟ اتصل بالمطعم",
      "Trouble confirming payment? Call the restaurant"));
    proofHelp.className="pay-proof-support";
    proofHelp.href="tel:"+encodeURIComponent(String(cfg?.hotline||"#889").trim());
    proofHelp.hidden=true;
    proofHelp.setAttribute("aria-label",t("الاتصال بخدمة المطعم على "+(cfg?.hotline||"#889"),
      "Call restaurant support at "+(cfg?.hotline||"#889")));
    input.parentNode.append(proofWarning,proofHelp);
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
      if(proof){proofAttempts=0;if(proofWarning)proofWarning.hidden=true;if(proofHelp)proofHelp.hidden=true;}
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
    b.append(el("p", draft.service_type === "delivery"
      ? t("طلب توصيل", "Delivery order") + " · " + draft.delivery_address.trim()
      : t("تناول الطعام في المطعم", "Dine in at the restaurant")));
    if (draft.service_type === "delivery") {
      b.append(el("p", t("أقرب معلم: ", "Nearby landmark: ") + draft.delivery_landmark.trim()));
      b.append(el("p", t("رقم احتياطي: ", "Backup phone: ") + draft.backup_phone.trim()));
    }
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
      const validPng = /^https:\/\/\S+\.png(?:\?\S*)?$/i.test(entry.icon || "");
      const emblem = validPng ? el("img") : el("span");
      emblem.className = "pay-method-icon";
      if (validPng) {
        emblem.src = entry.icon;
        emblem.alt = "";
        emblem.onerror = () => {
          const fallback = el("span");
          fallback.className = "pay-method-icon pay-method-placeholder";
          emblem.replaceWith(fallback);
        };
      } else {
        emblem.classList.add("pay-method-placeholder");
        emblem.setAttribute("aria-hidden", "true");
      }
      option.append(radio, emblem, el("span", entry.name));
      methods.append(option);
    }
    b.append(methods);
    const m = cfg.methods.find((m) => m.id === method);
    // Only render actual images uploaded for this payment method.
    // Never lazy-load an image inside a hidden container: Safari and Chromium
    // can defer that request forever, so an onload-controlled parent stays hidden.
    const qrLink = String(m.qr_url || "").trim();
    const qrUrl = (() => {
      try {
        const u = new URL(qrLink);
        if (u.protocol !== "https:" ||
            !/^\/storage\/v1\/object\/public\/menu-images\/payment-qr\/[\w-]+\.(?:png|jpg|jpeg|webp)$/i.test(u.pathname))
          return null;
        return u;
      } catch { return null; }
    })();
    if (qrUrl) {
      const qrBox = el("figure");
      qrBox.className = "pay-qr-box";
      const caption = el("figcaption", t("امسح QR لإتمام التحويل", "Scan the QR code to pay"));
      const qr = el("img");
      qr.className = "pay-qr";
      qr.alt = t("رمز QR الخاص بطريقة الدفع المحددة", "QR for selected payment method");
      qr.loading = "eager";
      qr.decoding = "async";
      const state = el("small", t("جارٍ تحميل رمز QR…", "Loading QR code…"));
      state.className = "pay-qr-state";
      qr.onload = () => {
        state.remove();
        qrBox.classList.add("pay-qr-ready");
      };
      qr.onerror = () => {
        qr.remove();
        state.textContent = t(
          "تعذر عرض صورة QR حالياً. يمكنك محاولة تنزيلها أو استخدام رقم الحساب.",
          "QR preview unavailable. Try downloading it or use the account number."
        );
        qrBox.classList.add("pay-qr-error");
      };
      const fileName = "snounu-payment-qr." +
        (qrUrl.pathname.toLowerCase().endsWith(".png") ? "png" :
        qrUrl.pathname.toLowerCase().endsWith(".webp") ? "webp" : "jpg");
      const download = new URL(qrUrl.href);
      // Supabase Storage returns Content-Disposition: attachment for this query.
      // A normal anchor is reliable on mobile Safari, where a fetch/Blob click
      // after an await may lose its user activation.
      download.searchParams.set("download", fileName);
      const link = el("a", t("تنزيل صورة QR", "Download QR image"));
      link.className = "pay-download-qr pay-qr-download";
      link.href = download.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.download = fileName;
      link.setAttribute("aria-label", t("تنزيل رمز QR لهذه المحفظة أو طريقة الدفع", "Download this payment method's QR code"));
      qr.src = qrUrl.href;
      qrBox.append(caption, qr, state, link);
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
      if (!proof) {
        proofAttempts++;
        if(proofWarning){
          proofWarning.hidden=false;
          proofWarning.textContent=t("يرجى رفع صورة أو PDF لإثبات التحويل قبل إرسال طلبك.",
            "Upload a payment receipt (photo or PDF) before submitting.");
          proofWarning.setAttribute("role","alert");
          proofWarning.scrollIntoView({block:"nearest",behavior:"smooth"});
        }
        if(proofAttempts>=2 && proofHelp)proofHelp.hidden=false;
        return;
      }
      await submitOrder(proof);
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
        const nextKey=[o.status,o.fulfillment_status,o.arrived_at,o.report_open].join("|");
        if (current === nextKey) return;
        const previousStatus = current;
        current = nextKey;
        if (previousStatus && previousStatus !== nextKey) announce(ref, o);
        ref.status = o.status;
        ref.fulfillment_status = o.fulfillment_status;
        localStorage.setItem("snounu-orders-v1", JSON.stringify(tracking));
        refresh();
        b.replaceChildren();
        pulse(b);
        const stageTitle=o.fulfillment_status==="completed"
          ? t("تم تسليم طلبك","Order marked delivered")
          : o.payment_mode==="at_restaurant"&&o.status==="pending"
          ? o.arrived_at?t("تم تأكيد وصولك","Arrival confirmed"):t("طلبك ينتظر حضورك","Awaiting your arrival")
          : o.status==="approved"&&o.fulfillment_status==="awaiting_visit"
          ? t("التحضير يبدأ عند حضورك","We start when you visit")
          : o.status==="approved"?t("تم اعتماد الدفع · الطلب قيد التنفيذ","Payment approved · Order in progress")
          : t(...statuses[o.status]);
        b.append(
          el("h3",stageTitle),
          el("strong", "#" + o.number + " · " + amount(o.total)),
          el("p", o.method + " · " + when(o.created_at)),
        );
        if (o.service_type === "delivery") {
          b.append(el("p", t("توصيل إلى: ", "Delivery to: ") + (o.delivery_address || "—")));
          if (o.delivery_landmark) b.append(el("p", t("أقرب معلم: ", "Nearby landmark: ") + o.delivery_landmark));
          if (o.backup_phone) b.append(el("p", t("رقم احتياطي: ", "Backup phone: ") + o.backup_phone));
        }
        else if (o.service_type === "dine_in"){
          b.append(el("p", t("تناول الطعام في المطعم", "Dine in at the restaurant")));
          if(o.payment_mode==="at_restaurant"&&o.arrival_eta_minutes){
            b.append(el("p",t("المدة التي اخترتها للوصول: ","Your chosen arrival time: ")+
              o.arrival_eta_minutes+t(" دقيقة"," minutes")));
            if(o.expected_arrival_at)b.append(el("p",
              t("موعد الوصول التقريبي: ","Estimated arrival: ")+
              new Intl.DateTimeFormat(document.documentElement.lang==="en"?"en-GB":"ar-PS",{
                timeZone:"Asia/Hebron",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"
              }).format(new Date(o.expected_arrival_at))));
            if(!o.arrived_at)b.append(el("small",t(
              "هذا تقديرك أنت للوصول وليس موعداً مضموناً لجهوزية الوجبة.",
              "This is your arrival estimate, not a promised meal-ready time.")));
          }
        }
        if (o.status === "pending") {
          b.append(el("p",o.payment_mode==="at_restaurant"
            ? o.arrived_at
              ? t("تأكد المطعم من حضورك. بمجرد تسجيل استلام الدفع يبدأ تجهيز وجبتك.",
                "Your arrival is confirmed. Preparation begins after the restaurant records payment.")
              : t("تم تسجيل طلبك دون دفع مسبق. سيبدأ المطعم تجهيز وجبتك بعد حضورك والدفع.",
                "Your order is registered with no advance payment. Preparation begins when you arrive and pay.")
            : t("وصل طلبك وإثبات الدفع. إدارة المطعم تراجع التحويل الآن، وستظهر النتيجة هنا.",
              "We have your order and receipt. The restaurant is reviewing the payment.")));
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
            el("p",o.fulfillment_status==="completed"
              ? o.service_type==="delivery"
                ? t("أشارت إدارة المطعم إلى تسليم الطلب. إن لم تستلمه بالفعل، أبلغنا فوراً.",
                  "The restaurant marked this order delivered. If you did not receive it, report a problem.")
                : t("أشارت إدارة المطعم إلى تسليم وجبتك. إن لم تستلمها، أبلغنا فوراً.",
                  "The restaurant marked the meal handed over. Report a problem if you did not receive it.")
              : o.fulfillment_status==="awaiting_visit"
                ? t("تم اعتماد دفعتك. سيبدأ إعداد الوجبة بعد حضورك إلى المطعم وتأكيد وصولك.",
                  "Your payment is approved. Preparation starts when you arrive.")
                : t("تم اعتماد دفعتك. الطلب قيد التنفيذ ولم يُسجّل كتسليم بعد.",
                  "Your payment is approved. The order is in progress and has not been marked delivered.")),
            button(t("عرض الفاتورة","View invoice"),()=>invoice(o)),
          );
          const issue=el("section");
          issue.className="pay-order-issue";
          if(o.report_open){
            issue.append(el("p",t("بلاغك قيد متابعة إدارة المطعم.",
              "Your issue has been sent to the restaurant.")));
          }else{
            const reveal=button(t("لم تستلم طلبك؟ بلّغ عن مشكلة","Haven't received it? Report a problem"),()=>{
              reveal.remove();
              const form=el("form");
              form.className="pay-issue-form";
              const kind=el("select");
              for(const [value,label] of [
                ["not_received",t("لم أستلم طلبي","Order not received")],
                ["incorrect_order",t("وصلني طلب غير صحيح","Wrong order received")],
                ["other",t("مشكلة أخرى","Other issue")]
              ]){
                const option=el("option",label);option.value=value;kind.append(option);
              }
              const details=el("textarea");
              details.placeholder=t("اشرح المشكلة لإدارة المطعم (5 أحرف على الأقل)",
                "Describe the issue for the restaurant (at least 5 characters)");
              details.minLength=5;details.maxLength=500;details.required=true;
              field(form,t("نوع المشكلة","Issue type"),kind);
              field(form,t("رسالة لإدارة المطعم","Message to restaurant"),details);
              const send=el("button",t("إرسال البلاغ للإدارة","Send report"));
              send.type="submit";send.className="pay-primary";
              const message=el("small");message.setAttribute("role","status");
              form.append(send,message);
              form.onsubmit=async event=>{
                event.preventDefault();
                send.disabled=true;
                try {
                  await call({...ref,action:"report",category:kind.value,message:details.value.trim()});
                  message.textContent=t("تم إرسال البلاغ بنجاح. ستتم مراجعته.",
                    "Your report was sent to the restaurant.");
                  form.remove();
                  await update();
                }catch(err){message.textContent=err.message;send.disabled=false;}
              };
              issue.append(form);
            });
            issue.append(reveal);
          }
          const phone=el("a",t("اتصل بالمطعم: "+(o.hotline||"#889"),
            "Call restaurant: "+(o.hotline||"#889")));
          phone.href="tel:"+encodeURIComponent(String(o.hotline||"#889").trim());
          phone.className="pay-call-support";
          issue.append(phone);
          b.append(issue);
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
        if (o.live_updates && !socket &&
           (o.status==="pending" || (o.status==="approved"&&o.fulfillment_status!=="completed"))) {
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
      for (const ref of tracking.filter(r => r.status === "pending" ||
        (r.status==="approved"&&r.fulfillment_status!=="completed")).slice(0, 5)) {
        const o = await call({ ...ref, action: "status" });
        if (o.status === ref.status && o.fulfillment_status === ref.fulfillment_status) continue;
        ref.status = o.status;
        ref.fulfillment_status = o.fulfillment_status;
        localStorage.setItem("snounu-orders-v1", JSON.stringify(tracking));
        refresh();
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
