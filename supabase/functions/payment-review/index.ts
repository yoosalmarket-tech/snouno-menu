// Guest tracking uses a separate 256-bit bearer secret. The order number is display-only.
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
// Closure and queue calculations are shared with the transactional database guard.
const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);
const bucket = db.storage.from("snounu-payment-proofs");
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey,content-type,authorization",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Cache-Control": "no-store",
};
const reply = (value: unknown, status = 200) =>
  Response.json(value, { status, headers });
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const summary =
  "id,number,customer,phone,service_type,delivery_address,delivery_landmark,backup_phone,payment_mode,arrival_eta_minutes,expected_arrival_at,fulfillment_status,arrived_at,completed_at,advance_order,advance_opening_at,queue_managed,advance_exception,refund_resolution,method,total,status,created_at,reason,topic,approved_at,invoice,pay_items(dish_id,name,qty,price,old_price,choices,special_instructions)";
function fileType(b: Uint8Array) {
  const at = (s: string, i = 0) =>
    Array.from(s).every((v, j) => b[i + j] === v.charCodeAt(0));
  if (b[0] === 255 && b[1] === 216 && b[2] === 255)
    return ["image/jpeg", "jpg"];
  if (at("\x89PNG\r\n\x1a\n")) return ["image/png", "png"];
  if (at("RIFF") && at("WEBP", 8)) return ["image/webp", "webp"];
  if (at("%PDF-")) return ["application/pdf", "pdf"];
  return [];
}
const hash = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const multi = req.headers
      .get("content-type")
      ?.startsWith("multipart/form-data");
    const limit = multi ? 4194304 + 32768 : 32768;
    if (Number(req.headers.get("content-length")) > limit)
      return reply({ error: "File too large" }, 413);
    const reader = req.body?.getReader();
    if (!reader) return reply({ error: "Missing request" }, 400);
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) {
        await reader.cancel();
        return reply({ error: "File too large" }, 413);
      }
      chunks.push(new Uint8Array(value));
    }
    const body = new Response(new Blob(chunks), {
      headers: {
        "content-type": req.headers.get("content-type") || "application/json",
      },
    });
    const form = multi ? await body.formData() : null;
    const data = form
      ? JSON.parse(String(form.get("data")))
      : await body.json();
    const { action, id, secret } = data;
    const { data: cfg, error: cfgError } = await db
      .from("pay_settings")
      .select("formats,cancellation,live_updates,max_quantity")
      .single();
    if (cfgError || !cfg) throw new Error();
    const { data: contact }=await db.from("menu_settings").select("hotline").eq("id",1).single();
    const hotline=contact?.hotline || "#889";
    const queueInfo = async (orderId: string | null = null) => {
      const {data: info,error} = await db.rpc("pay_advance_info",{p_id:orderId});
      if(error||!info) throw new Error("Queue unavailable");
      return info;
    };
    if(action==="advance_info") return reply(await queueInfo());
    const forCustomer = async (order: Record<string,unknown>) => {
      const { data: report } = await db.from("pay_order_reports")
        .select("id").eq("order_id",order.id).is("resolved_at",null).limit(1).maybeSingle();
      const queue=await queueInfo(String(order.id));
      return { ...order, cancellation: cfg.cancellation, live_updates: cfg.live_updates,
        hotline, report_open: !!report, queue_position:queue.queue_position,
        orders_ahead:queue.orders_ahead, restaurant_closed:queue.closed,
        next_opening_at:queue.next_opening_at };
    };
    if (action === "config") {
      const { data: methods, error } = await db
        .from("pay_methods")
        .select("id,name,icon,holder,account,url,instructions,qr_url")
        .eq("enabled", true)
        .order("position")
        .order("id");
      if (error) throw new Error();
      return reply({ ...cfg, methods, hotline });
    }
    if (action === "quote") {
      if (
        !Array.isArray(data.items) ||
        !data.items.length ||
        data.items.length > 60
      )
        return reply({ error: "Invalid cart" }, 400);
      const { data: lines, error } = await db.rpc("pay_price_lines", {
        p_items: data.items,
      });
      if (error || !lines)
        return reply(
          {
            error:
              "Menu changed. Check quantities and choices before transferring.",
          },
          409,
        );
      const cents = lines.reduce(
        (sum, line) => sum + Math.round(line.price * 100) * line.qty,
        0,
      );
      const queue=await queueInfo();
      if(queue.closed && data.payment_mode==="at_restaurant")
        return reply({error:"الطلبات المسبقة تتطلب الدفع الإلكتروني."},409);
      let hold=null;
      if(data.reserve_advance===true){
        if(!uuid.test(id)||!/^[a-f0-9]{64}$/.test(secret))return reply({error:"Invalid checkout key"},400);
        const reservation=await db.rpc("pay_reserve_checkout",{p_id:id,p_hash:await hash(secret)});
        if(reservation.error)return reply({error:"الطلبات المسبقة غير متاحة حالياً. لا تحول المبلغ وحاول لاحقاً."},409);
        hold=reservation.data;
      } else if(queue.closed&&!queue.advance_allowed){
        return reply({error:"الطلبات المسبقة غير متاحة حالياً. لا تحول المبلغ."},409);
      }
      return reply({ total: cents / 100, ...queue, hold });
    }
    if (!uuid.test(id) || !/^[a-f0-9]{64}$/.test(secret))
      return reply({ error: "Invalid tracking key" }, 400);
    const digest = await hash(secret);
    const lookup = () =>
      db
        .from("pay_orders")
        .select(summary)
        .eq("id", id)
        .eq("secret_hash", digest)
        .maybeSingle();
    const { data: order, error } = await lookup();
    if (error) throw new Error();
    if (action !== "submit" && !order)
      return reply({ error: "Order unavailable" }, 404);
    if (action === "status" || (action === "submit" && order))
      return reply(await forCustomer(order));
    if (action === "report") {
      if (order?.status!=="approved") return reply({error:"Report available after payment approval"},409);
      if (!["not_received","incorrect_order","other"].includes(data.category) ||
          typeof data.message!=="string" || data.message.trim().length<5 ||
          data.message.trim().length>500)
        return reply({error:"Invalid report details"},400);
      const {error: reportError}=await db.from("pay_order_reports").insert({
        order_id:id,category:data.category,message:data.message.trim()
      });
      if(reportError) return reply({error:"An unresolved report already exists for this order"},409);
      return reply({ok:true,message:"تم إرسال بلاغك لإدارة المطعم."});
    }
    if (action === "cancel") {
      const { error } = await db.rpc("pay_customer_change", {
        p_id: id,
        p_hash: digest,
        p_target: "cancelled",
      });
      return error
        ? reply({ error: "Order cannot be cancelled" }, 409)
        : reply({ ok: true });
    }
    if (action !== "submit" && action !== "replace")
      return reply({ error: "Unknown action" }, 400);
    if (action === "replace" && order?.status !== "rejected")
      return reply({ error: "Decision changed" }, 409);
    if (action === "submit") {
      if (
        !Array.isArray(data.items) ||
        !data.items.length ||
        data.items.length > 60 ||
        !(data.payment_mode==="at_restaurant"&&data.service_type==="dine_in") &&
          !uuid.test(data.method) || 
        !["online","at_restaurant"].includes(data.payment_mode) ||
        (data.payment_mode==="at_restaurant" &&
          (data.service_type!=="dine_in" ||
            ![10,15,20,30,45,60,90,120].includes(data.arrival_eta_minutes))) ||
        (data.payment_mode==="online" &&
          data.arrival_eta_minutes!==null && data.arrival_eta_minutes!==undefined) ||
        typeof data.customer !== "string" ||
        !data.customer.trim() ||
        data.customer.length > 100 ||
        !/^\+?[\d ()-]{7,25}$/.test(data.phone) ||
        String(data.notes || "").length > 1000 ||
        !["dine_in","delivery"].includes(data.service_type) ||
        (data.service_type === "delivery" &&
          (typeof data.delivery_address !== "string" ||
           data.delivery_address.trim().length < 8 ||
           data.delivery_address.trim().length > 500 ||
           typeof data.delivery_landmark !== "string" ||
           data.delivery_landmark.trim().length < 3 ||
           data.delivery_landmark.trim().length > 160 ||
           typeof data.backup_phone !== "string" ||
           !/^\+?[\d ()-]{7,25}$/.test(data.backup_phone.trim()) ||
           data.backup_phone.replace(/\D/g, "").length < 7 ||
           data.backup_phone.replace(/\D/g, "").length > 15 ||
           data.backup_phone.replace(/\D/g, "") === data.phone.replace(/\D/g, "")))
      )
        return reply({ error: "Invalid order" }, 400);
      // The database checks and consumes the hold atomically. A late proof must be retained for manual review.
      if(data.payment_mode==="at_restaurant"){
        const queue=await queueInfo();
        if(queue.closed)return reply({error:"المطعم مغلق حالياً. الدفع عند الحضور غير متاح."},409);
      }
      if(data.payment_mode!=="at_restaurant"){
        const method = await db.from("pay_methods").select("id")
          .eq("id",data.method).eq("enabled",true).maybeSingle();
        if(!method.data) return reply({error:"Payment method unavailable"},409);
      } else {
        // Prevent accidental rapid duplicate arrival orders from a phone number.
        const hourAgo = new Date(Date.now()-3600000).toISOString();
        const recent = await db.from("pay_orders").select("id",{count:"exact",head:true})
          .eq("phone",data.phone).eq("payment_mode","at_restaurant").gte("created_at",hourAgo);
        if((recent.count||0)>=3)return reply({error:"Too many arrival orders. Call the restaurant."},429);
      }
    }
    const noProof=action==="submit"&&data.payment_mode==="at_restaurant";
    const f=form?.get("proof");
    if(!noProof && (!(f instanceof File)||!f.size||f.size>4194304))
      return reply({error:"Choose a file up to 4 MB"},400);
    let path: string|null=null;
    if(!noProof){
      const file=f as File;
      const bytes=new Uint8Array(await file.arrayBuffer());
      const [mime,ext]=fileType(bytes);
      if(!mime||!cfg.formats.includes(mime)||mime!==file.type)
        return reply({error:"Unsupported file"},415);
      path=id+"/"+crypto.randomUUID()+"."+ext;
      const uploaded=await bucket.upload(path,bytes,{contentType:mime,upsert:false});
      if(uploaded.error)throw new Error();
    }
    const result =
      action === "submit"
        ? await db.rpc("pay_submit_with_referral", {
            p_id: id,
            p_hash: digest,
            p_customer: data.customer.trim(),
            p_phone: data.phone,
            p_notes: "SNOUNU_FULFILLMENT_V1:" + JSON.stringify({
              type: data.service_type,
              payment_mode: data.payment_mode,
              arrival_eta_minutes: data.payment_mode==="at_restaurant" ? data.arrival_eta_minutes : null,
              address: data.service_type === "delivery" ? data.delivery_address.trim() : "",
              landmark: data.service_type === "delivery" ? data.delivery_landmark.trim() : "",
              backup_phone: data.service_type === "delivery" ? data.backup_phone.trim() : "",
              notes: String(data.notes || "").trim(),
            }),
            p_method: noProof ? null : data.method,
            p_items: data.items,
            p_total: data.total,
            p_path: path,
            p_referral_source: typeof data.referral_source === "string" ? data.referral_source : null,
          })
        : await db.rpc("pay_customer_change", {
            p_id: id,
            p_hash: digest,
            p_target: "pending",
            p_path: path,
          });
    if(path){
      const linked=await db.from("pay_proofs").select("path").eq("path",path).maybeSingle();
      if(!linked.error&&!linked.data)await bucket.remove([path]);
    }
    if (result.error)
      return reply(
        { error: "Order changed. Check your order before retrying." },
        409,
      );
    const saved = await lookup();
    if (saved.error || !saved.data) throw new Error();
    return reply(await forCustomer(saved.data));
  } catch {
    return reply({ error: "Request could not be processed" }, 400);
  }
});
