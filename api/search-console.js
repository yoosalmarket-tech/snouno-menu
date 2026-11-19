// Read-only Search Console data for the authenticated restaurant owner.
// Reuses the Google service account already configured for Yoosal's GA4 proxy,
// but that account must separately receive Search Console property access.
import {createSign} from 'node:crypto';
const BASE='https://wknpuzdyemwkllmxehyy.supabase.co';
const KEY='sb_publishable_FJg5RC-dTvsINEy9D8_rXw_xM03B4Ip';
const PROPERTY='https://snounu-restaurant.vercel.app/';
const json=(res,code,obj)=>{res.statusCode=code;res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','private, no-store');res.end(JSON.stringify(obj))};
async function ownerAuthorized(header){
 if(!/^Bearer\s+[^\s]+$/.test(header||''))return false;
 const auth=header.replace(/^Bearer\s+/,'');
 const headers={apikey:KEY,Authorization:'Bearer '+auth};
 const user=await fetch(BASE+'/auth/v1/user',{headers});
 if(!user.ok)return false;
 const record=await user.json();
 const email=String(record.email||'').toLowerCase();
 if(!email)return false;
 const role=await fetch(BASE+'/rest/v1/menu_staff?select=role&email=eq.'+encodeURIComponent(email),{headers});
 if(!role.ok)return false;
 const rows=await role.json();
 return Array.isArray(rows)&&rows.some(x=>x.role==='owner');
}
function googleJwt(account){
 const now=Math.floor(Date.now()/1000);
 const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const value=b64({alg:'RS256',typ:'JWT'})+'.'+b64({
  iss:account.client_email,scope:'https://www.googleapis.com/auth/webmasters.readonly',
  aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600
 });
 const signer=createSign('RSA-SHA256');signer.update(value);signer.end();
 return value+'.'+signer.sign(account.private_key).toString('base64url');
}
const date=date=>date.toISOString().slice(0,10);
export default async function handler(req,res){
 if(req.method!=='GET')return json(res,405,{error:'method_not_allowed'});
 try{
  if(!await ownerAuthorized(req.headers.authorization))return json(res,403,{error:'forbidden',message:'هذه البيانات متاحة لمالك المنيو فقط.'});
  const days=[7,28,90].includes(Number(req.query?.days))?Number(req.query.days):28;
  const raw=process.env.GA4_SERVICE_ACCOUNT_JSON;
  if(!raw)return json(res,200,{available:false,message:'حساب خدمة Google غير مُعدّ بعد على Vercel.',property:PROPERTY});
  let account;try{account=JSON.parse(raw)}catch{return json(res,200,{available:false,message:'إعداد حساب خدمة Google غير صالح.',property:PROPERTY})}
  if(!account.client_email||!account.private_key)return json(res,200,{available:false,message:'بيانات حساب Google ناقصة.',property:PROPERTY});
  const serviceAccountEmail=account.client_email;
  const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:googleJwt(account)})
  });
  if(!tokenResponse.ok)return json(res,200,{available:false,message:'تعذر اتصال خدمة Google. تحقق من صلاحيات حساب الخدمة.',serviceAccountEmail,property:PROPERTY});
  const token=(await tokenResponse.json()).access_token;
  if(!token)return json(res,200,{available:false,message:'تعذّر مصادقة Google.',serviceAccountEmail,property:PROPERTY});
  const end=new Date(Date.now()-3*86400000),start=new Date(end.getTime()-(days-1)*86400000);
  const startDate=date(start),endDate=date(end);
  const response=await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(PROPERTY)+'/searchAnalytics/query',{
   method:'POST',
   headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({
    startDate,endDate,dimensions:['query','page'],type:'web',dataState:'final',
    rowLimit:2500,startRow:0
   })
  });
  if(!response.ok){
   const body=await response.text();
   console.warn('Search Console permissions:',response.status,body.slice(0,250));
   return json(res,200,{
    available:false,property:PROPERTY,serviceAccountEmail,
    message:response.status===403||response.status===404
     ?'لم تُمنح صلاحية Search Console لهذا الموقع بعد. تحقق من الملكية وأضف حساب الخدمة أدناه كمستخدم.'
     :'تعذّر قراءة Google Search Console حالياً. تحقق من تفعيل API والصلاحيات.'
   });
  }
  const payload=await response.json();
  const rows=(payload.rows||[]).map(r=>({
   query:String(r.keys?.[0]||'').slice(0,400),
   page:String(r.keys?.[1]||'/menu').replace(PROPERTY,'/'),
   clicks:Number(r.clicks)||0,impressions:Number(r.impressions)||0,
   ctr:Number(r.ctr)||0,position:Number(r.position)||0
  })).filter(r=>r.query);
  return json(res,200,{available:true,source:'Google Search Console',property:PROPERTY,startDate,endDate,rows,
   note:'Aggregated GSC data; anonymized or withheld queries may be absent.'});
 }catch(err){
  console.error('Search Console dashboard:',err?.message||err);
  return json(res,200,{available:false,property:PROPERTY,message:'تعذّر الاتصال بـ Search Console حالياً. استخدم استيراد CSV عند الحاجة.'});
 }
}