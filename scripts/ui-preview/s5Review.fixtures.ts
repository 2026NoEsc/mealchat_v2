/** Synthetic UI contract fixtures only. No Auth token, provider, or database connection. */
import { signupFoodOptions, SIGNUP_FOOD_CATALOG_VERSION } from '../../src/screens/food/signupFoodOptions';
const scene = new URLSearchParams(globalThis.location?.search).get('scene');
export const fixtureCalls: string[] = [];
Reflect.set(globalThis, '__s5ReviewCalls', fixtureCalls);
const user = { id: '00000000-0000-4000-8000-000000000001' };
export const useAuth = () => ({ user });
export const getConsentServerMode = () => scene === 'time-legacy' ? 'legacy' : 's1';
const until = () => new Date(Date.now() + 86400000).toISOString();
const catalog = { contract_version: 2, catalog_version: SIGNUP_FOOD_CATALOG_VERSION,
  food_groups: ['cuisine', 'preferred_ingredient', 'food_form', 'spice'].map(group_code => group(group_code)),
  health_groups: ['allergy', 'avoided_food', 'diet_type', 'additional_avoid'].map(group_code => group(group_code)),
  capabilities: { food_v2: true, health_storage_v2: true, health_filter: false, automatic_midpoint: false, recommendation_purposes: ['places'] } };
function group(group_code: string) { return { group_code, selection: ['spice', 'diet_type'].includes(group_code) ? 'single' : 'multiple', min: 0, max: 17,
  sentinel: group_code === 'cuisine' ? 'any' : ['allergy', 'avoided_food', 'diet_type'].includes(group_code) ? 'none' : null,
  options: signupFoodOptions.filter(option => option.group === group_code).map(option => ({ ...option, enabled: option.code !== 'other_input' })) }; }
let food = { contract_version: 2, schema_version: 2, catalog_version: SIGNUP_FOOD_CATALOG_VERSION, requires_update: false, preferences: { cuisines: ['korean'], ingredients: [], forms: [], spice: null }, revision: '1', completed_at: null as string | null, onboarding: { seen_at: null, snoozed_until: null } };
let health = { contract_version: 2, schema_version: 2, catalog_version: SIGNUP_FOOD_CATALOG_VERSION, requires_update: false, status: scene === 'health-saved' || scene === 'health-empty-complete' ? 'complete' : 'not_started',
  allergy_codes: scene === 'health-saved' ? ['shrimp'] : [], avoided_food_codes: [], diet_type_code: scene === 'health-saved' ? 'vegan' : null as string | null,
  additional_avoid_codes: scene === 'health-saved' ? ['exclude_pork'] : [], revision: '1', consent_revision: '3', valid_until: until(), completed_at: scene === 'health-saved' || scene === 'health-empty-complete' ? new Date().toISOString() : null as string | null };
const area = { id: 'fixture-area', label: '시각 검증용 공용 지역', latitude: 37.5665, longitude: 126.978, radius_m: 2000 };
let settings = { contract_version: 2, public_area_id: area.id, area, public_cuisines: [] as string[], revision: '1' };
export const fetchConsentManifest = async () => ({ data: { documents: { health: { version: 'fixture', content_hash: 'a'.repeat(64) } } }, error: null });
export const fetchConsentStatus = async () => ({ data: { server_time: new Date().toISOString(), health: { status: 'granted', valid_until: until() } }, error: null });
export const setOptionalConsent = async () => ({ data: { status: 'granted' }, error: null });
export const fetchRoom = async () => ({ data: { participants: [{ profileId: user.id }] }, error: null });
export const advanceRoomStage = async () => ({ error: null });
export const fetchRoomVoting = async () => ({ data: [], memberCount: 2, error: null });
export const addVotingItem = async () => ({ id: 'fixture-candidate', error: null });
export const toggleVote = async () => null;
export const removeVotingItem = async () => null;
export const confirmRoomVote = async () => null;
export const supabase = {
  auth: { getSession: async () => ({ data: { session: { user } }, error: null }) },
  async rpc(name: string, args: Record<string, unknown>) {
    fixtureCalls.push(name);
    if (name === 'get_food_profile_catalog_v2') return scene === 'time-s1-only' ? { data: null, error: { code: 'PGRST202' } } : { data: catalog, error: null };
    if (name === 'get_my_food_preferences_v2') return { data: food, error: null };
    if (name === 'save_my_food_preferences_v2') { food = { ...food, preferences: args.p_preferences as typeof food.preferences, completed_at: new Date().toISOString(), revision: '2' }; return { data: food, error: null }; }
    if (name === 'get_my_health_preferences_v2') return scene === 'health-v1' ? { data: null, error: { code: 'S1008' } } : { data: health, error: null };
    if (name === 'save_my_health_preferences_v2') {
      health = { ...health, status: 'complete', allergy_codes: args.p_allergy_codes as string[], avoided_food_codes: args.p_avoided_food_codes as never[], diet_type_code: args.p_diet_type_code as string | null, additional_avoid_codes: args.p_additional_avoid_codes as string[], revision: '2' };
      return { data: health, error: null };
    }
    if (name === 'get_room_recommendation_settings_v2') return { data: settings, error: null };
    if (name === 'get_public_meeting_areas_v2') return { data: { contract_version: 2, areas: [area] }, error: null };
    if (name === 'set_room_public_cuisines_v2') { if (scene === 'restaurant-save-failure') return { data: null, error: { code: 'NETWORK' } }; settings = { ...settings, public_cuisines: args.p_cuisines as string[], revision: String(Number(settings.revision) + 1) }; return { data: settings, error: null }; }
    if (name === 'validate_my_recommendation_v2') return { data: { contract_version: 2, status: 'valid', valid_until: until() }, error: null };
    return { data: null, error: { code: 'PGRST202' } };
  },
  functions: { async invoke(_name: string, options: { body: { request_id?: string } }) {
    fixtureCalls.push('invoke');
    if (scene === 'time-400') return { data: null, error: { status: 400 } };
    const places = scene === 'restaurant-save-failure' ? [{place_id:'fixture-place',menu_id:null,place:{name:'저장 실패 뒤 유지되는 식당',address:'시각 검증용 주소',latitude:area.latitude,longitude:area.longitude},rank:1,reason_code:'PUBLIC_AREA_RECOMMENDATION',evidence_status:'unverified'}] : [];
    return { data: { contract_version: 2, request_id: options.body.request_id, valid_until: new Date(Date.now() + 60000).toISOString(), source: 'rules', area, places_status: places.length?'ready':'empty', slots_status: 'not_requested', place_recommendations: places, my_health_filter: 'not_requested', slot_recommendations: [] }, error: null };
  } },
};
