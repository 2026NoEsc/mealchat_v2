const React = require('react');
const { act, create } = require('react-test-renderer');
const { StyleSheet, Text, TextInput } = require('react-native');

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../src/theme/insets', () => ({ useTopInset: jest.fn(() => 32) }));
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
jest.mock('../src/components/NotificationsProvider', () => ({
  useNotifications: () => ({ hasUnread: false, open: jest.fn() }),
}));
jest.mock('../src/navigation/NavigationContext', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));
jest.mock('../src/auth/SignupDraftProvider', () => ({
  useSignupDraft: () => ({ draft: { nickname: '', email: 'fixture@example.test', password: '', passwordConfirm: '', bank: '카카오페이', account: '', birth: { year: '', month: '', day: '' } }, updateDraft: jest.fn() }),
}));
jest.mock('../src/theme/keyboard', () => ({ useKeyboardOverlap: () => ({ overlap: 0, remeasure: jest.fn() }) }));
jest.mock('../src/lib/email', () => ({ checkEmailAvailable: jest.fn() }));
jest.mock('../src/lib/friends', () => ({
  fetchMyFriends: jest.fn(), searchProfilesByTag: jest.fn(), addFriend: jest.fn(), removeFriend: jest.fn(),
}));
jest.mock('../src/lib/confirm', () => ({ notify: jest.fn() }));

const NotificationPanel = require('../src/components/NotificationPanel').default;
const FriendsScreen = require('../src/screens/profile/FriendsScreen').default;
const SignupPersonalScreen = require('../src/screens/signup/SignupPersonalScreen').default;
const { fetchMyFriends, searchProfilesByTag, addFriend } = require('../src/lib/friends');
const { useTopInset } = require('../src/theme/insets');
const { checkEmailAvailable } = require('../src/lib/email');
let renderer;

async function render(Component, props) {
  await act(async () => { renderer = create(React.createElement(Component, props)); });
  return renderer.root;
}
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined;
  jest.clearAllMocks();
});

it('anchors the panel at 92 using the corrected 32-unit top inset instead of the raw 24-unit safe area', async () => {
  const root = await render(NotificationPanel, { notices: [], allRead: true, onClose: jest.fn() });
  const panel = root.findAll((node) => node.props.testID === 'notification-panel')[0];
  expect(useTopInset).toHaveBeenCalled();
  expect(StyleSheet.flatten(panel.props.style).marginTop).toBe(92);
});

it('matches the signup email action, account, bank and birth inputs to the 52/16 form dimensions', async () => {
  const root = await render(SignupPersonalScreen);
  const inputs = root.findAllByType(TextInput);
  const email = inputs.find((node) => node.props.accessibilityLabel === '이메일');
  expect(StyleSheet.flatten(email.props.style).minHeight).toBe(52);
  const check = root.findAll((node) => typeof node.props.style === 'function' && node.props.accessibilityRole === 'button' && node.findAllByType(Text).some((text) => text.props.children === '중복 확인'))[0];
  expect(StyleSheet.flatten(check.props.style({ pressed: false })).height).toBe(52);
  for (const label of ['계좌번호', '생년월일 년', '생년월일 월', '생년월일 일']) {
    expect(StyleSheet.flatten(inputs.find((node) => node.props.accessibilityLabel === label).props.style)).toMatchObject({ height: 52, fontSize: 16 });
  }
  const bank = root.findAll((node) => node.props.accessibilityLabel === '은행 선택, 카카오페이')[0];
  expect(StyleSheet.flatten(bank.props.style).height).toBe(52);
});

function actionWithText(root, label) {
  return root.findAll((node) => typeof node.props.onPress === 'function' && node.findAllByType(Text).some((text) => text.props.children === label))[0];
}

function contrastRatio(first, second) {
  const luminance = (color) => {
    const channels = [1, 3, 5].map((index) => {
      const value = parseInt(color.slice(index, index + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(first), luminance(second)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

it('keeps the email-check label and successful result above 4.5:1 against their rendered backgrounds', async () => {
  checkEmailAvailable.mockResolvedValue({ status: 'available' });
  const root = await render(SignupPersonalScreen);
  const check = actionWithText(root, '중복 확인');
  const buttonBackground = StyleSheet.flatten(check.props.style({ pressed: false })).backgroundColor;
  const labelColor = StyleSheet.flatten(check.findAllByType(Text).find((text) => text.props.children === '중복 확인').props.style).color;
  expect(labelColor).toBe('#1C1A17');
  expect(contrastRatio(labelColor, buttonBackground)).toBeGreaterThanOrEqual(4.5);

  await act(async () => check.props.onPress());
  expect(checkEmailAvailable).toHaveBeenCalledWith('fixture@example.test');
  const success = root.findAllByType(Text).find((text) => text.props.children === '사용할 수 있는 이메일이에요.');
  const successColor = StyleSheet.flatten(success.props.style).color;
  const screenBackground = StyleSheet.flatten(renderer.toJSON().props.style).backgroundColor;
  expect(successColor).toBe('#1E6B34');
  expect(contrastRatio(successColor, screenBackground)).toBeGreaterThanOrEqual(4.5);
});

it('exposes a searched mate as an add button and sends one add action after a native click', async () => {
  fetchMyFriends.mockResolvedValue({ data: [], error: null });
  searchProfilesByTag.mockResolvedValue({ data: [{ id: 'candidate', name: '밀챗', tag: 'fixture', avatar_color: '#FFFFFF' }], error: null });
  addFriend.mockResolvedValue(null);
  const root = await render(FriendsScreen);
  await act(async () => actionWithText(root, '＋ 메이트 초대').props.onPress());
  await act(async () => root.findByType(TextInput).props.onChangeText('fixture'));
  await act(async () => actionWithText(root, '찾기').props.onPress());
  const target = root.findAll((node) => node.props.accessibilityLabel === '밀챗 메이트 추가')[0];
  expect(target.props.accessibilityRole).toBe('button');
  expect(target.props.accessibilityState.checked).toBeUndefined();
  const host = root.find((node) => typeof node.type === 'string' && node.props.accessibilityLabel === '밀챗 메이트 추가' && typeof node.props.onClick === 'function');
  await act(async () => host.props.onClick({ nativeEvent: {}, currentTarget: 1, target: 1 }));
  expect(addFriend).toHaveBeenCalledTimes(1);
  expect(addFriend).toHaveBeenCalledWith('me', 'candidate');
});
