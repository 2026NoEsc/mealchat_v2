const React = require('react');
const { act, create } = require('react-test-renderer');
const { TextInput } = require('react-native');
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }), SafeAreaProvider: ({ children }) => children }));
jest.mock('../src/theme/keyboard', () => ({ useKeyboardOverlap: () => ({ overlap: 0, remeasure: jest.fn() }) }));
jest.mock('../src/components/NotificationsProvider', () => ({ useNotifications: () => ({ hasUnread: false, open: jest.fn() }) }));
jest.mock('../src/lib/confirm', () => ({ notify: jest.fn() }));
jest.mock('../src/screens/chat/ChatHomeScreen', () => () => null);
jest.mock('../src/screens/chat/ChatRoomScreen', () => () => null);
jest.mock('../src/screens/chat/RoomDetailScreen', () => () => null);
jest.mock('../src/screens/HomeScreen', () => () => null);
jest.mock('../src/screens/LoginScreen', () => () => null);
jest.mock('../src/screens/profile/FriendsScreen', () => () => null);
jest.mock('../src/screens/profile/OriginScreen', () => () => null);
jest.mock('../src/screens/profile/PrivacyScreen', () => () => null);
jest.mock('../src/screens/profile/ProfileEditScreen', () => () => null);
jest.mock('../src/screens/profile/PasswordChangeScreen', () => () => null);
jest.mock('../src/screens/profile/ProfileHomeScreen', () => () => null);
jest.mock('../src/screens/schedule/ScheduleConfirmedScreen', () => () => null);
jest.mock('../src/screens/settlement/SettlementsScreen', () => () => null);
jest.mock('../src/screens/settlement/SettlementDetailScreen', () => () => null);
jest.mock('../src/screens/schedule/ScheduleDetailScreen', () => () => null);
jest.mock('../src/screens/schedule/ScheduleHomeScreen', () => () => null);
jest.mock('../src/screens/schedule/ScheduleTimeScreen', () => () => null);
jest.mock('../src/screens/signup/SignupCalendarScreen', () => () => null);
jest.mock('../src/screens/signup/SignupPersonalScreen', () => () => null);
jest.mock('../src/screens/signup/SignupStartScreen', () => () => null);
jest.mock('../src/screens/signup/SignupTasteScreen', () => () => null);
jest.mock('../src/screens/signup/SignupTermsScreen', () => () => null);
jest.mock('../src/screens/food/FoodProfileScreen', () => () => null);
jest.mock('../src/screens/food/FoodProfilePrompt', () => () => null);
jest.mock('../src/screens/settings/SettingsScreen', () => () => null);
jest.mock('../src/screens/settings/ServiceTermsScreen', () => () => null);
jest.mock('../src/screens/settings/PrivacyPolicyScreen', () => () => null);
jest.mock('../src/screens/settings/AppInfoScreen', () => () => null);
jest.mock('../src/screens/settings/OptionalConsentsScreen', () => () => null);
jest.mock('../src/screens/settings/PrivacyRevisionScreen', () => () => null);
const AppNavigator = require('../src/navigation/AppNavigator').default;
const { NavigationProvider, useNavigation } = require('../src/navigation/NavigationContext');
let phoneNavigation;
function PhoneNavigationObserver() { phoneNavigation = useNavigation(); return null; }
let renderer;
const text = () => JSON.stringify(renderer.toJSON());
async function mount(route) { await act(async () => { renderer = create(React.createElement(NavigationProvider, { initialRoute: route }, React.createElement(React.Fragment, null, React.createElement(PhoneNavigationObserver), React.createElement(AppNavigator)))); }); }
async function press(label) {
  const nodes = renderer.root.findAll(n => ['button', 'radio', 'checkbox', 'switch'].includes(n.props.accessibilityRole) && n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');
  expect(nodes.length).toBeGreaterThan(0); await act(async () => { nodes[0].props.onPress(); });
}
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); });
it('uses application navigation from history through both explicit local receipts and back', async () => {
  await mount('MealHistory'); await press('로컬 예시 기록 보기');
  await press('로컬 예시 · 팀 점심 영수증 보기'); expect(text()).toContain('실제 내역이 아니에요');
  await press('이미지로 저장'); expect(text()).toContain('저장 준비됨');
  await press('영수증 닫기'); expect(text()).toContain('밥약 기록');
  await press('로컬 예시 기록 보기'); await press('로컬 예시 · 저녁팟 영수증 보기'); expect(text()).toContain('저녁팟');
});
it('completes three local deletion steps without a password input or deletion claim', async () => {
  await mount('AccountDeletion');
  const box = renderer.root.findAll(n => n.props.accessibilityRole === 'checkbox' && typeof n.props.onPress === 'function')[0];
  await act(async () => box.props.onPress()); await press('계정 삭제');
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
  await press('삭제 요청 준비'); expect(text()).toContain('계정은 삭제되지 않았어요');
});
it('navigates all menu states as a recoverable local workflow', async () => {
  await mount('LocalMenu'); await press('메뉴 후보 보기'); expect(text()).toContain('고르는 중');
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 700)); });
  expect(text()).toContain('불러오지 못했어요'); await press('로컬 예시 후보로 계속하기');
  await press('삼겹살 별로예요'); await press('평가 완료'); expect(text()).toContain('의견이 조금 갈리고');
  await press('새 후보로 다시 평가하기'); expect(text()).toContain('모두 괜찮다고 한 새 후보 4개');
  expect(text()).not.toContain('삼겹살 별로예요');
  await press('샤브샤브 먹고 싶어요'); await press('평가 완료');
  await press('샤브샤브로 정하기'); await press('샤브샤브로 확정'); expect(text()).toContain('서버 연결 대기');
  await press('메뉴 변경'); await press('다시 정하기'); expect(text()).toContain('어떤 음식이 당기세요');
});

it('keeps receipt permission and recognition failures recoverable with a validated local draft', async () => {
  const Capture = require('../src/screens/settlement/ReceiptCaptureFlow').default;
  const onDraft = jest.fn(), onClose = jest.fn();
  await act(async () => { renderer = create(React.createElement(Capture, { onDraft, onClose })); });
  await press('촬영'); expect(text()).toContain('권한이 꺼져');
  await press('앨범에서 선택'); expect(text()).toContain('읽지 못했어요');
  await press('직접 입력');
  const inputs = renderer.root.findAllByType(TextInput);
  await act(async () => { inputs[0].props.onChangeText('로컬 가게'); inputs[1].props.onChangeText('12000'); });
  await press('로컬 초안으로 넣기'); expect(onDraft).toHaveBeenCalledWith({ merchant: '로컬 가게', amount: 12000 }); expect(onClose).toHaveBeenCalled();
});
it.each(['report', 'block'])('shows pending failure for %s without a connected handler', async kind => {
  const Safety = require('../src/screens/chat/MessageSafetySheet').default;
  await act(async () => { renderer = create(React.createElement(Safety, { kind, targetId: 'local-mate', name: '예시 메이트', onClose: jest.fn() })); });
  await press(kind === 'report' ? '신고 요청' : '차단 요청'); expect(text()).toContain('처리되지 않았어요');
});

it('opens the distinct shabu receipt with four mates and source line items', async () => {
  await mount('MealHistory'); await press('로컬 예시 기록 보기');
  await press('로컬 예시 · 저녁팟 · 샤브샤브 영수증 보기');
  expect(text()).toContain('채선당 서면점'); expect(text()).toContain('샤브샤브 세트'); expect(text()).toContain('칼국수 사리');
  expect(text()).toContain('52,000'); expect(text()).toContain('13,000');
});
it('validates the dedicated three-field account draft without claiming a saved account', async () => {
  const Form = require('../src/screens/settlement/SettlementAccountForm').default;
  await act(async () => { renderer = create(React.createElement(Form, { onClose: jest.fn(), onOpenProfile: jest.fn() })); });
  await press('계좌 입력 준비'); expect(text()).toContain('은행을 선택해 주세요'); expect(text()).toContain('예금주를 입력해 주세요');
  await press('은행 선택'); await press('국민은행');
  const fields = renderer.root.findAllByType(TextInput);
  await act(async () => { fields[0].props.onChangeText('0000000000'); fields[1].props.onChangeText('예시 예금주'); });
  await press('계좌 입력 준비'); expect(text()).toContain('아직 저장되지 않았어요'); expect(text()).not.toContain('계좌를 등록했어요');
});

const phoneMenus = [
  ['498:1191', 'craving'], ['683:12744', 'loading'], ['683:12855', 'error'], ['497:1127', 'evaluate'],
  ['497:1287', 'result'], ['497:1369', 'split'], ['498:1312', 'confirm'], ['498:1404', 'change'],
  ['591:2159', 'new-evaluate'], ['591:2319', 'new-result'], ['591:2401', 'new-confirm'], ['631:4253', 'new-change'],
];
it.each(phoneMenus)('[phone %s] actual navigator menu condition %s', async (id, state) => {
  await mount('LocalMenu');
  await act(async () => phoneNavigation.replace('LocalMenu', { roomId: 'phone-room' }));
  if (state === 'craving') { await press('아무거나'); expect(text()).toContain('오늘은 어떤 음식'); return; }
  await press('메뉴 후보 보기');
  if (state === 'loading') { expect(text()).toContain('메뉴 후보를 고르는 중'); return; }
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 650)); });
  if (state === 'error') { expect(text()).toContain('후보를 불러오지 못했어요'); await press('다시 시도'); expect(text()).toContain('고르는 중'); return; }
  await press('로컬 예시 후보로 계속하기');
  if (state === 'evaluate') { await press('라멘 먹고 싶어요'); expect(text()).toContain('라멘 먹고 싶어요'); await press('평가 완료'); expect(text()).toContain('가장 의견이 잘 맞는 메뉴'); return; }
  if (state === 'split' || state.startsWith('new-')) { await press('삼겹살 별로예요'); await press('평가 완료'); }
  if (state === 'split') { expect(text()).toContain('의견이 조금 갈리고'); return; }
  if (state.startsWith('new-')) { await press('새 후보로 다시 평가하기'); expect(text()).toContain('새 후보 4개'); expect(text()).not.toContain('삼겹살 먹고 싶어요'); }
  if (state === 'new-evaluate') { await press('파스타 먹고 싶어요'); expect(text()).toContain('파스타 먹고 싶어요'); return; }
  if (!state.startsWith('new-')) await press('평가 완료'); else await press('평가 완료');
  const menu = state.startsWith('new-') ? '샤브샤브' : '삼겹살';
  if (state.endsWith('change')) { await press('메뉴 변경'); expect(text()).toContain(`${menu}예요`); await press('취소'); return; }
  if (state.endsWith('confirm')) { await press(`${menu}로 정하기`); expect(text()).toContain(`${menu}로 정할까요`); return; }
  expect(text()).toContain('가장 의견이 잘 맞는 메뉴'); await press('식당 찾기');
  expect(phoneNavigation.current).toEqual({ name: 'ChatRoom', params: { roomId: 'phone-room', openSheet: 'menu', localMenuName: menu } });
});

it.each([
  ['542:1534', 'list'], ['542:1633', 'local-lunch'], ['589:2147', 'local-dinner'], ['631:6196', 'local-shabu'],
  ['601:3701', 'save-lunch'], ['601:3797', 'save-dinner'],
])('[phone %s] history data and action %s', async (id, condition) => {
  await mount('MealHistory'); await press('로컬 예시 기록 보기');
  if (condition === 'list') { expect(text()).toContain('밥약 3번'); return; }
  const recordId = condition.startsWith('save-') ? 'local-' + condition.slice(5) : condition;
  const record = require('../src/screens/history/localMealExamples').localMealExamples.find(item => item.id === recordId);
  await press(record.title + ' 영수증 보기'); expect(text()).toContain(record.place);
  for (const item of record.items) expect(text()).toContain(item.name);
  expect(record.items.reduce((sum, item) => sum + item.amount, 0)).toBe(record.amount);
  if (condition.startsWith('save-')) { await press('이미지로 저장'); expect(text()).toContain('저장 준비됨'); expect(text()).not.toContain('이미지를 저장했어요'); }
  await press('영수증 닫기'); expect(phoneNavigation.current.name).toBe('MealHistory');
});

it.each([
  ['589:1867', 'camera'], ['631:5369', 'camera-shabu'], ['683:13311', 'denied'], ['683:13350', 'failure'],
  ['589:1890', 'result'], ['562:1736', 'result-chat'], ['631:5390', 'result-shabu'], ['631:5095', 'result-chat-shabu'],
])('[phone %s] device boundary condition %s', async (id, state) => {
  const Capture = require('../src/screens/settlement/ReceiptCaptureFlow').default;
  const shabu = state.includes('shabu'), onDraft = jest.fn(), recognize = jest.fn(async () => ({ merchant: shabu ? '채선당 서면점' : '돼지집 서면점', amount: 52000 }));
  await act(async () => { renderer = create(React.createElement(Capture, { onClose: jest.fn(), onDraft, recognize, requestPermission: async () => state !== 'denied' })); });
  if (state.startsWith('camera')) { await press('플래시 켜기'); expect(text()).toContain('플래시 끄기'); expect(recognize).not.toHaveBeenCalled(); return; }
  if (state === 'failure') { await press('앨범에서 선택'); expect(text()).toContain('영수증을 읽지 못했어요'); await press('다시 찍기'); expect(text()).toContain('촬영'); return; }
  await press('촬영');
  if (state === 'denied') { expect(text()).toContain('카메라 권한이 꺼져'); expect(recognize).not.toHaveBeenCalled(); return; }
  expect(renderer.root.findAllByType(TextInput)[0].props.value).toBe(shabu ? '채선당 서면점' : '돼지집 서면점');
  await press('로컬 초안으로 넣기'); expect(onDraft).toHaveBeenCalledWith({ merchant: shabu ? '채선당 서면점' : '돼지집 서면점', amount: 52000 });
});

it.each([['564:1985', 0], ['601:3371', 0], ['601:3416', 1], ['601:3473', 2]])('[phone %s] deletion local step %s', async (id, step) => {
  await mount('AccountDeletion'); expect(text()).toContain('서버 연결 대기');
  if (step > 0) { await press('안내를 확인했어요'); await press('계정 삭제'); }
  if (step === 1) { expect(text()).toContain('본인 확인'); expect(renderer.root.findAllByType(TextInput)).toHaveLength(0); await press('돌아가기'); }
  if (step === 2) { await press('삭제 요청 준비'); expect(text()).toContain('계정은 삭제되지 않았어요'); await press('설정으로 돌아가기'); }
});
it('[phone 564:1875] master notification toggle disables dependent local settings', async () => {
  await mount('NotificationPreferences'); await press('알림 받기');
  const switches = renderer.root.findAll(node => node.props.accessibilityRole === 'switch');
  expect(switches.some(node => node.props.accessibilityState?.disabled)).toBe(true); expect(text()).toContain('서버 연결 대기');
});
it.each([['562:2142', 'report', false], ['628:2477', 'block', false], ['628:2600', 'block', true], ['628:2726', 'report', true]])('[phone %s] safety kind=%s requested=%s remains truthful', async (id, kind, requested) => {
  const Sheet = require('../src/screens/chat/MessageSafetySheet').default;
  await act(async () => { renderer = create(React.createElement(Sheet, { kind, targetId: 'phone-mate', name: '모아', onClose: jest.fn() })); });
  expect(text()).toContain(kind === 'report' ? '신고하기' : '모아님을 차단할까요');
  if (requested) { await press(kind === 'report' ? '신고 요청' : '차단 요청'); expect(text()).toContain('처리되지 않았어요'); }
  else expect(text()).toContain('취소');
});
it.each([['601:3208', false], ['601:3243', true]])('[phone %s] inquiry draft submitted=%s cannot claim remote success', async (id, submitted) => {
  await mount('Contact'); const input = renderer.root.findAllByType(TextInput)[0];
  await act(async () => input.props.onChangeText('로컬 문의 초안'));
  if (submitted) { await press('보내기 · 준비 중'); expect(require('../src/lib/confirm').notify).toHaveBeenCalledWith('문의 전송 준비 중', expect.stringContaining('전송되지 않았어요')); }
  expect(input.props.value).toBe('로컬 문의 초안'); expect(text()).not.toContain('문의를 보냈어요');
});
it('[phone 543:1609] invite landing reads only the code and offers explicit pending installation', async () => {
  await mount('InviteLanding'); await act(async () => phoneNavigation.replace('InviteLanding', { code: 'PHONE6' }));
  expect(text()).toContain('PHONE6'); await press('앱 설치 안내'); expect(text()).toContain('스토어 연결 대기');
});
it.each([['599:3969', false], ['683:18201', true]])('[phone %s] origin local text/permission denied=%s', async (id, denied) => {
  const Control = require('../src/screens/schedule/LocalLocationControl').default;
  await act(async () => { renderer = create(React.createElement(Control)); });
  if (denied) { await press('현재 위치로'); expect(text()).toContain('위치 권한이 꺼져 있어요'); }
  const input = renderer.root.findByType(TextInput); await act(async () => input.props.onChangeText('서면역'));
  expect(input.props.value).toBe('서면역'); expect(text()).toContain('실제 밥약 생성에는 반영되지 않아요');
});
