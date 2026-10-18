import { clearOptionalConsentData, getConsentAccess, hasConsentAccess, setConsentAccess } from '../consents/access';
import { getConsentServerMode } from './consents';

export type FoodPreferences = { cuisines: string[]; ingredients: string[]; forms: string[]; spice: string | null };
export type FoodGroup = { group_code: string; selection: string; min: number; max: number; sentinel: string | null; options: { code: string; label: string; enabled: boolean }[] };
export type FoodCatalog = { contract_version: 2; catalog_version: string; food_groups: FoodGroup[]; health_groups: FoodGroup[]; capabilities: { food_v2: true; health_storage_v2: true; health_filter: false; automatic_midpoint: false; recommendation_purposes: string[] } };
export type FoodProfile = { contract_version: 2; schema_version: 2; catalog_version: string; requires_update: boolean; preferences: FoodPreferences | Record<string, never>; revision: string; completed_at: string | null; onboarding: { seen_at: string | null; snoozed_until: string | null } };
export type HealthProfile = { contract_version: 2; schema_version: 2; catalog_version: string; requires_update: boolean; status: 'not_started' | 'complete'; allergy_codes: string[]; avoided_food_codes: string[]; diet_type_code: string | null; additional_avoid_codes: string[]; revision: string; consent_revision: string; valid_until: string; completed_at: string | null };
export type HealthInput = Pick<HealthProfile, 'allergy_codes' | 'avoided_food_codes' | 'diet_type_code' | 'additional_avoid_codes'>;
export const unansweredHealth = (health: HealthInput) => [!health.allergy_codes.length && '알레르기', !health.avoided_food_codes.length && '못 먹는 음식', !health.additional_avoid_codes.length && '추가로 피할 것', health.diet_type_code === null && '식단 유형'].filter((label): label is string => Boolean(label));
export type S5Transport = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
const live: S5Transport = async (name, args) => (await import('./supabase')).supabase.rpc(name, args);
let transport = live;
/** Isolated contract/local-stack fixtures; production always uses the current authenticated client. */
export function configureFoodProfileTransport(next?: S5Transport) { transport = next ?? live; }
/** Anonymous signup probes only function availability. A denial never grants access; writes still require the accepted owner/session. */
export async function probeSignupFoodAvailability(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([Promise.resolve(transport('get_food_profile_catalog_v2', {})), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 10000); })]);
    if (!result.error) { parseCatalog(result.data); return true; }
    const error = result.error as {code?: string; message?: string};
    return error.code === '42501' && /permission denied for function get_food_profile_catalog_v2\b/i.test(error.message ?? '');
  } catch { return false; }
  finally { clearTimeout(timer); }
}
export const s5Error = (code = 'S5006') => Object.assign(new Error(foodProfileErrorMessage({ code })), { code });
export function foodProfileErrorMessage(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'S1003') return '건강정보 동의를 확인한 뒤 다시 입력해 주세요.';
  if (code === 'HEALTH_UNANSWERED') return '아직 고르지 않은 항목이 있어요. 없음도 직접 골라 주세요.';
  if (code === 'S1004') return '다른 곳에서 변경됐어요. 다시 불러온 뒤 선택해 주세요.';
  if (code === 'S5001') return '선택 항목이 바뀌었어요. 다시 불러와 주세요.';
  if (code === 'S5002') return '방장이 공용 만남 지역을 골라 주세요.';
  if (code === 'S5003' || code === 'S5004') return '추천 조건이 바뀌었거나 시간이 지났어요. 다시 추천받아 주세요.';
  if (code === 'S5005') return '추천 요청이 많아요. 잠시 후 다시 시도해 주세요.';
  if (code === 'S5_UNAVAILABLE') return '이 서버에서는 아직 사용할 수 없어요.';
  if (code === 'S1008') return '현재 앱에서 처리할 수 없는 정보예요. 앱을 업데이트한 뒤 다시 확인해 주세요.';
  if (code === 'S1001' || code === '42501') return '로그인과 약관 동의 상태를 다시 확인해 주세요.';
  return '처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
}
export const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw s5Error('INVALID_RESPONSE');
  return v as Record<string, unknown>;
};
export const validRevision = (v: unknown): v is string => typeof v === 'string' && /^(0|[1-9]\d*)$/.test(v);
export const validDate = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
const nullableDate = (v: unknown) => v === null || validDate(v);
export const stringList = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string') && new Set(v).size === v.length;
export function parseCatalog(value: unknown): FoodCatalog {
  const v = record(value), caps = record(v.capabilities);
  if (v.contract_version !== 2 || typeof v.catalog_version !== 'string' || !v.catalog_version || caps.food_v2 !== true || caps.health_storage_v2 !== true || caps.health_filter !== false || caps.automatic_midpoint !== false || !stringList(caps.recommendation_purposes)) throw s5Error('INVALID_RESPONSE');
  for (const [key, codes] of [['food_groups', ['cuisine', 'preferred_ingredient', 'food_form', 'spice']], ['health_groups', ['allergy', 'avoided_food', 'diet_type', 'additional_avoid']]] as const) {
    const groups = v[key];
    if (!Array.isArray(groups) || groups.length !== codes.length || new Set(groups.map(g => record(g).group_code)).size !== codes.length) throw s5Error('INVALID_RESPONSE');
    for (const raw of groups) {
      const g = record(raw);
      if (!codes.includes(g.group_code as never) || !['single', 'multiple'].includes(String(g.selection)) || !Number.isInteger(g.min) || !Number.isInteger(g.max) || !(g.sentinel === null || typeof g.sentinel === 'string') || !Array.isArray(g.options) || !g.options.length) throw s5Error('INVALID_RESPONSE');
      if (new Set(g.options.map(o => record(o).code)).size !== g.options.length) throw s5Error('INVALID_RESPONSE');
      for (const rawOption of g.options) { const o = record(rawOption); if (typeof o.code !== 'string' || typeof o.label !== 'string' || typeof o.enabled !== 'boolean') throw s5Error('INVALID_RESPONSE'); }
    }
  }
  return value as FoodCatalog;
}
export function parseFoodProfile(value: unknown): FoodProfile {
  const v = record(value), p = record(v.preferences), onboarding = record(v.onboarding);
  if (v.contract_version !== 2 || v.schema_version !== 2 || typeof v.catalog_version !== 'string' || typeof v.requires_update !== 'boolean' || !validRevision(v.revision) || !nullableDate(v.completed_at) || !nullableDate(onboarding.seen_at) || !nullableDate(onboarding.snoozed_until)) throw s5Error('INVALID_RESPONSE');
  if (Object.keys(p).length && (Object.keys(p).length !== 4 || !stringList(p.cuisines) || !p.cuisines.length || !stringList(p.ingredients) || !stringList(p.forms) || !(p.spice === null || typeof p.spice === 'string'))) throw s5Error('INVALID_RESPONSE');
  return value as FoodProfile;
}
export function parseHealthProfile(value: unknown): HealthProfile {
  const v = record(value);
  if (v.contract_version !== 2 || v.schema_version !== 2 || typeof v.catalog_version !== 'string' || typeof v.requires_update !== 'boolean' || !['complete', 'not_started'].includes(String(v.status)) || !stringList(v.allergy_codes) || !stringList(v.avoided_food_codes) || !stringList(v.additional_avoid_codes) || !(v.diet_type_code === null || typeof v.diet_type_code === 'string') || !validRevision(v.revision) || !validRevision(v.consent_revision) || !validDate(v.valid_until) || !nullableDate(v.completed_at)) throw s5Error('INVALID_RESPONSE');
  return value as HealthProfile;
}
export async function s5Request<T>(name: string, args: Record<string, unknown>, parse: (v: unknown) => T) {
  const owner = getConsentAccess().userId;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (getConsentServerMode() === 'legacy') throw s5Error('S5_UNAVAILABLE');
    if (!owner || !hasConsentAccess(owner)) throw s5Error('S1001');
    if (transport === live && /^(save_|mark_|set_)/.test(name)) {
      const session = await (await import('./supabase')).supabase.auth.getSession();
      if (session.error || session.data.session?.user.id !== owner || getConsentAccess().userId !== owner || !hasConsentAccess(owner)) throw s5Error('S1001');
    }
    const result = await Promise.race([Promise.resolve(transport(name, args)), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(s5Error()), 10000); })]);
    if (getConsentAccess().userId !== owner || !hasConsentAccess(owner)) throw s5Error('S1001');
    if (result.error) {
      const code = (result.error as { code?: string }).code;
      // Only a server denial closes the accepted owner's gate. A foreground loading guard is not a denial.
      if (getConsentAccess().userId === owner) {
        if (code === 'S1003' || code === 'S1005') clearOptionalConsentData();
        // Health S1008 requires local v1-data recovery, not another required-terms gate.
        if (code === 'S1001' || (code === 'S1008' && name === 'begin_room_recommendation_v2')) setConsentAccess(owner, code === 'S1001' ? 'required' : 'error');
      }
      throw s5Error(code === 'PGRST202' || code === '42883' ? 'S5_UNAVAILABLE' : code);
    }
    return { data: parse(result.data), error: null };
  } catch (e) { return { data: null, error: s5Error((e as { code?: string })?.code) }; }
  finally { clearTimeout(timer); }
}
export const fetchFoodCatalog = () => s5Request('get_food_profile_catalog_v2', {}, parseCatalog);
export const fetchFoodProfile = () => s5Request('get_my_food_preferences_v2', {}, parseFoodProfile);
export const saveFoodProfile = (catalog: string, preferences: FoodPreferences | Record<string, never>, revision: string) => s5Request('save_my_food_preferences_v2', { p_catalog_version: catalog, p_preferences: preferences, p_expected_revision: revision }, parseFoodProfile);
export const markFoodPrompt = (action: 'shown' | 'later', revision: string) => s5Request('mark_food_profile_prompt_v2', { p_action: action, p_expected_revision: revision }, parseFoodProfile);
export const fetchHealthProfile = () => s5Request('get_my_health_preferences_v2', {}, parseHealthProfile);
export const saveHealthProfile = (catalog: string, health: HealthInput, revision: string, consentRevision: string) => unansweredHealth(health).length
  ? Promise.resolve({ data: null, error: s5Error('HEALTH_UNANSWERED') })
  : s5Request('save_my_health_preferences_v2', { p_catalog_version: catalog, p_allergy_codes: health.allergy_codes.filter(c => c !== 'none'), p_avoided_food_codes: health.avoided_food_codes.filter(c => c !== 'none'), p_diet_type_code: health.diet_type_code === 'none' ? null : health.diet_type_code, p_additional_avoid_codes: health.additional_avoid_codes.filter(c => c !== 'none'), p_expected_revision: revision, p_consent_revision: consentRevision }, parseHealthProfile);
export function toggleFoodCode(selected: string[], code: string, sentinel?: string | null) {
  if (selected.includes(code)) return selected.filter(v => v !== code);
  return code === sentinel ? [code] : [...selected.filter(v => v !== sentinel), code];
}
export function shouldPromptFood(profile: FoodProfile, now = Date.now()) {
  return !profile.completed_at && (!profile.onboarding.seen_at || (profile.onboarding.snoozed_until !== null && Date.parse(profile.onboarding.snoozed_until) <= now));
}
