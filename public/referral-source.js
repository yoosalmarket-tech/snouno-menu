// Last tagged organic referral in this browser tab. No personal identifiers are stored.
const KEY="snounu-referral-last-touch-v1";
const TTL=24*60*60*1000;
const valid=s=>s && s.length>=2 && s.length<=80 && /^[\p{L}\p{N}_-]+$/u.test(s);
export function getReferralSource(){
  const params=new URLSearchParams(location.search);
  const tagged=params.get("source")||params.get("utm_campaign")||"";
  const fresh=String(tagged).normalize("NFKC").toLowerCase().trim();
  if(valid(fresh)){
    try{sessionStorage.setItem(KEY,JSON.stringify({source:fresh,time:Date.now()}));}catch{}
    return fresh;
  }
  try{
    const saved=JSON.parse(sessionStorage.getItem(KEY)||"null");
    if(saved&&valid(saved.source)&&Number.isFinite(saved.time)&&Date.now()-saved.time<=TTL&&Date.now()>=saved.time)return saved.source;
    sessionStorage.removeItem(KEY);
  }catch{}
  return null;
}
// Capture before menu navigation can update the URL.
getReferralSource();
