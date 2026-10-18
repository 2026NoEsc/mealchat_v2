import { getConsentAccess, registerSensitiveConsentClearer, setConsentAccess } from '../src/consents/access';
import { configureFoodProfileTransport, parseCatalog, parseFoodProfile, saveFoodProfile, saveHealthProfile, fetchHealthProfile, fetchFoodCatalog, fetchFoodProfile, shouldPromptFood, toggleFoodCode, probeSignupFoodAvailability, s5Request } from '../src/lib/foodProfile';
import { bindSignupFoodDraft, setSignupFoodDraft, takeSignupFoodDraft } from '../src/screens/food/signupFoodDraft';
import { signupFoodOptions } from '../src/screens/food/signupFoodOptions';

const food = { contract_version: 2, schema_version: 2, catalog_version: 'test-v1', requires_update: false, preferences: {}, revision: '9007199254740993', completed_at: null, onboarding: { seen_at: null, snoozed_until: null } };
beforeEach(() => setConsentAccess('self', 'accepted'));
afterEach(() => { configureFoodProfileTransport(); setConsentAccess(null, 'loading'); });
it('keeps the Figma catalog at 67 options without automatically migrating six booleans', () => {
  expect(signupFoodOptions).toHaveLength(67); expect(signupFoodOptions.filter(o => o.code === 'other_input')).toHaveLength(3);
  expect(() => parseFoodProfile({ ...food, preferences: { korean: true } })).toThrow();
  expect(parseFoodProfile(food).preferences).toEqual({});
});
it('keeps any/none exclusive and supports several allergies', () => {
  expect(toggleFoodCode(['korean', 'japanese'], 'any', 'any')).toEqual(['any']);
  expect(toggleFoodCode(['any'], 'korean', 'any')).toEqual(['korean']);
  expect(toggleFoodCode(['shrimp'], 'peanut', 'none')).toEqual(['shrimp', 'peanut']);
  expect(toggleFoodCode(['shrimp', 'peanut'], 'none', 'none')).toEqual(['none']);
});
it('uses revision strings unchanged and never sends a user id or completion time', async () => {
  const rpc = jest.fn(async () => ({ data: food, error: null })); configureFoodProfileTransport(rpc);
  const preferences = { cuisines: ['any'], ingredients: [], forms: [], spice: 'very_hot' };
  await saveFoodProfile('test-v1', preferences, food.revision);
  expect(rpc).toHaveBeenCalledWith('save_my_food_preferences_v2', { p_catalog_version: 'test-v1', p_preferences: preferences, p_expected_revision: '9007199254740993' });
});
it('strips UI sentinels before saving health with the exact consent revision', async () => {
  const rpc = jest.fn(async () => ({ data: null, error: { code: 'S1003' } })); configureFoodProfileTransport(rpc);
  const result = await saveHealthProfile('test-v1', { allergy_codes: ['none'], avoided_food_codes: ['none'], diet_type_code: 'none', additional_avoid_codes: ['none'] }, '7', '11');
  expect(result.error).toMatchObject({ code: 'S1003' });
  expect(rpc).toHaveBeenCalledWith('save_my_health_preferences_v2', { p_catalog_version: 'test-v1', p_allergy_codes: [], p_avoided_food_codes: [], p_diet_type_code: null, p_additional_avoid_codes: [], p_expected_revision: '7', p_consent_revision: '11' });
});
it.each(['allergy_codes', 'avoided_food_codes', 'additional_avoid_codes', 'diet_type_code'])('rejects an unanswered %s before saving any health data', async field => {
  const rpc = jest.fn(); configureFoodProfileTransport(rpc);
  const health = { allergy_codes: ['none'], avoided_food_codes: ['none'], diet_type_code: 'none', additional_avoid_codes: ['none'], [field]: field === 'diet_type_code' ? null : [] };
  expect((await saveHealthProfile('test-v1', health, '0', '3')).error).toMatchObject({ code: 'HEALTH_UNANSWERED' });
  expect(rpc).not.toHaveBeenCalled();
});
it.each(['PGRST202', '42883'])('hides the feature only for a missing S5 RPC (%s)', async code => {
  configureFoodProfileTransport(async () => ({ data: null, error: { code } })); expect((await fetchFoodCatalog()).error).toMatchObject({ code: 'S5_UNAVAILABLE' });
});
it('never treats a network/permission failure as a legacy server', async () => {
  configureFoodProfileTransport(async () => ({ data: null, error: { code: '42501', message: 'private' } })); const result = await fetchFoodCatalog(); expect(result.error).toMatchObject({ code: '42501' }); expect(result.error?.message).not.toContain('private');
});
it('discards an in-flight response after account change', async () => {
  let done!: (v: { data: unknown; error: null }) => void;
  configureFoodProfileTransport(() => new Promise(resolve => { done = resolve; }));
  const pending = fetchFoodProfile(); setConsentAccess('other', 'accepted'); done({ data: food, error: null });
  expect(await pending).toMatchObject({ data: null, error: { code: 'S1001' } });
});
it('shows a first prompt, respects seven-day snooze, and never prompts a completed profile', () => {
  const now = Date.parse('2026-10-18T00:00:00Z'); const initial = parseFoodProfile(food);
  expect(shouldPromptFood(initial, now)).toBe(true);
  const seen = { ...initial, onboarding: { seen_at: new Date(now).toISOString(), snoozed_until: null } };
  expect(shouldPromptFood(seen, now)).toBe(false);
  const later = { ...seen, onboarding: { ...seen.onboarding, snoozed_until: new Date(now + 7 * 86400000).toISOString() } };
  expect(shouldPromptFood(later, now + 7 * 86400000 - 1)).toBe(false); expect(shouldPromptFood(later, now + 7 * 86400000)).toBe(true);
  expect(shouldPromptFood({ ...later, completed_at: new Date(now).toISOString() }, now + 8 * 86400000)).toBe(false);
});
it('binds a signup draft only to the actual id and consumes it once', () => {
  const preferences = { cuisines: ['korean'], ingredients: [], forms: [], spice: null };
  setSignupFoodDraft(preferences); bindSignupFoodDraft(null); expect(takeSignupFoodDraft('self')).toBeNull();
  setSignupFoodDraft(preferences); bindSignupFoodDraft('self'); expect(takeSignupFoodDraft('other')).toBeNull();
  setSignupFoodDraft(preferences); bindSignupFoodDraft('self'); expect(takeSignupFoodDraft('self')).toEqual(preferences); expect(takeSignupFoodDraft('self')).toBeNull();
});
it('rejects a catalog that promises an unavailable health filter', () => {
  expect(() => parseCatalog({ contract_version: 2, catalog_version: 'x', capabilities: { health_filter: true } })).toThrow();
});
it.each([
  [{code:'PGRST202'},false],
  [{code:'42501',message:'permission denied for function get_food_profile_catalog_v2'},true],
  [{code:'42501',message:'unrelated permission failure'},false],
  [{code:'S1001'},false],
])('uses only a known function-presence denial for anonymous signup metadata: %o', async (error, expected) => {
  setConsentAccess(null,'loading');configureFoodProfileTransport(async()=>({data:null,error}));
  expect(await probeSignupFoodAvailability()).toBe(expected);expect((await saveFoodProfile('v1',{cuisines:['any'],ingredients:[],forms:[],spice:null},'0')).error).toMatchObject({code:'S1001'});
});

it.each(['S1003','S1005'])('clears transient optional data on current-owner %s', async code => {
 const clear=jest.fn(),unsubscribe=registerSensitiveConsentClearer(clear);configureFoodProfileTransport(async()=>({data:null,error:{code}}));
 try { await fetchHealthProfile(); expect(clear).toHaveBeenCalledTimes(1);expect(getConsentAccess().state).toBe('accepted'); } finally {unsubscribe();}
});
it('closes the current-owner gate on a required-consent server denial',async()=>{
 configureFoodProfileTransport(async()=>({data:null,error:{code:'S1001'}}));await fetchFoodProfile();expect(getConsentAccess()).toEqual({userId:'self',state:'required'});
});
it.each(['get_my_health_preferences_v2','save_my_health_preferences_v2','get_my_food_preferences_v2'])('keeps S1008 local for %s',async name=>{
 configureFoodProfileTransport(async()=>({data:null,error:{code:'S1008'}}));
 expect((await s5Request(name,{},value=>value)).error).toMatchObject({code:'S1008'});
 expect(getConsentAccess()).toEqual({userId:'self',state:'accepted'});
});
it('closes the gate for recommendation begin S1008',async()=>{
 configureFoodProfileTransport(async()=>({data:null,error:{code:'S1008'}}));await s5Request('begin_room_recommendation_v2',{},value=>value);
 expect(getConsentAccess()).toEqual({userId:'self',state:'error'});
});
it('does not close or clear the new account on a late previous-owner error',async()=>{
 let done!: (value: {data: null;error: {code: string}}) => void;configureFoodProfileTransport(()=>new Promise(resolve=>{done=resolve;}));const pending=fetchFoodProfile();setConsentAccess('other','accepted');const clear=jest.fn(),unsubscribe=registerSensitiveConsentClearer(clear);
 try {done({data:null,error:{code:'S1008'}});await pending;expect(getConsentAccess()).toEqual({userId:'other',state:'accepted'});expect(clear).not.toHaveBeenCalled();}finally{unsubscribe();}
});

it('does not turn a foreground loading guard into a server consent denial',async()=>{
 setConsentAccess('self','loading');const rpc=jest.fn();configureFoodProfileTransport(rpc);expect((await fetchFoodProfile()).error).toMatchObject({code:'S1001'});expect(rpc).not.toHaveBeenCalled();expect(getConsentAccess()).toEqual({userId:'self',state:'loading'});
});
