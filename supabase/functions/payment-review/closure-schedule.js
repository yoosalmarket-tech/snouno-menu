/* Restaurant closure rules use Asia/Gaza wall-clock dates and times.
   Rules are stored as a JSON array on menu_settings.closure_rules. */
export const CLOSURE_TIME_ZONE='Asia/Gaza';
const TIME=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const toMinutes=time=>Number(time.slice(0,2))*60+Number(time.slice(3,5));
const validDate=date=>{
 if(!DATE.test(date))return false;
 const parsed=new Date(date+'T12:00:00Z');
 return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===date;
};
export function normalizeClosureRules(value){
 if(!Array.isArray(value))return [];
 return value.slice(0,100).filter(rule=>{
  if(!rule||typeof rule!=='object')return false;
  if(rule.kind==='date')return validDate(rule.date);
  if(rule.kind==='weekly')return Array.isArray(rule.weekdays)&&rule.weekdays.some(d=>Number.isInteger(d)&&d>=0&&d<=6);
  return false;
 }).filter(rule=>rule.allDay===true||
  (TIME.test(rule.start||'')&&TIME.test(rule.end||'')&&rule.start!==rule.end)
 ).map(rule=>({
  id:String(rule.id||'').slice(0,90),
  kind:rule.kind,
  weekdays:rule.kind==='weekly'?[...new Set(rule.weekdays.filter(d=>Number.isInteger(d)&&d>=0&&d<=6))].sort():[],
  date:rule.kind==='date'?rule.date:'',
  allDay:rule.allDay===true,
  start:rule.allDay===true?'00:00':rule.start,
  end:rule.allDay===true?'00:00':rule.end
 }));
}
export function gazaParts(at=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{
  timeZone:CLOSURE_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23'
 }).formatToParts(at);
 const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 return {date:values.year+'-'+values.month+'-'+values.day,
  minute:Number(values.hour)*60+Number(values.minute)};
}
const previousDate=date=>{
 const d=new Date(date+'T12:00:00Z');
 d.setUTCDate(d.getUTCDate()-1);
 return d.toISOString().slice(0,10);
};
const weekday=date=>new Date(date+'T12:00:00Z').getUTCDay(); // 0 = Sunday
export function isRestaurantClosed(rules,at=new Date()){
 const {date,minute}=gazaParts(at);
 const previous=previousDate(date);
 return normalizeClosureRules(rules).some(rule=>{
  const matches=d=>rule.kind==='date'
   ?rule.date===d:rule.weekdays.includes(weekday(d));
  if(rule.allDay)return matches(date);
  const start=toMinutes(rule.start),end=toMinutes(rule.end);
  if(start<end)return matches(date)&&minute>=start&&minute<end;
  // Crossing midnight: a Sunday 22:00–02:00 closure also covers Monday 00:00–02:00.
  return (matches(date)&&minute>=start)||(matches(previous)&&minute<end);
 });
}
