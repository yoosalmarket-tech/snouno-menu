// Guest tracking uses a separate 256-bit bearer secret. The order number is display-only.
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { isRestaurantClosed } from "./closure-schedule.js";
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
  "id,number,customer,phone,method,total,status,created_at,reason,topic,approved_at,invoice,pay_items(dish_id,name,qty,price,old_price)";
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
      .select("formats,cancellation,live_updates")
      .single();
    if (cfgError || !cfg) throw new Error();
    if (action === "config") {
      const { data: methods, error } = await db
        .from("pay_methods")
        .select("id,name,icon,holder,account,url,instructions")
        .eq("enabled", true)
        .order("position")
        .order("id");
      if (error) throw new Error();
      return reply({ ...cfg, methods });
    }
    if (action === "quote") {
      if (
        !Array.isArray(data.items) ||
        !data.items.length ||
        data.items.length > 60
      )
        return reply({ error: "Invalid cart" }, 400);
      const ids = data.items.map((i) => i.id);
      if (new Set(ids).size !== ids.length || !ids.every((v) => uuid.test(v)))
        return reply({ error: "Invalid meals" }, 400);
      const { data: menu, error } = await db
        .from("dishes")
        .select("id,price,available")
        .in("id", ids);
      if (error) throw new Error();
      let cents = 0;
      for (const item of data.items) {
        const d = menu?.find((d) => d.id === item.id);
        if (
          !d?.available ||
          Number(d.price) !== Number(item.price) ||
          !Number.isInteger(item.qty) ||
          item.qty < 1 ||
          item.qty > 99
        )
          return reply(
            { error: "Menu changed. Refresh the menu before transferring." },
            409,
          );
        cents += Math.round(d.price * 100) * item.qty;
      }
      const { data: s, error: closedError } = await db
        .from("menu_settings")
        .select("closure_rules")
        .single();
      if (closedError) throw new Error();
      if (isRestaurantClosed(s.closure_rules))
        return reply({ error: "Restaurant closed" }, 409);
      return reply({ total: cents / 100 });
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
      return reply({
        ...order,
        cancellation: cfg.cancellation,
        live_updates: cfg.live_updates,
      });
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
        !uuid.test(data.method) ||
        typeof data.customer !== "string" ||
        !data.customer.trim() ||
        data.customer.length > 100 ||
        !/^\+?[\d ()-]{7,25}$/.test(data.phone) ||
        String(data.notes || "").length > 1000
      )
        return reply({ error: "Invalid order" }, 400);
      const { data: s, error } = await db
        .from("menu_settings")
        .select("closure_rules")
        .eq("id", 1)
        .single();
      if (error) throw new Error();
      if (isRestaurantClosed(s.closure_rules))
        return reply({ error: "Restaurant closed" }, 409);
      const method = await db
        .from("pay_methods")
        .select("id")
        .eq("id", data.method)
        .eq("enabled", true)
        .maybeSingle();
      if (!method.data)
        return reply({ error: "Payment method unavailable" }, 409);
    }
    const f = form?.get("proof");
    if (!(f instanceof File) || !f.size || f.size > 4194304)
      return reply({ error: "Choose a file up to 4 MB" }, 400);
    const bytes = new Uint8Array(await f.arrayBuffer());
    const [mime, ext] = fileType(bytes);
    if (!mime || !cfg.formats.includes(mime) || mime !== f.type)
      return reply({ error: "Unsupported file" }, 415);
    const path = id + "/" + crypto.randomUUID() + "." + ext;
    const uploaded = await bucket.upload(path, bytes, {
      contentType: mime,
      upsert: false,
    });
    if (uploaded.error) throw new Error();
    const result =
      action === "submit"
        ? await db.rpc("pay_submit", {
            p_id: id,
            p_hash: digest,
            p_customer: data.customer.trim(),
            p_phone: data.phone,
            p_notes: data.notes || "",
            p_method: data.method,
            p_items: data.items,
            p_total: data.total,
            p_path: path,
          })
        : await db.rpc("pay_customer_change", {
            p_id: id,
            p_hash: digest,
            p_target: "pending",
            p_path: path,
          });
    const linked = await db
      .from("pay_proofs")
      .select("path")
      .eq("path", path)
      .maybeSingle();
    if (!linked.error && !linked.data) await bucket.remove([path]);
    if (result.error)
      return reply(
        { error: "Order changed. Check your order before retrying." },
        409,
      );
    const saved = await lookup();
    if (saved.error || !saved.data) throw new Error();
    return reply({
      ...saved.data,
      cancellation: cfg.cancellation,
      live_updates: cfg.live_updates,
    });
  } catch {
    return reply({ error: "Request could not be processed" }, 400);
  }
});
