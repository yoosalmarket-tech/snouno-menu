export const el = (tag, text) => {
  const e = document.createElement(tag);
  if (text != null) e.textContent = text;
  return e;
};
export const amount = (n) => Number(n).toFixed(2) + " ₪";
export const when = (s) =>
  new Date(s).toLocaleString(document.documentElement.lang, {
    timeZone: "Asia/Gaza",
  });
export const statuses = {
  pending: ["قيد مراجعة الدفع", "Payment under review"],
  approved: ["تم اعتماد الدفع بنجاح!", "Payment approved!"],
  rejected: ["لم يتم اعتماد الدفع", "Payment rejected"],
  cancelled: ["ملغي", "Cancelled"],
};
export function button(label, fn) {
  const b = el("button", label);
  b.type = "button";
  b.onclick = fn;
  return b;
}
export function field(parent, label, input) {
  const l = el("label", label);
  l.append(input);
  parent.append(l);
  return input;
}
export function invoice(o) {
  if (o.status !== "approved" || !o.invoice) return;
  const w = window.open("", "_blank");
  if (!w) return alert("يرجى السماح بفتح نافذة الفاتورة");
  w.opener = null;
  const doc = w.document,
    i = o.invoice;
  doc.documentElement.lang = "ar";
  doc.documentElement.dir = "rtl";
  doc.title = i.number;
  const style = doc.createElement("style");
  doc.head.append(style);
  const size = (s) =>
    (style.textContent =
      "@page{size:" +
      (s === "80mm" ? "auto" : "A4") +
      ";margin:5mm}*{box-sizing:border-box}body{font:15px/1.6 Tahoma,sans-serif;color:#171717;margin:8px auto;width:" +
      (s === "80mm" ? "70mm" : "min(95%,190mm)") +
      "}h1{border-bottom:4px solid #FDBE2D}table{width:100%;border-collapse:collapse}th,td{text-align:start;border-bottom:1px solid #aaa;padding:4px}img{max-width:30mm;max-height:20mm} @media print{nav{display:none}body{width:" +
      (s === "80mm" ? "70mm" : "auto") +
      "}tr{break-inside:avoid}}");
  size(i.paper);
  const root = doc.body,
    nav = el("nav"),
    select = el("select");
  for (const v of ["A4", "80mm"]) {
    const opt = el("option", v);
    opt.value = v;
    select.append(opt);
  }
  select.value = i.paper;
  select.onchange = () => size(select.value);
  nav.append(
    select,
    button("طباعة الفاتورة", () => w.print()),
  );
  root.append(nav);
  if (i.logo) {
    const img = el("img");
    img.alt = i.restaurant;
    img.src = new URL(i.logo, location.origin);
    root.append(img);
  }
  root.append(
    el("h1", i.restaurant),
    el("p", [i.address, i.phone].filter(Boolean).join(" · ")),
    el("h2", "فاتورة " + i.number),
    el("p", "طلب #" + o.number + " · " + when(o.approved_at)),
    el("p", o.customer + " · " + o.phone),
  );
  const table = el("table"),
    head = el("tr");
  for (const s of ["الطبق", "العدد", "سعر الوحدة", "الخصم", "المجموع"])
    head.append(el("th", s));
  table.append(head);
  for (const row of o.pay_items) {
    const tr = el("tr"),
      list = Math.max(Number(row.old_price || 0), Number(row.price));
    for (const v of [
      row.name,
      row.qty,
      amount(list),
      amount((list - row.price) * row.qty),
      amount(row.qty * row.price),
    ])
      tr.append(el("td", v));
    table.append(tr);
  }
  root.append(
    table,
    el("h2", "الإجمالي " + amount(o.total)),
    el("p", o.method + " · تم اعتماد الدفع"),
  );
  return w;
}
