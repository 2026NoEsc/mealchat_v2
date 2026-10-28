import { newConsentRequestId } from '../consents/contracts';
import { getConsentAccess, hasConsentAccess, setConsentAccess } from '../consents/access';
import { record, s5Error, s5Request, stringList, validDate, validRevision } from './foodProfile';
export type PublicMeetingArea = { id: string; label: string; latitude: number; longitude: number; radius_m: number };
export type RoomRecommendationSettings = { contract_version: 2; public_area_id: string | null; area: PublicMeetingArea | null; public_cuisines: string[]; revision: string };
export type PlaceCandidate = { id: string; name: string; address: string; latitude: number; longitude: number; category: string };
export type RestaurantResult = { contract_version: 2; request_id: string; valid_until: string; source: 'gemini' | 'rules'; area: PublicMeetingArea; places_status: 'ready' | 'empty'; slots_status: 'not_requested'; place_recommendations: { place_id: string; menu_id: null; place: { name: string; address: string; latitude: number; longitude: number }; rank: number; reason_code: 'PUBLIC_AREA_RECOMMENDATION'; evidence_status: 'unverified' }[]; my_health_filter: 'not_requested'; slot_recommendations: [] };
function parseArea(value: unknown): PublicMeetingArea {
  const v=record(value);
  if (typeof v.id !== 'string' || typeof v.label !== 'string' || typeof v.latitude !== 'number' || !Number.isFinite(v.latitude) || Math.abs(v.latitude)>90 || typeof v.longitude !== 'number' || !Number.isFinite(v.longitude) || Math.abs(v.longitude)>180 || typeof v.radius_m !== 'number' || !Number.isFinite(v.radius_m) || v.radius_m<=0) throw s5Error('INVALID_RESPONSE');
  return value as PublicMeetingArea;
}
export function parseRecommendationSettings(value: unknown): RoomRecommendationSettings {
  const v=record(value); if(v.contract_version!==2 || !(v.public_area_id===null || typeof v.public_area_id==='string') || !stringList(v.public_cuisines) || !validRevision(v.revision)) throw s5Error('INVALID_RESPONSE');
  if(v.area!==null && parseArea(v.area).id!==v.public_area_id)throw s5Error('INVALID_RESPONSE');
  return value as RoomRecommendationSettings;
}
export const fetchPublicMeetingAreas=()=>s5Request('get_public_meeting_areas_v2',{},value=>{const v=record(value);if(v.contract_version!==2||!Array.isArray(v.areas))throw s5Error('INVALID_RESPONSE');return v.areas.map(parseArea);});
export const fetchRoomRecommendationSettings=(roomId:string)=>s5Request('get_room_recommendation_settings_v2',{p_room_id:roomId},parseRecommendationSettings);
export const setRoomRecommendationArea=(roomId:string,areaId:string,revision:string)=>s5Request('set_room_recommendation_area_v2',{p_room_id:roomId,p_public_area_id:areaId,p_expected_revision:revision},parseRecommendationSettings);
export const setRoomPublicCuisines=(roomId:string,cuisines:string[],revision:string)=>s5Request('set_room_public_cuisines_v2',{p_room_id:roomId,p_cuisines:cuisines,p_expected_revision:revision},parseRecommendationSettings);
export const validateRecommendation=(requestId:string)=>s5Request('validate_my_recommendation_v2',{p_request_id:requestId},value=>{const v=record(value);if(v.contract_version!==2||v.status!=='valid'||!validDate(v.valid_until)||Date.parse(v.valid_until)<=Date.now())throw s5Error('S5004');return v;});
export function parseRestaurantResult(value:unknown):RestaurantResult{
  const v=record(value); if(v.contract_version!==2||typeof v.request_id!=='string'||!validDate(v.valid_until)||Date.parse(v.valid_until)<=Date.now()||!['gemini','rules'].includes(String(v.source))||!['ready','empty'].includes(String(v.places_status))||v.slots_status!=='not_requested'||v.my_health_filter!=='not_requested'||!Array.isArray(v.place_recommendations)||v.place_recommendations.length>3||!Array.isArray(v.slot_recommendations)||v.slot_recommendations.length)throw s5Error('INVALID_RESPONSE');
  parseArea(v.area);
  if((v.places_status==='empty') !== (v.place_recommendations.length===0))throw s5Error('INVALID_RESPONSE');
  for(const raw of v.place_recommendations){const p=record(raw), place=record(p.place);if(typeof p.place_id!=='string'||p.menu_id!==null||!Number.isInteger(p.rank)||p.reason_code!=='PUBLIC_AREA_RECOMMENDATION'||p.evidence_status!=='unverified'||typeof place.name!=='string'||!place.name.trim()||typeof place.address!=='string'||typeof place.latitude!=='number'||!Number.isFinite(place.latitude)||typeof place.longitude!=='number'||!Number.isFinite(place.longitude))throw s5Error('INVALID_RESPONSE');}
  return value as RestaurantResult;
}
export type RecommendationInvoker=(body:{contract_version:2;request_id:string;room_id:string;purpose:'places'},signal:AbortSignal)=>Promise<{data:unknown;error:unknown}>;
const liveInvoke:RecommendationInvoker=async(body,signal)=>(await import('./supabase')).supabase.functions.invoke('schedule-recommend',{body,signal});
/** Server owns collection/aggregation. A timed-out or cancelled ticket may still be working server-side. */
export async function requestRestaurantRecommendation(roomId: string, invoke: RecommendationInvoker = liveInvoke, retryRequestId?: string, signal?: AbortSignal): Promise<RestaurantResult> {
  const userId = getConsentAccess().userId, requestId = retryRequestId ?? newConsentRequestId(), controller = new AbortController();
  const failure = (code: string) => Object.assign(s5Error(code), { requestId });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let onAbort: () => void;
  const aborted = new Promise<never>((_, reject) => { onAbort = () => reject(failure('ABORTED')); controller.signal.addEventListener('abort', onAbort, { once: true }); });
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const work = async () => { for (;;) {
    if (controller.signal.aborted) throw failure('ABORTED');
    if (!hasConsentAccess(userId) || getConsentAccess().userId !== userId) throw s5Error('S1001');
    const { data, error } = await invoke({ contract_version: 2, request_id: requestId, room_id: roomId, purpose: 'places' }, controller.signal);
    if (controller.signal.aborted) throw failure('ABORTED');
    if (!hasConsentAccess(userId) || getConsentAccess().userId !== userId) throw s5Error('S1001');
    if (error) {
      let code = (error as { code?: string }).code;
      let newRequestRequired = (error as { new_request_required?: unknown }).new_request_required;
      const context = (error as { context?: Response }).context;
      if (context && typeof context.clone === 'function') { try { const json = await context.clone().json(); code = json.code ?? code; newRequestRequired = json.new_request_required; } catch { /* Safe generic error. */ } }
      if (getConsentAccess().userId === userId && hasConsentAccess(userId)) {
        if (code === 'S1001' || code === 'S1008') setConsentAccess(userId, code === 'S1001' ? 'required' : 'error');
      }
      throw Object.assign(s5Error(code), { requestId, newRequestRequired: code === 'S5006' && typeof newRequestRequired === 'boolean' ? newRequestRequired : undefined });
    }
    const v = record(data);
    if (v.contract_version === 2 && v.request_id === requestId && ['working', 'pending'].includes(String(v.status))) {
      await new Promise<void>(resolve => {
        const done = () => { clearTimeout(timer); controller.signal.removeEventListener('abort', done); resolve(); };
        const timer = setTimeout(done, 1000); controller.signal.addEventListener('abort', done, { once: true });
      });
      continue;
    }
    const result = parseRestaurantResult(data); if (result.request_id !== requestId) throw s5Error('INVALID_RESPONSE'); return result;
  } };
  try {
    return await Promise.race([aborted, work(), new Promise<never>((_, reject) => {
      timeout = setTimeout(() => { reject(failure('TIMEOUT')); controller.abort(); }, 25000);
    })]);
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', cancel); controller.signal.removeEventListener('abort', onAbort!); controller.abort(); }
}
export function reusableRestaurantRequestId(error: unknown): string | undefined {
  const failed = error as { code?: string; requestId?: string; newRequestRequired?: boolean } | null;
  return typeof failed?.requestId === 'string' && (failed.code === 'TIMEOUT' || failed.code === 'ABORTED' || (failed.code === 'S5006' && failed.newRequestRequired === false)) ? failed.requestId : undefined;
}
