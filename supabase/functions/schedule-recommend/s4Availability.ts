// Pure KST availability normalization. No network, health, private origin or provider access.
export type AvailabilityRow = { profile_id: string; schedule: { slots: string[] } };
export function normalizeAvailabilityRows(value:unknown,expiresAt:string,now=Date.now()):AvailabilityRow[] {
 const expiry=Date.parse(expiresAt);
 if(!Array.isArray(value)||!Number.isFinite(expiry)||!Number.isFinite(now))return [];
 return value.flatMap(raw=>{
  if(!raw||typeof raw!=='object'||typeof raw.profile_id!=='string'||!raw.profile_id)return [];
  const selected=Array.isArray(raw.schedule?.slots)?raw.schedule.slots.slice(0,500):[];
  const slots=selected.filter((key:unknown):key is string=>{
   if(typeof key!=='string')return false;
   const m=/^(\d{4})-(\d{2})-(\d{2})-(1[1-9]|20)$/.exec(key);if(!m)return false;
   const y=Number(m[1]),month=Number(m[2]),d=Number(m[3]),hour=Number(m[4]);
   const date=new Date(0);date.setUTCFullYear(y,month-1,d);date.setUTCHours(0,0,0,0);
   if(date.getUTCFullYear()!==y||date.getUTCMonth()!==month-1||date.getUTCDate()!==d)return false;
   const start=date.getTime()+(hour-9)*3600000;
   return start>now&&start+3600000<=expiry;
  });
  return [{profile_id:raw.profile_id,schedule:{slots:[...new Set<string>(slots)].sort()}}];
 });
}
