const React = require('react');
const { act, create } = require('react-test-renderer');
const { AppState } = require('react-native');
jest.mock('../src/lib/foodProfile', () => ({ ...jest.requireActual('../src/lib/foodProfile'), fetchFoodCatalog: jest.fn() }));
jest.mock('../src/lib/placeCandidates', () => ({ ...jest.requireActual('../src/lib/placeCandidates'), fetchRoomRecommendationSettings: jest.fn(), fetchPublicMeetingAreas: jest.fn(), setRoomRecommendationArea: jest.fn(), setRoomPublicCuisines: jest.fn(), requestRestaurantRecommendation: jest.fn(), validateRecommendation: jest.fn() }));
const { setConsentAccess } = require('../src/consents/access');
const { fetchFoodCatalog } = require('../src/lib/foodProfile');
const api = require('../src/lib/placeCandidates');
const { useRestaurantRecommendations } = require('../src/screens/chat/useRestaurantRecommendations');
const area = { id: 'public-center', label: '공용 지역', latitude: 37.5665, longitude: 126.978, radius_m: 2000 };
const settings = { contract_version: 2, public_area_id: area.id, area, public_cuisines: [], revision: '1' };
const response = (name = '검증된 식당', source = 'rules') => ({ contract_version: 2, request_id: 'request', valid_until: new Date(Date.now() + 60000).toISOString(), source, area, places_status: 'ready', slots_status: 'not_requested', place_recommendations: [{ place_id: 'id', menu_id: null, place: { name, address: '공용 식당 주소', latitude: area.latitude, longitude: area.longitude }, rank: 1, reason_code: 'PUBLIC_AREA_RECOMMENDATION', evidence_status: 'unverified' }], slot_recommendations: [], my_health_filter: 'not_requested' });
let renderer, value, stateListener;
let props;
function Probe(p) { value = useRestaurantRecommendations(p); return null; }
const mount = async () => { await act(async () => { renderer = create(React.createElement(Probe, props)); }); };
const update = async () => { await act(async () => renderer.update(React.createElement(Probe, props))); };
beforeEach(() => {
  jest.clearAllMocks(); setConsentAccess('A', 'accepted');
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => { stateListener = listener; return { remove: jest.fn() }; });
  fetchFoodCatalog.mockResolvedValue({ data: { food_groups: [] }, error: null });
  api.fetchRoomRecommendationSettings.mockResolvedValue({ data: settings, error: null });
  api.fetchPublicMeetingAreas.mockResolvedValue({ data: [area], error: null });
  api.requestRestaurantRecommendation.mockResolvedValue(response());
  api.validateRecommendation.mockResolvedValue({ data: { status: 'valid' }, error: null });
  props = { roomId: 'room', userId: 'A', enabled: true, members: 'A,B' };
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; jest.restoreAllMocks(); jest.useRealTimers(); setConsentAccess(null, 'loading'); });
it('recommends around only the public area without a profile-origin prerequisite and labels rules', async () => {
  await mount(); expect(api.requestRestaurantRecommendation).toHaveBeenCalledWith('room', undefined, expect.any(String), expect.anything()); expect(value.status).toBe('ready');
  expect(value.suggestions).toEqual([{ label: '검증된 식당', source: 'rules', fresh: false }]);
});
it('skips calls with no selected area and permits owner selection through revision RPC', async () => {
  api.fetchRoomRecommendationSettings.mockResolvedValue({ data: { ...settings, public_area_id: null, area: null, revision: '0' }, error: null });
  api.setRoomRecommendationArea.mockResolvedValue({ data: settings, error: null }); await mount();
  expect(api.requestRestaurantRecommendation).not.toHaveBeenCalled();
  await act(async () => value.saveArea(area.id)); expect(api.setRoomRecommendationArea).toHaveBeenCalledWith('room', area.id, '0'); expect(api.requestRestaurantRecommendation).toHaveBeenCalledTimes(1);
});
it('does not call or display recommendations when the restaurant is locked or sheet is closed', async () => {
  props.enabled = false; await mount(); expect(api.requestRestaurantRecommendation).not.toHaveBeenCalled(); expect(value.suggestions).toEqual([]);
});
it('distinguishes an empty provider result from an actual failure and permits explicit retry', async () => {
  api.requestRestaurantRecommendation.mockResolvedValueOnce({ ...response(), places_status: 'empty', place_recommendations: [] }).mockRejectedValueOnce(Object.assign(Error('private error'), { code: 'S5006' })).mockResolvedValueOnce(response());
  await mount(); expect(value.status).toBe('empty'); await act(async () => value.request()); expect(value.status).toBe('error'); expect(value.reason).not.toContain('private'); await act(async () => value.request()); expect(value.status).toBe('ready');
});
it('blocks two explicit requests in the same frame before loading state is rendered', async () => {
  await mount(); let finish; api.requestRestaurantRecommendation.mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));
  await act(async()=>{void value.request();void value.request();});expect(api.requestRestaurantRecommendation).toHaveBeenCalledTimes(2);
  await act(async()=>finish(response()));expect(value.status).toBe('ready');
});
it('clears result at 60 seconds and validates immediately before selection', async () => {
  jest.useFakeTimers(); await mount(); await value.validateSuggestion('검증된 식당'); expect(api.validateRecommendation).toHaveBeenCalledWith('request');
  await act(async () => jest.advanceTimersByTime(60000)); expect(value.suggestions).toEqual([]); await expect(value.validateSuggestion('검증된 식당')).rejects.toThrow();
});
it('discards context-changed results on validation failure', async () => {
  await mount(); api.validateRecommendation.mockResolvedValueOnce({ data: null, error: Object.assign(Error('context'), { code: 'S5003' }) });
  await act(async () => { await expect(value.validateSuggestion('검증된 식당')).rejects.toMatchObject({ code: 'S5003' }); }); expect(value.suggestions).toEqual([]);
});
it('rejects the real Edge S5003 response for a recommendation made stale by an S4 decision', async () => {
  const invoke = jest.fn(async () => ({ data: null, error: { context: { clone: () => ({ json: async () => ({ code: 'S5003', message: 'private-server-text' }) }) } } }));
  const liveRequest = jest.requireActual('../src/lib/placeCandidates').requestRestaurantRecommendation;
  await expect(liveRequest('room', invoke)).rejects.toMatchObject({ code: 'S5003', message: expect.stringContaining('다시 추천받아 주세요') });
  expect(require('../src/consents/access').getConsentAccess().state).toBe('accepted');
  api.requestRestaurantRecommendation.mockImplementationOnce((room, _invoke, id, signal) => liveRequest(room, invoke, id, signal));
  await mount(); expect(value.status).toBe('error'); expect(value.suggestions).toEqual([]); expect(value.reason).not.toContain('private-server-text');
});
it('discards late results on room departure and makes a new request after reentry', async () => {
  let resolve; api.requestRestaurantRecommendation.mockReturnValueOnce(new Promise(done => { resolve = done; })); await mount(); props.enabled = false; await update();
  await act(async () => resolve(response('늦은 식당'))); expect(value.suggestions).toEqual([]); props.enabled = true; await update(); expect(api.requestRestaurantRecommendation).toHaveBeenCalledTimes(2); expect(value.suggestions[0].label).toBe('검증된 식당');
});
it('never shows A results to B or restores them after logout/login with the same id', async () => {
  await mount(); api.requestRestaurantRecommendation.mockReturnValue(new Promise(() => {}));
  await act(async () => setConsentAccess('B', 'accepted')); props.userId = 'B'; await update(); expect(value.suggestions).toEqual([]);
  await act(async () => setConsentAccess(null, 'loading')); props.userId = null; await update(); expect(value.suggestions).toEqual([]);
  await act(async () => setConsentAccess('A', 'accepted')); props.userId = 'A'; await update(); expect(value.suggestions).toEqual([]);
});
it('hides background results and reuses a valid result after foreground context recheck', async () => {
  await mount(); await act(async () => stateListener('background')); expect(value.suggestions).toEqual([]); await act(async () => stateListener('active')); expect(api.fetchRoomRecommendationSettings).toHaveBeenCalledTimes(2); expect(api.requestRestaurantRecommendation).toHaveBeenCalledTimes(1);expect(value.suggestions[0].label).toBe('검증된 식당');
});
it('invalidates results on membership or consent changes', async () => {
  await mount(); props.members = 'A,B,C'; await update(); expect(api.requestRestaurantRecommendation).toHaveBeenCalledTimes(2);
  await act(async () => setConsentAccess('A', 'required')); expect(value.suggestions).toEqual([]);
});
it('hides new controls on a missing S5 RPC while keeping manual addition possible', async () => {
  api.fetchRoomRecommendationSettings.mockResolvedValue({ data: null, error: { code: 'S5_UNAVAILABLE' } }); await mount(); expect(value.available).toBe(false); expect(api.requestRestaurantRecommendation).not.toHaveBeenCalled();
});
it('uses exactly the v2 body, polls a working ticket with the same id, and accepts rules', async () => {
  const invoke = jest.fn().mockImplementationOnce(async body => ({ data: { ...body, status: 'working' }, error: null })).mockImplementationOnce(async body => ({ data: { ...response(), request_id: body.request_id }, error: null }));
  jest.useFakeTimers(); const request = jest.requireActual('../src/lib/placeCandidates').requestRestaurantRecommendation('room', invoke);
  await jest.advanceTimersByTimeAsync(1000); const result = await request;
  expect(result.source).toBe('rules'); expect(invoke.mock.calls[0][0]).toEqual({ contract_version: 2, purpose: 'places', room_id: 'room', request_id: expect.any(String) }); expect(invoke.mock.calls[1][0]).toEqual(invoke.mock.calls[0][0]);
});
it('times out an unresolved invocation at 25 seconds, ignores a late response, and permits a new request', async () => {
  jest.useFakeTimers(); let done; const invoke = jest.fn(body => new Promise(resolve => { done = () => resolve({ data: { ...response(), request_id: body.request_id }, error: null }); }));
  const request = jest.requireActual('../src/lib/placeCandidates').requestRestaurantRecommendation('room', invoke); const rejected = expect(request).rejects.toMatchObject({ code: 'TIMEOUT' });
  await jest.advanceTimersByTimeAsync(25000); await rejected; done();
  const retry = await jest.requireActual('../src/lib/placeCandidates').requestRestaurantRecommendation('room', async body => ({ data: { ...response(), request_id: body.request_id }, error: null })); expect(retry.places_status).toBe('ready');
});

const providerError = (newRequestRequired) => ({
  data: null,
  error: { context: { clone: () => ({ json: async () => ({ code: 'S5006', message: 'private provider detail', new_request_required: newRequestRequired }) }) } },
});
it.each([false, true])('honors S5006 new_request_required=%s on the visible retry action', async newRequestRequired => {
  const invoke = jest.fn().mockResolvedValueOnce(providerError(newRequestRequired)).mockImplementation(async body => ({ data: { ...response(), request_id: body.request_id }, error: null }));
  api.requestRestaurantRecommendation.mockImplementation((...args) => jest.requireActual('../src/lib/placeCandidates').requestRestaurantRecommendation(args[0], invoke, args[2], args[3]));
  await mount(); expect(value.status).toBe('error'); expect(value.reason).not.toContain('private provider detail');
  await act(async () => value.request()); expect(value.status).toBe('ready');
  const first = invoke.mock.calls[0][0].request_id, retry = invoke.mock.calls[1][0].request_id;
  if (newRequestRequired) expect(retry).not.toBe(first); else expect(retry).toBe(first);
  // Once successful, a deliberate "more" request must start a new ticket.
  await act(async () => value.request()); expect(invoke.mock.calls[2][0].request_id).not.toBe(retry);
});
it('discards a reusable pre-claim ticket when the public area or account context changes', async () => {
  const invoke = jest.fn().mockResolvedValueOnce(providerError(false)).mockImplementation(async body => ({ data: { ...response(), request_id: body.request_id }, error: null }));
  api.requestRestaurantRecommendation.mockImplementation((...args) => jest.requireActual('../src/lib/placeCandidates').requestRestaurantRecommendation(args[0], invoke, args[2]));
  api.setRoomRecommendationArea.mockResolvedValue({ data: { ...settings, revision: '2' }, error: null });
  await mount(); expect(value.status).toBe('error');
  await act(async () => value.saveArea(area.id)); expect(value.status).toBe('ready');
  expect(invoke.mock.calls[1][0].request_id).not.toBe(invoke.mock.calls[0][0].request_id);
  invoke.mockResolvedValueOnce(providerError(false)); await act(async () => value.request()); expect(value.status).toBe('error');
  const oldAccountId = invoke.mock.calls[2][0].request_id;
  await act(async () => setConsentAccess('B', 'accepted')); props.userId = 'B'; await update();
  expect(value.status).toBe('ready'); expect(invoke.mock.calls[3][0].request_id).not.toBe(oldAccountId);
});
it.each(['working', 'pending'])('polls the claim-race %s response without issuing a new ticket', async status => {
  jest.useFakeTimers();
  const invoke = jest.fn().mockImplementationOnce(async body => ({ data: { contract_version: 2, request_id: body.request_id, status }, error: null })).mockImplementation(async body => ({ data: { ...response(), request_id: body.request_id }, error: null }));
  const request = jest.requireActual('../src/lib/placeCandidates').requestRestaurantRecommendation('room', invoke);
  await jest.advanceTimersByTimeAsync(1000); await expect(request).resolves.toMatchObject({ source: 'rules' });
  expect(invoke).toHaveBeenCalledTimes(2); expect(invoke.mock.calls[1][0]).toEqual(invoke.mock.calls[0][0]);
});
it('accepts an already-completed claim-race result and preserves permission errors', async () => {
  const actual = jest.requireActual('../src/lib/placeCandidates').requestRestaurantRecommendation;
  const completed = jest.fn(async body => ({ data: { ...response(), request_id: body.request_id }, error: null }));
  await expect(actual('room', completed)).resolves.toMatchObject({ places_status: 'ready' }); expect(completed).toHaveBeenCalledTimes(1);
  await expect(actual('room', async () => ({ data: null, error: { code: '42501', message: 'private denial' } }))).rejects.toMatchObject({ code: '42501', newRequestRequired: undefined });
});

it('aborts the transport and stops polling immediately when the sheet closes', async()=>{
 jest.useFakeTimers();const invoke=jest.fn(async body=>({data:{contract_version:2,request_id:body.request_id,status:'working'},error:null}));
 api.requestRestaurantRecommendation.mockImplementation((...args)=>jest.requireActual('../src/lib/placeCandidates').requestRestaurantRecommendation(args[0],invoke,args[2],args[3]));
 await mount();expect(invoke).toHaveBeenCalledTimes(1);props.enabled=false;await update();expect(invoke.mock.calls[0][1].aborted).toBe(true);
 await jest.advanceTimersByTimeAsync(5000);expect(invoke).toHaveBeenCalledTimes(1);
});
it('returns requestId on timeout and resumes the same server ticket on the explicit retry',async()=>{
 jest.useFakeTimers();const invoke=jest.fn().mockImplementationOnce(()=>new Promise(()=>{})).mockImplementation(async body=>({data:{...response(),request_id:body.request_id},error:null}));
 api.requestRestaurantRecommendation.mockImplementation((...args)=>jest.requireActual('../src/lib/placeCandidates').requestRestaurantRecommendation(args[0],invoke,args[2],args[3]));
 await mount();await act(async()=>jest.advanceTimersByTimeAsync(25000));expect(value.status).toBe('error');await act(async()=>value.request());expect(value.status).toBe('ready');expect(invoke.mock.calls[1][0].request_id).toBe(invoke.mock.calls[0][0].request_id);
});
it('does not request again for iOS inactive/active or an accepted foreground gate recheck while still valid',async()=>{
 await mount();await act(async()=>stateListener('inactive'));expect(value.suggestions).toEqual([]);await act(async()=>{setConsentAccess('A','loading');stateListener('active');});
 await act(async()=>setConsentAccess('A','accepted'));expect(value.suggestions).toHaveLength(1);expect(api.requestRestaurantRecommendation).toHaveBeenCalledTimes(1);
});
it('invalidates changed foreground context without an automatic provider request',async()=>{
 await mount();api.fetchRoomRecommendationSettings.mockResolvedValueOnce({data:{...settings,revision:'2'},error:null});await act(async()=>stateListener('inactive'));await act(async()=>stateListener('active'));
 expect(value.suggestions).toEqual([]);expect(api.requestRestaurantRecommendation).toHaveBeenCalledTimes(1);await act(async()=>value.request());expect(api.requestRestaurantRecommendation).toHaveBeenCalledTimes(2);
});
it('discards a cached result when the server rejects its foreground context without creating another ticket',async()=>{
 await mount();api.validateRecommendation.mockResolvedValueOnce({data:null,error:{code:'S5003'}});
 await act(async()=>stateListener('background'));await act(async()=>stateListener('active'));
 expect(api.validateRecommendation).toHaveBeenCalledWith('request');expect(value.suggestions).toEqual([]);
 expect(value.status).toBe('error');expect(api.requestRestaurantRecommendation).toHaveBeenCalledTimes(1);
});
it('saves public cuisine taps without requesting until the explicit retry action',async()=>{
 await mount();api.setRoomPublicCuisines.mockResolvedValueOnce({data:{...settings,public_cuisines:['korean'],revision:'2'},error:null});await act(async()=>value.saveCuisines(['korean']));
 expect(value.suggestions).toEqual([]);expect(value.reason).toContain('다시 추천받기');expect(api.requestRestaurantRecommendation).toHaveBeenCalledTimes(1);await act(async()=>value.request());expect(api.requestRestaurantRecommendation).toHaveBeenCalledTimes(2);
});
it('an already-aborted external signal never invokes the provider',async()=>{
 const controller=new AbortController();controller.abort();const invoke=jest.fn();await expect(jest.requireActual('../src/lib/placeCandidates').requestRestaurantRecommendation('room',invoke,undefined,controller.signal)).rejects.toMatchObject({code:'ABORTED',requestId:expect.any(String)});expect(invoke).not.toHaveBeenCalled();
});
it('reuses an aborted ticket after closing and reopening the same sheet',async()=>{
 jest.useFakeTimers();const invoke=jest.fn().mockImplementationOnce(async body=>({data:{contract_version:2,request_id:body.request_id,status:'working'},error:null})).mockImplementation(async body=>({data:{...response(),request_id:body.request_id},error:null}));
 api.requestRestaurantRecommendation.mockImplementation((...args)=>jest.requireActual('../src/lib/placeCandidates').requestRestaurantRecommendation(args[0],invoke,args[2],args[3]));
 await mount();props.enabled=false;await update();props.enabled=true;await update();
 expect(invoke).toHaveBeenCalledTimes(2);expect(invoke.mock.calls[1][0].request_id).toBe(invoke.mock.calls[0][0].request_id);expect(value.status).toBe('ready');
});
it.each(['settings','account','room','members','expired'])('discards an interrupted ticket when its %s context changes',async kind=>{
 jest.useFakeTimers();const invoke=jest.fn().mockImplementationOnce(async body=>({data:{contract_version:2,request_id:body.request_id,status:'working'},error:null})).mockImplementation(async body=>({data:{...response(),request_id:body.request_id},error:null}));
 api.requestRestaurantRecommendation.mockImplementation((...args)=>jest.requireActual('../src/lib/placeCandidates').requestRestaurantRecommendation(args[0],invoke,args[2],args[3]));
 await mount();props.enabled=false;await update();
 if(kind==='settings')api.fetchRoomRecommendationSettings.mockResolvedValueOnce({data:{...settings,revision:'2'},error:null});
 if(kind==='account'){await act(async()=>setConsentAccess('B','accepted'));props.userId='B';}
 if(kind==='room')props.roomId='other-room';if(kind==='members')props.members='A,B,C';if(kind==='expired')await jest.advanceTimersByTimeAsync(5*60000);
 props.enabled=true;await update();expect(invoke.mock.calls[1][0].request_id).not.toBe(invoke.mock.calls[0][0].request_id);
});
it('keeps the current result and settings when saving cuisine fails',async()=>{
 await mount();api.setRoomPublicCuisines.mockResolvedValueOnce({data:null,error:{code:'NETWORK'}});
 await act(async()=>value.saveCuisines(['korean']));expect(value.suggestions).toHaveLength(1);expect(value.settings.public_cuisines).toEqual([]);expect(value.settingsError).toBeTruthy();
 expect(api.requestRestaurantRecommendation).toHaveBeenCalledTimes(1);
});
it.each([['S1001','required'],['S1008','error']])('closes the gate for recommendation begin failure %s',async(code,state)=>{
 const actual=jest.requireActual('../src/lib/placeCandidates').requestRestaurantRecommendation;
 await expect(actual('room',async()=>({data:null,error:{code}}))).rejects.toMatchObject({code});
 expect(require('../src/consents/access').getConsentAccess()).toEqual({userId:'A',state});
});
