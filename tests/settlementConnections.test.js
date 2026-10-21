const React = require('react');
const { act, create } = require('react-test-renderer');
const { Modal, Text, TextInput } = require('react-native');
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../src/profile/useMyProfile', () => ({ useMyProfile: () => ({ status: 'ready', bundle: { profile: { name: '요청자' }, privateProfile: { bankName: 'Synthetic', accountNumber: '0000' } } }) }));
jest.mock('../src/lifecycle/AppLifecycleContext', () => ({ useForegroundRefreshToken: () => 0 }));
jest.mock('../src/theme/insets', () => ({ useTopInset: () => 0 }));
jest.mock('../src/theme/keyboard', () => ({ useKeyboardOverlap: () => ({ overlap: 0, remeasure: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: ({ children }) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('../src/lib/profile', () => ({ fetchVisibleProfile: jest.fn() }));
jest.mock('../src/lib/friends', () => ({ fetchMyFriends: jest.fn(), addFriend: jest.fn() }));
jest.mock('../src/lib/confirm', () => ({ notify: jest.fn() }));
jest.mock('../src/lib/settlements', () => ({ ...jest.requireActual('../src/lib/settlementAccess'), fetchMyNotifications: jest.fn(), fetchNotificationsReadAt: jest.fn(), markNotificationsRead: jest.fn(), fetchSettlementDetail: jest.fn(), fetchRoomSettlements: jest.fn(), createRoomSettlement: jest.fn(), setSettlementCompleted: jest.fn(), subscribeSettlementPayments: () => () => {} }));
jest.mock('../src/screens/settlement/useSettlementPayment', () => ({ useSettlementPayment: () => ({ status: 'ready', data: { status: 'open' } }) }));
jest.mock('../src/screens/settlement/SettlementPaymentAccount', () => {
  const React = require('react'); const { Text } = require('react-native'); const Account = () => React.createElement(Text, null, 'Synthetic account');
  return { __esModule: true, default: Account, SettlementPaymentAccountView: Account };
});
const { NavigationProvider, useNavigation } = require('../src/navigation/NavigationContext');
const { NotificationsProvider, useNotifications } = require('../src/components/NotificationsProvider');
const NotificationPanel = require('../src/components/NotificationPanel').default;
const { MembersSheet, SettlementSheet } = require('../src/screens/chat/ChatRoomSheets');
const Detail = require('../src/screens/settlement/SettlementDetailScreen').default;
const api = require('../src/lib/settlements');
const { fetchVisibleProfile } = require('../src/lib/profile');
const { fetchMyFriends } = require('../src/lib/friends');
const { useAuth } = require('../src/auth/AuthProvider');
const { setConsentAccess } = require('../src/consents/access');
let renderer, navigation, notifications, user, bill, notice;
const close = jest.fn();
const participants = [
  { id: 'member-owner', profileId: 'owner', name: '요청자', avatarUrl: null, avatarColor: '#FF9900' },
  { id: 'member-sender', profileId: 'sender', name: '참여자', avatarUrl: null, avatarColor: '#FF9900' },
  { id: 'member-null', profileId: null, name: '탈퇴한 메이트', avatarUrl: null, avatarColor: '#FF9900' },
];
function NavigationProbe() { navigation = useNavigation(); return null; }
function NotificationProbe() { notifications = useNotifications(); return null; }
function NoticeFlow() {
  const nav = useNavigation();
  return React.createElement(NotificationsProvider, null, React.createElement(NavigationProbe), React.createElement(NotificationProbe), nav.current.name === 'SettlementDetail' ? React.createElement(Detail) : React.createElement(Text, null, nav.current.name));
}
function MembersFlow() { return React.createElement(React.Fragment, null, React.createElement(NavigationProbe), React.createElement(MembersSheet, { visible: true, participants, code: 'SYNTH1', myId: user.id, ownerId: 'owner', onClose: close })); }
function ChatFlow() { return React.createElement(React.Fragment, null, React.createElement(NavigationProbe), React.createElement(SettlementSheet, { visible: true, roomId: 'room', roomStage: 'confirmed', appointmentConfirmedAt: '2026-10-20T00:00:00Z', onClose: close })); }
const button = label => renderer.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const text = () => JSON.stringify(renderer.toJSON());
async function press(label) { await act(async () => button(label).props.onPress()); }
async function mount(Flow = NoticeFlow, initialRoute = 'Home') { await act(async () => { renderer = create(React.createElement(NavigationProvider, { initialRoute }, React.createElement(Flow))); }); }
beforeEach(() => {
  jest.clearAllMocks(); user = { id: 'owner' }; setConsentAccess('owner', 'accepted'); useAuth.mockImplementation(() => ({ user }));
  bill = { id: 'bill', roomId: 'room', creatorId: 'owner', roomTitle: '연결된 밥약', title: '정산', totalAmount: 6000, splitCount: 3, createdAt: '2026-10-20T00:00:00Z', members: [
    { id: 'owner-member', profileId: 'owner', name: '요청자', isCompleted: true },
    { id: 'sender-member', profileId: 'sender', name: '참여자', isCompleted: false },
    { id: 'last-member', profileId: 'last', name: '다른 참여자', isCompleted: false },
  ] };
  notice = { id: 'notice', roomId: 'room', settlementId: 'bill', title: '정산 요청', message: '정산을 확인해 주세요', amount: 2000, createdAt: '2026-10-20T01:00:00Z' };
  api.fetchMyNotifications.mockImplementation(async () => ({ data: [notice], error: null }));
  api.fetchNotificationsReadAt.mockResolvedValue({ data: null, error: null }); api.markNotificationsRead.mockResolvedValue(null);
  api.fetchSettlementDetail.mockImplementation(async () => ({ data: bill, error: null }));
  api.fetchRoomSettlements.mockResolvedValue({ data: [], error: null }); api.setSettlementCompleted.mockResolvedValue(null);
  fetchVisibleProfile.mockResolvedValue({ data: { profile: { id: 'sender', name: '참여자', tag: 'synthetic', avatar_url: null }, relationship: 'room_mate', fields: {} }, error: null });
  fetchMyFriends.mockResolvedValue({ data: [], error: null });
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = undefined; setConsentAccess(null, 'loading'); });
it.each([['owner', 'ChatRoom', { roomId: 'room' }], ['sender', 'Settlements', undefined]])('opens the exact notification bill and follows Figma back for %s', async (id, destination, params) => {
  user = { id }; setConsentAccess(id, 'accepted'); await mount();
  await act(async () => notifications.open());
  await act(async () => renderer.root.findByType(NotificationPanel).props.onPressNotice(notice));
  expect(navigation.current).toEqual({ name: 'SettlementDetail', params: { billId: 'bill' } });
  expect(api.fetchSettlementDetail).toHaveBeenCalledWith('bill'); expect(text()).toContain('연결된 밥약');
  expect(renderer.root.findAllByType(NotificationPanel)).toHaveLength(0);
  await press('뒤로'); expect(navigation.current).toEqual({ name: destination, params });
});
it('retains the list fallback for a settlement notification without a bill id', async () => {
  notice.settlementId = null; await mount(); await act(async () => notifications.open());
  await act(async () => renderer.root.findByType(NotificationPanel).props.onPressNotice(notice));
  expect(navigation.current.name).toBe('Settlements'); expect(api.fetchSettlementDetail).not.toHaveBeenCalled();
});
it('opens a deleted-room bill from notifications and returns to the list', async () => {
  notice.roomId = null; notice.amount = 0; bill.roomId = null; await mount(); await act(async () => notifications.open());
  await act(async () => renderer.root.findByType(NotificationPanel).props.onPressNotice(notice));
  expect(navigation.current.name).toBe('SettlementDetail'); await press('뒤로'); expect(navigation.current.name).toBe('Settlements');
});
it('routes the own member row to Profile rather than opening a profile sheet', async () => {
  await mount(MembersFlow, 'ChatRoom'); await act(async () => navigation.replace('ChatRoom', { roomId: 'room' }));
  await press('요청자, 방장, 나'); expect(close).toHaveBeenCalled(); expect(navigation.current.name).toBe('Profile'); expect(fetchVisibleProfile).not.toHaveBeenCalled();
});
it('opens a mate profile with room context inside the existing modal and returns to members', async () => {
  await mount(MembersFlow, 'ChatRoom'); await act(async () => navigation.replace('ChatRoom', { roomId: 'room' }));
  await press('참여자'); expect(fetchVisibleProfile).toHaveBeenCalledWith('sender', 'room'); expect(button('친구 추가')).toBeDefined();
  expect(renderer.root.findAllByType(Modal).filter(node => node.props.visible)).toHaveLength(1);
  await press('닫기'); expect(text()).toContain('멤버 3명'); expect(close).not.toHaveBeenCalled();
});
it('opens a NULL-profile member without querying a profile or exposing friend actions', async () => {
  await mount(MembersFlow, 'ChatRoom'); await press('탈퇴한 메이트');
  expect(text()).toContain('탈퇴한 메이트'); expect(button('친구 추가')).toBeUndefined(); expect(fetchVisibleProfile).not.toHaveBeenCalled(); expect(fetchMyFriends).not.toHaveBeenCalled();
  expect(renderer.root.findAllByType(Modal).filter(node => node.props.visible)).toHaveLength(1);
});
it('clears the selected mate immediately when the room context changes', async () => {
  await mount(MembersFlow, 'ChatRoom'); await act(async () => navigation.replace('ChatRoom', { roomId: 'room' }));
  await press('참여자'); expect(renderer.root.findAllByProps({ testID: 'mate-profile-sheet' }).length).toBeGreaterThan(0);
  await act(async () => navigation.replace('ChatRoom', { roomId: 'other-room' }));
  expect(renderer.root.findAllByProps({ testID: 'mate-profile-sheet' })).toHaveLength(0);
  await press('참여자'); expect(fetchVisibleProfile).toHaveBeenLastCalledWith('sender', 'other-room');
});
it('reloads the chat bill after a paid-bill lock and replaces the stale creation draft', async () => {
  api.fetchRoomSettlements.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValue({ data: [bill], error: null });
  api.createRoomSettlement.mockResolvedValue({ data: null, error: { code: '42501', message: 'SETTLEMENT_LOCKED_AFTER_PAYMENT' } });
  await mount(ChatFlow, 'ChatRoom'); await act(async () => renderer.root.findByType(TextInput).props.onChangeText('9000'));
  await press('정산 요청 보내기'); expect(api.fetchRoomSettlements).toHaveBeenCalledTimes(2);
  expect(button('정산 요청 보내기')).toBeUndefined(); expect(button('정산 상세 보기')).toBeDefined();
  expect(require('../src/lib/confirm').notify).toHaveBeenCalledWith('정산 요청 실패', expect.stringContaining('이미 송금 완료한 메이트'));
});
