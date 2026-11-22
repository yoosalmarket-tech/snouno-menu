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
  pending: ["قيد المراجعة", "Payment under review"],
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
  if(o.status!=="approved"||!o.invoice)return;
  const w=window.open("","_blank");
  if(!w){alert("يرجى السماح بفتح نافذة الإيصال");return;}
  w.opener=null;
  const doc=w.document, snap=o.invoice;
  const make=(tag,text,cls)=>{
    const e=doc.createElement(tag);
    if(text!==undefined&&text!==null)e.textContent=String(text);
    if(cls)e.className=cls;
    return e;
  };
  const money=n=>(Number(n)||0).toLocaleString("ar-PS",{minimumFractionDigits:2,maximumFractionDigits:2})+" ₪";
  const date=s=>s?new Date(s).toLocaleString("ar-PS",{timeZone:"Asia/Gaza",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}):"—";
  doc.documentElement.lang="ar";
  doc.documentElement.dir="rtl";
  doc.title="إيصال سنونو — "+(snap.number||o.number);
  const viewport=make("meta");viewport.name="viewport";viewport.content="width=device-width,initial-scale=1";
  const fontRegular=new URL("/assets/plex-arabic.woff",location.origin).href;
  const fontBold=new URL("/assets/qatar-bold.woff",location.origin).href;
  const css=make("style");
  css.textContent=[
    "@font-face{font-family:Receipt;src:url(",JSON.stringify(fontRegular),") format(woff);font-weight:400;font-display:swap}",
    "@font-face{font-family:Receipt;src:url(",JSON.stringify(fontBold),") format(woff);font-weight:700;font-display:swap}",
    "*{box-sizing:border-box}html{background:#f1f1ed}body{margin:0;font:12px/1.6 Receipt,Tahoma,Arial,sans-serif;color:#212121}",
    ".tools{width:min(94%,440px);margin:15px auto;display:flex;align-items:center;justify-content:space-between;gap:8px}",
    ".tools small{color:#665f56}.tools .buttons{display:flex;gap:8px}",
    ".tools button{border:1px solid #ddd;border-radius:10px;padding:9px 12px;background:white;font:700 12px Receipt,Tahoma;cursor:pointer}",
    ".tools .primary{background:#FDBE2D;border-color:#FDBE2D}",
    ".receipt{width:80mm;max-width:100%;margin:14px auto 25px;padding:5mm 4mm 6mm;background:#fff;border-top:4px solid #FDBE2D;box-shadow:0 12px 28px #00000016}",
    ".brand{text-align:center;padding-bottom:12px;border-bottom:1px dashed #aaa}",
    ".brand img{display:block;max-width:25mm;max-height:17mm;object-fit:contain;margin:0 auto 6px}",
    ".brand h1{margin:0;font-size:19px;line-height:1.3}.brand p{color:#666;font-size:10px;margin:6px 0 0;overflow-wrap:anywhere}",
    ".heading{text-align:center;padding:10px 0}.heading h2{font-size:16px;margin:0}",
    ".heading small{font-size:10px;direction:ltr;display:block;color:#666}",
    ".info{border-top:1px dashed #aaa;border-bottom:1px dashed #aaa;padding:8px 0}",
    ".pair{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin:4px 0;font-size:11px}",
    ".pair .key{color:#666;flex:0 0 33%}.pair .value{flex:1;text-align:left;overflow-wrap:anywhere;white-space:pre-wrap}.pair .value.ltr{direction:ltr;unicode-bidi:isolate}",
    ".section-title{margin:12px 0 5px;font-size:12px}",
    ".items{border-collapse:collapse;width:100%;table-layout:fixed;font-size:11px}",
    ".items th{font-size:10px;text-align:right;border-bottom:1px solid #999;color:#666;padding:5px 2px}",
    ".items td{border-bottom:1px dashed #bbb;padding:9px 2px;vertical-align:top;overflow-wrap:anywhere}",
    ".items th:nth-child(2),.items td:nth-child(2){width:12%;text-align:center}",
    ".items th:nth-child(3),.items td:nth-child(3){width:30%;text-align:left;direction:ltr;white-space:nowrap}",
    ".item-name{display:block;font-weight:700}.extras,.unit{display:block;color:#666;font-size:10px;margin-top:3px;white-space:pre-wrap}",
    ".total{display:flex;align-items:center;justify-content:space-between;border-top:2px solid #222;margin-top:11px;padding-top:10px;font-weight:700}",
    ".total strong{font-size:18px;direction:ltr;white-space:nowrap}",
    ".status{text-align:center;border:1px dashed #aaa;font-size:10px;padding:7px;margin-top:11px}",
    ".note{font-size:10px;white-space:pre-wrap;overflow-wrap:anywhere;margin:12px 0}",
    ".footer{text-align:center;border-top:1px dashed #aaa;padding-top:11px;margin-top:16px}",
    ".footer strong{font-size:12px;display:block}.footer small{font-size:10px;display:block}.footer .stamp{font-size:9px;color:#777;direction:ltr;margin-top:6px}",
    "@page{size:auto;margin:0}",
    "@media print{html,body{width:80mm!important;max-width:80mm!important;margin:0!important;background:#fff!important}",
    ".tools{display:none!important}.receipt{width:80mm!important;max-width:80mm!important;margin:0!important;padding:4mm 4mm 5mm!important;box-shadow:none!important;border-top:2px solid #222!important}",
    ".items tr,.pair,.total,.brand,.footer{break-inside:avoid;page-break-inside:avoid}}",
    "@media(max-width:370px){.tools{flex-direction:column}.receipt{margin:12px auto}}"
  ].join("");
  doc.head.append(viewport,css);
  const toolbar=make("nav",null,"tools");
  toolbar.append(make("small","إيصال حراري 80 مم"));
  const actions=make("div",null,"buttons");
  const close=make("button","إغلاق");close.type="button";close.onclick=()=>w.close();
  const print=make("button","طباعة الإيصال","primary");print.type="button";print.onclick=()=>w.print();
  actions.append(close,print);toolbar.append(actions);
  const receipt=make("article",null,"receipt");
  const brand=make("header",null,"brand");
  if(snap.logo){
    try{
      const url=new URL(String(snap.logo),location.origin);
      if(["https:","http:"].includes(url.protocol)){
        const image=make("img");image.alt="شعار سنونو";image.src=url.href;brand.append(image);
      }
    }catch{}
  }
  brand.append(make("h1",snap.restaurant||"مطعم سنونو"),make("p",[snap.address,snap.phone].filter(Boolean).join(" · ")));
  receipt.append(brand);
  const heading=make("section",null,"heading");
  heading.append(make("h2","إيصال دفع"),make("small",snap.number||"SN-"+o.number));
  receipt.append(heading);
  const info=make("section",null,"info");
  const pair=(key,value,ltr=false)=>{
    if(value===null||value===undefined||value==="")return;
    const line=make("div",null,"pair");
    line.append(make("span",key,"key"),make("span",value,"value"+(ltr?" ltr":"")));
    info.append(line);
  };
  pair("رقم الطلب","#"+o.number,true);
  pair("تاريخ الدفع",date(o.approved_at));
  pair("العميل",o.customer);
  pair("الجوال",o.phone,true);
  pair("نوع الطلب",o.service_type==="delivery"?"توصيل":o.service_type==="dine_in"?"داخل المطعم":"غير محدد");
  if(o.service_type==="delivery"){
    pair("عنوان التوصيل",o.delivery_address);
    pair("أقرب معلم",o.delivery_landmark);
    pair("هاتف احتياطي",o.backup_phone,true);
  }
  receipt.append(info,make("h3","تفاصيل الطلب","section-title"));
  const table=make("table",null,"items"),thead=make("thead"),labels=make("tr");
  for(const name of ["الوجبة","العدد","المجموع"])labels.append(make("th",name));
  thead.append(labels);
  const tbody=make("tbody");
  for(const line of (Array.isArray(o.pay_items)?o.pay_items:[])){
    const tr=make("tr"),dish=make("td");
    dish.append(make("strong",line.name||"وجبة","item-name"));
    const extras=[...(Array.isArray(line.choices)?line.choices.map(v=>v?.label).filter(Boolean):[]),line.special_instructions].filter(Boolean).join(" · ");
    if(extras)dish.append(make("span",extras,"extras"));
    dish.append(make("span","سعر الوحدة: "+money(line.price),"unit"));
    tr.append(dish,make("td",line.qty),make("td",money((Number(line.qty)||0)*(Number(line.price)||0))));
    tbody.append(tr);
  }
  table.append(thead,tbody);receipt.append(table);
  const total=make("section",null,"total");
  total.append(make("span","المبلغ المدفوع"),make("strong",money(o.total)));
  receipt.append(total,make("div",o.fulfillment_status==="completed"?
    "تم اعتماد الدفع · تم تسليم الطلب":"تم اعتماد الدفع · الطلب غير مسلّم بعد","status"));
  if(o.notes)receipt.append(make("p","ملاحظات الطلب: "+o.notes,"note"));
  const footer=make("footer",null,"footer");
  footer.append(make("strong","شكراً لطلبكم من سنونو!"),make("small","سنونو قلب زبونو"),
    make("div","Snounu Restaurant · "+(snap.number||o.number),"stamp"));
  receipt.append(footer);
  doc.body.replaceChildren(toolbar,receipt);
  return w;
}
