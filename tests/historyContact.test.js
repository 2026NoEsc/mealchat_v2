const React = require('react');
const { act, create } = require('react-test-renderer');
const { TextInput } = require('react-native');
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }), SafeAreaProvider: ({ children }) => children }));
jest.mock('../src/theme/keyboard', () => ({ useKeyboardOverlap: () => ({ overlap: 0, remeasure: jest.fn() }) }));
jest.mock('../src/navigation/NavigationContext', () => ({ useNavigation: jest.fn() }));
jest.mock('../src/lib/confirm', () => ({ notify: jest.fn() }));
jest.mock('../src/components/NotificationsProvider', () => ({ useNotifications: () => ({ hasUnread: false, open: jest.fn() }) }));
const { useNavigation } = require('../src/navigation/NavigationContext');
const { notify } = require('../src/lib/confirm');
const MealHistory = require('../src/screens/history/MealHistoryScreen').default;
const MealReceipt = require('../src/screens/history/MealReceiptScreen').default;
const Contact = require('../src/screens/settings/ContactScreen').default;
const Preferences = require('../src/screens/settings/NotificationPreferencesScreen').default;
const { records } = require('../scripts/ui-preview/history.fixtures');
const Button = require('../src/components/ui/Button').default;
const Switch = require('../src/components/ui/Switch').default;
let renderer;
let navigation;
beforeEach(() => { jest.clearAllMocks(); navigation = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: true, resetTo: jest.fn() }; useNavigation.mockReturnValue(navigation); });
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); });
async function render(Component, props) { await act(async () => { renderer = create(React.createElement(Component, props)); }); return renderer.root; }
const text = () => JSON.stringify(renderer.toJSON());
it('keeps production history empty and disables unavailable receipt actions', async () => {
  await render(MealHistory);
  expect(text()).toContain('기록과 영수증 보관 기능을 준비');
  expect(text()).not.toContain('회사 팀 점심');
  await act(async () => renderer.unmount()); renderer = undefined;
  const root = await render(MealReceipt);
  expect(root.findAllByType(Button).every(button => button.props.disabled)).toBe(true);
});
it('filters preview records by mate, place and month and opens a receipt', async () => {
  const onOpen = jest.fn();
  const root = await render(MealHistory, { records, onOpen });
  await act(async () => root.findByType(TextInput).props.onChangeText('모닝글로우'));
  expect(text()).toContain('주말 브런치 모임');
  expect(text()).not.toContain('회사 팀 점심');
  const row = root.findAll(node => node.props.accessibilityLabel === '주말 브런치 모임 영수증 보기' && typeof node.props.onPress === 'function')[0];
  await act(async () => row.props.onPress());
  expect(onOpen).toHaveBeenCalledWith(records[2]);
  await act(async () => root.findAll(node => node.props.accessibilityRole === 'button' && node.props.children?.props?.children === '2026년 9월' && typeof node.props.onPress === 'function')[0].props.onPress());
  expect(text()).toContain('검색 결과가 없어요');
});
it('does not claim submission after entering an inquiry', async () => {
  const root = await render(Contact);
  expect(root.findByType(Button).props.disabled).toBe(true);
  await act(async () => root.findByType(TextInput).props.onChangeText('문의 예시'));
  await act(async () => root.findByType(Button).props.onPress());
  expect(notify).toHaveBeenCalledWith('문의 전송 준비 중', expect.stringContaining('전송되지 않았어요'));
  expect(text()).not.toContain('접수했어요');
});
it('allows local notification preferences without claiming server persistence', async () => {
  const root = await render(Preferences);
  expect(root.findAllByType(Switch).some(item => !item.props.disabled && item.props.value)).toBe(true);
  await act(async () => root.findAllByType(Switch)[0].props.onChange(false));
  expect(root.findAllByType(Switch)[1].props.disabled).toBe(true);
  expect(text()).toContain('서버 연결 대기');
});
