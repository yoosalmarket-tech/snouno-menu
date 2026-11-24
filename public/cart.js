import {
  el,
  amount,
  when,
  statuses,
  button,
  field,
  invoice,
} from "./payment-ui.js?v=receipt-clean-20261122";
import {getReferralSource} from "./referral-source.js?v=referrals-1";
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
// One shared vertical-only dialog motion controller.
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export function openPayDialog(dialog, animate = true) {
  if (dialog.open || dialog.classList.contains("closing")) return;
  dialog.style.removeProperty("transform");
  dialog.showModal();
  if (!animate || reducedMotion()) return;
  const bounds = dialog.getBoundingClientRect();
  const bottomSheet = window.innerWidth <= 980;
  const startY = bottomSheet ? Math.max(72, window.innerHeight - bounds.top + 12) : 74;
  dialog.getAnimations().forEach(a => a.cancel());
  const entrance = dialog.animate(
    [{transform:`translateY(${startY}px)`},{transform:"translateY(0px)"}],
    {duration:400,easing:"cubic-bezier(.22,1,.36,1)"}
  );
  entrance.finished.catch(() => {});
}
export async function closePayDialog(dialog, animate = true) {
  if (!dialog.open || dialog.classList.contains("closing")) return;
  const useMotion = animate && !reducedMotion();
  const from = useMotion ? getComputedStyle(dialog).transform : "";
  dialog.getAnimations().forEach(a => a.cancel());
  dialog.classList.add("closing");
  dialog.inert = true;
  let exit;
  try {
    if (useMotion) {
      const bounds = dialog.getBoundingClientRect();
      // Include an existing finger-drag offset; the entire dialog must
      // finish below the viewport even if dismissal began mid-gesture.
      const currentY=(()=>{try{return from&&from!=="none"?new DOMMatrixReadOnly(from).m42:0;}catch{return 0;}})();
      const distance = Math.max(currentY+85,window.innerHeight - bounds.top + currentY + 36);
      exit = dialog.animate(
        [{transform:from==="none"?"translateY(0px)":from},
         {transform:`translateY(${distance}px)`}],
        {duration:305,easing:"cubic-bezier(.4,0,1,1)",fill:"forwards"}
      );
      await exit.finished.catch(() => {});
    }
  } finally {
    dialog.close();
    dialog.style.removeProperty("transform");
    exit?.cancel();
    dialog.inert = false;
    dialog.classList.remove("closing");
  }
}
// Header-only pointer dragging; form scroll and button presses are unaffected.
export function installPayDialogDrag(dialog){
 let gesture=null,settling=null,activePointer=null;
 const prefersReduce=()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 const deltaY=()=>{try{const m=getComputedStyle(dialog).transform;return m&&m!=="none"?new DOMMatrixReadOnly(m).m42:0;}catch{return 0;}};
 function reset(){gesture=null;activePointer=null;settling?.cancel();settling=null;dialog.classList.remove("pay-dragging");dialog.style.removeProperty("transform");}
 function down(event){
  if(event.button!==0||!dialog.open||dialog.inert||dialog.classList.contains("closing")||
    !document.body.classList.contains("rich-menu-active")||gesture)return;
  const target=event.target;
  if(target?.closest?.("button,a,input,textarea,select,label"))return;
  const top=target?.closest?.(".pay-top, .pay-drag-strip");
  const rect=dialog.getBoundingClientRect();
  const onHandle=event.clientY>=rect.top && event.clientY<=rect.top+33;
  if(!top&&!onHandle)return;
  const startOffset=deltaY();
  dialog.getAnimations().forEach(a=>a.cancel());
  gesture={id:event.pointerId,start:event.clientY,y:event.clientY,offset:startOffset,time:performance.now(),velocity:0};
  activePointer=event.pointerId;
  dialog.classList.add("pay-dragging");
  dialog.style.transform=`translateY(${startOffset}px)`;
  try{dialog.setPointerCapture(event.pointerId)}catch{}
 }
 function move(event){
  if(!gesture||event.pointerId!==gesture.id||!dialog.open)return;
  if(event.cancelable)event.preventDefault();
  const bounds=dialog.getBoundingClientRect();
  const maxUp=Math.min(145,Math.max(0,bounds.top-gesture.offset-12));
  const displacement=event.clientY-gesture.start;
  const next=Math.max(-maxUp,Math.min(window.innerHeight,gesture.offset+displacement));
  const elapsed=Math.max(1,performance.now()-gesture.time);
  gesture.velocity=(event.clientY-gesture.y)/elapsed;
  gesture.y=event.clientY;gesture.time=performance.now();
  dialog.style.transform=`translateY(${next}px)`;
 }
 async function finish(event,cancelled=false){
  if(!gesture||event.pointerId!==gesture.id)return;
  const y=deltaY(),velocity=gesture.velocity;
  gesture=null;
  try{if(dialog.hasPointerCapture(event.pointerId))dialog.releasePointerCapture(event.pointerId)}catch{}
  activePointer=null;
  dialog.classList.remove("pay-dragging");
  if(!dialog.open||dialog.classList.contains("closing")){dialog.style.removeProperty("transform");return;}
  if(!cancelled&&(y>Math.min(138,dialog.clientHeight*.23)||y>55&&velocity>.85)){
   await closePayDialog(dialog,true);
   return;
  }
  if(prefersReduce()){dialog.style.removeProperty("transform");return;}
  settling?.cancel();
  settling=dialog.animate(
   [{transform:`translateY(${y}px)`},{transform:"translateY(0px)"}],
   {duration:300,easing:"cubic-bezier(.22,1,.36,1)",fill:"forwards"}
  );
  try{await settling.finished;}catch{}
  if(dialog.open&&!dialog.classList.contains("closing"))dialog.style.removeProperty("transform");
  settling?.cancel();settling=null;
 }
 dialog.addEventListener("pointerdown",down);
 dialog.addEventListener("pointermove",move);
 dialog.addEventListener("pointerup",event=>void finish(event));
 dialog.addEventListener("pointercancel",event=>void finish(event,true));
 dialog.addEventListener("lostpointercapture",event=>{
  if(gesture?.id===event.pointerId)void finish(event,true);
 });
 dialog.addEventListener("close",reset);
 return reset;
}
export function installCart({ catalog, name, description, closed, page }) {
  const dialog = el("dialog");
  dialog.className = "pay-dialog";
  dialog.setAttribute("aria-label", t("السلة والطلبات", "Cart and orders"));
  const badge = button("", () => {
    if (count() === 0) {
      if (dialog.inert) return;
      modal();
      showHistory();
    } else open();
  });
  badge.className = "pay-footer";
  const history = button("", () => {
    openPayDialog(dialog, document.body.classList.contains("rich-menu-active"));
    showHistory();
  });
  history.className = "pay-orders-link";
  document.body.append(dialog, badge, history);
  installPayDialogDrag(dialog);
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
  let glowCleanupTimer=0;
  function celebrateFooter(){
 if(!motion()||!badge.classList.contains("visible")||
 !document.body.classList.contains("rich-menu-active"))return;
 if(!badge.querySelector(".pay-cart-icon"))return;
 clearTimeout(glowCleanupTimer);
 badge.classList.remove("pay-arrival-glow");
 // Only the yellow box responds to landing. The icon never moves or shines.
 void badge.offsetWidth;
 badge.classList.add("pay-arrival-glow");
 glowCleanupTimer=setTimeout(()=>badge.classList.remove("pay-arrival-glow"),1280);
}
  async function flyMealToCart(photo,origin,isNewFooter){
 if(!motion()||!document.body.classList.contains("rich-menu-active")||
 !photo?.complete||!photo.naturalWidth||!origin.width||!origin.height||document.hidden)return false;
 const layer=document.createElement("div");
 layer.className="pay-flight-layer";
 layer.setAttribute("popover","manual");
 const ghost=document.createElement("img");
 ghost.className="pay-flight-image";
 ghost.src=photo.currentSrc||photo.src;
 ghost.alt="";
 ghost.decoding="async";
 ghost.style.left=`${origin.left}px`;
 ghost.style.top=`${origin.top}px`;
 ghost.style.width=`${origin.width}px`;
 ghost.style.height=`${origin.height}px`;
 const style=getComputedStyle(photo);
 ghost.style.objectFit=style.objectFit;
 ghost.style.objectPosition=style.objectPosition;
 ghost.style.borderRadius=style.borderRadius;
 layer.append(ghost);
 document.body.append(layer);
 let flight=null,cancelled=false;
 const cancelFlight=()=>{cancelled=true;flight?.cancel();layer.remove();};
 const cancelOnHidden=()=>{if(document.hidden)cancelFlight();};
 const cancelOnModeChange=()=>{
  if(!document.body.classList.contains("rich-menu-active"))cancelFlight();
 };
 window.addEventListener("pagehide",cancelFlight);
 document.addEventListener("visibilitychange",cancelOnHidden);
 window.addEventListener("richmodechange",cancelOnModeChange);
 try{
  // Top-layer popovers remain visible above the closing modal dialog.
  try{
   if(typeof layer.showPopover==="function")layer.showPopover();
   else layer.removeAttribute("popover");
  }catch{layer.removeAttribute("popover");}
  // The image begins flying as the popup closes, rather than waiting
  // for the cart footer to finish its entrance.
  await new Promise(resolve=>setTimeout(resolve,32));
  if(cancelled||!layer.isConnected)return false;
  const icon=badge.querySelector(".pay-cart-icon");
  if(!icon||!badge.classList.contains("visible"))return false;
  const destination=icon.getBoundingClientRect();
  if(!destination.width||!destination.height)return false;
  const dx=destination.left+destination.width/2-(origin.left+origin.width/2);
  // Subtract the cart footer's current entrance translation to target
  // the icon's final resting coordinate, even on the first addition.
  let footerShiftY=0;
  try{
   const transform=getComputedStyle(badge).transform;
   if(transform&&transform!=="none")footerShiftY=new DOMMatrixReadOnly(transform).m42||0;
  }catch{}
  const dy=destination.top+destination.height/2-footerShiftY-(origin.top+origin.height/2);
  const finalScale=Math.min(.30,Math.max(.095,Math.min(destination.width/origin.width,destination.height/origin.height)));
  const arc=Math.min(96,Math.max(38,Math.abs(dx)*.17));
  flight=ghost.animate([
   {transform:"translate3d(0px,0px,0px) scale(1)",offset:0},
   {transform:`translate3d(${dx*.47}px,${dy*.44-arc}px,0px) scale(.7)`,offset:.47},
   {transform:`translate3d(${dx}px,${dy}px,0px) scale(${finalScale})`,offset:1}
  ],{duration:1200,easing:"cubic-bezier(.22,.68,.22,1)",fill:"forwards"});
  await flight.finished;
  if(cancelled)return false;
  celebrateFooter(); // Trigger only on actual arrival.
  return true;
 }catch{return false;}finally{
  window.removeEventListener("pagehide",cancelFlight);
  document.removeEventListener("visibilitychange",cancelOnHidden);
  window.removeEventListener("richmodechange",cancelOnModeChange);
  try{
   if(typeof layer.hidePopover==="function"&&layer.matches(":popover-open"))layer.hidePopover();
  }catch{}
  layer.remove();
 }
}
  function refresh() {
    const empty = count() === 0;
    const show = page() === "menu";
    badge.classList.toggle("pay-footer--orders-only", empty);
    badge.setAttribute("aria-label", empty ? t("طلباتي", "My orders") : t("عرض السلة", "View cart"));
    const cartIcon=el("span");
    cartIcon.className="pay-cart-icon";
    cartIcon.setAttribute("aria-hidden","true");
    const iconSvg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    iconSvg.setAttribute("viewBox","0 0 24 24");
    iconSvg.setAttribute("fill","none");
    iconSvg.setAttribute("stroke","currentColor");
    iconSvg.setAttribute("stroke-width","1.85");
    iconSvg.setAttribute("stroke-linecap","round");
    iconSvg.setAttribute("stroke-linejoin","round");
    iconSvg.innerHTML=empty
      ? '<path d="M8 3h9a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-4 2V7a4 4 0 0 1 4-4h1"/><path d="M9 9h7M9 13h5"/>'
      : '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.72a2 2 0 0 0 2-1.58L22 7H5"/>';
    cartIcon.append(iconSvg);
    if (empty) {
      badge.replaceChildren(cartIcon, el("strong", t("طلباتي", "My orders")));
    } else {
      const title=el("strong", t("عرض السلة", "View cart") + " · " + count());
      title.prepend(cartIcon);
      badge.replaceChildren(title, el("span", amount(total())));
    }
    // The same-sized basket / My Orders rail always reserves its footprint.
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
    history.hidden = true; // My Orders uses the empty-state button and the full cart dialog.
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
  }
  function modal() {
    openPayDialog(dialog, document.body.classList.contains("rich-menu-active"));
  }
  async function dismiss() {
    if (!locked) await closePayDialog(dialog, document.body.classList.contains("rich-menu-active"));
  }
  function add(d, existing) {
    if (dialog.inert || !d || d.available === false) return;
    const previous = document.getElementById("dish");
    if (previous?.open) previous.close();
    modal();
    const body = layout(name(d)),
      form = el("form");
    const photo = el("img");
    photo.className = "pay-meal-photo";
    photo.alt = name(d);
    photo.src = d.image || d.rich_image || "/assets/logo.webp";
    const photoStage=el("div");
    photoStage.className="pay-meal-photo-stage";
    photoStage.append(photo);
    body.append(
      photoStage,
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
      const rich=document.body.classList.contains("rich-menu-active");
      confirm.disabled=true;
      form.inert=true;
      save(); // Cart is saved before any visual animation runs.
      confirm.textContent=existing
        ?t("تم حفظ التعديل ✓","Changes saved ✓")
        :t("أُضيفت إلى السلة ✓","Added to cart ✓");
      if(existing){
        await closePayDialog(dialog,rich);
        modal();
        showCart(); // Preserve the existing edit-and-return flow.
        return;
      }
      // Only duplicate the original, transparent interactive-meal image.
      // The ordering popup and its yellow image background must close first.
      await closePayDialog(dialog,rich);
      if(rich){
        const selected=document.querySelector('#rich-menu .rm-dish[aria-selected="true"]');
        const original=selected?.dataset.mealId===String(d.id)
          ?selected.querySelector("img.rm-dish-photo"):null;
        // Verify that the visible carousel photo is the dedicated rich_image
        // asset, never the opaque d.image fallback or the popup thumbnail.
        let transparentSource=false;
        try{
          transparentSource=Boolean(d.rich_image&&original?.dataset.src&&
            new URL(d.rich_image,location.origin).href===original.dataset.src);
        }catch{}
        if(transparentSource && original.complete && original.naturalWidth){
          await flyMealToCart(original,original.getBoundingClientRect(),false);
        }
      }
    };
    draw();
  }
  // Native ordering controls for the regular menu's existing meal sheet.
  function inlineAdd(d) {
    const form=el("form");
    form.className="pay-inline-add";
    const chosen=new Set();
    let qty=1;
    for(const group of d.order_options||[]){
      const section=el("fieldset");
      section.append(el("legend",localized(group)+(group.required?" *":"")));
      for(const opt of group.choices||[]){
        const label=el("label");
        const input=el("input");
        input.type=group.multiple?"checkbox":"radio";
        input.name="inline-option-"+(d.order_options||[]).indexOf(group);
        input.value=opt.id;
        input.disabled=opt.available===false;
        input.onchange=()=>{
          if(!group.multiple)group.choices.forEach(o=>chosen.delete(o.id));
          if(input.checked)chosen.add(opt.id);else chosen.delete(opt.id);
          draw();
        };
        label.append(input,el("span",localized(opt)+(opt.price?" +"+amount(opt.price):"")));
        section.append(label);
      }
      if(!group.multiple&&!group.required){
        section.append(button(t("بدون","None"),()=>{
          section.querySelectorAll("input").forEach(i=>i.checked=false);
          group.choices.forEach(o=>chosen.delete(o.id));
          draw();
        }));
      }
      form.append(section);
    }
    const note=el("textarea");
    note.maxLength=300;
    note.placeholder=t("تعليمات خاصة (اختياري)","Special instructions (optional)");
    const noteLabel=el("label");
    noteLabel.append(el("span",t("تعليمات خاصة (اختياري)","Special instructions (optional)")),note);
    form.append(noteLabel);
    const controls=el("div");
    controls.className="pay-inline-controls";
    const minus=button("−",()=>{qty=Math.max(1,qty-1);draw();});
    const n=el("output",qty);
    n.className="pay-inline-qty";
    const plus=button("+",()=>{qty=Math.min(maxQty,qty+1);draw();});
    minus.setAttribute("aria-label",t("تقليل الكمية","Decrease quantity"));
    plus.setAttribute("aria-label",t("زيادة الكمية","Increase quantity"));
    controls.append(minus,n,plus);
    const confirm=el("button");
    confirm.type="submit";
    confirm.className="pay-primary";
    const feedback=el("output");
    feedback.className="pay-inline-feedback";
    feedback.setAttribute("role","status");
    form.append(controls,confirm,feedback);
    function draw(){
      n.textContent=qty;
      minus.disabled=qty<=1;
      plus.disabled=qty>=maxQty;
      confirm.textContent=t("أضف إلى السلة","Add to cart")+" · "+amount(qty*unit(d,[...chosen]).price);
    }
    form.onsubmit=e=>{
      e.preventDefault();
      feedback.textContent="";
      try{
        addDirect(d,qty,[...chosen],note.value.trim());
        feedback.textContent=t("أُضيفت إلى السلة ✓","Added to cart ✓");
        // Dismiss the regular meal sheet with its existing exit animation.
        // Adding never opens a second popup or the cart itself.
        const mealDialog=document.getElementById("dish");
        if(mealDialog?.open)document.getElementById("close")?.click();
      }catch(err){feedback.textContent=err.message;}
    };
    draw();
    return form;
  }
  function addDirect(d,qty=1,options=[],note=""){
    if(!d||d.available===false)throw Error(t("الطلب غير متاح حالياً","Ordering is currently unavailable"));
    const quantity=Number(qty);
    if(!Number.isInteger(quantity)||quantity<1||quantity>maxQty)
      throw Error(t("كمية غير صالحة","Invalid quantity"));
    const selected=[...options].sort();
    for(const group of d.order_options||[]){
      if(group.required&&!group.choices.some(o=>o.available!==false&&selected.includes(o.id)))
        throw Error(t("اختر من ","Choose from ")+localized(group));
    }
    const same=cart.find(l=>l.id===d.id&&JSON.stringify(l.options)===JSON.stringify(selected)&&l.note===note);
    if(same&&same.qty+quantity>maxQty)throw Error(t("تجاوزت حد الكمية","Quantity limit exceeded"));
    if(same)same.qty+=quantity;
    else cart.push({line:crypto.randomUUID(),id:d.id,qty:quantity,options:selected,note});
    save();
    return true;
  }
  function open() {
    if (dialog.inert) return;
    modal();
    showCart();
  }
  function showHistory() {
    const b = layout(t("طلباتي", "My orders"));
    const back=button(t("العودة إلى السلة", "Back to cart"),showCart);
    back.className="pay-cart-back";b.append(back);
    if(!tracking.length)b.append(el("p",t("لا توجد طلبات سابقة","No previous orders")));
    for (const ref of tracking)
      b.append(button("#" + (ref.number || "…") + " — " + t(...(statuses[ref.status] || statuses.pending)), () => status(ref)));
  }
  function layout(title) {
    dialog.classList.remove("pay-cart-view");
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
    const grab=el("div");
    grab.className="pay-drag-strip";
    grab.setAttribute("aria-hidden","true");
    grab.append(el("span"));
    dialog.append(grab,top);
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
    if (dialog.open) return;
    cleanup();
    generation++;
  };
  function showCart() {
    const b = layout(t("سلّتك", "Your cart"));
    dialog.classList.add("pay-cart-view");
    let nextButton = null;
    for (const l of lines()) {
      const { line, qty, d, price, selected, note } = l;
      const row = el("section");
      row.className = "pay-row";
      row.dataset.cartLine = line;
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
      const number = el("span", qty);
      number.className = "pay-cart-line-qty";
      number.setAttribute("aria-live", "polite");
      let removing = false;
      const change = async n => {
        if (removing) return;
        const current = cart.find(i => i.line === line);
        if (!current) return;
        if (n <= 0) {
          removing = true;
          row.inert = true;
          // Fade out the removed meal while its height collapses naturally.
          if (motion()) {
            const css = getComputedStyle(row);
            const height = row.getBoundingClientRect().height;
            row.style.overflow = "hidden";
            const fade = row.animate([
              {height:height+"px",opacity:1,transform:"translateY(0)",paddingTop:css.paddingTop,paddingBottom:css.paddingBottom,borderBottomWidth:css.borderBottomWidth},
              {height:"0px",opacity:0,transform:"translateY(-8px)",paddingTop:"0px",paddingBottom:"0px",borderBottomWidth:"0px"}
            ],{duration:300,easing:"cubic-bezier(.25,.8,.25,1)",fill:"forwards"});
            await fade.finished.catch(() => {});
          }
          const oldHeight = dialog.getBoundingClientRect().height;
          cart = cart.filter(i => i.line !== line);
          save();
          showCart(); // Display the empty basket rather than closing abruptly.
          const newHeight = dialog.getBoundingClientRect().height;
          if (dialog.open && motion() && Math.abs(newHeight-oldHeight)>2) {
            dialog.animate([{height:oldHeight+"px"},{height:newHeight+"px"}],
              {duration:270,easing:"cubic-bezier(.22,1,.36,1)"});
          }
          return;
        }
        current.qty = Math.min(n, maxQty);
        save();
        number.textContent = current.qty;
        plus.disabled = current.qty >= maxQty;
        // Do not rebuild/reanimate the modal on quantity-only edits.
        if (nextButton) nextButton.textContent = t("متابعة", "Continue") + " · " + amount(total());
      };
      const minus=button("−",()=>void change((cart.find(i=>i.line===line)?.qty||0)-1));
      const plus=button("+",()=>void change((cart.find(i=>i.line===line)?.qty||0)+1));
      minus.setAttribute("aria-label",t("تقليل الكمية","Decrease quantity"));
      plus.setAttribute("aria-label",t("زيادة الكمية","Increase quantity"));
      plus.disabled=qty>=maxQty;
      controls.append(
        minus,number,plus,
        button(t("تعديل", "Edit"), () => add(d, l)),
        button(t("حذف", "Remove"), () => void change(0)),
      );
      row.append(info, controls);
      b.append(row);
    }
    if (!count()) b.append(el("p", t("سلّتك فارغة", "Your cart is empty")));
    else {
      nextButton = button(
        t("متابعة", "Continue") + " · " + amount(total()),
        () => void beginCheckout(),
      );
      nextButton.className = "pay-primary";
      nextButton.disabled = lines().some((l) => !l.d?.available);
      b.append(nextButton);
      if (nextButton.disabled)
        b.append(el("p", closed() ? t("تقدر تحتفظ بسلتك، والدفع متاح عند الافتتاح.", "Keep your cart; checkout opens when the restaurant reopens.") : t("الطلب غير متاح حالياً", "Ordering is currently unavailable")));
    }
    const orders=button(t("طلباتي", "My orders")+(tracking.length?" · "+tracking.length:""),showHistory);
    orders.className="pay-cart-orders";
    orders.setAttribute("aria-label",t("عرض طلباتي السابقة","View my previous orders"));
    b.append(orders);
    // Old browser records may still say pending after the restaurant has finished an order.
    const ticket = generation;
    let shortcut, checkingBasket = false;
    const underReview = (order) => order.status === "pending" &&
      order.payment_mode !== "at_restaurant" &&
      (!order.fulfillment_status || order.fulfillment_status === "awaiting_approval");
    async function updateShortcut() {
      if (checkingBasket || document.hidden || generation !== ticket) return;
      checkingBasket = true;
      try {
        let latest;
        for (const ref of tracking.filter(underReview)) {
          const order = await call({ id: ref.id, secret: ref.secret, action: "status" }).catch(() => null);
          if (ticket !== generation) return;
          if (!order) continue;
          const current = tracking.find((r) => r.id === ref.id);
          if (!current) continue;
          if (current.status !== order.status || current.fulfillment_status !== order.fulfillment_status ||
              current.payment_mode !== order.payment_mode) {
            Object.assign(current, {status: order.status, fulfillment_status: order.fulfillment_status, payment_mode: order.payment_mode});
            localStorage.setItem("snounu-orders-v1", JSON.stringify(tracking));
            refresh();
          }
          if (underReview(order)) { latest = current; break; }
        }
        if (shortcut?.dataset.orderId === latest?.id) return;
        shortcut?.remove();
        shortcut = null;
        if (latest) {
          shortcut = button(t("متابعة طلب", "Track order") + " #" + latest.number, () => status(latest));
          shortcut.dataset.orderId = latest.id;
          b.append(shortcut);
        }
      } catch {
        shortcut?.remove();
        shortcut = null;
      } finally {
        checkingBasket = false;
      }
    }
    const timer = setInterval(updateShortcut, 15000);
    document.addEventListener("visibilitychange", updateShortcut);
    cleanup = () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", updateShortcut);
    };
    void updateShortcut();
  }
  async function submitOrder(receiptFile) {
      const payload = {
        ...draft,
        payment_mode: draft.payment_mode === "at_restaurant" ? "at_restaurant" : "online",
        arrival_eta_minutes: draft.payment_mode === "at_restaurant" ? draft.arrival_eta_minutes : null,
        method: draft.payment_mode === "at_restaurant" ? null : method,
        total: total(),
        items: items(),
        referral_source: getReferralSource(),
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
  let advanceCheckout=false;
  const openingText=value=>value?new Intl.DateTimeFormat(document.documentElement.lang==="en"?"en-GB":"ar-PS",{timeZone:"Asia/Gaza",weekday:"long",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"}).format(new Date(value)):"—";
  async function beginCheckout(){
    const b=layout(t("تأكيد الطلب","Confirm order"));
    b.append(el("p",t("جارٍ التحقق من توفر الطلب…","Checking ordering availability…")));
    const ticket=generation;
    try{
      const info=await call({action:"advance_info"});
      if(ticket!==generation)return;
      advanceCheckout=info.closed;
      if(!info.closed){checkout();return;}
      b.replaceChildren();
      if(!info.advance_allowed){
        b.append(el("p",t("الطلبات المسبقة غير متاحة حالياً. ستبقى وجباتك محفوظة في السلة.","Advance orders are unavailable. Your cart will stay saved.")),button(t("العودة للسلة","Back to cart"),showCart));return;
      }
      b.append(el("h3",t("اطلب قبل الافتتاح!","Order before opening!")),
        el("p",t("المطعم مغلق حالياً، لكن بتقدر تطلب وتحجز دورك من الآن.","The restaurant is closed, but you can order and reserve a place in line.")),
        el("strong",t("الافتتاح القادم: ","Next opening: ")+openingText(info.next_opening_at)),
        el("p",t("الطلبات الحالية في الانتظار: ","Current active orders: ")+Number(info.active_orders)),
        el("p",t("سيتم مراجعة دفعتك وتجهيز طلبك حسب دورك بعد افتتاح المطعم. لا يتم حجز الدور قبل إرسال إثبات الدفع.","Payment will be reviewed and preparation starts after opening. A place is reserved only after submitting proof.")));
      const proceed=button(t("متابعة الطلب والدفع","Continue to payment"),()=>{draft.payment_mode="online";draft.arrival_eta_minutes=null;checkout();});proceed.className="pay-primary";
      b.append(proceed,button(t("العودة للسلة","Back to cart"),showCart));
    }catch(e){if(ticket===generation){b.replaceChildren(el("p",t("تعذّر التحقق من توفر الطلب. حاول مرة أخرى قبل الدفع.","Unable to check ordering availability. Retry before paying.")),button(t("العودة للسلة","Back to cart"),showCart));}}
  }
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
    for(const [value,label] of payOptions.filter(([value])=>!advanceCheckout||value==="online")){
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
    if(!advanceCheckout)payPlace.append(el("small",t("عند الدفع في المطعم لا تحتاج رفع إثبات. لن يبدأ تجهيز الطلب حتى تؤكد الإدارة حضورك واستلام الدفع.",
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
        if(advanceCheckout&&!cfg.methods.length)throw Error(t("لا توجد طريقة دفع متاحة للطلب المسبق","No advance payment method is available"));
        if (cfg.methods.length) {
          const q = await call({
            action: "quote",
            payment_mode:draft.payment_mode,
            items: items(),
          });
          if(q.closed&&!advanceCheckout){await beginCheckout();return;}
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
        const nextKey=[o.status,o.fulfillment_status,o.arrived_at,o.report_open,o.queue_position,o.restaurant_closed,o.next_opening_at].join("|");
        if (current === nextKey) return;
        const previousStatus = current;
        current = nextKey;
        if (previousStatus && (ref.status!==o.status||ref.fulfillment_status!==o.fulfillment_status)) announce(ref, o);
        ref.status = o.status;
        ref.fulfillment_status = o.fulfillment_status;
        localStorage.setItem("snounu-orders-v1", JSON.stringify(tracking));
        refresh();
        b.replaceChildren();
        const stageTitle=o.advance_order&&o.status==="pending"&&o.queue_position!=null?t("حجزنا دورك!","Your place is reserved!")
          :o.fulfillment_status==="queued"?t("تم تأكيد الدفع · بانتظار دورك","Payment approved · Waiting in line")
          :o.fulfillment_status==="ready"?t("طلبك جاهز","Your order is ready")
          :o.fulfillment_status==="completed"
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
        if(o.queue_position!=null){
          b.append(el("h3",t("ترتيبك الحالي في قائمة الانتظار","Your current place in line")),el("strong","#"+Number(o.queue_position)),
            el("p",Number(o.orders_ahead)>0?t("في "+o.orders_ahead+" طلبات قبلك",o.orders_ahead+" orders ahead of you"):t("لا توجد طلبات قبلك","No orders ahead of you")));
          if(o.restaurant_closed&&o.next_opening_at)b.append(el("p",t("الافتتاح القادم: ","Next opening: ")+openingText(o.next_opening_at)));
          if(o.status==="pending")b.append(el("small",t("دورك محجوز مبدئياً، وسيتم تأكيده بعد مراجعة الدفعة.","Your place is provisional until payment is verified.")));
          else if(o.status==="approved"&&!o.restaurant_closed&&o.orders_ahead===0&&o.fulfillment_status==="queued")b.append(el("strong",t("صار دورك!","It is your turn!")));
        }
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
            : o.advance_order?t("وصل طلبك وإثبات الدفع. سيتم مراجعة دفعتك حسب دورك.","Your order and receipt are received. Payment is pending verification.")
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
              : o.fulfillment_status==="queued"?t("تم اعتماد دفعتك، والطلب بانتظار بدء التحضير.","Payment is approved; preparation has not started.")
              : o.fulfillment_status==="ready"?t("طلبك جاهز للاستلام أو التوصيل.","Your order is ready for pickup or delivery.")
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
  // Only one active order update is ever shown near the basket.
  // All earlier orders and their latest state remain in tracking / "طلباتي".
  let latestNotice = null, latestNoticeTimer = null;
  function clearLatestNotice() {
    if (latestNoticeTimer !== null) clearTimeout(latestNoticeTimer);
    latestNoticeTimer = null;
    latestNotice?.remove();
    latestNotice = null;
  }
  function announce(ref, order) {
    clearLatestNotice();
    const note = button(
      t(...(statuses[order.status] || statuses.pending)) + " · #" + order.number,
      () => {
        clearLatestNotice();
        if (!dialog.open) dialog.showModal();
        void status(ref, order);
      },
    );
    note.className = "pay-notification pay-notification--latest";
    note.setAttribute("aria-label", t("آخر تحديث لحالة الطلب", "Latest order update"));
    note.title = t("اضغط لعرض تفاصيل الطلب، وبقية الطلبات في طلباتي",
      "Tap for this order; earlier orders are in My Orders");
    latestNotice = note;
    document.body.append(note);
    latestNoticeTimer = setTimeout(() => {
      if (latestNotice === note) clearLatestNotice();
    }, 14000);
    refresh();
  }
  let checking = false;
  async function notifications() {
    if (checking || document.hidden || dialog.open) return;
    checking = true;
    let newestUpdate = null;
    try {
      // Tracking is newest-first. Show one popup for the newest changed order,
      // keeping all older changes accessible under طلباتي.
      for (const ref of tracking.filter(r => r.status === "pending" ||
        (r.status==="approved"&&r.fulfillment_status!=="completed")).slice(0, 5)) {
        const o = await call({ ...ref, action: "status" });
        if (o.status === ref.status && o.fulfillment_status === ref.fulfillment_status) continue;
        ref.status = o.status;
        ref.fulfillment_status = o.fulfillment_status;
        localStorage.setItem("snounu-orders-v1", JSON.stringify(tracking));
        refresh();
        if (!newestUpdate) newestUpdate = { ref, order: o };
      }
      if (newestUpdate) announce(newestUpdate.ref, newestUpdate.order);
    } catch {
    } finally {
      checking = false;
    }
  }
  setInterval(notifications, 15000);
  document.addEventListener("visibilitychange", notifications);
  window.addEventListener("pagechange", refresh);
  window.addEventListener("richmodechange", refresh);
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
    inlineAdd,
    button(d) {
      const b = button(t("أضف إلى السلة", "Add to cart"), () => add(d));
      b.disabled = d.available === false;
      b.className = "pay-primary";
      return b;
    },
  };
}
