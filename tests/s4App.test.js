const React = require('react');
const { act, create } = require('react-test-renderer');
const { AccessibilityInfo, Platform, Text, TextInput } = require('react-native');
jest.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: ({ children }) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('../src/theme/insets', () => ({ useTopInset: () => 0 }));
jest.mock('../src/theme/keyboard', () => ({ useKeyboardOverlap: () => ({ overlap: 0, remeasure: jest.fn() }) }));
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'A' } }) }));
jest.mock('../src/navigation/NavigationContext', () => ({ useNavigation: jest.fn() }));
jest.mock('../src/lib/useRoomDecision', () => ({ useRoomDecision: jest.fn() }));
jest.mock('../src/lib/consents', () => ({ getConsentServerMode: () => 's1', fetchConsentManifest: jest.fn() }));
jest.mock('../src/lib/foodProfile', () => ({ fetchFoodCatalog: jest.fn() }));
jest.mock('../src/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
jest.mock('../src/lib/voting', () => ({ fetchRoomVoting: jest.fn(), toggleVote: jest.fn(), addVotingItem: jest.fn(), removeVotingItem: jest.fn(), confirmRoomVote: jest.fn() }));
jest.mock('../src/lib/rooms', () => ({ advanceRoomStage: jest.fn(), leaveRoom: jest.fn(async () => null) }));
jest.mock('../src/lib/tmap', () => ({ searchPlaces: jest.fn() }));
const { s4Capabilities, s4RoomId, s4ItemId, s4Time, s4State, s4Mutation } = require('./fixtures/s4');
const { configureRoomDecisions } = require('../src/lib/roomDecisions');
const { setConsentAccess } = require('../src/consents/access');
const { useRoomDecision } = require('../src/lib/useRoomDecision');
const { useNavigation } = require('../src/navigation/NavigationContext');
const { fetchFoodCatalog } = require('../src/lib/foodProfile');
const { supabase } = require('../src/lib/supabase');
const voting = require('../src/lib/voting');
const { advanceRoomStage } = require('../src/lib/rooms');
const ScheduleConfirmedScreen = require('../src/screens/schedule/ScheduleConfirmedScreen').default;
const ScheduleTimeScreen = require('../src/screens/schedule/ScheduleTimeScreen').default;
const ScheduleSheet = require('../src/screens/chat/ScheduleSheet').default;
const VotingSheet = require('../src/screens/chat/VotingSheet').default;
const AvailabilityGrid = require('../src/components/AvailabilityGrid').default;
const PlanConfirmation = require('../src/components/ui/PlanConfirmation').default;
const MeetingCard = require('../src/components/ui/MeetingCard').default;
const RoomRow = require('../src/components/RoomRow').default;
let renderer, view, navigation, rpc, response, component, props;
const output = root => root.findAllByType(Text).map(node => node.props.children).flat(Infinity).join(' ');
const button = (root, label) => root.findAll(n => n.props.accessibilityRole === 'button' && n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
async function press(root, label) { expect(button(root, label)).toBeDefined(); await act(async () => button(root, label).props.onPress()); }
async function render(Component, incoming = {}) { component = Component; props = incoming; await act(async () => { renderer = create(React.createElement(Component, incoming)); }); return renderer.root; }
async function update() { await act(async () => renderer.update(React.createElement(component, props))); }
const place = overrides => s4State({ stage: 'place', meeting_time: s4Time, time_status: 'selected', permissions: { can_submit: false, can_select_time: true, can_confirm: true }, ...overrides });
const incomplete = () => { const state = s4State(); state.availability.members[1].submitted = false; state.availability.submitted_count = 1; state.availability.all_submitted = false; return state; };
const votingProps = () => ({ roomId: s4RoomId, visible: true, isOwner: true, kind: 'menu', title: '식당 정하기', subtitle: '가고 싶은 곳에 투표해 주세요', placeholder: '식당 이름', onConfirm: jest.fn(), onClose: jest.fn(), onSelectTime: jest.fn() });
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-20T00:00:00Z')); jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  setConsentAccess('A', 'accepted');
  view = { accountId: 'A', mode: 's4', data: s4State(), loading: false, error: null, reload: jest.fn(async () => view.data) };
  useRoomDecision.mockImplementation(() => view);
  navigation = { current: { params: { roomId: s4RoomId, name: '실제 계약 밥약' } }, navigate: jest.fn(), goBack: jest.fn(), goBackWith: jest.fn(), resetTo: jest.fn() };
  useNavigation.mockReturnValue(navigation);
  response = () => s4Mutation(place({ revision: '5' }));
  rpc = jest.fn(async name => ({ data: name === 'get_s4_capabilities' ? s4Capabilities : name === 'preview_room_meeting_time_v1' ? { eligible_count: 2, available_count: 1, all_available: false, revision: '4' } : response(), error: null }));
  configureRoomDecisions({ transport: rpc, storage: { getItem: async () => null, setItem: async () => {} }, backend: 's4-ui-fixture' });
  fetchFoodCatalog.mockResolvedValue({ data: { contract_version: 2 }, error: null });
  supabase.functions.invoke.mockResolvedValue({ data: { slotRecommendations: [{ slot: { id: 'one', date: '2026-10-20', startTime: '18:00', endTime: '19:00' }, availableCount: 1, totalCount: 2, rank: 1, reason: '제출된 일정', rainChance: null }] }, error: null });
  voting.fetchRoomVoting.mockResolvedValue({ data: [{ id: s4ItemId, label: '실제 후보 식당', kind: 'menu', createdBy: 'A', mine: true, voters: [{ name: '모아' }, { name: '두두' }] }], memberCount: 2, error: null });
  voting.toggleVote.mockResolvedValue(null);
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = undefined; jest.restoreAllMocks(); jest.useRealTimers(); });

it('persists the entire manually chosen KST interval before opening restaurants', async () => {
  const root = await render(ScheduleConfirmedScreen);
  await act(async () => root.findByType(AvailabilityGrid).props.onToggle('2026-10-20', 18));
  expect(output(root)).toContain('18:00–19:00 · 한국 시간');
  await press(root, '시간 저장하고 식당 정하기');
  expect(rpc.mock.calls.at(-1)).toEqual(['select_room_meeting_time_v1', { p_room_id: s4RoomId, p_time: s4Time, p_expected_revision: '4', p_request_id: expect.any(String) }]);
  expect(advanceRoomStage).not.toHaveBeenCalled(); expect(navigation.navigate).toHaveBeenCalledWith('ChatRoom', expect.objectContaining({ openSheet: 'menu' }));
});
it('shows direct-interval attendance and saves exactly its displayed revision', async () => {
  rpc.mockImplementation(async name => ({ data: name === 'get_s4_capabilities' ? s4Capabilities : name === 'preview_room_meeting_time_v1'
    ? { eligible_count: 2, available_count: 1, all_available: false, revision: '7' } : s4Mutation(place({ revision: '8' })), error: null }));
  const root = await render(ScheduleConfirmedScreen);
  await act(async () => root.findByType(AvailabilityGrid).props.onToggle('2026-10-20', 18));
  expect(output(root)).toMatch(/2\s*명 중\s*1\s*명 가능 · 참석률\s*50\s*%/);
  await press(root, '시간 저장하고 식당 정하기');
  expect(rpc.mock.calls.at(-1)[1]).toMatchObject({ p_time: s4Time, p_expected_revision: '7' });
});
it('blocks a zero-attendance interval without invoking the time selection writer', async () => {
  rpc.mockImplementation(async name => ({ data: name === 'get_s4_capabilities' ? s4Capabilities : { eligible_count: 2, available_count: 0, all_available: false, revision: '4' }, error: null }));
  const root = await render(ScheduleConfirmedScreen); await act(async () => root.findByType(AvailabilityGrid).props.onToggle('2026-10-20', 18));
  expect(output(root)).toMatch(/2\s*명 중\s*0\s*명 가능/); expect(output(root)).toContain('최소 1명이 가능한 시간을 골라 주세요');
  expect(button(root, '시간 저장하고 식당 정하기').props.disabled).toBe(true); await press(root, '시간 저장하고 식당 정하기');
  expect(rpc.mock.calls.some(([name]) => name === 'select_room_meeting_time_v1')).toBe(false);
});
it('discards a late preview for the earlier interval and never saves while the current one is loading', async () => {
  const reads = [];
  rpc.mockImplementation(async (name, args) => name === 'get_s4_capabilities' ? { data: s4Capabilities, error: null } : new Promise(resolve => reads.push({ args, resolve })));
  const root = await render(ScheduleConfirmedScreen); await act(async () => root.findByType(AvailabilityGrid).props.onToggle('2026-10-20', 18));
  expect(button(root, '시간 저장하고 식당 정하기').props.disabled).toBe(true);
  await act(async () => root.findByType(AvailabilityGrid).props.onToggle('2026-10-20', 19));
  expect(reads).toHaveLength(2); expect(reads[1].args.p_ends_at).toBe('2026-10-20T11:00:00.000Z');
  await act(async () => reads[1].resolve({ data: { eligible_count: 2, available_count: 0, all_available: false, revision: '5' }, error: null }));
  await act(async () => reads[0].resolve({ data: { eligible_count: 2, available_count: 2, all_available: true, revision: '4' }, error: null }));
  expect(output(root)).toMatch(/2\s*명 중\s*0\s*명 가능/); expect(button(root, '시간 저장하고 식당 정하기').props.disabled).toBe(true);
});
it('rechecks a previously selected interval instead of resurrecting its old attendance', async () => {
  const reads = [];
  rpc.mockImplementation(async name => name === 'get_s4_capabilities' ? { data: s4Capabilities, error: null } : new Promise(resolve => reads.push(resolve)));
  const root = await render(ScheduleConfirmedScreen); await act(async () => root.findByType(AvailabilityGrid).props.onToggle('2026-10-20', 18));
  await act(async () => reads[0]({ data: { eligible_count: 2, available_count: 1, all_available: false, revision: '4' }, error: null }));
  expect(button(root, '시간 저장하고 식당 정하기').props.disabled).toBe(false);
  await act(async () => root.findByType(AvailabilityGrid).props.onToggle('2026-10-20', 19));
  await act(async () => root.findByType(AvailabilityGrid).props.onToggle('2026-10-20', 19));
  expect(reads).toHaveLength(3); expect(button(root, '시간 저장하고 식당 정하기').props.disabled).toBe(true);
  expect(root.findAll(n => n.props.testID === 's4-time-attendance')).toHaveLength(0);
});
it('refreshes preview counts after a polled revision change before another explicit save', async () => {
  const root = await render(ScheduleConfirmedScreen); await act(async () => root.findByType(AvailabilityGrid).props.onToggle('2026-10-20', 18));
  let finish;
  rpc.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  view = { ...view, data: s4State({ revision: '6' }) }; await update();
  expect(button(root, '시간 저장하고 식당 정하기').props.disabled).toBe(true);
  await act(async () => finish({ data: { eligible_count: 2, available_count: 2, all_available: true, revision: '6' }, error: null }));
  expect(output(root)).toMatch(/2\s*명 중\s*2\s*명 가능/); expect(navigation.navigate).not.toHaveBeenCalled();
  response = () => s4Mutation(place({ revision: '7' })); await press(root, '시간 저장하고 식당 정하기');
  expect(rpc.mock.calls.at(-1)[1].p_expected_revision).toBe('6');
});
it('shows a safe preview failure with retry and does not treat a generic HTTP 404 as old support', async () => {
  const root = await render(ScheduleConfirmedScreen);
  rpc.mockImplementationOnce(async () => ({ data: s4Capabilities, error: null })).mockImplementationOnce(async () => ({ data: null, status: 404, error: { message: 'private raw' } }));
  await act(async () => root.findByType(AvailabilityGrid).props.onToggle('2026-10-20', 18));
  expect(button(root, '시간 저장하고 식당 정하기').props.disabled).toBe(true); expect(output(root)).not.toContain('private raw');
  await press(root, '참석 인원 다시 확인'); expect(button(root, '시간 저장하고 식당 정하기').props.disabled).toBe(false);
});
it('omits counts on older S4 servers with the optional preview RPC absent and preserves real saving', async () => {
  rpc.mockImplementation(async name => name === 'get_s4_capabilities' ? { data: s4Capabilities, error: null } : name === 'preview_room_meeting_time_v1'
    ? { data: null, status: 404, error: { code: 'PGRST202', message: 'Could not find the function public.preview_room_meeting_time_v1(p_ends_at, p_room_id, p_starts_at, p_time_zone) in the schema cache' } }
    : { data: response(), error: null });
  const root = await render(ScheduleConfirmedScreen); await act(async () => root.findByType(AvailabilityGrid).props.onToggle('2026-10-20', 18));
  expect(root.findAll(n => n.props.testID === 's4-time-attendance')).toHaveLength(0); expect(button(root, '시간 저장하고 식당 정하기').props.disabled).toBe(false);
  await press(root, '시간 저장하고 식당 정하기'); expect(navigation.navigate).toHaveBeenCalled();
});
it('requires a fresh displayed preview and explicit selection after a manual-time revision conflict', async () => {
  const root = await render(ScheduleConfirmedScreen); await act(async () => root.findByType(AvailabilityGrid).props.onToggle('2026-10-20', 18));
  rpc.mockResolvedValueOnce({ data: null, error: { code: 'S4005' } });
  view.reload.mockImplementationOnce(async () => { view.data = s4State({ revision: '6' }); return view.data; });
  await press(root, '시간 저장하고 식당 정하기'); await update();
  expect(output(root)).toContain('다시 불러온 뒤 선택해 주세요'); expect(button(root, '시간 저장하고 식당 정하기').props.disabled).toBe(true);
  expect(root.findAll(n => n.props.testID === 's4-time-attendance')).toHaveLength(0); expect(navigation.navigate).not.toHaveBeenCalled();
  rpc.mockResolvedValueOnce({ data: { eligible_count: 2, available_count: 1, all_available: false, revision: '6' }, error: null });
  await act(async () => root.findByType(AvailabilityGrid).props.onToggle('2026-10-20', 18));
  response = () => s4Mutation(place({ revision: '7' })); await press(root, '시간 저장하고 식당 정하기');
  expect(rpc.mock.calls.at(-1)[1].p_expected_revision).toBe('6'); expect(navigation.navigate).toHaveBeenCalledTimes(1);
});
it('never shows a delayed prior-account attendance after switching accounts', async () => {
  let finish;
  rpc.mockImplementation(async name => name === 'get_s4_capabilities' ? { data: s4Capabilities, error: null } : new Promise(resolve => { finish = resolve; }));
  const root = await render(ScheduleConfirmedScreen); await act(async () => root.findByType(AvailabilityGrid).props.onToggle('2026-10-20', 18));
  setConsentAccess('B', 'accepted'); view = { ...view, accountId: 'B' }; await update();
  await act(async () => finish({ data: { eligible_count: 2, available_count: 2, all_available: true, revision: '4' }, error: null }));
  expect(root.findAll(n => n.props.testID === 's4-time-attendance')).toHaveLength(0); expect(button(root, '시간 저장하고 식당 정하기').props.disabled).toBe(true);
});
it.each(['step2', 'sheet'])('accepts an unchanged schedule revision from %s as success', async screen => {
  response = () => s4Mutation(s4State());
  const changed = jest.fn(); const root = await render(screen === 'step2' ? ScheduleTimeScreen : ScheduleSheet,
    screen === 'step2' ? {} : { visible: true, roomId: s4RoomId, onClose: jest.fn(), onStateChanged: changed });
  if (screen === 'sheet') await press(root, '일정 수정'); await press(root, '선택 완료');
  expect(output(root)).not.toContain('밥약 상태를 확인하지 못했어요');
  if (screen === 'sheet') { expect(changed).toHaveBeenCalledTimes(1); expect(button(root, '일정 수정')).toBeDefined(); }
  else expect(navigation.navigate).toHaveBeenCalledWith('ScheduleConfirmed', expect.objectContaining({ roomId: s4RoomId }));
});
it('uses the server operation hint even when a confirmation error arrives in the voting UI', async () => {
  view.data = place(); const root = await render(VotingSheet, votingProps()); await press(root, '실제 후보 식당으로 정하기');
  rpc.mockImplementation(async name => name === 'get_s4_capabilities' ? { data: s4Capabilities, error: null } : { data: null, error: { code: 'S4008', hint: 'operation=settlement', message: 'private raw' } });
  await press(root, '확정하기'); expect(output(root)).toContain('약속을 확정한 뒤 정산'); expect(output(root)).not.toContain('private raw');
});
it('uses the recommendation revision snapshot and asks for a fresh choice after a conflict', async () => {
  const root = await render(ScheduleConfirmedScreen); await press(root, '시간 추천받기');
  expect(output(root)).toMatch(/참석률\s+50\s*%/);
  const radio = root.findAll(n => n.props.accessibilityRole === 'radio' && typeof n.props.onPress === 'function')[0];
  await act(async () => radio.props.onPress());
  view = { ...view, data: s4State({ revision: '7' }) }; await update();
  rpc.mockImplementation(async name => name === 'get_s4_capabilities' ? { data: s4Capabilities, error: null } : { data: null, error: { code: 'S4005' } });
  await press(root, '시간 저장하고 식당 정하기');
  expect(rpc.mock.calls.at(-1)[1].p_expected_revision).toBe('4');
  expect(output(root)).toContain('다시 불러온 뒤 선택해 주세요'); expect(navigation.navigate).not.toHaveBeenCalled();
});
it('clears a chosen time on account changes even if the room and revision are identical', async () => {
  const root = await render(ScheduleConfirmedScreen);
  await act(async () => root.findByType(AvailabilityGrid).props.onToggle('2026-10-20', 18));
  expect(button(root, '시간 저장하고 식당 정하기').props.disabled).toBe(false);
  setConsentAccess('B', 'accepted'); view = { ...view, accountId: 'B' }; await update();
  expect(button(root, '시간 저장하고 식당 정하기').props.disabled).toBe(true); expect(rpc.mock.calls.some(([name]) => name === 'select_room_meeting_time_v1')).toBe(false);
});
it('blocks both next-step choices until all eligible members submitted, excluding display-only rows', async () => {
  view.data = incomplete(); const root = await render(ScheduleConfirmedScreen);
  expect(output(root)).toContain('2명 중 1명 제출'); expect(button(root, '시간 저장하고 식당 정하기').props.disabled).toBe(true);
  expect(button(root, '시간 없이 식당 정하기')).toBeUndefined(); expect(root.findAllByType(AvailabilityGrid)).toHaveLength(0);
  expect(rpc).not.toHaveBeenCalled();
});
it('keeps direct selection usable if the recommendation Edge returns HTTP 400', async () => {
  supabase.functions.invoke.mockResolvedValue({ data: null, error: { context: { status: 400 }, message: 'private server raw' } });
  const root = await render(ScheduleConfirmedScreen); await press(root, '시간 추천받기');
  expect(output(root)).toContain('현재 서버와 시간 추천 방식이 달라요'); expect(output(root)).not.toContain('private server raw');
  expect(root.findByType(AvailabilityGrid)).toBeTruthy();
});
it('rejects malformed recommendation content without rendering objects as labels', async () => {
  supabase.functions.invoke.mockResolvedValue({ data: { slotRecommendations: [{ slot: { id: 'bad', date: '2026-10-20', startTime: '18:00', endTime: '19:00' }, availableCount: 1, totalCount: 2, reason: { raw: 'invalid' } }] }, error: null });
  const root = await render(ScheduleConfirmedScreen); await press(root, '시간 추천받기');
  expect(output(root)).toContain('유효한 추천 시간이 없어요'); expect(root.findAll(n => n.props.accessibilityRole === 'radio')).toHaveLength(0); expect(root.findByType(AvailabilityGrid)).toBeTruthy();
});
it('rechecks submissions for the documented HTTP 409/S4004 Edge response', async () => {
  supabase.functions.invoke.mockResolvedValue({ data: null, error: { context: { status: 409, json: async () => ({ code: 'S4004', message: 'private server raw' }) } } });
  view.reload.mockImplementation(async () => { view.data = incomplete(); return view.data; });
  const root = await render(ScheduleConfirmedScreen); await press(root, '시간 추천받기'); await update();
  expect(output(root)).toContain('모두 제출해야 방장이 진행할 수 있어요'); expect(output(root)).not.toContain('private server raw');
  expect(button(root, '시간 저장하고 식당 정하기').props.disabled).toBe(true); expect(rpc).not.toHaveBeenCalled();
});
it.each(['settling', 'done'])('keeps unverified legacy %s separate from confirmed appointments in every card size', async stage => {
  const root = await render(MeetingCard, { stage, s4: true, compact: false, memberCount: 2, ownerConfirmed: false, onChooseRestaurant: jest.fn() });
  expect(output(root)).toContain('확정 미확인'); expect(output(root)).not.toContain('이전 확정 상태예요');
  props = { ...props, compact: true }; await update(); expect(output(root)).toContain('확정 미확인');
  props = { ...props, ownerConfirmed: true }; await update(); expect(output(root)).not.toContain('확정 미확인');
});
it('labels unverified settlement rows without claiming an appointment confirmation', async () => {
  const room = { id: s4RoomId, title: '이전 방', decisionMode: 's4', stage: 'settling', expiresAt: '2026-10-27T14:59:59Z', isConfirmed: true, participants: [] };
  const root = await render(RoomRow, { room, onPress: jest.fn() });
  expect(output(root)).toContain('확정 미확인 · 정산 중');
  props = { ...props, room: { ...room, appointmentConfirmedAt: '2026-10-20T00:00:00Z' } }; await update();
  expect(output(root)).not.toContain('확정 미확인');
});
it('renders the new legacy_settlement_unverified state as a read-only schedule', async () => {
  view.data = place({ stage: 'settling', confirmation_status: 'legacy_settlement_unverified', permissions: { can_submit: false, can_select_time: false, can_confirm: false } });
  const root = await render(ScheduleSheet, { visible: true, roomId: s4RoomId, isOwner: true, onClose: jest.fn(), onStateChanged: jest.fn() });
  expect(output(root)).toContain('확정 미확인 · 정산 중'); expect(button(root, '시간 수정하기')).toBeUndefined();
});
it.each(['step2', 'sheet'])('lets %s repair schedules in place only while time is unselected', async screen => {
  const permissions = { can_submit: true, can_select_time: true, can_confirm: false };
  view.data = place({ meeting_time: null, time_status: 'unset', permissions });
  response = () => s4Mutation(place({ revision: '5', meeting_time: null, time_status: 'unset', permissions }));
  const root = await render(screen === 'step2' ? ScheduleTimeScreen : ScheduleSheet, screen === 'step2' ? {} : { visible: true, roomId: s4RoomId, isOwner: true, onClose: jest.fn(), onStateChanged: jest.fn() });
  if (screen === 'sheet') await press(root, '일정 수정');
  expect(root.findByType(AvailabilityGrid)).toBeTruthy(); await press(root, '선택 완료');
  expect(rpc.mock.calls.some(([name]) => name === 'submit_room_availability_v1')).toBe(true);
  expect(advanceRoomStage).not.toHaveBeenCalled();
  view = { ...view, data: place() }; await update(); expect(button(root, '일정 수정')).toBeUndefined();
  expect(root.findAllByType(AvailabilityGrid)).toHaveLength(0);
});
it('allows an explicit time-unset place transition without claiming a saved time', async () => {
  response = () => s4Mutation(s4State({ stage: 'place', revision: '5', permissions: { can_submit: false, can_select_time: true, can_confirm: false } }));
  const root = await render(ScheduleConfirmedScreen); await press(root, '시간 없이 식당 정하기');
  expect(rpc.mock.calls.at(-1)[1].p_time).toBeNull(); expect(navigation.navigate).toHaveBeenCalled();
});
it('keeps incomplete submission in the waiting state and provides a real chat entry', async () => {
  response = () => { view.data = { ...incomplete(), revision: '5' }; return s4Mutation(view.data); };
  const root = await render(ScheduleTimeScreen); await press(root, '선택 완료');
  expect(output(root)).toMatch(/2\s*명 중\s*1\s*명 제출/); expect(navigation.navigate).not.toHaveBeenCalled();
  await press(root, '채팅방에서 기다리기'); expect(navigation.navigate).toHaveBeenCalledWith('ChatRoom', expect.objectContaining({ roomId: s4RoomId }));
});
it('submits an explicit empty withdrawal without converting it to a completed submission', async () => {
  response = () => { const state = incomplete(); state.availability.my_slots = []; state.availability.members[0].submitted = false; state.availability.submitted_count = 0; return s4Mutation(state); };
  const root = await render(ScheduleTimeScreen);
  await act(async () => root.findByType(AvailabilityGrid).props.onToggle('2026-10-20', 18));
  await act(async () => root.findByType(AvailabilityGrid).props.onToggle('2026-10-20', 19));
  await press(root, '제출 철회'); expect(rpc.mock.calls.at(-1)[1].p_slot_keys).toEqual([]); expect(output(root)).toContain('일정을 철회했어요'); expect(output(root)).not.toContain('일정을 제출했어요');
});
it.each(['step2', 'sheet'])('blocks %s when every picked time elapsed without silently withdrawing the schedule', async screen => {
  view.data = s4State({ server_time: '2026-10-20T08:59:59Z' }); view.data.availability.my_slots = ['2026-10-20-18'];
  const root = await render(screen === 'step2' ? ScheduleTimeScreen : ScheduleSheet, screen === 'step2' ? {} : { visible: true, roomId: s4RoomId, onClose: jest.fn(), onStateChanged: jest.fn() });
  if (screen === 'sheet') await press(root, '일정 수정');
  await act(async () => jest.advanceTimersByTimeAsync(2000)); await press(root, '선택 완료');
  expect(output(root)).toContain('고른 시간이 모두 지났어요'); expect(rpc).not.toHaveBeenCalled();
});
it('moves the visible KST grid to the next date at midnight', async () => {
  view.data = s4State({ server_time: '2026-10-20T14:59:59Z' });
  const root = await render(ScheduleTimeScreen); expect(root.findByType(AvailabilityGrid).props.days[0].date).toBe('2026-10-20');
  await act(async () => jest.advanceTimersByTimeAsync(2000)); expect(root.findByType(AvailabilityGrid).props.days[0].date).toBe('2026-10-21');
});
it.each(['step2', 'sheet'])('retains %s picks and an editable form with a retry banner on refresh errors', async screen => {
  const root = await render(screen === 'step2' ? ScheduleTimeScreen : ScheduleSheet, screen === 'step2' ? {} : { visible: true, roomId: s4RoomId, onClose: jest.fn(), onStateChanged: jest.fn() });
  if (screen === 'sheet') await press(root, '일정 수정');
  const picked = [...root.findByType(AvailabilityGrid).props.picked]; view = { ...view, loading: true, error: Object.assign(Error('private raw'), { code: 'NETWORK' }) }; await update();
  expect([...root.findByType(AvailabilityGrid).props.picked]).toEqual(picked); expect(output(root)).not.toContain('private raw');
  expect(button(root, '상태 다시 확인')).toBeDefined(); expect(button(root, '선택 완료').props.disabled).toBe(false);
});
it('keeps the confirmation dialog open and surfaces a polling error without dropping its plan', async () => {
  view.data = place(); const root = await render(VotingSheet, votingProps()); await press(root, '실제 후보 식당으로 정하기');
  view = { ...view, error: Object.assign(Error('private raw'), { code: 'NETWORK' }) }; await update();
  expect(root.findByType(PlanConfirmation).props.restaurant).toBe('실제 후보 식당'); expect(root.findByType(PlanConfirmation).props.error).not.toContain('private raw');
  expect(root.findByType(PlanConfirmation).props.error).toContain('다시 시도');
});
it.each(['S4006', 'S4010'])('recovers %s confirmation failures through a visible time-edit entry', async code => {
  view.data = place(); const incoming = votingProps(), root = await render(VotingSheet, incoming); await press(root, '실제 후보 식당으로 정하기');
  rpc.mockImplementation(async name => name === 'get_s4_capabilities' ? { data: s4Capabilities, error: null } : { data: null, error: { code, message: 'private raw' } });
  await press(root, '확정하기'); expect(root.findAllByType(PlanConfirmation)).toHaveLength(0); expect(output(root)).toContain('시간을 다시 골라 주세요'); expect(output(root)).not.toContain('private raw');
  await press(root, '시간 수정하기'); expect(incoming.onSelectTime).toHaveBeenCalledTimes(1);
});
it('passes the existing room title from the schedule sheet through saving a changed time', async () => {
  view.data = place(); const incoming = { visible: true, roomId: s4RoomId, roomName: '서버의 밥약 제목', onClose: jest.fn(), onStateChanged: jest.fn() };
  let root = await render(ScheduleSheet, incoming); await press(root, '시간 수정하기');
  expect(navigation.navigate).toHaveBeenCalledWith('ScheduleConfirmed', { roomId: s4RoomId, name: '서버의 밥약 제목' });
  await act(async () => renderer.unmount()); navigation.current.params.name = '서버의 밥약 제목'; root = await render(ScheduleConfirmedScreen);
  await act(async () => root.findByType(AvailabilityGrid).props.onToggle('2026-10-20', 18)); await press(root, '선택한 시간 저장');
  expect(navigation.navigate).toHaveBeenLastCalledWith('ChatRoom', { roomId: s4RoomId, title: '서버의 밥약 제목', openSheet: 'menu' });
});
it('cleans up a newly created empty solo room and returns the creation inputs on STEP2 back', async () => {
  view.data = s4State(); view.data.availability.eligible_count = 1; view.data.availability.my_slots = [];
  view.data.availability.members = [{ ...view.data.availability.members[0], submitted: false }]; view.data.availability.submitted_count = 0; view.data.availability.all_submitted = false;
  navigation.current.params.invitees = ['친구']; navigation.current.params.name = '입력한 이름';
  const root = await render(ScheduleTimeScreen); await press(root, '뒤로');
  expect(require('../src/lib/rooms').leaveRoom).toHaveBeenCalledWith(s4RoomId);
  expect(navigation.goBackWith).toHaveBeenCalledWith({ name: '입력한 이름', invitees: ['친구'] });
});
it('retains a new empty room and the form if its cleanup fails', async () => {
  view.data = s4State(); view.data.availability.eligible_count = 1; view.data.availability.my_slots = [];
  view.data.availability.members = [{ ...view.data.availability.members[0], submitted: false }]; view.data.availability.submitted_count = 0; view.data.availability.all_submitted = false;
  navigation.current.params.invitees = []; require('../src/lib/rooms').leaveRoom.mockResolvedValueOnce(Error('private raw'));
  const root = await render(ScheduleTimeScreen); await press(root, '뒤로');
  expect(output(root)).toContain('빈 밥약을 정리하지 못했어요'); expect(output(root)).not.toContain('private raw'); expect(navigation.goBackWith).not.toHaveBeenCalled();
});
it.each(['settling', 'done'])('does not relabel old-server %s rooms as unverified S4 settlements', async stage => {
  const root = await render(MeetingCard, { stage, s4: false, memberCount: 2, onChooseRestaurant: jest.fn() });
  expect(output(root)).not.toContain('확정 미확인');
  await act(async () => renderer.unmount());
  const row = await render(RoomRow, { room: { id: s4RoomId, title: '이전 방', stage, decisionMode: 'legacy', expiresAt: '2026-10-27T14:59:59Z' }, onPress: jest.fn() });
  expect(output(row)).not.toContain('확정 미확인');
});
it.each(['step2', 'sheet'])('keeps the %s draft through a conflict and resubmits with the refreshed revision', async screen => {
  const latest = s4State({ revision: '6' }); latest.availability.my_slots = ['2026-10-20-15'];
  const root = await render(screen === 'step2' ? ScheduleTimeScreen : ScheduleSheet, screen === 'step2' ? {} : { visible: true, roomId: s4RoomId, isOwner: true, onClose: jest.fn(), onStateChanged: jest.fn() });
  if (screen === 'sheet') await press(root, '일정 수정');
  await act(async () => root.findByType(AvailabilityGrid).props.onToggle('2026-10-20', 20));
  view = { ...view, data: latest }; await update();
  rpc.mockImplementation(async name => name === 'get_s4_capabilities' ? { data: s4Capabilities, error: null } : { data: null, error: { code: 'S4005' } });
  await press(root, '선택 완료'); expect(rpc.mock.calls.at(-1)[1].p_expected_revision).toBe('4');
  expect([...root.findByType(AvailabilityGrid).props.picked]).toEqual(['2026-10-20-18', '2026-10-20-19', '2026-10-20-20']);
  rpc.mockImplementation(async name => ({ data: name === 'get_s4_capabilities' ? s4Capabilities : s4Mutation(s4State({ revision: '7' })), error: null }));
  await press(root, '선택 완료'); expect(rpc.mock.calls.at(-1)[1]).toMatchObject({ p_expected_revision: '6', p_slot_keys: ['2026-10-20-18', '2026-10-20-19', '2026-10-20-20'] });
});
it.each(['step2', 'sheet'])('uses the preserved %s state revision when the post-conflict reload fails', async screen => {
  const root = await render(screen === 'step2' ? ScheduleTimeScreen : ScheduleSheet, screen === 'step2' ? {} : { visible: true, roomId: s4RoomId, onClose: jest.fn(), onStateChanged: jest.fn() });
  if (screen === 'sheet') await press(root, '일정 수정');
  await act(async () => root.findByType(AvailabilityGrid).props.onToggle('2026-10-20', 20));
  view = { ...view, data: s4State({ revision: '6' }), error: Object.assign(Error('private raw'), { code: 'NETWORK' }), reload: jest.fn(async () => null) }; await update();
  rpc.mockImplementation(async name => name === 'get_s4_capabilities' ? { data: s4Capabilities, error: null } : { data: null, error: { code: 'S4005' } });
  await press(root, '선택 완료'); expect(rpc.mock.calls.at(-1)[1].p_expected_revision).toBe('4');
  expect([...root.findByType(AvailabilityGrid).props.picked]).toEqual(['2026-10-20-18', '2026-10-20-19', '2026-10-20-20']);
  expect(output(root)).toContain('고른 시간은 유지했어요'); expect(output(root)).not.toContain('private raw');
  rpc.mockImplementation(async name => ({ data: name === 'get_s4_capabilities' ? s4Capabilities : s4Mutation(s4State({ revision: '7' })), error: null }));
  await press(root, '선택 완료'); expect(rpc.mock.calls.at(-1)[1].p_expected_revision).toBe('6');
});
it.each([false, true])('shows the legacy-confirmation notice only on S4 servers (s4=%s)', async s4 => {
  const root = await render(MeetingCard, { stage: 'confirmed', s4, ownerConfirmed: false, memberCount: 2, onChooseRestaurant: jest.fn() });
  expect(output(root).includes('이전 확정 상태예요')).toBe(s4);
});
it('shows an actionable idle unknown state instead of spinning with no room to probe', async () => {
  view = { ...view, mode: 'unknown', data: null, loading: false }; props = { visible: true, roomId: null, onClose: jest.fn(), onStateChanged: jest.fn() };
  const root = await render(ScheduleSheet, props); expect(output(root)).toContain('화면을 닫고 다시 열어 주세요');
  expect(root.findAllByType(require('react-native').ActivityIndicator)).toHaveLength(0);
});
it('keeps the legacy voting input mounted while showing a capability recheck notice', async () => {
  view = { ...view, mode: 'legacy', data: null }; const root = await render(VotingSheet, votingProps());
  await press(root, '직접 추가'); await act(async () => root.findByType(TextInput).props.onChangeText('입력한 후보'));
  view = { ...view, loading: true }; await update(); expect(root.findByType(TextInput).props.value).toBe('입력한 후보');
  await press(root, '식당 직접 추가 닫기'); expect(output(root)).toContain('서버 기능을 다시 확인하고 있어요');
});
it('renders eligible submission badges and exposes time editing in place only to the owner', async () => {
  const props = { visible: true, roomId: s4RoomId, isOwner: true, participants: [{ id: 'p-me', profileId: 'A', name: '모아' }], onClose: jest.fn(), onStateChanged: jest.fn() };
  const root = await render(ScheduleSheet, props);
  expect(output(root)).toContain('제출 대상 아님'); expect(output(root)).toMatch(/2\s*명 중\s*2\s*명/);
  await press(root, '시간 선택하기'); expect(navigation.navigate).toHaveBeenCalledWith('ScheduleConfirmed', { roomId: s4RoomId });
  view = { ...view, data: place() }; await update(); expect(button(root, '시간 수정하기')).toBeDefined();
  view = { ...view, data: place({ stage: 'settling', permissions: { can_submit: false, can_select_time: false, can_confirm: false } }) }; await update();
  expect(button(root, '시간 수정하기')).toBeUndefined(); expect(output(root)).toContain('정산 단계');
});
it('announces changed S4 submission/stage notices once on iOS without repeating polling refreshes', async () => {
  const platform = Platform.OS; Platform.OS = 'ios';
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions').mockImplementation(() => {});
  try {
    await render(ScheduleSheet, { visible: true, roomId: s4RoomId, isOwner: true, onClose: jest.fn(), onStateChanged: jest.fn() });
    expect(announce).toHaveBeenCalledWith('2명 중 2명 일정을 제출했어요.', { queue: true });
    view = { ...view, data: s4State({ revision: '5' }) }; await update(); expect(announce).toHaveBeenCalledTimes(1);
    view = { ...view, data: place() }; await update(); expect(announce).toHaveBeenCalledTimes(2);
  } finally { Platform.OS = platform; }
});
it('keeps a room-scoped submission lock across sheet remounts and refreshes on late success', async () => {
  let finish; const changed = jest.fn();
  rpc.mockImplementation(async name => name === 'get_s4_capabilities' ? { data: s4Capabilities, error: null } : new Promise(resolve => { finish = resolve; }));
  const props = { visible: true, roomId: s4RoomId, isOwner: true, onClose: jest.fn(), onStateChanged: changed };
  let root = await render(ScheduleSheet, props); await press(root, '일정 수정'); await press(root, '선택 완료');
  await act(async () => renderer.unmount()); renderer = undefined;
  root = await render(ScheduleSheet, props); expect(button(root, '일정 수정').props.disabled).toBe(true);
  await act(async () => finish({ data: s4Mutation(s4State({ revision: '5' })), error: null }));
  expect(changed).toHaveBeenCalledTimes(1); expect(button(root, '일정 수정').props.disabled).toBe(false);
});
it('refreshes the parent after a closed-sheet success without navigating or closing a newer sheet', async () => {
  let finish;
  rpc.mockImplementation(async name => name === 'get_s4_capabilities' ? { data: s4Capabilities, error: null } : new Promise(resolve => { finish = resolve; }));
  const incoming = { visible: true, roomId: s4RoomId, isOwner: true, onClose: jest.fn(), onStateChanged: jest.fn() };
  const root = await render(ScheduleSheet, incoming); await press(root, '시간 없이 식당 정하기');
  props = { ...incoming, visible: false }; await update();
  await act(async () => finish({ data: s4Mutation(place({ revision: '5', meeting_time: null, time_status: 'unset', permissions: { can_submit: false, can_select_time: true, can_confirm: false } })), error: null }));
  expect(incoming.onStateChanged).toHaveBeenCalledTimes(1); expect(incoming.onClose).not.toHaveBeenCalled(); expect(navigation.navigate).not.toHaveBeenCalled();
});
it('waits for the owner despite all votes and performs only the atomic confirmation RPC', async () => {
  view.data = place(); response = () => s4Mutation(place({ stage: 'confirmed', revision: '5', confirmation_status: 'owner_confirmed', permissions: { can_submit: false, can_select_time: false, can_confirm: false } }));
  const props = votingProps(), root = await render(VotingSheet, props);
  expect(output(root)).toContain('자동 확정되지 않아요'); expect(rpc).not.toHaveBeenCalled();
  await press(root, '실제 후보 식당으로 정하기'); expect(root.findByType(PlanConfirmation).props.when).toContain('18:00–19:00 · 한국 시간');
  await press(root, '확정하기');
  expect(rpc.mock.calls.map(call => call[0])).toEqual(['get_s4_capabilities', 'confirm_room_appointment_v1']);
  expect(voting.confirmRoomVote).not.toHaveBeenCalled(); expect(advanceRoomStage).not.toHaveBeenCalled(); expect(props.onConfirm).toHaveBeenCalledTimes(1);
});
it('keeps votes editable on a legacy-partial S4 room without treating it as a completed appointment', async () => {
  view.data = place({ confirmation_status: 'legacy_partial', restaurant: { item_id: s4ItemId, label: '이전 식당' } });
  const root = await render(VotingSheet, { ...votingProps(), confirmedRestaurant: '이전 식당' });
  expect(button(root, '직접 추가').props.disabled).toBe(false); expect(button(root, '약속 확정 다시 시도')).toBeUndefined();
});
it('preserves a candidate draft while the current decision is being rechecked', async () => {
  view.data = place(); const root = await render(VotingSheet, votingProps()); await press(root, '직접 추가');
  await act(async () => root.findByType(TextInput).props.onChangeText('밥'));
  view = { ...view, loading: true }; await update();
  expect(root.findByType(TextInput).props.value).toBe('밥');
  expect(button(root, '이 이름으로 후보 추가').props.disabled).toBe(false);
  await press(root, '이 이름으로 후보 추가'); expect(voting.addVotingItem).toHaveBeenCalled();
});
it('hides owner actions for ordinary mates and requires a structured time before final confirmation', async () => {
  view.data = place({ permissions: { can_submit: false, can_select_time: false, can_confirm: false } });
  const root = await render(VotingSheet, { ...votingProps(), isOwner: false });
  expect(output(root)).toContain('방장이 확정해요');
  expect(button(root, '실제 후보 식당으로 정하기')).toBeUndefined();
  view.data = place({ meeting_time: null, time_status: 'legacy_unverified', legacy_time_label: '8/20(목) 18:00', permissions: { can_submit: false, can_select_time: true, can_confirm: false } });
  props = votingProps(); await update(); expect(button(root, '실제 후보 식당으로 정하기').props.disabled).toBe(true);
  await press(root, '시간 선택하기'); expect(props.onSelectTime).toHaveBeenCalledTimes(1); expect(rpc).not.toHaveBeenCalled();
});
it('shows a revision conflict without a partial restaurant-success claim or a stage advance', async () => {
  view.data = place(); const root = await render(VotingSheet, votingProps()); await press(root, '실제 후보 식당으로 정하기');
  rpc.mockImplementation(async name => name === 'get_s4_capabilities' ? { data: s4Capabilities, error: null } : { data: null, error: { code: 'S4005', message: 'private SQL raw' } });
  await press(root, '확정하기'); expect(output(root)).toContain('다시 불러온 뒤 선택해 주세요');
  expect(output(root)).not.toContain('식당은 저장됐지만'); expect(output(root)).not.toContain('private SQL raw'); expect(advanceRoomStage).not.toHaveBeenCalled();
});
it('uses the same full KST time string on chat cards and home rows without meetingDate fallback', async () => {
  const room = { id: s4RoomId, title: '밥약', color: '', ownerId: 'A', stage: 'place', isConfirmed: false, confirmedSlot: s4Time.starts_at, meetingTime: s4Time, expiresAt: '2026-10-25T00:00:00Z', meetingDate: '2099-12-31', participants: [], locationName: null, lastMessage: null };
  const Card = () => React.createElement(React.Fragment, null, React.createElement(MeetingCard, { stage: room.stage, meetingTime: s4Time, memberCount: 2, onChooseRestaurant: jest.fn() }), React.createElement(RoomRow, { room, onPress: jest.fn() }));
  const root = await render(Card); expect(output(root).match(/2026년 10월 20일 \(화\) 18:00–19:00 · 한국 시간/g)).toHaveLength(2); expect(output(root)).not.toContain('2099');
});
