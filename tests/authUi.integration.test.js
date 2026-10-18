const React = require('react');
const { act, create } = require('react-test-renderer');
const { TextInput, StyleSheet } = require('react-native');

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const Context = React.createContext({ top: 24, bottom: 0, left: 0, right: 0 });
  return {
    SafeAreaProvider: ({ children }) => React.createElement(Context.Provider, { value: { top: 32, bottom: 48, left: 0, right: 0 } }, children),
    useSafeAreaInsets: () => React.useContext(Context),
  };
});
jest.mock('../src/theme/keyboard', () => ({ useKeyboardOverlap: jest.fn() }));
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../src/navigation/NavigationContext', () => ({ useNavigation: jest.fn() }));
jest.mock('../src/lib/consents', () => ({
  invalidateConsentServerMode: jest.fn(),
  fetchConsentManifest: jest.fn(async () => ({ data: require('./fixtures/s1').s1Manifest, error: null })),
  recordRequiredConsents: jest.fn(async () => ({ data: require('./fixtures/s1').s1Status(true), error: null })),
  completeSignupConsents: jest.fn(async () => ({ data: require('./fixtures/s1').s1Status(true), error: null })),
  setOptionalConsent: jest.fn(),
}));
jest.mock('../src/lib/email', () => ({ checkEmailAvailable: jest.fn() }));
jest.mock('../src/screens/settings/notificationPermission', () => ({ queueNotificationGuide: jest.fn(async () => undefined) }));
jest.mock('../src/lib/profile', () => ({ saveMyPrivateProfile: jest.fn(async () => null) }));
jest.mock('../src/lib/confirm', () => ({ notify: jest.fn() }));

const { useAuth } = require('../src/auth/AuthProvider');
const { useNavigation } = require('../src/navigation/NavigationContext');
const { recordRequiredConsents: recordTermsConsent, completeSignupConsents } = require('../src/lib/consents');
const { checkEmailAvailable } = require('../src/lib/email');
const { SignupDraftProvider, useSignupDraft } = require('../src/auth/SignupDraftProvider');
const { useKeyboardOverlap } = require('../src/theme/keyboard');
const { saveMyPrivateProfile: saveSignupPrivateProfile } = require('../src/lib/profile');
const { notify } = require('../src/lib/confirm');
const { PrimaryButton, SecondaryButton, TextButton } = require('../src/components/ui/Button');
const { Checkbox } = require('../src/components/ui/Checkbox');
const PasswordField = require('../src/components/ui/PasswordField').default;
const BankSelect = require('../src/components/ui/BankSelect').default;
const PasswordResetSheet = require('../src/screens/auth/PasswordResetSheet').default;
const LoginScreen = require('../src/screens/LoginScreen').default;
const NewPasswordScreen = require('../src/screens/auth/NewPasswordScreen').default;
const ReConsentScreen = require('../src/screens/auth/ReConsentScreen').default;
const SignupStartScreen = require('../src/screens/signup/SignupStartScreen').default;
const SignupPersonalScreen = require('../src/screens/signup/SignupPersonalScreen').default;
const SignupTermsScreen = require('../src/screens/signup/SignupTermsScreen').default;
let renderer;
let auth;
let navigation;

beforeEach(() => {
  jest.clearAllMocks();
  useKeyboardOverlap.mockReturnValue({ overlap: 0, remeasure: jest.fn() });
  auth = {
    user: { id: 'fixture', email: 'fixture@example.test' },
    sendPasswordReset: jest.fn(async () => null), signInWithEmail: jest.fn(async () => null),
    completePasswordReset: jest.fn(async () => null), cancelPasswordReset: jest.fn(async () => null),
    signOut: jest.fn(async () => null),
    signUpWithEmail: jest.fn(async () => ({ error: null, confirmationRequired: false, userId: 'fixture' })),
  };
  navigation = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), canGoBack: true };
  useAuth.mockImplementation(() => auth);
  useNavigation.mockImplementation(() => navigation);
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined;
});
async function render(Component, props, wrapper) {
  const child = React.createElement(Component, props);
  await act(async () => { renderer = create(wrapper ? React.createElement(wrapper, null, child) : child); });
  return renderer.root;
}
function action(root, label) {
  return root.findAll((node) => typeof node.props.style === 'function' && typeof node.props.onPress === 'function' && node.props.accessibilityLabel === label)[0];
}
function input(root, label) { return root.findAllByType(TextInput).find((node) => node.props.accessibilityLabel === label); }

it('toggles password visibility without changing the password and exposes the toggle state', async () => {
  const root = await render(PasswordField, { label: '비밀번호', value: 'fixture-password' });
  expect(input(root, '비밀번호').props.secureTextEntry).toBe(true);
  const show = action(root, '비밀번호 보기');
  expect(StyleSheet.flatten(show.props.style({ pressed: false }))).toMatchObject({ width: 44, height: 44 });
  await act(async () => show.props.onPress());
  expect(input(root, '비밀번호').props.secureTextEntry).toBe(false);
  expect(input(root, '비밀번호').props.value).toBe('fixture-password');
  expect(action(root, '비밀번호 숨기기').props.accessibilityState.selected).toBe(true);
  await act(async () => action(root, '비밀번호 숨기기').props.onPress());
  expect(input(root, '비밀번호').props.secureTextEntry).toBe(true);
});

it('routes the two start actions separately and opens signup directly from login', async () => {
  const root = await render(SignupStartScreen);
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  await act(async () => root.findByType(SecondaryButton).props.onPress());
  expect(navigation.navigate.mock.calls).toEqual([['SignupPersonal'], ['Login']]);
  await act(async () => renderer.unmount());
  const login = await render(LoginScreen);
  const signup = login.findAll((node) => node.props.accessibilityRole === 'button' && typeof node.props.style === 'function'
    && node.findAll((child) => child.props.children === '회원가입').length > 0)[0];
  await act(async () => signup.props.onPress());
  expect(navigation.navigate).toHaveBeenLastCalledWith('SignupPersonal');
  await act(async () => action(login, '뒤로').props.onPress());
  expect(navigation.goBack).toHaveBeenCalledTimes(1);
});

it('validates reset email inline before calling the API', async () => {
  const root = await render(PasswordResetSheet, { initialEmail: 'invalid', onClose: jest.fn() });
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  expect(auth.sendPasswordReset).not.toHaveBeenCalled();
  expect(input(root, '이메일').props['aria-invalid']).toBe(true);
  expect(JSON.stringify(renderer.toJSON())).toContain('이메일 주소 형식을 확인해 주세요.');
});

it.each([null, new Error('User not found'), new Error('Email not registered')])('uses identical reset confirmation regardless of account existence (%s)', async (response) => {
  auth.sendPasswordReset.mockResolvedValue(response);
  const root = await render(PasswordResetSheet, { initialEmail: ' Fixture@Example.test ', onClose: jest.fn() });
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  expect(auth.sendPasswordReset).toHaveBeenCalledWith('fixture@example.test');
  const output = JSON.stringify(renderer.toJSON());
  expect(output).toContain('메일을 보냈어요. 링크는 1시간 동안 열 수 있어요.');
  expect(output).not.toContain('not found');
  expect(output).not.toContain('not registered');
});

it('shows generic network errors and prevents concurrent reset sends', async () => {
  let finish;
  auth.sendPasswordReset.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const root = await render(PasswordResetSheet, { initialEmail: 'fixture@example.test', onClose: jest.fn() });
  await act(async () => {
    root.findByType(PrimaryButton).props.onPress();
    root.findByType(PrimaryButton).props.onPress();
  });
  expect(auth.sendPasswordReset).toHaveBeenCalledTimes(1);
  expect(root.findByType(PrimaryButton).props.loading).toBe(true);
  await act(async () => finish(Object.assign(new Error('Failed to fetch'), { name: 'AuthRetryableFetchError', status: 0 })));
  expect(root.findByType(PrimaryButton).props.loading).toBe(false);
  expect(JSON.stringify(renderer.toJSON())).toContain('네트워크 연결을 확인한 뒤 다시 시도해 주세요.');
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Failed to fetch');
});

it('requires eight matching password characters and uses the existing completion and cancel APIs', async () => {
  const root = await render(NewPasswordScreen);
  expect(StyleSheet.flatten(input(root, '새 비밀번호').props.style).borderColor).toBe('#E8E3DC');
  await act(async () => input(root, '새 비밀번호').props.onFocus({ nativeEvent: {} }));
  expect(StyleSheet.flatten(input(root, '새 비밀번호').props.style).borderColor).toBe('#FF9900');
  await act(async () => input(root, '새 비밀번호').props.onBlur({ nativeEvent: {} }));
  expect(StyleSheet.flatten(input(root, '새 비밀번호').props.style).borderColor).toBe('#E8E3DC');
  expect(JSON.stringify(renderer.toJSON())).toContain('fixture@example.test 계정의 비밀번호를 바꿔요.');
  await act(async () => input(root, '새 비밀번호').props.onChangeText('1234567'));
  await act(async () => input(root, '새 비밀번호 재확인').props.onChangeText('1234567'));
  expect(root.findByType(PrimaryButton).props.disabled).toBe(true);
  await act(async () => input(root, '새 비밀번호').props.onChangeText('12345678'));
  expect(input(root, '새 비밀번호 재확인').props['aria-invalid']).toBe(true);
  await act(async () => input(root, '새 비밀번호 재확인').props.onChangeText('12345678'));
  expect(root.findByType(PrimaryButton).props.disabled).toBe(false);
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  expect(auth.completePasswordReset).toHaveBeenCalledWith('12345678');
  await act(async () => root.findByType(TextButton).props.onPress());
  expect(auth.cancelPasswordReset).toHaveBeenCalledTimes(1);
});

it('records reconsent only after both required choices and calls onDone only after success', async () => {
  recordTermsConsent.mockResolvedValue({ data: null, error: new Error('fixture failure') });
  const onDone = jest.fn();
  const root = await render(ReConsentScreen, { onDone });
  expect(root.findByType(PrimaryButton).props.disabled).toBe(true);
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  expect(recordTermsConsent).not.toHaveBeenCalled();
  for (const index of [1, 2]) await act(async () => root.findAllByType(Checkbox)[index].props.onChange(true));
  expect(root.findByType(PrimaryButton).props.disabled).toBe(false);
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  expect(recordTermsConsent).toHaveBeenCalledWith(expect.objectContaining({ p_choices: { service: true, privacy: true } }));
  expect(onDone).not.toHaveBeenCalled();
  recordTermsConsent.mockResolvedValue({ data: require('./fixtures/s1').s1Status(true), error: null });
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  expect(onDone).toHaveBeenCalledTimes(1);
  await act(async () => action(root, '나중에 하기 (로그아웃)').props.onPress());
  expect(auth.signOut).toHaveBeenCalledTimes(1);
});

it('searches banks and securities and closes the sheet after selecting', async () => {
  const onChange = jest.fn();
  const root = await render(BankSelect, { value: null, logicalHeight: 52, onChange });
  await act(async () => action(root, '은행 선택').props.onPress());
  await act(async () => input(root, '은행·증권사 검색').props.onChangeText('미래에셋'));
  expect(action(root, '미래에셋증권')).toBeDefined();
  expect(action(root, '국민은행')).toBeUndefined();
  await act(async () => action(root, '미래에셋증권').props.onPress());
  expect(onChange).toHaveBeenCalledWith('미래에셋증권');
  expect(input(root, '은행·증권사 검색')).toBeUndefined();
});

it('invalidates an email availability result after editing and lets optional fields stay empty', async () => {
  checkEmailAvailable.mockResolvedValue({ status: 'available' });
  const root = await render(SignupPersonalScreen, undefined, SignupDraftProvider);
  await act(async () => input(root, '닉네임').props.onChangeText('밀챗'));
  await act(async () => input(root, '이메일').props.onChangeText('fixture@example.test'));
  await act(async () => root.findByType(SecondaryButton).props.onPress());
  await act(async () => input(root, '비밀번호').props.onChangeText('12345678'));
  await act(async () => input(root, '비밀번호 재확인').props.onChangeText('12345678'));
  await act(async () => input(root, '이메일').props.onChangeText('new@example.test'));
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(input(root, '이메일').props['aria-invalid']).toBe(true);
  await act(async () => root.findByType(SecondaryButton).props.onPress());
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  expect(navigation.navigate).toHaveBeenCalledWith('SignupCalendar');
});

it.each([
  [0, 72],
  [300, 24],
])('uses the Modal provider insets and avoids counting the bottom bar twice with keyboard=%s', async (keyboard, padding) => {
  useKeyboardOverlap.mockReturnValue({ overlap: keyboard, remeasure: jest.fn() });
  const root = await render(PasswordResetSheet, { initialEmail: '', onClose: jest.fn() });
  const surface = root.findAll((node) => node.props.testID === 'auth-sheet-surface')[0];
  const frame = root.findAll((node) => node.props.testID === 'auth-sheet-root')[0];
  // Outer activity context is top=24,bottom=0; Modal provider is top=32,bottom=48.
  expect(StyleSheet.flatten(surface.props.style).paddingBottom).toBe(padding);
  expect(StyleSheet.flatten(frame.props.style)).toMatchObject({ paddingTop: 32, paddingBottom: keyboard });
  const scrim = root.findAll((node) => node.props.testID === 'auth-sheet-scrim')[0];
  expect(scrim.props).toMatchObject({ accessible: false, importantForAccessibility: 'no', 'aria-hidden': true });
  expect(scrim.props.accessibilityRole).toBeUndefined();
  expect(action(root, '닫기')).toBeDefined();
  expect(action(root, '시트 닫기')).toBeUndefined();
});

it('uses the Modal bottom inset for the bank search sheet as well', async () => {
  const root = await render(BankSelect, { value: null, onChange: jest.fn(), logicalHeight: 52 });
  await act(async () => action(root, '은행 선택').props.onPress());
  const surface = root.findAll((node) => node.props.testID === 'auth-sheet-surface')[0];
  expect(StyleSheet.flatten(surface.props.style).paddingBottom).toBe(72);
});

it.each([
  [{ name: 'AuthRetryableFetchError', status: 0 }, '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'],
  [{ name: 'TypeError' }, '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'],
  [{ name: 'AuthApiError', status: 429, code: 'over_request_rate_limit' }, '요청이 많아요. 잠시 후 다시 시도해 주세요.'],
  [{ name: 'AuthApiError', status: 500 }, null],
  [{ name: 'AuthRetryableFetchError', status: 503 }, null],
  [{ name: 'AuthApiError', status: 429, code: 'over_email_send_rate_limit' }, null],
  [{ name: 'AuthApiError', status: 400, code: 'user_not_found' }, null],
  [{ name: 'AuthApiError', status: 422, code: 'email_exists' }, null],
  [{ name: 'AuthApiError', status: 422, code: 'user_already_exists' }, null],
])('classifies password-reset response metadata %s without exposing provider text', async (metadata, expectedError) => {
  auth.sendPasswordReset.mockResolvedValue(Object.assign(new Error('provider-private-fixture'), metadata));
  const root = await render(PasswordResetSheet, { initialEmail: 'fixture@example.test', onClose: jest.fn() });
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  const output = JSON.stringify(renderer.toJSON());
  expect(output).not.toContain('provider-private-fixture');
  if (expectedError) {
    expect(output).toContain(expectedError);
    expect(output).not.toContain('메일을 보냈어요.');
  } else {
    expect(output).toContain('메일을 보냈어요. 링크는 1시간 동안 열 수 있어요.');
    expect(output).toContain('메일이 오지 않으면 잠시 뒤 다시 보내 주세요.');
  }
});

it('classifies a thrown fetch error by name too', async () => {
  auth.sendPasswordReset.mockRejectedValue(new TypeError('provider-private-fixture'));
  const root = await render(PasswordResetSheet, { initialEmail: 'fixture@example.test', onClose: jest.fn() });
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  expect(JSON.stringify(renderer.toJSON())).toContain('네트워크 연결을 확인한 뒤 다시 시도해 주세요.');
});

it.each(['이메일', '비밀번호'])('shows a safe login error and clears it after editing %s', async (field) => {
  auth.signInWithEmail.mockResolvedValue(new Error('provider-private-fixture'));
  const root = await render(LoginScreen);
  await act(async () => input(root, '이메일').props.onChangeText('fixture@example.test'));
  await act(async () => input(root, '비밀번호').props.onChangeText('12345678'));
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  expect(auth.signInWithEmail).toHaveBeenCalledWith('fixture@example.test', '12345678');
  expect(JSON.stringify(renderer.toJSON())).toContain('잠시 후 다시 시도해 주세요.');
  expect(JSON.stringify(renderer.toJSON())).not.toContain('provider-private-fixture');
  expect(input(root, '비밀번호').props['aria-invalid']).toBe(true);
  await act(async () => input(root, field).props.onChangeText('edited-value'));
  expect(input(root, '비밀번호').props['aria-invalid']).toBe(false);
  expect(JSON.stringify(renderer.toJSON())).not.toContain('잠시 후 다시 시도해 주세요.');
});

it.each([false, true])('reports cancellation failure and re-enables password controls, thrown=%s', async (thrown) => {
  const failure = new Error('provider-private-fixture');
  if (thrown) auth.cancelPasswordReset.mockRejectedValue(failure);
  else auth.cancelPasswordReset.mockResolvedValue(failure);
  const onCancelRequested = jest.fn();
  const onCancelFailed = jest.fn();
  const root = await render(NewPasswordScreen, { onCancelRequested, onCancelFailed });
  await act(async () => root.findByType(TextButton).props.onPress());
  expect(onCancelRequested).toHaveBeenCalledTimes(1);
  expect(onCancelFailed).toHaveBeenCalledTimes(1);
  expect(root.findByType(TextButton).props.disabled).toBe(false);
  expect(JSON.stringify(renderer.toJSON())).not.toContain('provider-private-fixture');
});

it('delivers completion feedback to the persistent host after the password screen has unmounted', async () => {
  let finish;
  auth.completePasswordReset.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const onPasswordChanged = jest.fn();
  const root = await render(NewPasswordScreen, { onPasswordChanged });
  await act(async () => input(root, '새 비밀번호').props.onChangeText('12345678'));
  await act(async () => input(root, '새 비밀번호 재확인').props.onChangeText('12345678'));
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  await act(async () => renderer.unmount());
  renderer = undefined;
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await act(async () => finish(null));
    expect(onPasswordChanged).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  } finally { error.mockRestore(); }
});

it('shows a safe mapped password error without showing the provider message', async () => {
  auth.completePasswordReset.mockResolvedValue(new Error('New password should be different from the old password.'));
  const root = await render(NewPasswordScreen);
  await act(async () => input(root, '새 비밀번호').props.onChangeText('12345678'));
  await act(async () => input(root, '새 비밀번호 재확인').props.onChangeText('12345678'));
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  expect(JSON.stringify(renderer.toJSON())).toContain('이전 비밀번호와 다른 비밀번호를 입력해 주세요.');
  expect(JSON.stringify(renderer.toJSON())).not.toContain('New password should');
});

it.each([false, true])('keeps reconsent on screen after signOut fails, thrown=%s', async (thrown) => {
  if (thrown) auth.signOut.mockRejectedValue(new Error('provider-private-fixture'));
  else auth.signOut.mockResolvedValue(new Error('provider-private-fixture'));
  const onDone = jest.fn();
  const root = await render(ReConsentScreen, { onDone });
  await act(async () => action(root, '나중에 하기 (로그아웃)').props.onPress());
  expect(onDone).not.toHaveBeenCalled();
  expect(action(root, '나중에 하기 (로그아웃)').props.disabled).toBe(false);
  expect(JSON.stringify(renderer.toJSON())).toContain('로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.');
  expect(JSON.stringify(renderer.toJSON())).not.toContain('provider-private-fixture');
});

function SignupSeed({ children }) {
  const { updateDraft } = useSignupDraft();
  React.useEffect(() => {
    updateDraft({ nickname: '밀챗', email: 'fixture@example.test', password: '12345678' });
  }, [updateDraft]);
  return children;
}
function SeededSignupProvider({ children }) {
  return React.createElement(SignupDraftProvider, null, React.createElement(SignupSeed, null, children));
}

it.each([false, true])('blocks signup until both required terms are chosen and preserves its API arguments, marketing=%s', async (marketing) => {
  const root = await render(SignupTermsScreen, undefined, SeededSignupProvider);
  expect(root.findByType(PrimaryButton).props.disabled).toBe(true);
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  expect(auth.signUpWithEmail).not.toHaveBeenCalled();
  await act(async () => root.findAllByType(Checkbox)[1].props.onChange(true));
  expect(root.findByType(PrimaryButton).props.disabled).toBe(true);
  await act(async () => root.findAllByType(Checkbox)[2].props.onChange(true));
  if (marketing) await act(async () => root.findAllByType(Checkbox)[4].props.onChange(true));
  expect(root.findByType(PrimaryButton).props.disabled).toBe(false);
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  expect(auth.signUpWithEmail).toHaveBeenCalledWith({
    email: 'fixture@example.test', password: '12345678', displayName: '밀챗',
  });
  expect(completeSignupConsents).toHaveBeenCalledWith(expect.objectContaining({ p_choices: { service: true, privacy: true, health: false, marketing } }));
  expect(saveSignupPrivateProfile).toHaveBeenCalledWith('fixture', expect.objectContaining({ bank: null, account: '', birth: { year: '', month: '', day: '' }, tastes: {} }));
});

it('lays out the password toggle in the input box and the email action below its label without label-height offsets', async () => {
  const root = await render(LoginScreen);
  const toggle = action(root, '비밀번호 보기');
  expect(StyleSheet.flatten(toggle.props.style({ pressed: false })).top).toBeUndefined();
  expect(StyleSheet.flatten(toggle.parent.props.style)).toMatchObject({ top: 0, bottom: 0, justifyContent: 'center' });
  await act(async () => renderer.unmount());
  const personal = await render(SignupPersonalScreen, undefined, SignupDraftProvider);
  const check = personal.findByType(SecondaryButton);
  expect(StyleSheet.flatten(check.props.style).marginTop).toBeUndefined();
  const row = check.parent;
  expect(StyleSheet.flatten(row.props.style)).toMatchObject({ flexDirection: 'row', alignItems: 'center' });
  expect(row.findAllByType(TextInput).some((node) => node.props.accessibilityLabel === '이메일')).toBe(true);
});

it.each([
  ['weak_password', '비밀번호가 보안 기준에 맞지 않아요. 더 길고 추측하기 어려운 비밀번호로 바꿔 주세요.'],
  ['signup_disabled', '현재 회원가입을 받고 있지 않아요. 나중에 다시 시도해 주세요.'],
  ['email_address_invalid', '이메일 형식을 확인해 주세요.'],
  ['user_already_exists', '이미 가입된 이메일이에요. 로그인하거나 다른 이메일 주소를 입력해 주세요.'],
  ['email_exists', '이미 가입된 이메일이에요. 로그인하거나 다른 이메일 주소를 입력해 주세요.'],
  ['over_email_send_rate_limit', '인증 메일 전송 한도에 도달했어요. 메일함을 확인하고 잠시 뒤 다시 시도해 주세요.'],
  ['future_error', '잠시 후 다시 시도해 주세요.'],
])('preserves signup inputs and explains rejection code %s without exposing provider text', async (code, expected) => {
  auth.signUpWithEmail.mockResolvedValue({
    error: Object.assign(new Error('provider-private-fixture'), { name: 'AuthApiError', status: 422, code }),
    confirmationRequired: false, userId: null,
  });
  const root = await render(SignupTermsScreen, undefined, SeededSignupProvider);
  for (const index of [1, 2]) await act(async () => root.findAllByType(Checkbox)[index].props.onChange(true));
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  expect(notify).toHaveBeenCalledWith('회원가입 실패', expected);
  expect(saveSignupPrivateProfile).not.toHaveBeenCalled();
  expect(root.findByType(PrimaryButton).props.disabled).toBe(false);
  expect(root.findByType(PrimaryButton).props.loading).toBe(false);
  expect(root.findAllByType(Checkbox)[1].props.checked).toBe(true);
  expect(JSON.stringify(notify.mock.calls)).not.toContain('provider-private-fixture');
  auth.signUpWithEmail.mockResolvedValue({ error: null, confirmationRequired: false, userId: 'fixture' });
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  expect(auth.signUpWithEmail).toHaveBeenLastCalledWith({ email: 'fixture@example.test', password: '12345678', displayName: '밀챗' });
});

it('maps a thrown signup AuthApiError by its code as well', async () => {
  auth.signUpWithEmail.mockRejectedValue(Object.assign(new Error('provider-private-fixture'), { code: 'email_address_invalid' }));
  const root = await render(SignupTermsScreen, undefined, SeededSignupProvider);
  for (const index of [1, 2]) await act(async () => root.findAllByType(Checkbox)[index].props.onChange(true));
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  expect(notify).toHaveBeenCalledWith('회원가입 실패', '이메일 형식을 확인해 주세요.');
});
