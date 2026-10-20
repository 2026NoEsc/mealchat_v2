const React = require('react');
jest.mock('../src/lib/roomDecisions', () => ({ ...jest.requireActual('../src/lib/roomDecisions'), fetchS4Capabilities: jest.fn(async () => ({ mode: 'legacy', error: null })) }));
const { act, create } = require('react-test-renderer');
const { AccessibilityInfo, Animated, BackHandler, Clipboard, Linking, Modal, Platform, StyleSheet, Text, TextInput } = require('react-native');
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }), SafeAreaProvider: ({ children }) => children }));
jest.mock('../src/theme/insets', () => ({ useTopInset: () => 0 }));
jest.mock('../src/theme/keyboard', () => ({ useKeyboardOverlap: () => ({ overlap: 0, remeasure: jest.fn() }) }));
jest.mock('../src/profile/useMyProfile', () => ({ useMyProfile: () => ({ bundle: { profile: { name: '나야나' } } }) }));
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../src/components/NotificationsProvider', () => ({ useNotifications: () => ({ hasUnread: false, open: jest.fn() }) }));
jest.mock('../src/navigation/NavigationContext', () => ({ useNavigation: jest.fn() }));
jest.mock('../src/rooms/useMyRooms', () => ({ useMyRooms: jest.fn(), useMySettlements: jest.fn() }));
jest.mock('../src/lib/rooms', () => ({ joinRoomByCode: jest.fn(), fetchMyRooms: jest.fn(), fetchMySettlements: jest.fn() }));
jest.mock('../src/lifecycle/AppLifecycleContext', () => ({ useForegroundRefreshToken: jest.fn(() => 0) }));
jest.mock('../src/lib/settlements', () => ({ ...jest.requireActual('../src/lib/settlementAccess'), fetchMySettlementsDetailed: jest.fn(), setSettlementCompleted: jest.fn(), fetchMyNotifications: jest.fn(), fetchNotificationsReadAt: jest.fn(), markNotificationsRead: jest.fn(), fetchSettlementPaymentDetails: jest.fn(), subscribeSettlementPayments: () => () => {} }));
const HomeScreen = require('../src/screens/HomeScreen').default;
const NotificationPanel = require('../src/components/NotificationPanel').default;
const CopyButton = require('../src/components/ui/CopyButton').default;
const { copyToClipboard } = require('../src/components/ui/CopyButton');
const SettleMember = require('../src/components/ui/SettleMember').default;
const FailureCard = require('../src/components/ui/FailureCard').default;
const JoinCodeSheet = require('../src/components/JoinCodeSheet').default;
const SettlementsScreen = require('../src/screens/settlement/SettlementsScreen').default;
const { HOME_STAGE_LABELS, default: RoomRow } = require('../src/components/RoomRow');
const { useNavigation } = require('../src/navigation/NavigationContext');
const { useMyRooms, useMySettlements } = require('../src/rooms/useMyRooms');
const { useAuth } = require('../src/auth/AuthProvider');
const { relativeTime } = require('../src/lib/format');
const { NotificationsProvider, useNotifications: useRealNotifications } = jest.requireActual('../src/components/NotificationsProvider');
const { useMyRooms: useRealRooms, useMySettlements: useRealSettlements } = jest.requireActual('../src/rooms/useMyRooms');
const { fetchMyRooms, fetchMySettlements } = require('../src/lib/rooms');
const { useForegroundRefreshToken } = require('../src/lifecycle/AppLifecycleContext');
const { fetchMyNotifications, fetchNotificationsReadAt, markNotificationsRead } = require('../src/lib/settlements');
const noticeLabel = (n, unread) => [unread ? '안 읽음' : '읽음', n.title, n.message, ...(n.amount > 0 ? [n.amount.toLocaleString('ko-KR') + '원'] : []), relativeTime(n.createdAt)].join(', ');
const { joinRoomByCode } = require('../src/lib/rooms');
const { fetchMySettlementsDetailed, setSettlementCompleted } = require('../src/lib/settlements');
let renderer, navigation, reload;
const text = root => root.findAllByType(Text).map(node => Array.isArray(node.props.children) ? node.props.children.join('') : node.props.children).join(' ');
const target = (root, label) => root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function' && node.props.accessibilityRole)[0];
async function render(Component, props = {}) { await act(async () => { renderer = create(React.createElement(Component, props)); }); return renderer.root; }
async function press(root, label) { await act(async () => target(root, label).props.onPress()); }
const room = { id: 'room', title: '오늘 저녁팟', stage: 'confirmed', isConfirmed: true, meetingDate: '2026-09-27', confirmedSlot: null, locationName: null, expiresAt: '2099-01-01', participants: [], lastMessage: null };
const notices = [
  { id: 'new', roomId: 'room', title: '일정 확정', message: '저녁팟', amount: 0, createdAt: '2026-09-27T02:00:00Z' },
  { id: 'bill', roomId: 'room', title: '정산 요청', message: '회사', amount: 13000, createdAt: '2026-09-27T01:00:00Z' },
  { id: 'old', roomId: '', title: '이전 일정', message: '안내', amount: 0, createdAt: '2026-09-26T01:00:00Z' },
];
const bill = { id: 'bill', roomId: 'room', creatorId: 'mate', roomTitle: '조선칼국수', title: '회사 팀 점심', totalAmount: 52000, splitCount: 4, bankName: '카카오뱅크', accountNumber: '3333-01-2345678', accountHolder: '박모아', createdAt: '2026-09-27T00:00:00Z', members: [{ id: 'mine', profileId: 'me', name: '나야나', isCompleted: false }, { id: 'other', profileId: 'mate', name: '모아', isCompleted: true }] };
beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ user: { id: 'me' } });
  fetchMyRooms.mockResolvedValue({ data: [room], error: null });
  fetchMySettlements.mockResolvedValue({ data: [], error: null });
  useForegroundRefreshToken.mockReturnValue(0);
  fetchMyNotifications.mockResolvedValue({ data: notices, error: null }); fetchNotificationsReadAt.mockResolvedValue({ data: null, error: null }); markNotificationsRead.mockResolvedValue(null);
  navigation = { navigate: jest.fn(), goBack: jest.fn() }; reload = jest.fn();
  useNavigation.mockReturnValue(navigation);
  useMyRooms.mockReturnValue({ rooms: [room], status: 'ready', reload }); useMySettlements.mockReturnValue([]);
  fetchMySettlementsDetailed.mockResolvedValue({ data: [bill], error: null }); setSettlementCompleted.mockResolvedValue(null);
  require('../src/lib/settlements').fetchSettlementPaymentDetails.mockResolvedValue({ data: { billId: bill.id, status: 'open', details: { bankName: bill.bankName, accountNumber: bill.accountNumber, accountHolder: bill.accountHolder } }, error: null });
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = undefined; jest.restoreAllMocks(); jest.useRealTimers(); });
it('hides the settlement nudge for zero and shows the actual positive count', async () => {
  let root = await render(HomeScreen); expect(text(root)).not.toContain('미완료 정산');
  useMySettlements.mockReturnValue([{ settled: false }, { settled: true }]);
  await act(async () => renderer.update(React.createElement(HomeScreen)));
  root = renderer.root; expect(text(root)).toContain('미완료 정산 1건'); await press(root, '미완료 정산 1건 보기'); expect(navigation.navigate).toHaveBeenCalledWith('Settlements');
});
it('offers creation and invite-code entry in the empty state and hides the FAB', async () => {
  useMyRooms.mockReturnValue({ rooms: [], status: 'ready', reload });
  const root = await render(HomeScreen); expect(text(root)).toContain('아직 잡힌 밥약이 없어요.'); expect(target(root, '새 밥약 또는 초대 코드')).toBeUndefined();
  await press(root, '새 밥약 만들기'); expect(navigation.navigate).toHaveBeenCalledWith('ScheduleDetail');
  await press(root, '초대 코드 입력'); expect(root.findByType(JoinCodeSheet).props.visible).toBe(true); expect(root.findByType(JoinCodeSheet).props.onMembershipClosed).toBe(reload);
});
it('retries a real load error and keeps the previous room list visibly stale', async () => {
  useMyRooms.mockReturnValue({ rooms: [room], status: 'error', reload }); const root = await render(HomeScreen);
  expect(text(root)).toContain('이전에 불러온 밥약이에요.'); expect(target(root, '새 밥약 또는 초대 코드')).toBeDefined(); await press(root, '다시 시도'); expect(reload).toHaveBeenCalledTimes(1);
  expect(root.findAll(n => StyleSheet.flatten(n.props.style)?.opacity === 0.45).length).toBeGreaterThan(0);
});
it('uses the existing stage contract without inventing a menu stage', () => {
  expect(HOME_STAGE_LABELS).toEqual({ scheduling: '일정 조율 중', place: '식당 정하는 중', confirmed: '약속 확정', settling: '정산 중', done: '정산 완료' });
});
it('filters notifications with one selected category and does not invent mate records', async () => {
  const root = await render(NotificationPanel, { notices, allRead: false, onClose: jest.fn() });
  await press(root, '정산 알림'); expect(text(root)).toContain('정산 요청'); expect(text(root)).not.toContain('일정 확정');
  expect(new Set(root.findAll(n => n.props.accessibilityRole === 'radio' && n.props.accessibilityState.checked).map(n => n.props.accessibilityLabel)).size).toBe(1);
  await press(root, '메이트 알림'); expect(text(root)).toContain('아직 메이트 알림이 없어요');
});
it('marks only notices newer than readAt unread and disables all-read after completion', async () => {
  const mark = jest.fn(); const props = { notices, allRead: false, readAt: '2026-09-27T00:00:00Z', onClose: jest.fn(), onMarkAllRead: mark, onPressNotice: jest.fn() };
  const root = await render(NotificationPanel, props); expect(target(root, noticeLabel(notices[0], true))).toBeDefined(); expect(target(root, noticeLabel(notices[1], true))).toBeDefined();
  expect(target(root, noticeLabel(notices[2], false))).toBeUndefined();
  expect(root.findAll(n => n.props.accessible && n.props.accessibilityLabel === noticeLabel(notices[2], false)).length).toBeGreaterThan(0);
  await press(root, '모두 읽음'); expect(mark).toHaveBeenCalledTimes(1);
  await act(async () => renderer.update(React.createElement(NotificationPanel, { ...props, allRead: true })));
  expect(root.findAll(n => typeof n.type === 'string' && n.props.accessibilityLabel === '안 읽음')).toHaveLength(0); expect(target(root, '모두 읽음').props.disabled).toBe(true);
});
it('connects a notification to its real destination callback', async () => {
  const onPressNotice = jest.fn(); const root = await render(NotificationPanel, { notices, allRead: true, onClose: jest.fn(), onPressNotice });
  await press(root, noticeLabel(notices[0], false)); expect(onPressNotice).toHaveBeenCalledWith(notices[0]);
});
it.each([0, -100, 13000])('includes the amount in a notification accessibility label only when positive: %s', async amount => {
  const notice = { ...notices[0], amount };
  const root = await render(NotificationPanel, { notices: [notice], allRead: true, onClose: jest.fn(), onPressNotice: jest.fn() });
  const row = target(root, noticeLabel(notice, false));
  expect(row).toBeDefined();
  const formattedAmount = amount.toLocaleString('ko-KR') + '원';
  if (amount > 0) expect(row.props.accessibilityLabel).toContain(formattedAmount);
  else expect(row.props.accessibilityLabel).not.toContain(formattedAmount);
});
it('copies the actual account using the installed native clipboard and reports success', async () => {
  const copy = jest.spyOn(Clipboard, 'setString').mockImplementation(() => {});
  const root = await render(CopyButton, { text: '카카오뱅크 3333' }); await press(root, '복사');
  expect(copy).toHaveBeenCalledWith('카카오뱅크 3333'); expect(text(root)).toContain('복사됨');
});
it('falls back when browser writeText rejects and reports failure only if both paths fail', async () => {
  const previous = Platform.OS; Platform.OS = 'web'; const oldNavigator = global.navigator; const oldDocument = global.document;
  const input = { style: {}, select: jest.fn(), remove: jest.fn() };
  const writeText = jest.fn().mockResolvedValue(undefined); const execCommand = jest.fn().mockReturnValue(true);
  Object.defineProperty(global, 'navigator', { configurable: true, value: { clipboard: { writeText } } });
  global.document = { createElement: jest.fn(() => input), body: { appendChild: jest.fn() }, execCommand };
  try {
    await copyToClipboard('실제 계좌'); expect(writeText).toHaveBeenCalledWith('실제 계좌'); expect(execCommand).not.toHaveBeenCalled();
    writeText.mockRejectedValue(new Error('denied')); await copyToClipboard('계좌'); expect(execCommand).toHaveBeenCalledWith('copy'); expect(input.value).toBe('계좌'); expect(input.remove).toHaveBeenCalled();
    execCommand.mockReturnValue(false); await expect(copyToClipboard('계좌')).rejects.toThrow('Clipboard access denied');
  } finally { Platform.OS = previous; global.document = oldDocument; Object.defineProperty(global, 'navigator', { configurable: true, value: oldNavigator }); }
});
it('shows clipboard failure when the write fails', async () => {
  jest.spyOn(Clipboard, 'setString').mockImplementation(() => { throw new Error('denied'); }); const root = await render(CopyButton, { text: '계좌' }); await press(root, '복사'); expect(text(root)).toContain('복사 실패'); expect(text(root)).not.toContain('복사됨');
});
it.each([false, true])('displays a textual member status and 52px avatar: completed=%s', async completed => {
  const onPress = jest.fn(); const root = await render(SettleMember, { name: '모아', seed: 'mate', completed, onPress });
  expect(text(root)).toContain(completed ? '완료' : '대기'); expect(text(root)).toContain(completed ? '다시 누르면 대기' : '눌러서 완료');
  await press(root, '모아, ' + (completed ? '완료' : '대기')); expect(onPress).toHaveBeenCalledTimes(1);
});
it('retries the shared failure card', async () => { const retry = jest.fn(); const root = await render(FailureCard, { title: '실패', onRetry: retry }); await press(root, '다시 시도'); expect(retry).toHaveBeenCalledTimes(1); });
it('preserves the single invite input and existing join call', async () => {
  joinRoomByCode.mockResolvedValue({ roomId: 'joined', error: null }); const onJoined = jest.fn(); const root = await render(JoinCodeSheet, { visible: true, onClose: jest.fn(), onJoined });
  expect(root.findAllByType(TextInput)).toHaveLength(1); await act(async () => root.findByType(TextInput).props.onChangeText(' ab12cd ')); await press(root, '입장'); expect(joinRoomByCode).toHaveBeenCalledWith('AB12CD'); expect(onJoined).toHaveBeenCalledWith('joined');
});
it('closes a rejected S4 membership code entry with a safe explanation and no false join', async () => {
  const notify = jest.spyOn(require('../src/lib/confirm'), 'notify').mockImplementation(() => {});
  const onClose = jest.fn(), onJoined = jest.fn(), onMembershipClosed = jest.fn();
  joinRoomByCode.mockResolvedValue({ roomId: null, error: { code: 'S4003', hint: 'operation=membership', message: 'private server diagnostic' } });
  const root = await render(JoinCodeSheet, { visible: true, onClose, onJoined, onMembershipClosed });
  await act(async () => root.findByType(TextInput).props.onChangeText('TEST42')); await press(root, '입장');
  expect(onClose).toHaveBeenCalledTimes(1); expect(onJoined).not.toHaveBeenCalled();
  expect(onMembershipClosed).toHaveBeenCalledTimes(1);
  expect(root.findByType(TextInput).props.value).toBe('');
  expect(notify).toHaveBeenCalledWith('입장할 수 없어요', require('../src/lib/roomMembership').membershipClosedMessage);
});
it('keeps payment and member actions tied to existing data and only the current member', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true); const root = await render(SettlementsScreen);
  expect(text(root)).toContain('13,000원'); expect(text(root)).toContain('보낼 곳 · 모아 · 예금주 박모아');
  expect(target(root, '모아, 완료')).toBeUndefined(); await press(root, '토스로 보내기'); expect(openURL).toHaveBeenCalledWith('supertoss://send?bankCode=090&accountNo=3333012345678&amount=13000');
  await press(root, '나야나 (나), 대기'); expect(setSettlementCompleted).not.toHaveBeenCalled(); await press(root, '보냈어요'); expect(setSettlementCompleted).toHaveBeenCalledWith('mine', true);
});
it('retries a settlement fetch rejection through the actual load path', async () => {
  fetchMySettlementsDetailed.mockRejectedValueOnce(new Error('offline')); const root = await render(SettlementsScreen); expect(text(root)).toContain('정산을 불러오지 못했어요'); await press(root, '다시 시도'); expect(fetchMySettlementsDetailed).toHaveBeenCalledTimes(2); expect(text(root)).toContain('회사 팀 점심');
});
it.each(['S1005', 'SETTLEMENT_DISCLOSURE_CLOSED'])('shows the closed undo %s through the cross-platform dialog', async code => {
  const notify = jest.spyOn(require('../src/lib/confirm'), 'notify').mockImplementation(() => {});
  fetchMySettlementsDetailed.mockResolvedValue({ data: [{ ...bill, members: bill.members.map(member => ({ ...member, isCompleted: member.profileId === 'me' })) }], error: null });
  setSettlementCompleted.mockResolvedValue({ code, message: 'private server detail' });
  const root = await render(SettlementsScreen);
  await press(root, '나야나 (나), 완료');
  expect(setSettlementCompleted).toHaveBeenCalledWith('mine', false);
  expect(notify).toHaveBeenCalledWith('변경 실패', '끝난 정산은 되돌릴 수 없어요. 새 정산을 요청해 주세요.');
  expect(JSON.stringify(notify.mock.calls)).not.toContain('private server detail');
});

it('keeps settlement cards and the same accessible member control during a successful toggle refetch', async () => {
  const root = await render(SettlementsScreen);
  const memberControl = target(root, '나야나 (나), 대기');
  let finishRefetch;
  fetchMySettlementsDetailed.mockReturnValueOnce(new Promise(resolve => { finishRefetch = resolve; }));
  await press(root, '나야나 (나), 대기');
  await press(root, '보냈어요');
  expect(setSettlementCompleted).toHaveBeenCalledWith('mine', true);
  expect(fetchMySettlementsDetailed).toHaveBeenCalledTimes(2);
  expect(text(root)).toContain('불러오는 중');
  expect(text(root)).not.toContain('이전에 불러온 정산이에요');
  const cards = root.findAll(node => typeof node.type === 'string' && node.props.accessibilityElementsHidden !== undefined)[0];
  expect(StyleSheet.flatten(cards.props.style).opacity).toBeUndefined();
  expect(cards.props.accessibilityElementsHidden).toBe(false);
  expect(cards.props.importantForAccessibility).toBe('auto');
  expect(cards.props.pointerEvents).toBe('auto');
  expect(target(root, '나야나 (나), 대기')).toBe(memberControl);
  expect(memberControl.props.disabled).toBe(true);
  expect(target(root, '토스로 보내기').props.disabled).toBe(true);
  await press(root, '나야나 (나), 대기');
  expect(setSettlementCompleted).toHaveBeenCalledTimes(1);
  await act(async () => finishRefetch({ data: [{ ...bill, members: bill.members.map(member => ({ ...member, isCompleted: true })) }], error: null }));
  expect(text(root)).not.toContain('이전에 불러온 정산이에요');
  expect(target(root, '나야나 (나), 완료')).toBe(memberControl);
});

it('preserves server-confirmed human time text and omits unread counts when none exist', async () => {
  const root = await render(RoomRow, { room: { ...room, confirmedSlot: '9월 27일 (일) 12:30' }, onPress: jest.fn() });
  expect(text(root)).toContain('9월 27일 (일) 12:30'); expect(text(root)).not.toContain('제출');
});

it('keeps the FAB while refreshing a nonempty room list', async () => {
  const root = await render(HomeScreen);
  useMyRooms.mockReturnValue({ rooms: [room], status: 'loading', reload });
  await act(async () => renderer.update(React.createElement(HomeScreen)));
  expect(target(root, '새 밥약 또는 초대 코드')).toBeDefined();
});
it('waits for iOS menu dismissal before presenting the invite sheet', async () => {
  const previous = Platform.OS; Platform.OS = 'ios';
  jest.spyOn(Animated, 'timing').mockImplementation(() => ({ start: cb => cb?.({ finished: true }), stop: jest.fn() }));
  try {
    const root = await render(HomeScreen); await press(root, '새 밥약 또는 초대 코드');
    expect(root.findAllByType(Modal)[0].props.visible).toBe(true);
    await press(root, '초대 코드 입력');
    expect(root.findAllByType(Modal)[0].props.visible).toBe(false); expect(root.findByType(JoinCodeSheet).props.visible).toBe(false);
    await act(async () => root.findAllByType(Modal)[0].props.onDismiss());
    expect(root.findByType(JoinCodeSheet).props.visible).toBe(true);
  } finally { Platform.OS = previous; }
});
it('announces compact copy success on iOS and exposes Android live-region feedback', async () => {
  const previous = Platform.OS; Platform.OS = 'ios';
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  jest.spyOn(Clipboard, 'setString').mockImplementation(() => {});
  try {
    const root = await render(CopyButton, { text: '초대 코드', compact: true }); await press(root, '복사');
    expect(announce).toHaveBeenCalledWith('복사됨'); expect(target(root, '복사됨').props.accessibilityLiveRegion).toBe('polite');
    expect(text(root)).not.toContain('복사됨');
  } finally { Platform.OS = previous; }
});
it('uses a generic default copy failure hint and allows account-specific wording', async () => {
  jest.spyOn(Clipboard, 'setString').mockImplementation(() => { throw Error('denied'); });
  const root = await render(CopyButton, { text: '초대 코드', compact: true }); await press(root, '복사');
  expect(target(root, '복사 실패').props.accessibilityHint).toBe('내용을 길게 눌러 직접 복사해 주세요');
  await act(async () => renderer.update(React.createElement(CopyButton, { text: '계좌', compact: true, failureHint: '계좌번호 안내' })));
  expect(target(root, '복사 실패').props.accessibilityHint).toBe('계좌번호 안내');
});
it('shows the actionable hint on my settlement row', async () => {
  const root = await render(SettleMember, { name: '나', seed: 'me', mine: true, layout: 'row', completed: false, onPress: jest.fn() });
  expect(text(root)).toContain('눌러서 완료');
});
it.each(['error', 'reject'])('blocks stale settlement cards after a refetch %s and re-enables only on successful retry', async mode => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  const root = await render(SettlementsScreen);
  if (mode === 'error') fetchMySettlementsDetailed.mockResolvedValueOnce({ data: null, error: Error('failed') });
  else fetchMySettlementsDetailed.mockRejectedValueOnce(Error('failed'));
  await press(root, '나야나 (나), 대기');
  await press(root, '보냈어요');
  expect(text(root)).toContain('이전에 불러온 정산이에요'); expect(text(root)).not.toContain('인터넷 연결');
  expect(target(root, '토스로 보내기').props.disabled).toBe(true);
  const stale = root.findAll(n => n.props.pointerEvents === 'none' && n.props.importantForAccessibility === 'no-hide-descendants')[0];
  expect(stale.props.accessibilityElementsHidden).toBe(true); expect(StyleSheet.flatten(stale.props.style).opacity).toBe(0.45);
  await press(root, '토스로 보내기'); expect(openURL).not.toHaveBeenCalled();
  await press(root, '나야나 (나), 대기'); expect(setSettlementCompleted).toHaveBeenCalledTimes(1);
  await press(root, '다시 시도'); expect(target(root, '토스로 보내기').props.disabled).toBe(false);
});
it('supports a non-network failure reason and icon', async () => {
  const root = await render(FailureCard, { title: '오류', reason: '정보를 확인하지 못했어요', icon: React.createElement(Text, null, '사용자 지정 아이콘'), onRetry: jest.fn() });
  expect(text(root)).toContain('정보를 확인하지 못했어요'); expect(text(root)).toContain('사용자 지정 아이콘'); expect(text(root)).not.toContain('인터넷 연결');
});
it('dismisses notifications with Android hardware back and removes its listener', async () => {
  const previous = Platform.OS; Platform.OS = 'android'; let handler;
  const remove = jest.fn(); jest.spyOn(BackHandler, 'addEventListener').mockImplementation((event, callback) => { expect(event).toBe('hardwareBackPress'); handler = callback; return { remove }; });
  const onClose = jest.fn();
  try {
    await render(NotificationPanel, { notices, allRead: true, onClose });
    expect(handler()).toBe(true); expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => renderer.unmount()); renderer = undefined; expect(remove).toHaveBeenCalledTimes(1);
  } finally { Platform.OS = previous; }
});
let notificationContext;
function NotificationProbe() { notificationContext = useRealNotifications(); return React.createElement(Text, null, notificationContext.hasUnread ? 'unread' : 'read'); }
function ProviderScene() { return React.createElement(NotificationsProvider, null, React.createElement(NotificationProbe)); }
it('routes real provider notifications and closes only actionable rows', async () => {
  const root = await render(ProviderScene);
  await act(async () => notificationContext.open());
  await press(root, noticeLabel(notices[0], true)); expect(navigation.navigate).toHaveBeenCalledWith('ChatRoom', { roomId: 'room' }); expect(root.findAllByType(NotificationPanel)).toHaveLength(0);
  await act(async () => notificationContext.open());
  await press(root, noticeLabel(notices[1], true)); expect(navigation.navigate).toHaveBeenLastCalledWith('Settlements'); expect(root.findAllByType(NotificationPanel)).toHaveLength(0);
  await act(async () => notificationContext.open());
  await act(async () => root.findByType(NotificationPanel).props.onPressNotice(notices[2]));
  expect(navigation.navigate).toHaveBeenCalledTimes(2); expect(root.findAllByType(NotificationPanel)).toHaveLength(1);
  await press(root, '알림 닫기'); expect(root.findAllByType(NotificationPanel)).toHaveLength(0);
});
it('opens a bill-linked notification after its room disappears without requiring account fields', async () => {
  const notice = { ...notices[1], roomId: null, settlementId: 'bill' };
  fetchMyNotifications.mockResolvedValue({ data: [notice], error: null });
  const root = await render(ProviderScene); await act(async () => notificationContext.open());
  await press(root, noticeLabel(notice, true));
  expect(navigation.navigate).toHaveBeenCalledWith('Settlements'); expect(root.findAllByType(NotificationPanel)).toHaveLength(0);
});
it.each(['success', 'error', 'reject'])('optimistically marks provider notifications read and handles %s', async mode => {
  let resolve, reject;
  markNotificationsRead.mockReturnValue(new Promise((yes, no) => { resolve = yes; reject = no; }));
  const root = await render(ProviderScene); expect(notificationContext.hasUnread).toBe(true);
  await act(async () => notificationContext.open()); await press(root, '모두 읽음');
  expect(markNotificationsRead).toHaveBeenCalledWith('me'); expect(notificationContext.hasUnread).toBe(false); expect(root.findByType(NotificationPanel).props.allRead).toBe(true);
  await act(async () => mode === 'reject' ? reject(Error('offline')) : resolve(mode === 'error' ? Error('failed') : null));
  expect(notificationContext.hasUnread).toBe(mode !== 'success'); expect(root.findByType(NotificationPanel).props.allRead).toBe(mode === 'success');
});
it('clears rooms on account switch before effects and ignores an old in-flight result', async () => {
  let result; const frames = []; let roomsContext;
  function RoomsProbe() { roomsContext = useRealRooms(); frames.push(roomsContext.rooms.map(r => r.id)); return React.createElement(Text, null, roomsContext.status); }
  const root = await render(RoomsProbe); expect(roomsContext.rooms).toEqual([room]);
  fetchMyRooms.mockReturnValueOnce(new Promise(resolve => { result = resolve; }));
  await act(async () => roomsContext.reload()); expect(roomsContext.rooms).toEqual([room]);
  let newResult; fetchMyRooms.mockReturnValueOnce(new Promise(resolve => { newResult = resolve; }));
  useAuth.mockReturnValue({ user: { id: 'other-user' } }); const offset = frames.length;
  await act(async () => renderer.update(React.createElement(RoomsProbe)));
  expect(frames.slice(offset).every(ids => ids.length === 0)).toBe(true); expect(text(root)).toContain('loading');
  await act(async () => result({ data: [room], error: null })); expect(roomsContext.rooms).toEqual([]);
  await act(async () => newResult({ data: [{ ...room, id: 'other-room' }], error: null })); expect(roomsContext.rooms[0].id).toBe('other-room');
  useAuth.mockReturnValue({ user: null }); await act(async () => renderer.update(React.createElement(RoomsProbe))); expect(roomsContext.rooms).toEqual([]);
});
it('clears the home settlement nudge before account-switch effects and ignores the old request', async () => {
  const first = [{ id: 'a-one', settled: false }, { id: 'a-two', settled: false }];
  const frames = [];
  useMySettlements.mockImplementation(() => {
    const entries = useRealSettlements();
    frames.push(entries.map(entry => entry.id));
    return entries;
  });
  fetchMySettlements.mockResolvedValueOnce({ data: first, error: null });
  const root = await render(HomeScreen);
  expect(text(root)).toContain('미완료 정산 2건');
  let finishOld, finishNew;
  fetchMySettlements.mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; }));
  useForegroundRefreshToken.mockReturnValue(1);
  await act(async () => renderer.update(React.createElement(HomeScreen)));
  expect(text(root)).toContain('미완료 정산 2건');
  fetchMySettlements.mockReturnValueOnce(new Promise(resolve => { finishNew = resolve; }));
  useAuth.mockReturnValue({ user: { id: 'account-b' } });
  const offset = frames.length;
  await act(async () => renderer.update(React.createElement(HomeScreen)));
  expect(frames.slice(offset).every(ids => ids.length === 0)).toBe(true);
  expect(text(root)).not.toContain('미완료 정산');
  expect(fetchMySettlements).toHaveBeenLastCalledWith('account-b');
  await act(async () => finishOld({ data: first, error: null }));
  expect(text(root)).not.toContain('미완료 정산');
  await act(async () => finishNew({ data: [{ id: 'b-only', settled: false }], error: null }));
  expect(text(root)).toContain('미완료 정산 1건');
  useAuth.mockReturnValue({ user: null });
  await act(async () => renderer.update(React.createElement(HomeScreen)));
  expect(text(root)).not.toContain('미완료 정산');
});
it.each(['confirmed', 'settling', 'done'])('never displays the generated meetingDate in a %s home row', async stage => {
  const root = await render(RoomRow, { room: { ...room, stage, meetingDate: '2099-12-31', confirmedSlot: null }, onPress: jest.fn() });
  expect(text(root)).not.toContain('12월 31일'); expect(text(root)).not.toContain('2099');
});

it('requires confirmation to complete my share and cancels without a mutation', async () => {
  const root = await render(SettlementsScreen); await press(root, '나야나 (나), 대기');
  expect(text(root)).toContain('모아에게 13,000원 보냈나요?'); expect(setSettlementCompleted).not.toHaveBeenCalled();
  await press(root, '아직이요'); expect(setSettlementCompleted).not.toHaveBeenCalled();
  await press(root, '나야나 (나), 대기'); await press(root, '보냈어요'); expect(setSettlementCompleted).toHaveBeenCalledWith('mine', true);
});
it('prevents duplicate completion requests and keeps confirmation open on failure without exposing raw errors', async () => {
  let finish; setSettlementCompleted.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const root = await render(SettlementsScreen); await press(root, '나야나 (나), 대기');
  await act(async () => { const button = target(root, '보냈어요'); button.props.onPress(); button.props.onPress(); });
  expect(setSettlementCompleted).toHaveBeenCalledTimes(1);
  await act(async () => finish(Error('private backend detail')));
  expect(text(root)).toContain('정산을 변경하지 못했어요'); expect(text(root)).not.toContain('private backend detail');
  await press(root, '보냈어요'); expect(setSettlementCompleted).toHaveBeenCalledTimes(2);
});
it.each([true, false])('shows only working settlement-more actions; requester=%s', async requester => {
  const copy = jest.spyOn(Clipboard, 'setString').mockImplementation(() => {});
  fetchMySettlementsDetailed.mockResolvedValue({ data: [{ ...bill, creatorId: requester ? 'me' : 'mate' }], error: null });
  const root = await render(SettlementsScreen); await press(root, '회사 팀 점심 정산 더보기');
  expect(target(root, '채팅방으로 가기')).toBeDefined();
  expect(Boolean(target(root, '금액이 이상해요 · 채팅방에 묻기'))).toBe(!requester);
  for (const label of ['정산 취소', '금액 · 참여 멤버 고치기', '재알림']) expect(target(root, label)).toBeUndefined();
  await press(root, '정산 내용 복사'); expect(copy).toHaveBeenCalledWith('회사 팀 점심\n총 52,000원 · 1인당 13,000원'); expect(copy.mock.calls[0][0]).not.toContain('3333');
  await press(root, '채팅방으로 가기'); expect(navigation.navigate).toHaveBeenCalledWith('ChatRoom', { roomId: 'room', title: '조선칼국수' });
});
it('preserves undo for an already-completed own share instead of asking the sent-money question', async () => {
  fetchMySettlementsDetailed.mockResolvedValue({ data: [{ ...bill, members: [{ ...bill.members[0], isCompleted: true }, { ...bill.members[1], isCompleted: false }] }], error: null });
  const root = await render(SettlementsScreen); await press(root, '나야나 (나), 완료'); expect(setSettlementCompleted).toHaveBeenCalledWith('mine', false);
  expect(target(root, '보냈어요')).toBeUndefined();
});

it('preserves clipboard success and iOS announcement when a copy observer throws', async () => {
  const previous = Platform.OS; Platform.OS = 'ios';
  const copy = jest.spyOn(Clipboard, 'setString').mockImplementation(() => {});
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  const onCopied = jest.fn(() => { throw Error('observer failure'); });
  try {
    const root = await render(CopyButton, { text: 'REAL42', onCopied }); await press(root, '복사');
    expect(copy).toHaveBeenCalledWith('REAL42'); expect(onCopied).toHaveBeenCalledTimes(1);
    expect(text(root)).toContain('복사됨'); expect(text(root)).not.toContain('복사 실패'); expect(announce).toHaveBeenCalledWith('복사됨');
  } finally { Platform.OS = previous; }
});

it('shows the shared finite deadline on S4 home rows and refreshes it after restart/completion', async () => {
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-20T00:00:00Z'));
  const props = { room: { ...room, stage: 'settling', decisionMode: 's4', appointmentConfirmedAt: '2026-10-19T00:00:00Z', expiresAt: '2026-10-27T00:00:00Z' }, onPress: jest.fn() };
  const root = await render(RoomRow, props);
  const timer = () => root.findAllByType(Text).find(n => n.props.testID === 'room-expiry-timer').props.children;
  expect(timer()).toBe('정산 중 · 7일 뒤 방이 사라져요');
  // A server refresh can shorten retention to the absolute 30-day cap.
  props.room = { ...props.room, expiresAt: '2026-10-20T12:00:00Z' };
  await act(async () => renderer.update(React.createElement(RoomRow, props)));
  expect(timer()).toBe('정산 중 · 12:00:00 후 방이 사라져요.');
  await act(async () => jest.advanceTimersByTime(1000));
  expect(timer()).toBe('정산 중 · 11:59:59 후 방이 사라져요.');
  props.room = { ...props.room, stage: 'done' };
  await act(async () => renderer.update(React.createElement(RoomRow, props)));
  expect(timer()).toBe('11:59:59 후 방이 사라져요.');
  jest.setSystemTime(new Date('2026-10-20T12:00:00Z'));
  await act(async () => jest.advanceTimersByTime(1000));
  expect(timer()).toBe('이미 종료된 밥약이에요');
});
it.each(['scheduling', 'place', 'confirmed'])('does not show a provisional home deadline before settlement: %s', async stage => {
  const root = await render(RoomRow, { room: { ...room, stage, decisionMode: 's4' }, onPress: jest.fn() });
  expect(root.findAllByType(Text).filter(n => n.props.testID === 'room-expiry-timer')).toHaveLength(0);
});
it('does not apply S4 finite settlement retention to a legacy home row', async () => {
  const root = await render(RoomRow, { room: { ...room, stage: 'settling', decisionMode: 'legacy' }, onPress: jest.fn() });
  expect(text(root)).not.toContain('후 방이 사라져요');
  expect(root.findAllByType(Text).filter(n => n.props.testID === 'room-expiry-timer')).toHaveLength(0);
});
