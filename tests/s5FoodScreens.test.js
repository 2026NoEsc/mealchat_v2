const React = require('react');
const { act, create } = require('react-test-renderer');
const { Text } = require('react-native');
jest.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: ({children}) => children, useSafeAreaInsets: () => ({top:0,bottom:0,left:0,right:0}) }));
jest.mock('../src/theme/keyboard', () => ({ useKeyboardOverlap: () => ({overlap:0,remeasure:jest.fn()}) }));
jest.mock('../src/auth/AuthProvider', () => ({useAuth:jest.fn()}));
jest.mock('../src/navigation/NavigationContext', () => ({useNavigation:jest.fn()}));
jest.mock('../src/lib/foodProfile', () => ({...jest.requireActual('../src/lib/foodProfile'),fetchFoodCatalog:jest.fn(),fetchFoodProfile:jest.fn(),saveFoodProfile:jest.fn(),fetchHealthProfile:jest.fn(),saveHealthProfile:jest.fn(),markFoodPrompt:jest.fn()}));
jest.mock('../src/lib/consents', () => ({getConsentServerMode:()=> 's1',fetchConsentManifest:jest.fn(),fetchConsentStatus:jest.fn(),setOptionalConsent:jest.fn()}));
const {setConsentAccess}=require('../src/consents/access');
const api=require('../src/lib/foodProfile'); const consent=require('../src/lib/consents');
const {useAuth}=require('../src/auth/AuthProvider');const {useNavigation}=require('../src/navigation/NavigationContext');
const FoodProfileScreen=require('../src/screens/food/FoodProfileScreen').default;
const FoodProfilePrompt=require('../src/screens/food/FoodProfilePrompt').default;
const {setSignupFoodDraft,bindSignupFoodDraft}=require('../src/screens/food/signupFoodDraft');
const {SIGNUP_FOOD_CATALOG_VERSION,signupFoodOptions}=require('../src/screens/food/signupFoodOptions');
const catalog={contract_version:2,catalog_version:'v1',food_groups:[],health_groups:[],capabilities:{food_v2:true,health_storage_v2:true,health_filter:false,automatic_midpoint:false,recommendation_purposes:['places']}};
for(const code of ['cuisine','preferred_ingredient','food_form','spice','allergy','avoided_food','diet_type','additional_avoid']){
  const health=['allergy','avoided_food','diet_type','additional_avoid'].includes(code);catalog[health?'health_groups':'food_groups'].push({group_code:code,selection:['spice','diet_type'].includes(code)?'single':'multiple',min:0,max:17,sentinel:code==='cuisine'?'any':['allergy','avoided_food','diet_type'].includes(code)?'none':null,options:signupFoodOptions.filter(o=>o.group===code).map(o=>({...o,enabled:o.code!=='other_input'}))});
}
const food={contract_version:2,schema_version:2,catalog_version:'v1',requires_update:false,preferences:{cuisines:['korean'],ingredients:[],forms:[],spice:null},revision:'1',completed_at:null,onboarding:{seen_at:null,snoozed_until:null}};
const health={contract_version:2,schema_version:2,catalog_version:'v1',requires_update:false,status:'not_started',allergy_codes:[],avoided_food_codes:[],diet_type_code:null,additional_avoid_codes:[],revision:'0',consent_revision:'3',valid_until:new Date(Date.now()+86400000).toISOString(),completed_at:null};
let renderer,navigation;
const text=root=>root.findAllByType(Text).map(n=>n.props.children).flat().filter(x=>typeof x==='string').join(' ');
const target=(root,label)=>root.findAll(n=>n.props.accessibilityLabel===label&&n.props.accessibilityRole==='button'&&typeof n.props.onPress==='function').at(-1);
async function press(label){const button=target(renderer.root,label);expect(button).toBeDefined();await act(async()=>button.props.onPress());}
async function choose(role,label){const node=renderer.root.findAll(n=>n.props.accessibilityRole===role&&n.props.accessibilityLabel===label&&n.props.onPress).at(-1);expect(node).toBeDefined();await act(async()=>node.props.onPress());}
async function chooseNoAvoidedFood(){await press('못 먹는 음식, 아직 고르지 않았어요');await choose('checkbox','없음');}
async function mount(props={}){await act(async()=>{renderer=create(React.createElement(FoodProfileScreen,props));});return renderer.root;}
beforeEach(()=>{
 jest.clearAllMocks();bindSignupFoodDraft(null);setConsentAccess('A','accepted');useAuth.mockReturnValue({user:{id:'A'}});navigation={current:{name:'FoodProfile',params:{onboarding:true}},goBack:jest.fn(),navigate:jest.fn()};useNavigation.mockReturnValue(navigation);
 api.fetchFoodCatalog.mockResolvedValue({data:catalog,error:null});api.fetchFoodProfile.mockResolvedValue({data:food,error:null});api.saveFoodProfile.mockResolvedValue({data:{...food,revision:'2',completed_at:new Date().toISOString()},error:null});api.fetchHealthProfile.mockResolvedValue({data:health,error:null});api.saveHealthProfile.mockResolvedValue({data:{...health,status:'complete'},error:null});api.markFoodPrompt.mockResolvedValue({data:food,error:null});
 consent.fetchConsentManifest.mockResolvedValue({data:{documents:{health:{version:'health-v1',content_hash:'a'.repeat(64),canonical_content:'{}'}}},error:null});consent.fetchConsentStatus.mockResolvedValue({data:{required:{status:'accepted'},server_time:new Date().toISOString(),health:{status:'declined',revision:'2',valid_until:null}},error:null});consent.setOptionalConsent.mockResolvedValue({data:{status:'granted'},error:null});
});
afterEach(async()=>{if(renderer)await act(async()=>renderer.unmount());renderer=null;api.configureFoodProfileTransport();setConsentAccess(null,'loading');jest.restoreAllMocks();});
it('saves STEP1 before asking again for declined health consent and proceeds after refusal without storing health',async()=>{
 await mount();expect(text(renderer.root)).not.toContain('STEP 3 / 4');await press('다음');expect(api.saveFoodProfile).toHaveBeenCalledWith('v1',food.preferences,'1');expect(text(renderer.root)).toContain('건강정보 수집·이용 동의');expect(api.fetchHealthProfile).not.toHaveBeenCalled();
 consent.setOptionalConsent.mockImplementationOnce(async()=>{require('../src/consents/access').clearOptionalConsentData();return {data:{status:'declined'},error:null};});await press('동의하지 않고 계속');expect(consent.setOptionalConsent).toHaveBeenCalledWith(expect.objectContaining({p_kind:'health',p_action:'decline',p_source:'food_step2'}));expect(api.saveHealthProfile).not.toHaveBeenCalled();expect(navigation.goBack).toHaveBeenCalledTimes(1);
});
it('grants health only on explicit action, allows multiple allergies and saves exact revision',async()=>{
 await mount();await press('다음');await press('동의하고 입력하기');expect(consent.setOptionalConsent).toHaveBeenCalledWith(expect.objectContaining({p_action:'grant',p_expected_revision:'2',p_source:'food_step2'}));
 for(const label of ['새우','땅콩']){const chip=renderer.root.findAll(n=>n.props.accessibilityRole==='checkbox'&&n.props.accessibilityLabel===label&&n.props.onPress).at(-1);await act(async()=>chip.props.onPress());}
 await chooseNoAvoidedFood();
 await press('식단 제한, 아직 고르지 않았어요');await choose('radio','식단 제한 없음');await choose('checkbox','상관없음');
 await press('완료');expect(api.saveHealthProfile).toHaveBeenCalledWith('v1',expect.objectContaining({allergy_codes:['shrimp','peanut']}),'0','3');expect(navigation.goBack).toHaveBeenCalled();
});
it('opens STEP2 without another grant when the server reports unexpired valid consent',async()=>{
 consent.fetchConsentStatus.mockResolvedValueOnce({data:{server_time:new Date().toISOString(),health:{status:'granted',valid_until:health.valid_until}},error:null});await mount();await press('다음');expect(text(renderer.root)).toContain('피해야 할 음식이 있나요');expect(consent.setOptionalConsent).not.toHaveBeenCalled();expect(api.fetchHealthProfile).toHaveBeenCalledTimes(1);
});
it('does not present an unanswered diet as an explicit no-restriction selection',async()=>{
 consent.fetchConsentStatus.mockResolvedValueOnce({data:{server_time:new Date().toISOString(),health:{status:'granted',valid_until:health.valid_until}},error:null});await mount();await press('다음');await press('식단 제한, 아직 고르지 않았어요');
 const none=renderer.root.findAll(n=>n.props.accessibilityRole==='radio'&&n.props.accessibilityLabel==='식단 제한 없음'&&n.props.onPress).at(-1);expect(none.props.accessibilityState.checked).toBe(false);await act(async()=>none.props.onPress());expect(renderer.root.findAll(n=>n.props.accessibilityRole==='radio'&&n.props.accessibilityLabel==='식단 제한 없음'&&n.props.onPress).at(-1).props.accessibilityState.checked).toBe(true);
});
it('keeps STEP1 saved while surfacing a health load error and never invents completion',async()=>{
 api.fetchHealthProfile.mockResolvedValueOnce({data:null,error:{code:'S1008'}});await mount();await press('다음');await press('동의하고 입력하기');expect(text(renderer.root)).toContain('이전 건강정보');expect(target(renderer.root,'건강정보 선택 동의 관리')).toBeDefined();expect(api.saveHealthProfile).not.toHaveBeenCalled();
});
it.each(['get','save'])('keeps health S1008 recovery visible through real s5Request (%s)',async mode=>{
 const actual=jest.requireActual('../src/lib/foodProfile');
 api.configureFoodProfileTransport(async()=>({data:null,error:{code:'S1008'}}));
 if(mode==='get')api.fetchHealthProfile.mockImplementationOnce(actual.fetchHealthProfile);
 else api.saveHealthProfile.mockImplementationOnce(actual.saveHealthProfile);
 consent.fetchConsentStatus.mockResolvedValueOnce({data:{server_time:new Date().toISOString(),health:{status:'granted',valid_until:health.valid_until}},error:null});
 await mount();await press('다음');
 if(mode==='save') {await choose('checkbox','알레르기 없음');await chooseNoAvoidedFood();await press('식단 제한, 아직 고르지 않았어요');await choose('radio','식단 제한 없음');await choose('checkbox','상관없음');await press('완료');}
 expect(require('../src/consents/access').getConsentAccess()).toEqual({userId:'A',state:'accepted'});
 expect(text(renderer.root)).toContain('이전 건강정보는 자동으로 옮기지 않아요');
 await press('건강정보 선택 동의 관리');expect(navigation.navigate).toHaveBeenCalledWith('OptionalConsents');
});
it('does not overwrite a conflicting revision and provides reload',async()=>{
 api.saveFoodProfile.mockResolvedValueOnce({data:null,error:{code:'S1004'}});await mount();await press('다음');expect(text(renderer.root)).toContain('다른 곳에서 변경');expect(api.fetchHealthProfile).not.toHaveBeenCalled();await press('최신 상태 다시 불러오기');expect(api.fetchFoodProfile).toHaveBeenCalledTimes(2);
});
it('allows signup skip with no food/health write and no legacy game',async()=>{
 useAuth.mockReturnValue({user:null});setConsentAccess(null,'loading');await mount({signup:true});await press('건너뛰기');expect(navigation.navigate).toHaveBeenCalledWith('SignupTerms');expect(api.saveFoodProfile).not.toHaveBeenCalled();expect(api.saveHealthProfile).not.toHaveBeenCalled();
});
it('does not display cached A food/health to B during a pending new load',async()=>{
 await mount();api.fetchFoodCatalog.mockReturnValue(new Promise(()=>{}));api.fetchFoodProfile.mockReturnValue(new Promise(()=>{}));useAuth.mockReturnValue({user:{id:'B'}});await act(async()=>{setConsentAccess('B','accepted');renderer.update(React.createElement(FoodProfileScreen));});expect(text(renderer.root)).not.toContain('한식');expect(text(renderer.root)).not.toContain('새우');
});
it.each(['background','withdrawal'])('discards a health response that arrives after %s',async transition=>{
 let finish,appState;
 jest.spyOn(require('react-native').AppState,'addEventListener').mockImplementation((_,handler)=>{appState=handler;return {remove:jest.fn()};});
 consent.fetchConsentStatus.mockResolvedValueOnce({data:{server_time:new Date().toISOString(),health:{status:'granted',valid_until:health.valid_until}},error:null});
 api.fetchHealthProfile.mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));await mount();await press('다음');
 await act(async()=>{if(transition==='background')appState('background');else require('../src/consents/access').clearOptionalConsentData();});
 await act(async()=>finish({data:health,error:null}));expect(text(renderer.root)).not.toContain('피해야 할 음식이 있나요');expect(api.saveHealthProfile).not.toHaveBeenCalled();
});
it('saves only explicit signup input bound to this actual id, then resumes health without replaying STEP1',async()=>{
 navigation.current={name:'Home'};setSignupFoodDraft(food.preferences);bindSignupFoodDraft('A');
 await act(async()=>{renderer=create(React.createElement(FoodProfilePrompt));});
 expect(api.saveFoodProfile).toHaveBeenCalledWith(SIGNUP_FOOD_CATALOG_VERSION,food.preferences,'1');expect(navigation.navigate).toHaveBeenCalledWith('FoodProfile',{onboarding:true,resumeHealth:true});expect(api.markFoodPrompt).not.toHaveBeenCalled();
 await act(async()=>renderer.unmount());renderer=null;api.saveFoodProfile.mockClear();api.fetchFoodProfile.mockResolvedValueOnce({data:{...food,completed_at:new Date().toISOString()},error:null});navigation.current={name:'FoodProfile',params:{onboarding:true,resumeHealth:true}};await mount();
 expect(text(renderer.root)).toContain('건강정보 수집·이용 동의');expect(api.saveFoodProfile).not.toHaveBeenCalled();
});
it('does not apply another account signup input or overwrite an already-completed profile',async()=>{
 navigation.current={name:'Home'};setSignupFoodDraft(food.preferences);bindSignupFoodDraft('other');await act(async()=>{renderer=create(React.createElement(FoodProfilePrompt));});expect(api.saveFoodProfile).not.toHaveBeenCalled();
 await act(async()=>renderer.unmount());renderer=null;bindSignupFoodDraft('A');api.fetchFoodProfile.mockResolvedValueOnce({data:{...food,completed_at:new Date().toISOString()},error:null});await act(async()=>{renderer=create(React.createElement(FoodProfilePrompt));});expect(api.saveFoodProfile).not.toHaveBeenCalled();
});
it('requires explicit new choices after a food catalog change while preserving the CAS revision',async()=>{
 api.fetchFoodProfile.mockResolvedValueOnce({data:{...food,requires_update:true,catalog_version:'old-v0'},error:null});await mount();expect(text(renderer.root)).toContain('이전 값은 자동으로 옮기지 않아요');
 await press('다음');expect(api.saveFoodProfile).not.toHaveBeenCalled();
 const korean=renderer.root.findAll(n=>n.props.accessibilityRole==='checkbox'&&n.props.accessibilityLabel==='한식'&&n.props.onPress).at(-1);await act(async()=>korean.props.onPress());await press('다음');expect(api.saveFoodProfile).toHaveBeenCalledWith('v1',{cuisines:['korean'],ingredients:[],forms:[],spice:null},'1');
});
it('permits explicit health reselection after a v2 catalog change without copying old codes',async()=>{
 api.fetchHealthProfile.mockResolvedValueOnce({data:{...health,catalog_version:'old-v0',requires_update:true,allergy_codes:['shrimp'],revision:'7'},error:null});
 consent.fetchConsentStatus.mockResolvedValueOnce({data:{server_time:new Date().toISOString(),health:{status:'granted',valid_until:health.valid_until}},error:null});await mount();await press('다음');expect(text(renderer.root)).toContain('다시 선택하고 저장하면 이전 값을 대체');expect(target(renderer.root,'완료').props.disabled).toBe(true);await choose('checkbox','새우');await chooseNoAvoidedFood();await press('식단 제한, 아직 고르지 않았어요');await choose('radio','식단 제한 없음');await choose('checkbox','상관없음');await press('완료');expect(api.saveHealthProfile).toHaveBeenCalledWith('v1',{allergy_codes:['shrimp'],avoided_food_codes:['none'],diet_type_code:'none',additional_avoid_codes:['none']},'7','3');
});

it('requires four explicit health answers and skips without overwriting existing data',async()=>{
 consent.fetchConsentStatus.mockResolvedValue({data:{server_time:new Date().toISOString(),health:{status:'granted',valid_until:health.valid_until}},error:null});await mount();await press('다음');
 expect(target(renderer.root,'완료').props.disabled).toBe(true);expect(text(renderer.root)).toContain('알레르기 · 못 먹는 음식 · 추가로 피할 것 · 식단 유형');
 await press('완료');expect(api.saveHealthProfile).not.toHaveBeenCalled();
 await choose('checkbox','알레르기 없음');await press('식단 제한, 아직 고르지 않았어요');await choose('radio','식단 제한 없음');expect(target(renderer.root,'완료').props.disabled).toBe(true);
 await choose('checkbox','상관없음');expect(target(renderer.root,'완료').props.disabled).toBe(true);
 await chooseNoAvoidedFood();expect(target(renderer.root,'완료').props.disabled).toBe(false);
 await press('건너뛰기');expect(api.saveHealthProfile).not.toHaveBeenCalled();expect(navigation.goBack).toHaveBeenCalled();
});
it('restores saved explicit health codes after save and reentry',async()=>{
 consent.fetchConsentStatus.mockResolvedValue({data:{server_time:new Date().toISOString(),health:{status:'granted',valid_until:health.valid_until}},error:null});
 await mount();await press('다음');await choose('checkbox','새우');await chooseNoAvoidedFood();await press('식단 제한, 아직 고르지 않았어요');await choose('radio','비건 (동물성 음식을 먹지 않음)');await choose('checkbox','돼지고기 제외');
 await press('완료');const stored=api.saveHealthProfile.mock.calls[0][1];expect(stored).toMatchObject({allergy_codes:['shrimp'],diet_type_code:'vegan',additional_avoid_codes:['exclude_pork']});
 await act(async()=>renderer.unmount());renderer=null;api.fetchHealthProfile.mockResolvedValueOnce({data:{...health,...stored,status:'complete',completed_at:new Date().toISOString(),revision:'1'},error:null});await mount();await press('다음');
 expect(text(renderer.root)).toContain('새우');expect(text(renderer.root)).toContain('비건');expect(target(renderer.root,'완료').props.disabled).toBe(false);
});
it('saves explicit none answers through the API and restores them from the completed normalized server response on reentry',async()=>{
 let stored;
 const rpc=jest.fn(async(name,args)=>{
  expect(name).toBe('save_my_health_preferences_v2');
  stored={...health,status:'complete',completed_at:new Date().toISOString(),revision:'1',allergy_codes:args.p_allergy_codes,avoided_food_codes:args.p_avoided_food_codes,diet_type_code:args.p_diet_type_code,additional_avoid_codes:args.p_additional_avoid_codes};
  return {data:stored,error:null};
 });
 api.configureFoodProfileTransport(rpc);
 api.saveHealthProfile.mockImplementationOnce((...args)=>jest.requireActual('../src/lib/foodProfile').saveHealthProfile(...args));
 consent.fetchConsentStatus.mockResolvedValue({data:{server_time:new Date().toISOString(),health:{status:'granted',valid_until:health.valid_until}},error:null});
 await mount();await press('다음');await choose('checkbox','알레르기 없음');await chooseNoAvoidedFood();await press('식단 제한, 아직 고르지 않았어요');await choose('radio','식단 제한 없음');await choose('checkbox','상관없음');await press('완료');
 expect(rpc).toHaveBeenCalledWith('save_my_health_preferences_v2',expect.objectContaining({p_allergy_codes:[],p_additional_avoid_codes:[],p_diet_type_code:null}));
 expect(navigation.goBack).toHaveBeenCalledTimes(1);
 await act(async()=>renderer.unmount());renderer=null;api.fetchHealthProfile.mockResolvedValueOnce({data:stored,error:null});await mount();await press('다음');
 const selected=(role,label)=>renderer.root.findAll(n=>n.props.accessibilityRole===role&&n.props.accessibilityLabel===label&&n.props.onPress).at(-1).props.accessibilityState.checked;
 expect(selected('checkbox','알레르기 없음')).toBe(true);
 await press('식단 제한, 식단 제한 없음, 상관없음');expect(selected('radio','식단 제한 없음')).toBe(true);expect(selected('checkbox','상관없음')).toBe(true);
 expect(target(renderer.root,'완료').props.disabled).toBe(false);expect(api.saveHealthProfile).toHaveBeenCalledTimes(1);
 await press('못 먹는 음식, 없음');expect(selected('checkbox','없음')).toBe(true);
});
it.each([
 ['not_started',null],
 ['complete',null],
 ['not_started','2026-10-19T00:00:00Z'],
])('leaves empty fields unanswered without consistent completion (%s, %s)',async(status,completed_at)=>{
 api.fetchHealthProfile.mockResolvedValueOnce({data:{...health,status,completed_at},error:null});
 consent.fetchConsentStatus.mockResolvedValueOnce({data:{server_time:new Date().toISOString(),health:{status:'granted',valid_until:health.valid_until}},error:null});
 await mount();await press('다음');
 const selected=(role,label)=>renderer.root.findAll(n=>n.props.accessibilityRole===role&&n.props.accessibilityLabel===label&&n.props.onPress).at(-1).props.accessibilityState.checked;
 expect(selected('checkbox','알레르기 없음')).toBe(false);await press('못 먹는 음식, 아직 고르지 않았어요');expect(selected('checkbox','없음')).toBe(false);await press('식단 제한, 아직 고르지 않았어요');
 expect(selected('radio','식단 제한 없음')).toBe(false);expect(selected('checkbox','상관없음')).toBe(false);
 expect(target(renderer.root,'완료').props.disabled).toBe(true);expect(api.saveHealthProfile).not.toHaveBeenCalled();
});
it('skips an incomplete edit without replacing the previously stored health choices',async()=>{
 const stored={...health,status:'complete',allergy_codes:['shrimp'],diet_type_code:'vegan',additional_avoid_codes:['exclude_pork']};
 api.fetchHealthProfile.mockResolvedValueOnce({data:stored,error:null});
 consent.fetchConsentStatus.mockResolvedValueOnce({data:{server_time:new Date().toISOString(),health:{status:'granted',valid_until:health.valid_until}},error:null});
 await mount();await press('다음');await choose('checkbox','새우');expect(target(renderer.root,'완료').props.disabled).toBe(true);
 await press('건너뛰기');expect(api.saveHealthProfile).not.toHaveBeenCalled();
 expect(stored.allergy_codes).toEqual(['shrimp']);expect(navigation.goBack).toHaveBeenCalledTimes(1);
});
it('saves only STEP1 in edit mode and asks health consent only through the explicit STEP2 entry',async()=>{
 navigation.current.params={};await mount();expect(target(renderer.root,'건강정보 수정')).toBeDefined();await press('저장');expect(api.saveFoodProfile).toHaveBeenCalledTimes(1);expect(consent.fetchConsentStatus).not.toHaveBeenCalled();expect(api.fetchHealthProfile).not.toHaveBeenCalled();expect(navigation.goBack).toHaveBeenCalled();
 await press('건강정보 수정');expect(consent.fetchConsentStatus).toHaveBeenCalledTimes(1);expect(text(renderer.root)).toContain('건강정보 수집·이용 동의');
});
it('submits the bundled signup catalog version even when the server catalog has advanced',async()=>{
 navigation.current={name:'Home'};setSignupFoodDraft(food.preferences);bindSignupFoodDraft('A');api.fetchFoodCatalog.mockResolvedValueOnce({data:{...catalog,catalog_version:'new-server-version'},error:null});api.saveFoodProfile.mockResolvedValueOnce({data:null,error:{code:'S5001'}});
 await act(async()=>{renderer=create(React.createElement(FoodProfilePrompt));});expect(api.saveFoodProfile).toHaveBeenCalledWith(SIGNUP_FOOD_CATALOG_VERSION,food.preferences,'1');expect(navigation.navigate).not.toHaveBeenCalled();expect(text(renderer.root)).toContain('가입 때 고른 취향을 저장하지 못했어요');
});

it('does not confuse additional-any with an explicit no-diet answer in the summary',async()=>{
 consent.fetchConsentStatus.mockResolvedValue({data:{server_time:new Date().toISOString(),health:{status:'granted',valid_until:health.valid_until}},error:null});await mount();await press('다음');await choose('checkbox','새우');await press('식단 제한, 아직 고르지 않았어요');await choose('radio','비건 (동물성 음식을 먹지 않음)');await choose('checkbox','상관없음');
 const summary=target(renderer.root,'식단 제한, 비건 (동물성 음식을 먹지 않음), 상관없음');expect(summary).toBeDefined();expect(target(renderer.root,'식단 제한, 식단 제한 없음, 비건 (동물성 음식을 먹지 않음), 상관없음')).toBeUndefined();
});
