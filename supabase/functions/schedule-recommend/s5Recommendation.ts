// S5 places-only pipeline. All network dependencies are injected for local tests.
type Dict = Record<string, unknown>;
type Env = { get(name: string): string | undefined };
type AdminRpc = (name: string, args: Dict) => PromiseLike<{ data: unknown; error: { code?: string } | null }>;
type Area = { id: string; label: string; latitude: number; longitude: number; radius_m: number };
export type S5Place = { id: string; name: string; address: string; latitude: number; longitude: number; cuisine_codes: string[] };
const uuid = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const obj = (x: unknown): x is Dict => !!x && typeof x === "object" && !Array.isArray(x);
const errorMap: Record<string, [number,string]> = {
 "22023":[400,"INVALID_INPUT"],"42501":[403,"NOT_ALLOWED"],"23503":[409,"PROFILE_NOT_READY"],
 S1001:[403,"TERMS_REQUIRED"],S1003:[403,"HEALTH_CONSENT_REQUIRED"],S1004:[409,"REVISION_CONFLICT"],
 S1006:[503,"CONSENT_CONFIGURATION_UNAVAILABLE"],S1007:[409,"IDEMPOTENCY_CONFLICT"],S1008:[426,"CLIENT_UPDATE_REQUIRED"],
 S5001:[409,"CATALOG_CHANGED"],S5002:[409,"LOCATION_SELECTION_REQUIRED"],S5003:[409,"RECOMMENDATION_CONTEXT_CHANGED"],
 S5004:[410,"RECOMMENDATION_EXPIRED"],S5005:[429,"RECOMMENDATION_RATE_LIMITED"],S5006:[503,"PLACE_PROVIDER_UNAVAILABLE"]
};
class S5Failure extends Error { constructor(readonly code: string) { super(code); } }
export function s5FailureResponse(code: string, newRequestRequired=true): Response {
 const [status,error]=errorMap[code] ?? errorMap.S1006;
 return Response.json({code: errorMap[code] ? code : "S1006",error,...(code==="S5006"?{new_request_required:newRequestRequired}:{})},{status,headers:status===429?{"Retry-After":"60"}:undefined});
}
export async function readBoundedJson(request: Request | Response, maxBytes=32768): Promise<unknown> {
 const reader=request.body?.getReader(); if(!reader) throw new S5Failure("22023");
 const chunks: Uint8Array[]=[];let size=0;
 try {
  while(true) { const part=await reader.read(); if(part.done)break;size+=part.value.byteLength;
   if(size>maxBytes) { await reader.cancel();throw new S5Failure("22023"); } chunks.push(part.value); }
  const buffer=new Uint8Array(size);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(buffer));
 } catch(error) { if(error instanceof S5Failure)throw error;throw new S5Failure("22023"); }
 finally { reader.releaseLock(); }
}
export function validateS5Request(value: unknown): value is {contract_version:2;request_id:string;room_id:string;purpose:"places"} {
 return obj(value) && Object.keys(value).sort().join(",")==="contract_version,purpose,request_id,room_id"
 && value.contract_version===2 && uuid(value.request_id) && uuid(value.room_id) && value.purpose==="places"
 && new TextEncoder().encode(JSON.stringify(value)).length<=8192;
}
export function distanceM(a: Area,lat:number,lon:number):number {
 const rad=(x:number)=>x*Math.PI/180;
 const q=Math.sin(rad(lat-a.latitude)/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(lat))*Math.sin(rad(lon-a.longitude)/2)**2;
 return 6371000*2*Math.asin(Math.sqrt(Math.min(1,q)));
}
function cuisine(category:string):string[] {
 if(/한식/.test(category))return ["korean"];if(/일식|초밥/.test(category))return ["japanese"];
 if(/중식|중국/.test(category))return ["chinese"];if(/양식|패밀리레스토랑|피자|파스타/.test(category))return ["western"];
 if(/분식/.test(category))return ["snack_food"];if(/동남아|베트남|태국/.test(category))return ["southeast_asian"];
 return [];
}
export function normalizeS5Pois(value:unknown,area:Area):S5Place[] {
 if(!obj(value)||!obj(value.searchPoiInfo)||!obj(value.searchPoiInfo.pois)||!Array.isArray(value.searchPoiInfo.pois.poi))throw new S5Failure("S5006");
 const found=new Map<string,S5Place>();
 for(const raw of value.searchPoiInfo.pois.poi.slice(0,200)) {
  if(!obj(raw))continue;
  const id=typeof raw.id==="string"?raw.id:"",name=typeof raw.name==="string"?raw.name.trim():"";
  const lat=typeof raw.frontLat==="string"&&raw.frontLat.trim()?Number(raw.frontLat):NaN;
  const lon=typeof raw.frontLon==="string"&&raw.frontLon.trim()?Number(raw.frontLon):NaN;
  const category=["upperBizName","middleBizName","lowerBizName","detailBizName"].map(k=>typeof raw[k]==="string"?raw[k]:"").join(" ");
  if(!/음식|식음|한식|중식|일식|분식|전문음식점|레스토랑/.test(category)||!/^[A-Za-z0-9_-]{1,80}$/.test(id)||!name||name.length>160||
   !Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||distanceM(area,lat,lon)>area.radius_m)continue;
  const address=["upperAddrName","middleAddrName","lowerAddrName","detailAddrName","firstNo","secondNo"].map(k=>typeof raw[k]==="string"?raw[k].trim():"").filter(Boolean).join(" ");
  if(address.length>300)continue;
  if(!found.has(id))found.set(id,{id,name,address,latitude:lat,longitude:lon,cuisine_codes:cuisine(category)});
 }
 return [...found.values()].sort((a,b)=>a.id.localeCompare(b.id)).slice(0,12);
}
export function buildS5GeminiPayload(places:S5Place[],keywords:string[]):Dict {
 return {
  contents:[{parts:[{text:JSON.stringify({task:"Rank every supplied public restaurant candidate. Return only the full order of temporary ids.",
   keywords,candidates:places.map((p,i)=>({id:"p"+(i+1),cuisine_codes:p.cuisine_codes}))})}]}],
  generationConfig:{temperature:0,maxOutputTokens:512,responseMimeType:"application/json",
   responseJsonSchema:{type:"object",properties:{order:{type:"array",items:{type:"string"},minItems:places.length,maxItems:places.length}},required:["order"],additionalProperties:false}}
 };
}
export function parseS5Ranking(response:unknown,n:number):number[] {
 if(!obj(response)||!Array.isArray(response.candidates)||!obj(response.candidates[0])||!obj(response.candidates[0].content)||!Array.isArray(response.candidates[0].content.parts))throw new Error("bad ranking");
 const parts=response.candidates[0].content.parts;
 const text=parts.filter(obj).filter(p=>p.thought!==true&&typeof p.text==="string").map(p=>p.text).join("");
 const data:unknown=JSON.parse(text);
 if(!obj(data)||Object.keys(data).join(",")!=="order"||!Array.isArray(data.order)||data.order.length!==n||new Set(data.order).size!==n)throw new Error("bad ranking");
 return data.order.map(x=>{if(typeof x!=="string"||!/^p[1-9][0-9]*$/.test(x))throw new Error("bad ranking");
  const i=Number(x.slice(1))-1;if(i<0||i>=n)throw new Error("bad ranking");return i;});
}
export function sanitizeS5Result(value:unknown):Dict {
 if(!obj(value)||value.contract_version!==2||!uuid(value.request_id)||typeof value.valid_until!=="string"||!Number.isFinite(Date.parse(value.valid_until))
 || !["gemini","rules"].includes(String(value.source))||!obj(value.area)||!Array.isArray(value.place_recommendations)||value.place_recommendations.length>3
 || !["ready","empty"].includes(String(value.places_status))||value.slots_status!=="not_requested"||value.my_health_filter!=="not_requested")throw new S5Failure("S1006");
 if(Date.parse(value.valid_until)<=Date.now())throw new S5Failure("S5004");
 const a=value.area;
 if(typeof a.id!=="string"||typeof a.label!=="string"||typeof a.latitude!=="number"||!Number.isFinite(a.latitude)||Math.abs(a.latitude)>90
 ||typeof a.longitude!=="number"||!Number.isFinite(a.longitude)||Math.abs(a.longitude)>180||typeof a.radius_m!=="number"||a.radius_m<100||a.radius_m>2000)throw new S5Failure("S1006");
 const area:Area={id:a.id,label:a.label,latitude:a.latitude,longitude:a.longitude,radius_m:a.radius_m};
 const ids=new Set<string>();
 const places=value.place_recommendations.map((r,i)=>{
  if(!obj(r)||!obj(r.place)||typeof r.place_id!=="string"||!/^[A-Za-z0-9_-]{1,80}$/.test(r.place_id)||ids.has(r.place_id)
   ||r.rank!==i+1||r.menu_id!==null||r.evidence_status!=="unverified"||r.reason_code!=="PUBLIC_AREA_RECOMMENDATION")throw new S5Failure("S1006");
  ids.add(r.place_id);const p=r.place;
  if(typeof p.name!=="string"||!p.name||p.name.length>160||typeof p.address!=="string"||p.address.length>300||
   typeof p.latitude!=="number"||!Number.isFinite(p.latitude)||typeof p.longitude!=="number"||!Number.isFinite(p.longitude)||
   Math.abs(p.latitude)>90||Math.abs(p.longitude)>180||distanceM(area,p.latitude,p.longitude)>area.radius_m)throw new S5Failure("S1006");
  return {place_id:r.place_id,menu_id:null,place:{name:p.name,address:p.address,latitude:p.latitude,longitude:p.longitude},
   rank:i+1,reason_code:"PUBLIC_AREA_RECOMMENDATION",evidence_status:"unverified"};
 });
 if((places.length===0)!==(value.places_status==="empty"))throw new S5Failure("S1006");
 return {contract_version:2,request_id:value.request_id,valid_until:value.valid_until,source:value.source,area,
  places_status:value.places_status,slots_status:"not_requested",place_recommendations:places,slot_recommendations:[],my_health_filter:"not_requested"};
}

export async function runS5Places(body:unknown,env:Env,authorization:string|null,admin:AdminRpc,rpcFetch:typeof fetch=fetch):Promise<Response> {
 if(obj(body)&&body.contract_version===2&&typeof body.purpose==="string"&&body.purpose!=="places")return s5FailureResponse("S1008");
 if(!validateS5Request(body))return s5FailureResponse("22023");
 const url=env.get("SUPABASE_URL"),key=env.get("SUPABASE_ANON_KEY");
 if(!url||!key||!authorization)return s5FailureResponse("S1006");
 try {
  const begin=async():Promise<Dict>=>{
   const response=await rpcFetch(url+"/rest/v1/rpc/begin_room_recommendation_v2",{
    method:"POST",headers:{apikey:key,Authorization:authorization,"Content-Type":"application/json"},
    body:JSON.stringify({p_room_id:body.room_id,p_request_id:body.request_id,p_purpose:"places"}),signal:AbortSignal.timeout(8000),redirect:"error"});
   const ticket=await readBoundedJson(response);
   if(!response.ok)throw new S5Failure(obj(ticket)&&typeof ticket.code==="string"?ticket.code:"S1006");
   if(!obj(ticket)||ticket.contract_version!==2||ticket.request_id!==body.request_id)throw new S5Failure("S1006");
   return ticket;
  };
  const responseForTicket=(ticket:Dict):Response|null=>{
   if(ticket.status==="complete"&&obj(ticket.result))return Response.json(sanitizeS5Result(ticket.result));
   if(ticket.status==="working")return Response.json({contract_version:2,request_id:body.request_id,status:"working",valid_until:ticket.valid_until,result:null},{status:202,headers:{"Retry-After":"1"}});
   if(ticket.status!=="pending")throw new S5Failure("S1006");
   return null;
  };
  const ticket=await begin();
  const existing=responseForTicket(ticket);if(existing)return existing;
  // A missing key leaves the ticket pending; the same id can be retried after configuration repair.
  const tmapKey=env.get("TMAP_API_KEY")?.trim();if(!tmapKey)return s5FailureResponse("S5006",false);
  const claim=await admin("claim_recommendation_work_v2",{p_request_id:body.request_id});
  if(claim.error) {
   if(claim.error.code==="42501") {
    // Only user-scoped begin can recover a race. Never turn a genuine denial into success.
    const recovered=responseForTicket(await begin());if(recovered)return recovered;
   }
   throw new S5Failure(claim.error.code??"S1006");
  }
  const work=claim.data;
  if(!obj(work)||!uuid(work.work_token)||!obj(work.area)||!Array.isArray(work.keywords)||work.keywords.length>5||
   !work.keywords.every(x=>typeof x==="string"&&/^[a-z][a-z0-9_]{0,63}$/.test(x)))throw new S5Failure("S1006");
  const a=work.area;
  if(typeof a.id!=="string"||typeof a.label!=="string"||typeof a.latitude!=="number"||!Number.isFinite(a.latitude)||Math.abs(a.latitude)>90||
   typeof a.longitude!=="number"||!Number.isFinite(a.longitude)||Math.abs(a.longitude)>180||typeof a.radius_m!=="number"||a.radius_m<100||a.radius_m>2000)throw new S5Failure("S1006");
  const area:Area={id:a.id,label:a.label,latitude:a.latitude,longitude:a.longitude,radius_m:a.radius_m};
  const search=new URL("https://apis.openapi.sk.com/tmap/pois/search/around");
  search.search=new URLSearchParams({version:"1",centerLat:String(area.latitude),centerLon:String(area.longitude),radius:String(Math.ceil(area.radius_m/1000)),
   categories:"음식",count:"12",page:"1",reqCoordType:"WGS84GEO",resCoordType:"WGS84GEO",sort:"distance"}).toString();
  let places:S5Place[];
  try {
   const poi=await rpcFetch(search,{headers:{appKey:tmapKey,Accept:"application/json"},signal:AbortSignal.timeout(8000),redirect:"error"});
   if(!poi.ok)throw new Error("poi unavailable");
   places=normalizeS5Pois(await readBoundedJson(poi,2*1024*1024),area);
  } catch {
   // Terminal provider failure is explicit for subsequent requests with this id.
   try { const failed=await admin("fail_recommendation_work_v2",{p_request_id:body.request_id,p_work_token:work.work_token});if(failed.error)console.warn("S5_FAILURE_RECORD_UNAVAILABLE"); }
   catch { console.warn("S5_FAILURE_RECORD_UNAVAILABLE"); }
   throw new S5Failure("S5006");
  }
  const keywords=work.keywords as string[];
  let order=places.map((_p,i)=>i).sort((i,j)=>{
   const score=(p:S5Place)=>p.cuisine_codes.filter(c=>keywords.includes(c)).length;
   return score(places[j])-score(places[i])||places[i].id.localeCompare(places[j].id);
  });
  let source="rules";const geminiKey=env.get("GEMINI_API_KEY");
  if(geminiKey&&places.length>0) {
   try {
    const ranked=await rpcFetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent",{
     method:"POST",headers:{"x-goog-api-key":geminiKey,"Content-Type":"application/json"},body:JSON.stringify(buildS5GeminiPayload(places,keywords)),
     signal:AbortSignal.timeout(8000),redirect:"error"});
    if(!ranked.ok)throw new Error("model unavailable");
    order=parseS5Ranking(await readBoundedJson(ranked,131072),places.length);source="gemini";
   } catch { console.warn("S5_GEMINI_FALLBACK"); }
  }
  const done=await admin("finalize_recommendation_work_v2",{p_request_id:body.request_id,p_work_token:work.work_token,
   p_candidates:{places},p_model_ranking:order.map(i=>places[i].id),p_source:source});
  if(done.error)throw new S5Failure(done.error.code??"S1006");
  if(!obj(done.data)||done.data.contract_version!==2||done.data.request_id!==body.request_id)throw new S5Failure("S1006");
  return Response.json(sanitizeS5Result(done.data));
 } catch(error) { return s5FailureResponse(error instanceof S5Failure?error.code:"S1006"); }
}
