const React = require('react');
const { act, create } = require('react-test-renderer');
const { AccessibilityInfo, ActivityIndicator, Platform, StyleSheet, Text, TextInput } = require('react-native');

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 20, left: 0, right: 0 }),
}));

const { v3Colors: colors, colors: legacyColors, v3FeedbackColors } = require('../src/theme/tokens');
const { v3Layout, DESIGN_WIDTH, DESIGN_WIDTH_WIDE } = require('../src/theme/scale');
const { Button, PrimaryButton, CompleteButton, AddButton, DangerButton } = require('../src/components/ui/Button');
const TextField = require('../src/components/ui/TextField').default;
const { Chip } = require('../src/components/ui/Chip');
const { Radio } = require('../src/components/ui/Radio');
const { Checkbox } = require('../src/components/ui/Checkbox');
const { Switch } = require('../src/components/ui/Switch');
const { ListRow } = require('../src/components/ui/ListRow');
const { AppHeader } = require('../src/components/ui/AppHeader');
const BottomNav = require('../src/components/BottomNav').default;

const h = React.createElement;
const defaultPlatform = Platform.OS;
let renderer;
async function render(component, props) {
  await act(async () => { renderer = create(h(component, props)); });
  return renderer.root;
}
const pressables = (root) => root.findAll((node) => typeof node.props.style === 'function' && Boolean(node.props.accessibilityRole));
const pressStyle = (node, pressed = false) => StyleSheet.flatten(node.props.style({ pressed }));
beforeEach(() => jest.clearAllMocks());
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined;
  Platform.OS = defaultPlatform;
  jest.restoreAllMocks();
});

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

it('keeps the v3 palette separate and provides readable primary text without changing legacy scale', () => {
  expect(Object.keys(colors)).toHaveLength(12);
  expect(colors.surface).toBe('#FFFFFF');
  expect(legacyColors.surface).toBe('#F3F3F3');
  expect(legacyColors.border).toBe('#E6E6E6');
  expect(legacyColors.textOnAccent).toBe('#FFFFFF');
  expect((luminance(colors.primary) + 0.05) / (luminance(colors.onPrimary) + 0.05)).toBeGreaterThan(8);
  expect(DESIGN_WIDTH).toBe(220);
  expect(DESIGN_WIDTH_WIDE).toBe(412);
  expect(v3Layout.buttonHeight).toBe(52);
});

it.each([Button, PrimaryButton, CompleteButton, AddButton])('uses dark text for primary and compatible legacy exports (%p)', async (Component) => {
  const onPress = jest.fn();
  const root = await render(Component, { label: '계속', showNext: true, onPress });
  const button = pressables(root)[0];
  expect(button.props.accessibilityRole).toBe('button');
  expect(pressStyle(button).minHeight).toBe(52);
  expect(pressStyle(button).backgroundColor).toBe(colors.primary);
  expect(StyleSheet.flatten(root.findByType(Text).props.style).color).toBe(colors.onPrimary);
  expect(root.findByType(Text).props.children).toBe('계속 →');
  expect(button.props.accessibilityLabel).toBe('계속');
  await act(async () => button.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
});

it.each(['secondary', 'text'])('supports the %s button variant', async (variant) => {
  const root = await render(Button, { label: '취소', variant });
  const style = pressStyle(pressables(root)[0]);
  expect(style.backgroundColor).toBe(variant === 'text' ? 'transparent' : colors.surface);
  expect(style.minHeight).toBe(52);
});

it.each([{ disabled: true }, { loading: true }])('blocks button presses with native disabled semantics and preserves its label (%p)', async (state) => {
  const onPress = jest.fn();
  const root = await render(Button, { label: '저장', ...state, onPress, style: { opacity: 1 } });
  const button = pressables(root)[0];
  expect(button.props.disabled).toBe(true);
  expect(button.props.accessibilityState).toEqual({ disabled: true, busy: Boolean(state.loading) });
  expect(pressStyle(button, true).opacity).toBe(0.4);
  expect(root.findByType(Text).props.children).toBe('저장');
  expect(root.findAllByType(ActivityIndicator)).toHaveLength(state.loading ? 1 : 0);
  const host = root.find((node) => typeof node.type === 'string' && typeof node.props.onClick === 'function');
  await act(async () => host.props.onClick({ nativeEvent: {}, target: 1, currentTarget: 1 }));
  expect(onPress).not.toHaveBeenCalled();
});

it('delivers an enabled press through the same native press event path', async () => {
  const onPress = jest.fn();
  const root = await render(Button, { label: '저장', onPress });
  const host = root.find((node) => typeof node.type === 'string' && typeof node.props.onClick === 'function');
  await act(async () => host.props.onClick({ nativeEvent: {}, target: 1, currentTarget: 1 }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('keeps the legacy danger action outlined', async () => {
  const root = await render(DangerButton, { label: '나가기' });
  expect(pressStyle(pressables(root)[0]).borderColor).toBe(legacyColors.danger);
  expect(StyleSheet.flatten(root.findByType(Text).props.style).color).toBe(v3FeedbackColors.error);
  expect((luminance('#FFFFFF') + 0.05) / (luminance(v3FeedbackColors.error) + 0.05)).toBeGreaterThanOrEqual(4.5);
});

it('keeps the field label and transitions default → focus → error → focus → default', async () => {
  const onFocus = jest.fn();
  const onBlur = jest.fn();
  const props = { label: '닉네임', helper: '두 글자 이상', onFocus, onBlur };
  const root = await render(TextField, props);
  let input = root.findByType(TextInput);
  expect(input.props.accessibilityLabel).toBe('닉네임');
  expect(input.props.accessibilityHint).toBe('두 글자 이상');
  expect(StyleSheet.flatten(input.props.style)).toMatchObject({ minHeight: 52, fontSize: 16, borderColor: colors.border });
  await act(async () => input.props.onFocus({ nativeEvent: {} }));
  expect(onFocus).toHaveBeenCalledTimes(1);
  expect(StyleSheet.flatten(input.props.style).borderColor).toBe(colors.primary);
  await act(async () => renderer.update(h(TextField, { ...props, error: '이미 사용 중입니다' })));
  input = root.findByType(TextInput);
  expect(input.props['aria-invalid']).toBe(true);
  expect(input.props.accessibilityHint).toBe('오류: 이미 사용 중입니다');
  expect(StyleSheet.flatten(input.props.style).borderColor).toBe(v3FeedbackColors.error);
  const messages = root.findAllByType(Text);
  expect(messages.map((node) => node.props.children)).toEqual(['닉네임', '이미 사용 중입니다']);
  expect(messages[1].props.accessibilityLabel).toBe('오류: 이미 사용 중입니다');
  await act(async () => renderer.update(h(TextField, props)));
  expect(StyleSheet.flatten(input.props.style).borderColor).toBe(colors.primary);
  await act(async () => input.props.onBlur({ nativeEvent: {} }));
  expect(onBlur).toHaveBeenCalledTimes(1);
  expect(StyleSheet.flatten(input.props.style).borderColor).toBe(colors.border);
});

it('marks a read-only field disabled', async () => {
  const root = await render(TextField, { label: '이메일', editable: false, value: 'a@example.com' });
  expect(root.findByType(TextInput).props.accessibilityState.disabled).toBe(true);
});

it('announces each new iOS error once without an Android live region', async () => {
  Platform.OS = 'ios';
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  const root = await render(TextField, { label: '닉네임' });
  expect(announce).not.toHaveBeenCalled();
  await act(async () => renderer.update(h(TextField, { label: '닉네임', error: '사용 중입니다' })));
  expect(announce).toHaveBeenCalledWith('오류: 사용 중입니다');
  await act(async () => renderer.update(h(TextField, { label: '닉네임', error: '사용 중입니다' })));
  expect(announce).toHaveBeenCalledTimes(1);
  expect(root.findAllByType(Text)[1].props.accessibilityLiveRegion).toBe('none');
  await act(async () => renderer.update(h(TextField, { label: '닉네임', error: '다시 입력해 주세요' })));
  expect(announce).toHaveBeenCalledTimes(2);
});

it('uses the Android live region without an explicit announcement', async () => {
  Platform.OS = 'android';
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  const root = await render(TextField, { label: '닉네임', error: '사용 중입니다' });
  expect(root.findAllByType(Text)[1].props.accessibilityLiveRegion).toBe('polite');
  expect(announce).not.toHaveBeenCalled();
});

it.each([
  [Chip, { selected: false }, 'onChange', true, 'checkbox'],
  [Checkbox, { checked: true }, 'onChange', false, 'checkbox'],
  [Radio, { selected: false }, 'onSelect', undefined, 'radio'],
])('selects via the entire accessible touch target (%p)', async (Component, state, callback, next, role) => {
  const handler = jest.fn();
  const root = await render(Component, { label: '선택 항목', ...state, [callback]: handler });
  const target = pressables(root)[0];
  expect(target.props.accessibilityRole).toBe(role);
  expect(target.props.accessibilityLabel).toBe('선택 항목');
  expect(target.props.accessibilityState.checked).toBe(Boolean(state.selected ?? state.checked));
  expect(pressStyle(target).minHeight).toBeGreaterThanOrEqual(44);
  await act(async () => target.props.onPress());
  if (role === 'radio') expect(handler).toHaveBeenCalledWith();
  else expect(handler).toHaveBeenCalledWith(next);
});

it.each([Chip, Radio, Checkbox])('disables selection controls semantically (%p)', async (Component) => {
  const root = await render(Component, { label: '항목', disabled: true, checked: false, selected: false, onChange: jest.fn(), onSelect: jest.fn() });
  const target = pressables(root)[0];
  expect(target.props.disabled).toBe(true);
  expect(target.props.accessibilityState.disabled).toBe(true);
  expect(pressStyle(target).opacity).toBe(0.4);
});

it('keeps the switch target at 56 × 44 and announces its state', async () => {
  const onChange = jest.fn();
  const root = await render(Switch, { value: true, onChange, accessibilityLabel: '정보 공개' });
  const target = pressables(root)[0];
  expect(pressStyle(target)).toMatchObject({ width: 56, minHeight: 44 });
  expect(target.props.accessibilityState.checked).toBe(true);
  expect(target.props.accessibilityLabel).toBe('정보 공개');
  await act(async () => target.props.onPress());
  expect(onChange).toHaveBeenCalledWith(false);
});

it('exposes the list title and value as one action', async () => {
  const onPress = jest.fn();
  const root = await render(ListRow, { title: '이름', value: '밀챗', onPress });
  const target = pressables(root)[0];
  expect(target.props.accessibilityLabel).toBe('이름, 밀챗');
  expect(pressStyle(target).minHeight).toBe(56);
  await act(async () => target.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('labels unread notifications and keeps a 44-unit header button', async () => {
  const onPressBell = jest.fn();
  const root = await render(AppHeader, { hasUnread: true, onPressBell });
  const bell = pressables(root)[0];
  expect(bell.props.accessibilityLabel).toBe('알림, 읽지 않은 알림 있음');
  expect(pressStyle(bell)).toMatchObject({ width: 44, height: 44 });
  await act(async () => bell.props.onPress());
  expect(onPressBell).toHaveBeenCalledTimes(1);
});

it('exposes three selected tabs with 12-unit labels and reserves the bottom safe area', async () => {
  const onChange = jest.fn();
  const root = await render(BottomNav, { active: 'schedule', onChange });
  const tabs = pressables(root);
  expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual(['홈', '일정 조율', '프로필']);
  expect(tabs.map((tab) => tab.props.accessibilityState.selected)).toEqual([false, true, false]);
  expect(tabs.every((tab) => pressStyle(tab).minHeight === 52)).toBe(true);
  expect(root.findAllByType(Text).every((text) => StyleSheet.flatten(text.props.style).fontSize === 12)).toBe(true);
  expect(StyleSheet.flatten(renderer.toJSON().props.style)).toMatchObject({ paddingTop: 6, paddingHorizontal: 8, paddingBottom: 34 });
  await act(async () => tabs[2].props.onPress());
  expect(onChange).toHaveBeenCalledWith('profile');
});

