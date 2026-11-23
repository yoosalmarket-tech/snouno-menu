// STAFF & ROLE MANAGEMENT 01.2 — owner-authorized named employee invitation.
// Keep the existing Supabase Auth login and role tables.
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const reply = (status:number, message:string) =>
  new Response(JSON.stringify({message}), {status, headers});
Deno.serve(async req => {
  if(req.method==="OPTIONS") return new Response(null,{headers});
  if(req.method!=="POST") return reply(405,"POST required");
  const url=Deno.env.get("SUPABASE_URL");
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key) return reply(503,"Service unavailable");
  const bearer=req.headers.get("Authorization") || "";
  if(!/^Bearer\s+[^\s]+$/.test(bearer))return reply(401,"يلزم تسجيل الدخول");
  const auth=await fetch(url+"/auth/v1/user",{headers:{apikey:key,Authorization:bearer}});
  if(!auth.ok) return reply(401,"يلزم تسجيل الدخول");
  const user=await auth.json();
  if(!user.email_confirmed_at) return reply(403,"يلزم تأكيد البريد");
  const adminHeaders={apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"};
  const owner=await fetch(url+"/rest/v1/menu_staff?select=role,status&email=eq."+
    encodeURIComponent(String(user.email||"").toLowerCase()),{headers:adminHeaders});
  const owners=owner.ok?await owner.json():[];
  if(!owners.some((staff:{role:string,status:string})=>staff.role==="owner"&&staff.status!=="disabled"))
    return reply(403,"للمالك فقط");
  const data=await req.json().catch(()=>null);
  const email=String(data?.email??"").trim().toLowerCase();
  const full_name=String(data?.full_name??"").trim().replace(/\s+/g," ");
  const role=String(data?.role??"editor").trim();
  const password=data?.password;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!full_name||
     full_name.length<2||full_name.length>120||email===String(user.email).toLowerCase())
    return reply(400,"تحقق من اسم الموظف والبريد الإلكتروني");
  if(typeof password!=="string"||password.length<12)
    return reply(400,"كلمة المرور يجب ألا تقل عن 12 حرفاً");
  if(role==="owner"||!/^[a-z][a-z0-9_]{2,31}$/.test(role))
    return reply(400,"الدور غير مسموح");
  const roleCheck=await fetch(url+"/rest/v1/menu_roles?select=role&role=eq."+encodeURIComponent(role),{headers:adminHeaders});
  if(!roleCheck.ok || (await roleCheck.json()).length!==1)
    return reply(400,"الدور غير موجود");
  const existing=await fetch(url+"/rest/v1/menu_staff?select=role,user_id&email=eq."+
    encodeURIComponent(email),{headers:adminHeaders});
  if(!existing.ok) return reply(503,"تعذّر قراءة حساب الموظف");
  const existingRows=await existing.json();
  if(existingRows[0]?.role==="owner")return reply(403,"لا يمكن تغيير حساب المالك");
  const created=await fetch(url+"/auth/v1/admin/users",{
    method:"POST",headers:adminHeaders,
    body:JSON.stringify({email,password,email_confirm:true})
  });
  let userId:string|null=existingRows[0]?.user_id??null;
  if(created.ok){
    const account=await created.json();
    userId=account.id||account.user?.id||userId;
  }else{
    const error=await created.json().catch(()=>({}));
    if(!["email_exists","user_already_exists"].includes(error.error_code??error.code))
      return reply(400,"تعذّر إنشاء الحساب");
  }
  const payload:Record<string,unknown>={email,role,full_name,status:"active"};
  if(userId)payload.user_id=userId;
  const saved=await fetch(url+"/rest/v1/menu_staff?on_conflict=email",{
    method:"POST",headers:{...adminHeaders,Prefer:"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify(payload)
  });
  if(!saved.ok)return reply(500,"تعذّر حفظ صلاحيات الموظف");
  return reply(200,created.ok?"تم إنشاء حساب الموظف":"تم تحديث بيانات الموظف مع إبقاء كلمة مروره الحالية");
});
