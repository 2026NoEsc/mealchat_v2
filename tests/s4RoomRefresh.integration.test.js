const React = require('react');
const { act, create } = require('react-test-renderer');
const { Text } = require('react-native');
jest.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: ({ children }) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('../src/theme/insets', () => ({ useTopInset: () => 0 }));
jest.mock('../src/theme/keyboard', () => ({ useKeyboardOverlap: () => ({ overlap: 0, remeasure: jest.fn() }) }));
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../src/navigation/NavigationContext', () => ({ useNavigation: jest.fn() }));
jest.mock('../src/lifecycle/AppLifecycleContext', () => ({ useForegroundRefreshToken: () => 0 }));
jest.mock('../src/lib/useRoomDecision', () => ({ useRoomDecision: jest.fn() }));
jest.mock('../src/lib/consents', () => ({ getConsentServerMode: () => 's1' }));
jest.mock('../src/lib/supabase', () => ({ supabase: { channel: jest.fn(), removeChannel: jest.fn(), functions: { invoke: jest.fn() } } }));
jest.mock('../src/lib/rooms', () => ({ fetchRoom: jest.fn(), fetchRoomMessages: jest.fn(), sendRoomMessage: jest.fn(), sendRoomSticker: jest.fn(), leaveRoom: jest.fn(), advanceRoomStage: jest.fn() }));
jest.mock('../src/lib/voting', () => ({ fetchRoomVoting: jest.fn(), toggleVote: jest.fn(), addVotingItem: jest.fn(), removeVotingItem: jest.fn(), confirmRoomVote: jest.fn() }));
jest.mock('../src/lib/tmap', () => ({ searchPlaces: jest.fn(async () => []) }));
jest.mock('../src/profile/useMyProfile', () => ({ useMyProfile: () => ({ bundle: null }) }));
jest.mock('../src/lib/settlements', () => ({ ...jest.requireActual('../src/lib/settlementAccess'), fetchRoomSettlements: jest.fn(async () => ({ data: [], error: null })), createRoomSettlement: jest.fn(), setSettlementCompleted: jest.fn(), fetchSettlementPaymentDetails: jest.fn(), subscribeSettlementPayments: () => () => {} }));
jest.mock('../src/lib/confirm', () => ({ notify: jest.fn() }));
jest.mock('../src/screens/chat/ScheduleSheet', () => () => null);
jest.mock('../src/screens/chat/useRestaurantRecommendations', () => ({ useRestaurantRecommendations: () => ({ settings: null, areas: [], catalog: null, status: 'unavailable', reason: '', suggestions: [], settingsError: '', available: false, saving: false, request: jest.fn(), validateSuggestion: jest.fn(), saveArea: jest.fn(), saveCuisines: jest.fn(), reload: jest.fn() }) }));
const { useAuth } = require('../src/auth/AuthProvider');
const { useNavigation } = require('../src/navigation/NavigationContext');
const { useRoomDecision } = require('../src/lib/useRoomDecision');
const { configureRoomDecisions } = require('../src/lib/roomDecisions');
const { setConsentAccess } = require('../src/consents/access');
const { fetchRoom, fetchRoomMessages } = require('../src/lib/rooms');
const { fetchRoomVoting } = require('../src/lib/voting');
const { supabase } = require('../src/lib/supabase');
const { s4Capabilities, s4RoomId, s4ItemId, s4Time, s4State, s4Mutation } = require('./fixtures/s4');
const ChatRoomScreen = require('../src/screens/chat/ChatRoomScreen').default;
const PlanConfirmation = require('../src/components/ui/PlanConfirmation').default;
const MeetingCard = require('../src/components/ui/MeetingCard').default;
const FailureCard = require('../src/components/ui/FailureCard').default;
const { SettlementSheet } = require('../src/screens/chat/ChatRoomSheets');
const room = { id: s4RoomId, title: '서버에서 읽은 방 제목', code: 'TEST42', ownerId: 'A', stage: 'place',
  decisionMode: 's4', meetingTime: s4Time, appointmentConfirmedAt: null, confirmedSlot: null,
  participants: [{ id: 'p-A', profileId: 'A', name: '모아', avatarUrl: null, avatarColor: '#FF9900' }, { id: 'p-B', profileId: 'B', name: '두두', avatarUrl: null, avatarColor: '#FF9900' }],
  expiresAt: '2026-10-27T14:59:59Z', locationName: null };
let renderer, navigation, rpc;
const output = root => root.findAllByType(Text).map(node => node.props.children).flat(Infinity).join(' ');
const button = (root, label) => root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
async function press(label) { const target = button(renderer.root, label); expect(target).toBeDefined(); await act(async () => target.props.onPress()); }
async function openConfirmation() {
  await act(async () => { renderer = create(React.createElement(ChatRoomScreen)); });
  await press('약속 확정'); await press('실제 식당으로 정하기');
  expect(renderer.root.findAllByType(PlanConfirmation)).toHaveLength(1);
}
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-20T00:00:00Z')); jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  useAuth.mockReturnValue({ user: { id: 'A' } }); setConsentAccess('A', 'accepted');
  navigation = { current: { name: 'ChatRoom', params: { roomId: s4RoomId } }, navigate: jest.fn(), resetTo: jest.fn(), replace: jest.fn(), goBack: jest.fn() };
  useNavigation.mockReturnValue(navigation);
  const state = s4State({ stage: 'place', meeting_time: s4Time, time_status: 'selected', permissions: { can_submit: false, can_select_time: true, can_confirm: true } });
  useRoomDecision.mockReturnValue({ accountId: 'A', mode: 's4', data: state, loading: false, error: null, reload: jest.fn(async () => state) });
  rpc = jest.fn(async name => ({ data: name === 'get_s4_capabilities' ? s4Capabilities : s4Mutation(state), error: null }));
  configureRoomDecisions({ transport: rpc, storage: { getItem: async () => null, setItem: async () => {} }, backend: 'room-refresh-fixture' });
  const channel = { on: jest.fn().mockReturnThis(), subscribe: jest.fn().mockReturnThis() }; supabase.channel.mockReturnValue(channel);
  fetchRoom.mockReset().mockResolvedValue({ data: room, error: null });
  fetchRoomMessages.mockResolvedValue({ data: [], error: null });
  fetchRoomVoting.mockResolvedValue({ data: [{ id: s4ItemId, kind: 'menu', label: '실제 식당', voters: [{ name: '모아' }, { name: '두두' }], mine: true }], memberCount: 2, error: null });
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = undefined; jest.restoreAllMocks(); jest.useRealTimers(); });

it.each(['response', 'rejection'])('keeps the real owner confirmation and room stage during a pending poll and transient %s failure', async kind => {
  await openConfirmation();
  let finish;
  fetchRoom.mockImplementationOnce(() => new Promise((resolve, reject) => { finish = kind === 'response' ? resolve : reject; }));
  await act(async () => jest.advanceTimersByTime(10000));
  expect(renderer.root.findAllByType(PlanConfirmation)).toHaveLength(1);
  expect(renderer.root.findByType(MeetingCard).props.isOwner).toBe(true);
  expect(renderer.root.findByType(SettlementSheet).props.roomStage).toBe('place');
  const error = { code: 'NETWORK', status: 503, message: 'private server diagnostic' };
  await act(async () => finish(kind === 'response' ? { data: null, error } : error));
  expect(renderer.root.findAllByType(PlanConfirmation)).toHaveLength(1);
  expect(renderer.root.findByType(MeetingCard).props.isOwner).toBe(true);
  expect(renderer.root.findByType(SettlementSheet).props.roomStage).toBe('place');
  expect(output(renderer.root)).toContain('마지막으로 확인한 내용을 보고 있어요.');
  expect(output(renderer.root)).not.toContain(error.message);
  await act(async () => renderer.root.findByType(FailureCard).props.onRetry());
  expect(renderer.root.findAllByType(PlanConfirmation)).toHaveLength(1);
  expect(renderer.root.findAllByType(FailureCard)).toHaveLength(0);
  await press('확정하기');
  expect(rpc).toHaveBeenCalledWith('confirm_room_appointment_v1', expect.objectContaining({ p_room_id: s4RoomId, p_restaurant_item_id: s4ItemId }));
});
it.each(['account', 'room', 'denied'])('does not retain owner controls across a %s boundary', async boundary => {
  await openConfirmation();
  let finish;
  fetchRoom.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  if (boundary === 'account') useAuth.mockReturnValue({ user: { id: 'B' } });
  if (boundary === 'room') navigation.current.params.roomId = '00000000-0000-4000-8000-000000000099';
  await act(async () => {
    if (boundary === 'denied') jest.advanceTimersByTime(10000);
    else renderer.update(React.createElement(ChatRoomScreen));
  });
  if (boundary === 'denied') await act(async () => finish({ data: null, error: { code: '42501' } }));
  expect(renderer.root.findAllByType(PlanConfirmation)).toHaveLength(0);
  expect(renderer.root.findAllByType(MeetingCard).some(card => card.props.isOwner)).toBe(false);
  expect(output(renderer.root)).not.toContain(room.title);
});
