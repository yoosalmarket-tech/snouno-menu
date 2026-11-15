const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Content-Type": "application/json" };
const reply = (status:number, message:string) => new Response(JSON.stringify({message}), {status, headers});
Deno.serve(async req => {
 if(req.method==="OPTIONS") return new Response(null,{headers});
 if(req.method!=="POST") return reply(405,"POST required");
 const url=Deno.env.get("SUPABASE_URL")!;
 const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const bearer=req.headers.get("Authorization") || "";
 const auth=await fetch(url+"/auth/v1/user",{headers:{apikey:key,Authorization:bearer}});
 if(!auth.ok) return reply(401,"يلزم تسجيل الدخول");
 const user=await auth.json();
 if(!user.email_confirmed_at) return reply(403,"يلزم تأكيد البريد");
 const adminHeaders={apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"};
 const role=await fetch(url+"/rest/v1/menu_staff?select=role&email=eq."+encodeURIComponent(user.email.toLowerCase()),{headers:adminHeaders});
 if(!role.ok || (await role.json())[0]?.role!=="owner") return reply(403,"للمالك فقط");
 const {email:raw,password}=await req.json();
 const email=String(raw??"").trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof password!=="string"||password.length<12||email===user.email.toLowerCase()) return reply(400,"تحقق من البريد وكلمة المرور (12 حرفاً على الأقل)");
 const created=await fetch(url+"/auth/v1/admin/users",{method:"POST",headers:adminHeaders,body:JSON.stringify({email,password,email_confirm:true})});
 if(!created.ok){
   const error=await created.json();
   if(!["email_exists","user_already_exists"].includes(error.error_code??error.code)) return reply(400,"تعذّر إنشاء الحساب");
 }
 const saved=await fetch(url+"/rest/v1/menu_staff",{method:"POST",headers:{...adminHeaders,Prefer:"resolution=ignore-duplicates"},body:JSON.stringify({email,role:"editor"})});
 if(!saved.ok) return reply(500,"تعذّر حفظ الصلاحية. حاول مجدداً");
 return reply(200,created.ok?"تم إنشاء حساب المحرر":"تم منح الحساب الموجود صلاحية التحرير بكلمة مروره الحالية");
});
