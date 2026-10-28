const React = require('react');
const { act, create } = require('react-test-renderer');
const { Text, ScrollView, StyleSheet, Platform, BackHandler } = require('react-native');
jest.mock('../src/config/features', () => ({ NOTIFICATION_PERMISSION_PROMPT: true }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: ({ children }) => children, useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-notifications', () => ({ getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn(), setNotificationChannelAsync: jest.fn(async () => null), AndroidImportance: { DEFAULT: 3 } }));
jest.mock('../src/theme/keyboard', () => ({ useKeyboardOverlap: () => ({ overlap: 0, remeasure: jest.fn() }) }));
jest.mock('../src/theme/insets', () => ({ useTopInset: () => 24 }));
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../src/navigation/NavigationContext', () => ({ useNavigation: jest.fn() }));
jest.mock('../src/profile/useMyProfile', () => ({ useMyProfile: jest.fn() }));
jest.mock('../src/components/NotificationsProvider', () => ({ useNotifications: () => ({ hasUnread: false, open: jest.fn() }) }));
jest.mock('../src/lib/confirm', () => ({ notify: jest.fn() }));
jest.mock('../src/lib/friends', () => ({ fetchMyFriends: jest.fn(async () => ({ data: [], error: null })) }));
jest.mock('../src/lib/profile', () => ({ saveMyPrivateProfile: jest.fn(async () => null) }));
jest.mock('../src/lib/consents', () => ({
  getConsentServerMode: jest.fn(() => 's1'),
  getConsentServerModeSnapshot: jest.fn(() => 's1'),
  subscribeConsentServerMode: jest.fn(() => () => {}),
  invalidateConsentServerMode: jest.fn(),
  fetchConsentManifest: jest.fn(async () => ({ data: require('./fixtures/s1').s1Manifest, error: null })),
  recordRequiredConsents: jest.fn(async () => ({ data: require('./fixtures/s1').s1Status(true), error: null })),
  completeSignupConsents: jest.fn(async () => ({ data: require('./fixtures/s1').s1Status(true), error: null })),
  setOptionalConsent: jest.fn(),
}));

const AsyncStorage = require('@react-native-async-storage/async-storage');
const Notifications = require('expo-notifications');
const features = require('../src/config/features');
const { useAuth } = require('../src/auth/AuthProvider');
const { useNavigation } = require('../src/navigation/NavigationContext');
const { useMyProfile } = require('../src/profile/useMyProfile');
const { Checkbox } = require('../src/components/ui/Checkbox');
const { PrimaryButton, TextButton } = require('../src/components/ui/Button');
const { ListRow } = require('../src/components/ui/ListRow');
const { SignupDraftProvider, useSignupDraft } = require('../src/auth/SignupDraftProvider');
const { terms } = require('../src/legal/terms');
const { privacy } = require('../src/legal/privacy');
const licenses = require('../src/legal/licenses.generated.json');
const { appVersion } = require('../src/screens/settings/appVersion');
const SettingsScreen = require('../src/screens/settings/SettingsScreen').default;
const ServiceTermsScreen = require('../src/screens/settings/ServiceTermsScreen').default;
const PrivacyPolicyScreen = require('../src/screens/settings/PrivacyPolicyScreen').default;
const AppInfoScreen = require('../src/screens/settings/AppInfoScreen').default;
const ProfileHomeScreen = require('../src/screens/profile/ProfileHomeScreen').default;
const SignupTermsScreen = require('../src/screens/signup/SignupTermsScreen').default;
const ReConsentScreen = require('../src/screens/auth/ReConsentScreen').default;
const LegalDocumentBody = require('../src/screens/settings/LegalDocumentBody').default;
const LegalDocumentSheet = require('../src/screens/settings/LegalDocumentSheet').default;
const NotificationPermissionGate = require('../src/screens/settings/NotificationPermissionGate').default;
const NotificationPermissionScreen = require('../src/screens/settings/NotificationPermissionScreen').default;
const { queueNotificationGuide, readNotificationGuide, requestNotificationPermission } = require('../src/screens/settings/notificationPermission');
const { ROUTE_TO_TAB } = require('../src/navigation/routes');
let renderer;
let auth;
let navigation;

beforeEach(async () => {
  jest.clearAllMocks();
  features.NOTIFICATION_PERMISSION_PROMPT = true;
  await AsyncStorage.clear();
  auth = { user: { id: 'fixture-user' }, signOut: jest.fn(async () => null), signUpWithEmail: jest.fn(async () => ({ error: null, confirmationRequired: false, userId: 'fixture-user' })) };
  navigation = { navigate: jest.fn(), goBack: jest.fn(), resetTo: jest.fn(), canGoBack: true, current: { name: 'Settings', params: {} } };
  useAuth.mockImplementation(() => auth);
  useNavigation.mockImplementation(() => navigation);
  useMyProfile.mockReturnValue({ status: 'ready', userId: 'fixture-user', reload: jest.fn(), bundle: { profile: { id: 'fixture-user', name: '밀챗', tag: 'fixture' }, privateProfile: { personalData: {} } } });
  Notifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true, granted: false });
  Notifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true, granted: true });
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = undefined; jest.restoreAllMocks(); });
async function render(Component, props, options) {
  await act(async () => { renderer = create(React.createElement(Component, props), options); });
  return renderer.root;
}
function action(root, label) { return root.findAll((node) => node.props.accessibilityRole === 'button' && typeof node.props.style === 'function' && node.props.accessibilityLabel === label)[0]; }
const output = () => JSON.stringify(renderer.toJSON());

it('[phone 564:1791] routes the settings information rows to local screens and keeps their profile tab mappings', async () => {
  const root = await render(SettingsScreen);
  const rows = root.findAllByType(ListRow);
  expect(rows.map((row) => row.props.title)).toEqual(['알림 설정', '서비스 이용약관', '개인정보 처리방침', '오픈소스 라이선스', '앱 버전', '선택 동의', '로그아웃', '계정 삭제', '문의하기']);
  for (const row of rows.slice(1, 5)) await act(async () => row.props.onPress());
  expect(navigation.navigate.mock.calls).toEqual([['ServiceTerms'], ['PrivacyPolicy'], ['AppInfo'], ['AppInfo']]);
  for (const route of ['Settings', 'ServiceTerms', 'PrivacyPolicy', 'AppInfo']) expect(ROUTE_TO_TAB[route]).toBe('profile');
  expect(rows[4].props.value).toBe(require('../app.json').expo.version);
  expect(output()).not.toContain('최신');
  expect(output()).toContain('계정 삭제');
  expect(output()).toContain('문의하기');
});

it('adds one settings menu row to the profile home', async () => {
  const root = await render(ProfileHomeScreen);
  const row = root.findAllByType(ListRow).find((item) => item.props.title === '설정');
  expect(row.props.value).toBe('약관 · 계정');
  await act(async () => row.props.onPress());
  expect(navigation.navigate).toHaveBeenCalledWith('Settings');
});

it.each([[SettingsScreen, false], [SettingsScreen, true], [ProfileHomeScreen, false], [ProfileHomeScreen, true]])('locks duplicate signOut requests and shows the same safe failure toast, screen=%p thrown=%s', async (Screen, thrown) => {
  let finish, fail;
  auth.signOut.mockReturnValueOnce(new Promise((resolve, reject) => { finish = resolve; fail = reject; }));
  const root = await render(Screen);
  await act(async () => { action(root, '로그아웃').props.onPress(); action(root, '로그아웃').props.onPress(); });
  expect(auth.signOut).toHaveBeenCalledTimes(1);
  expect(action(root, '로그아웃').props.disabled).toBe(true);
  await act(async () => thrown ? fail(new Error('provider-private-fixture')) : finish(new Error('provider-private-fixture')));
  expect(output()).toContain('로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.');
  expect(output()).not.toContain('provider-private-fixture');
  expect(action(root, '로그아웃').props.disabled).toBe(false);
  auth.signOut.mockResolvedValueOnce(null);
  await act(async () => action(root, '로그아웃').props.onPress());
  expect(auth.signOut).toHaveBeenCalledTimes(2);
});

it.each([[ServiceTermsScreen, terms, 15], [PrivacyPolicyScreen, privacy, 11]])('renders the supplied legal document with all sections and metadata', async (Screen, document, count) => {
  const root = await render(Screen);
  const sections = root.findAll((node) => typeof node.type === 'string' && node.props.testID?.startsWith('legal-section-'));
  expect(document.sections).toHaveLength(count);
  expect(sections).toHaveLength(count);
  const text = root.findAllByType(Text).flatMap((node) => typeof node.props.children === 'string' ? [node.props.children] : []);
  for (const section of document.sections) {
    expect(text).toContain(section.title);
    for (const paragraph of section.paragraphs) expect(text).toContain(paragraph);
  }
  expect(output()).toContain(document.effectiveDate);
  expect(output()).not.toContain('이전 판 보기');
});

it('positions the marketing link at the privacy retention section', async () => {
  const scrollTo = jest.fn();
  const root = await render(LegalDocumentBody, { document: privacy, initialSection: 'retention' });
  root.findByType(ScrollView).props.ref.current = { scrollTo };
  const section = root.findAll((node) => node.props.testID === 'legal-section-retention')[0];
  await act(async () => section.props.onLayout({ nativeEvent: { layout: { y: 410 } } }));
  expect(scrollTo).toHaveBeenCalledWith({ y: 410, animated: false });
});

it('[phone 564:1961][phone 567:1909] shows current server canonical text on settings pages when the bundled hash differs', async () => {
  const { canonicalLegalDocument } = require('../src/legal/canonical');
  const manifest = JSON.parse(JSON.stringify(require('./fixtures/s1').s1Manifest));
  manifest.documents.service = { ...manifest.documents.service, content_hash: 'a'.repeat(64), canonical_content: canonicalLegalDocument({ ...terms, title: '서버의 현재 약관' }) };
  require('../src/lib/consents').fetchConsentManifest.mockResolvedValueOnce({ data: manifest, error: null });
  await render(ServiceTermsScreen);
  expect(output()).toContain('서버의 현재 약관');
});
it('opens preserved v1 from a newer server privacy document without replacing its original text', async () => {
  const { canonicalLegalDocument } = require('../src/legal/canonical');
  const manifest = JSON.parse(JSON.stringify(require('./fixtures/s1').s1Manifest));
  manifest.documents.privacy = { ...manifest.documents.privacy, edition: 2, version: 'privacy-test-v2', content_hash: 'b'.repeat(64), canonical_content: canonicalLegalDocument({ ...privacy, edition: 2, title: '서버의 개정 방침' }) };
  require('../src/lib/consents').fetchConsentManifest.mockResolvedValueOnce({ data: manifest, error: null });
  const root = await render(PrivacyPolicyScreen); expect(output()).toContain('서버의 개정 방침');
  await act(async () => action(root, '이전 판 보기 · 1판').props.onPress());
  expect(root.findByType(LegalDocumentBody).props.document).toBe(privacy);
  await act(async () => action(root, '현재 판 보기').props.onPress());
  expect(root.findByType(LegalDocumentBody).props.document.edition).toBe(2);
});

it('[phone 601:3156] renders the actual configured app version and generated licenses without an update badge', async () => {
  const root = await render(AppInfoScreen);
  expect(root.findAll((node) => typeof node.type === 'string' && node.props.testID === 'license-row')).toHaveLength(licenses.length);
  expect(output()).toContain('공용 만남 지역의 기준 좌표는 서울교통공사, 부산교통공사, 국가철도공단의 공공데이터를 활용했습니다. 공공누리 제1유형(출처표시). 데이터 수집일: 2026-10-19. 표시명과 검색 반경은 MealChat에서 편집했습니다.');
  expect(output()).toContain(appVersion);
  expect(output()).not.toContain('최신');
  expect(licenses.find((entry) => entry.name === '42dot Sans').license).toBe('SIL OFL 1.1');
});

it.each([SignupTermsScreen, ReConsentScreen])('opens all legal views without changing consent selections', async (Screen) => {
  const Wrapped = () => React.createElement(SignupDraftProvider, null, React.createElement(Screen, { onDone: jest.fn() }));
  const root = await render(Wrapped);
  const checks = root.findAllByType(Checkbox);
  await act(async () => checks[1].props.onChange(true));
  const views = Screen === SignupTermsScreen ? [[1, 'terms'], [2, 'privacy'], [3, 'health'], [4, 'marketing']] : [[1, 'terms'], [2, 'privacy']];
  for (const [index, document] of views) {
    const label = root.findAllByType(Checkbox)[index].props.label + ' 보기';
    const button = action(root, label);
    expect(StyleSheet.flatten(button.props.style({ pressed: false }))).toMatchObject({ width: 44, height: 44 });
    await act(async () => button.props.onPress());
    expect(root.findAllByType(LegalDocumentSheet).find(sheet => sheet.props.view).props.view).toEqual(expect.objectContaining({ document }));
    await act(async () => action(root, '닫기').props.onPress());
    expect(root.findAllByType(Checkbox)[1].props.checked).toBe(true);
  }
});

it('shows the guide only for queued signup users, saves the impression, and does not repeat after later', async () => {
  await queueNotificationGuide('fixture-user');
  const root = await render(NotificationPermissionGate, { userId: 'fixture-user', children: React.createElement(Text, null, 'application-body') });
  expect(root.findAllByType(NotificationPermissionScreen)).toHaveLength(1);
  expect(await readNotificationGuide('fixture-user')).toBe('seen');
  await act(async () => root.findByType(TextButton).props.onPress());
  expect(output()).toContain('application-body');
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
  await act(async () => renderer.unmount()); renderer = undefined;
  await queueNotificationGuide('fixture-user');
  await render(NotificationPermissionGate, { userId: 'fixture-user', children: React.createElement(Text, null, 'application-body') });
  expect(output()).toContain('application-body');
  expect(Notifications.getPermissionsAsync).toHaveBeenCalledTimes(1);
});

it('ships with notification prompting disabled', () => {
  expect(jest.requireActual('../src/config/features').NOTIFICATION_PERMISSION_PROMPT).toBe(false);
});

it('[phone 563:2071] skips storage and OS access while disabled even if an old pending marker exists', async () => {
  await AsyncStorage.setItem('@mealchat/notification-guide/v1/fixture-user', 'pending');
  features.NOTIFICATION_PERMISSION_PROMPT = false;
  AsyncStorage.getItem.mockClear(); AsyncStorage.setItem.mockClear();
  const root = await render(NotificationPermissionGate, { userId: 'fixture-user', children: React.createElement(Text, null, 'application-body') });
  expect(output()).toContain('application-body');
  expect(root.findAllByType(NotificationPermissionScreen)).toHaveLength(0);
  expect(AsyncStorage.getItem).not.toHaveBeenCalled(); expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
  await queueNotificationGuide('new-user');
  await expect(requestNotificationPermission()).rejects.toThrow('disabled');
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
});

it('ignores a pending OS lookup if the feature becomes disabled', async () => {
  await queueNotificationGuide('fixture-user');
  let finish;
  Notifications.getPermissionsAsync.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const body = React.createElement(Text, null, 'application-body');
  const root = await render(NotificationPermissionGate, { userId: 'fixture-user', children: body });
  features.NOTIFICATION_PERMISSION_PROMPT = false;
  await act(async () => renderer.update(React.createElement(NotificationPermissionGate, { userId: 'fixture-user', children: body })));
  await act(async () => finish({ status: 'undetermined', canAskAgain: true }));
  expect(output()).toContain('application-body');
  expect(root.findAllByType(NotificationPermissionScreen)).toHaveLength(0);
  expect(await readNotificationGuide('fixture-user')).toBe('pending');
});

it.each(['granted', 'denied'])('skips an already decided permission %s', async (status) => {
  await queueNotificationGuide('fixture-user');
  Notifications.getPermissionsAsync.mockResolvedValue({ status, canAskAgain: status === 'granted' });
  const root = await render(NotificationPermissionGate, { userId: 'fixture-user', children: React.createElement(Text, null, 'application-body') });
  expect(root.findAllByType(NotificationPermissionScreen)).toHaveLength(0);
  expect(output()).toContain('application-body');
  expect(await readNotificationGuide('fixture-user')).toBe('seen');
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});

it('does not open the guide for an existing user or another account and reacts to a later signup marker', async () => {
  await queueNotificationGuide('other-user');
  const root = await render(NotificationPermissionGate, { userId: 'fixture-user', children: React.createElement(Text, null, 'application-body') });
  expect(output()).toContain('application-body');
  expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
  await act(async () => queueNotificationGuide('fixture-user'));
  expect(root.findAllByType(NotificationPermissionScreen)).toHaveLength(1);
  expect(await readNotificationGuide('other-user')).toBe('pending');
});

it('ignores the previous account permission result after the user changes', async () => {
  await queueNotificationGuide('fixture-user');
  let resolvePermission;
  Notifications.getPermissionsAsync.mockImplementationOnce(() => new Promise((resolve) => { resolvePermission = resolve; }));
  const body = React.createElement(Text, null, 'application-body');
  const root = await render(NotificationPermissionGate, { userId: 'fixture-user', children: body });
  await act(async () => renderer.update(React.createElement(NotificationPermissionGate, { userId: 'other-user', children: body })));
  await act(async () => resolvePermission({ status: 'undetermined', canAskAgain: true }));
  expect(root.findAllByType(NotificationPermissionScreen)).toHaveLength(0);
  expect(output()).toContain('application-body');
  expect(await readNotificationGuide('fixture-user')).toBe('pending');
});

it('continues into the application when the OS permission check fails', async () => {
  await queueNotificationGuide('fixture-user');
  Notifications.getPermissionsAsync.mockRejectedValueOnce(new Error('OS fixture failure'));
  const root = await render(NotificationPermissionGate, { userId: 'fixture-user', children: React.createElement(Text, null, 'application-body') });
  expect(root.findAllByType(NotificationPermissionScreen)).toHaveLength(0);
  expect(output()).toContain('application-body');
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});

it.each(['granted', 'denied'])('requests OS permission only after allow and completes with result %s', async (status) => {
  const onDone = jest.fn();
  Notifications.requestPermissionsAsync.mockResolvedValue({ status });
  const root = await render(NotificationPermissionScreen, { onDone });
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(onDone).toHaveBeenCalledTimes(1);
});

it('creates the Android notification channel after allow and before requesting permission', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const root = await render(NotificationPermissionScreen, { onDone: jest.fn() });
  expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('default', { name: '약속 소식', importance: Notifications.AndroidImportance.DEFAULT });
  expect(Notifications.setNotificationChannelAsync.mock.invocationCallOrder[0]).toBeLessThan(Notifications.requestPermissionsAsync.mock.invocationCallOrder[0]);
});

it('treats Android hardware back as later and removes its listener, even with the feature off', async () => {
  features.NOTIFICATION_PERMISSION_PROMPT = false;
  jest.replaceProperty(Platform, 'OS', 'android');
  let back;
  const remove = jest.fn();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((event, callback) => {
    expect(event).toBe('hardwareBackPress'); back = callback; return { remove };
  });
  const onDone = jest.fn();
  await render(NotificationPermissionScreen, { onDone });
  await act(async () => { expect(back()).toBe(true); });
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  await act(async () => renderer.unmount()); renderer = undefined;
  expect(remove).toHaveBeenCalledTimes(1);
});

it('consumes Android hardware back while the permission request is busy, matching the disabled later button', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  let back, finish;
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, callback) => { back = callback; return { remove: jest.fn() }; });
  Notifications.requestPermissionsAsync.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const onDone = jest.fn();
  const root = await render(NotificationPermissionScreen, { onDone });
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  expect(root.findByType(TextButton).props.disabled).toBe(true);
  await act(async () => { expect(back()).toBe(true); });
  expect(onDone).not.toHaveBeenCalled();
  await act(async () => finish({ status: 'granted' }));
  expect(onDone).toHaveBeenCalledTimes(1);
});

it('keeps the guide usable and shows a safe toast after a permission failure', async () => {
  Notifications.requestPermissionsAsync.mockRejectedValue(new Error('private-fixture'));
  const onDone = jest.fn();
  const root = await render(NotificationPermissionScreen, { onDone });
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  expect(onDone).not.toHaveBeenCalled();
  expect(root.findByType(PrimaryButton).props.loading).toBe(false);
  expect(output()).toContain('알림 권한을 요청하지 못했어요.');
  expect(output()).not.toContain('private-fixture');
  await act(async () => root.findByType(TextButton).props.onPress());
  expect(onDone).toHaveBeenCalledTimes(1);
});

function SignupSeed() {
  const { updateDraft } = useSignupDraft();
  React.useEffect(() => { updateDraft({ nickname: '밀챗', email: 'fixture@example.test', password: 'fixture-password', consents: { service: true, privacy: true, marketing: false } }); }, [updateDraft]);
  return React.createElement(SignupTermsScreen);
}
it.each([false, true])('queues a per-user guide after successful signup, confirmationRequired=%s', async (confirmationRequired) => {
  auth.signUpWithEmail.mockResolvedValue({ error: null, confirmationRequired, userId: 'fixture-user' });
  const Wrapper = () => React.createElement(SignupDraftProvider, null, React.createElement(SignupSeed));
  const root = await render(Wrapper);
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  expect(await readNotificationGuide('fixture-user')).toBe('pending');
});

it.each([false, true])('does not queue disabled signup prompts or show a backlog after enabling, confirmationRequired=%s', async confirmationRequired => {
  features.NOTIFICATION_PERMISSION_PROMPT = false;
  auth.signUpWithEmail.mockResolvedValue({ error: null, confirmationRequired, userId: 'fixture-user' });
  const Wrapper = () => React.createElement(SignupDraftProvider, null, React.createElement(SignupSeed));
  const root = await render(Wrapper);
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  expect(await readNotificationGuide('fixture-user')).toBeNull();
  await act(async () => renderer.unmount()); renderer = undefined;
  features.NOTIFICATION_PERMISSION_PROMPT = true;
  const gate = await render(NotificationPermissionGate, { userId: 'fixture-user', children: React.createElement(Text, null, 'application-body') });
  expect(gate.findAllByType(NotificationPermissionScreen)).toHaveLength(0);
  expect(output()).toContain('application-body');
  expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
});

it('does not queue a guide when signup fails', async () => {
  auth.signUpWithEmail.mockResolvedValue({ error: new Error('fixture'), confirmationRequired: false, userId: null });
  const Wrapper = () => React.createElement(SignupDraftProvider, null, React.createElement(SignupSeed));
  const root = await render(Wrapper);
  await act(async () => root.findByType(PrimaryButton).props.onPress());
  expect(await readNotificationGuide('fixture-user')).toBeNull();
});
