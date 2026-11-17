// Read-only Google Analytics dashboard proxy.
// Google credentials never reach the browser, and only authenticated menu owners can query it.
import { createSign } from 'node:crypto';

const SUPABASE = 'https://wknpuzdyemwkllmxehyy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FJg5RC-dTvsINEy9D8_rXw_xM03B4Ip';
const PROPERTY_ID = process.env.GA4_PROPERTY_ID || '564846813';
const EVENTS = [
  'page_view','view_item','delivery_app_click','delivery_referral_unique',
  'add_to_wishlist','meal_share_click','scroll'
];
const json = (res,status,data)=>{
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(JSON.stringify(data));
};
async function ownerAuthorized(header){
  if(!/^Bearer\s+[^\s]+$/.test(header||''))return false;
  const token=header.replace(/^Bearer\s+/,'');
  const headers={apikey:SUPABASE_KEY,Authorization:'Bearer '+token};
  const userResponse=await fetch(SUPABASE+'/auth/v1/user',{headers});
  if(!userResponse.ok)return false;
  const user=await userResponse.json();
  const email=String(user.email||'').toLowerCase();
  if(!email)return false;
  const roleResponse=await fetch(SUPABASE+'/rest/v1/menu_staff?select=role&email=eq.'+encodeURIComponent(email),{headers});
  if(!roleResponse.ok)return false;
  const roles=await roleResponse.json();
  return Array.isArray(roles)&&roles.some(r=>r.role==='owner');
}
function signedJwt(account){
  const now=Math.floor(Date.now()/1000);
  const b64 = x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const header=b64({alg:'RS256',typ:'JWT'});
  const payload=b64({iss:account.client_email,scope:'https://www.googleapis.com/auth/analytics.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  const data=header+'.'+payload;
  const signer=createSign('RSA-SHA256');
  signer.update(data); signer.end();
  return data+'.'+signer.sign(account.private_key).toString('base64url');
}
async function googleToken(account){
  const request=new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:signedJwt(account)});
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:request});
  if(!response.ok)throw new Error('Unable to authenticate with Google Analytics');
  const data=await response.json();
  if(!data.access_token)throw new Error('Google Analytics did not provide an access token');
  return data.access_token;
}
async function gaReport(token,body){
  const response=await fetch('https://analyticsdata.googleapis.com/v1beta/properties/'+PROPERTY_ID+':runReport',{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)
  });
  if(!response.ok){
    const message=await response.text();
    throw new Error('GA4 query failed ('+response.status+'): '+message.slice(0,400));
  }
  return response.json();
}
// Realtime data is independent of the processed 7/28/90-day history.
async function gaRealtimeReport(token,body){
 const response=await fetch('https://analyticsdata.googleapis.com/v1beta/properties/'+PROPERTY_ID+':runRealtimeReport',{
  method:'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify(body)
 });
 if(!response.ok)throw new Error('Realtime query failed ('+response.status+')');
 return response.json();
}
function rows(report){
  return (report?.rows||[]).map(row=>({
    dimensions:(row.dimensionValues||[]).map(v=>v.value),
    metrics:(row.metricValues||[]).map(v=>Number(v.value)||0)
  }));
}
export default async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{error:'method_not_allowed'});
  try{
    if(!await ownerAuthorized(req.headers.authorization))return json(res,403,{error:'forbidden'});
    if(!/^\d{6,}$/.test(PROPERTY_ID))return json(res,503,{error:'invalid_property',message:'Configure a valid GA4 property ID on Vercel.'});
    const credentials=process.env.GA4_SERVICE_ACCOUNT_JSON;
    if(!credentials)return json(res,503,{error:'not_configured',message:'GA4 needs its read-only Google service account configured on Vercel.'});
    let account;
    try{account=JSON.parse(credentials);}catch{return json(res,503,{error:'invalid_credentials',message:'The GA4 service account configuration is not valid JSON.'});}
    if(!account.client_email||!account.private_key)return json(res,503,{error:'invalid_credentials',message:'The GA4 service account requires client_email and private_key.'});
    const days=([7,28,90].includes(Number(req.query?.days))?Number(req.query.days):28);
    const range={startDate:(days-1)+'daysAgo',endDate:'today'};
    const token=await googleToken(account);
    const base={dateRanges:[range]};
    const isReferral={filter:{fieldName:'eventName',stringFilter:{matchType:'EXACT',value:'delivery_referral_unique'}}};
    const [summaryResult,eventsResult,referralsResult,dailyResult,liveUsersResult,liveEventsResult]=await Promise.allSettled([
      gaReport(token,{...base,metrics:['sessions','totalUsers','activeUsers','newUsers','screenPageViews','keyEvents','engagedSessions'].map(name=>({name}))}),
      gaReport(token,{...base,dimensions:[{name:'eventName'}],metrics:[{name:'eventCount'},{name:'keyEvents'}],limit:'100',orderBys:[{metric:{metricName:'eventCount'},desc:true}]}),
      gaReport(token,{...base,dimensions:[{name:'customEvent:meal_name'},{name:'customEvent:delivery_platform'}],metrics:[{name:'eventCount'},{name:'customEvent:referral_value'}],dimensionFilter:isReferral,limit:'200',orderBys:[{metric:{metricName:'eventCount'},desc:true}]}),
      gaReport(token,{...base,dimensions:[{name:'date'}],metrics:[{name:'sessions'},{name:'totalUsers'}],limit:'100',orderBys:[{dimension:{dimensionName:'date'}}]}),
      gaRealtimeReport(token,{metrics:[{name:'activeUsers'}]}),
      gaRealtimeReport(token,{dimensions:[{name:'eventName'}],metrics:[{name:'eventCount'}],limit:'100'})
    ]);
    if(summaryResult.status!=='fulfilled')throw summaryResult.reason;
    const metrics=rows(summaryResult.value)[0]?.metrics||[];
    const eventRows=eventsResult.status==='fulfilled'?rows(eventsResult.value):[];
    const referralRows=referralsResult.status==='fulfilled'?rows(referralsResult.value):[];
    const eventCounts=Object.fromEntries(eventRows.filter(r=>EVENTS.includes(r.dimensions[0])).map(r=>[r.dimensions[0],{count:r.metrics[0],keyEvents:r.metrics[1]}]));
    const warning=[];
    if(eventsResult.status==='rejected')warning.push('Event breakdown is temporarily unavailable');
    if(referralsResult.status==='rejected')warning.push('Referral breakdown is awaiting GA4 custom-dimension/metric availability or access');
    if(dailyResult.status==='rejected')warning.push('Daily trend is temporarily unavailable');
    if(liveUsersResult.status==='rejected'||liveEventsResult.status==='rejected')warning.push('Realtime activity is temporarily unavailable');
    const realtimeEvents=liveEventsResult.status==='fulfilled'?Object.fromEntries(rows(liveEventsResult.value).map(r=>[r.dimensions[0],r.metrics[0]])):{};
    const realtime={
      available:liveUsersResult.status==='fulfilled'&&liveEventsResult.status==='fulfilled',
      activeUsers:liveUsersResult.status==='fulfilled'?(rows(liveUsersResult.value)[0]?.metrics[0]||0):null,
      eventCounts:realtimeEvents
    };
    const referrals=referralRows.map(r=>({meal:r.dimensions[0]||'—',platform:r.dimensions[1]||'—',count:r.metrics[0],value:r.metrics[1]}));
    return json(res,200,{
      source:'Google Analytics 4',propertyId:PROPERTY_ID,days,asOf:new Date().toISOString(),
      realtime,processedHasRows:(summaryResult.value?.rows||[]).length>0,
      summary:{sessions:metrics[0]||0,totalUsers:metrics[1]||0,activeUsers:metrics[2]||0,newUsers:metrics[3]||0,views:metrics[4]||0,keyEvents:metrics[5]||0,engagedSessions:metrics[6]||0},
      eventCounts,referrals,
      totals:{uniqueReferrals:referrals.reduce((n,r)=>n+r.count,0),referralValue:referrals.reduce((n,r)=>n+r.value,0)},
      daily:dailyResult.status==='fulfilled'?rows(dailyResult.value).map(r=>({date:r.dimensions[0],sessions:r.metrics[0],users:r.metrics[1]})):[],
      warning
    });
  }catch(error){
    // Keep diagnostic data on the server; do not return Google OAuth failures or internal user data.
    console.error('GA4 dashboard:',error?.message||error);
    return json(res,502,{error:'ga4_unavailable',message:'Could not load GA4. Check Data API access, service account Viewer permission, and property ID.'});
  }
}
