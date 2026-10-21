const React = require('react');
const { act, create } = require('react-test-renderer');
const { AppState } = require('react-native');
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: ({ children }) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../src/profile/useMyProfile', () => ({ useMyProfile: () => ({ userId: 'self', bundle: null }) }));
jest.mock('../src/lib/profile', () => ({ saveMyPrivateProfile: jest.fn(async () => null), fetchProfileVisibility: jest.fn(), setProfileVisibility: jest.fn() }));
jest.mock('../src/navigation/NavigationContext', () => ({ useNavigation: jest.fn() }));
jest.mock('../src/components/NotificationsProvider', () => ({ useNotifications: () => ({ hasUnread: false, open: jest.fn() }) }));
jest.mock('../src/lib/confirm', () => ({ notify: jest.fn() }));
jest.mock('../src/screens/settings/notificationPermission', () => ({ queueNotificationGuide: jest.fn(async () => undefined) }));
const storage = require('@react-native-async-storage/async-storage');
const { useAuth } = require('../src/auth/AuthProvider');
const { useNavigation } = require('../src/navigation/NavigationContext');
const api = require('../src/lib/consents');
const profile = require('../src/lib/profile');
const { setConsentAccess } = require('../src/consents/access');
const { useConsentGate } = require('../src/consents/useConsentGate');
const { useConsentManifest } = require('../src/consents/useConsentManifest');
const { createS1Fixture } = require('./fixtures/s1');
const { Checkbox } = require('../src/components/ui/Checkbox');
const { Switch } = require('../src/components/ui/Switch');
const ReConsentScreen = require('../src/screens/auth/ReConsentScreen').default;
const PrivacyScreen = require('../src/screens/profile/PrivacyScreen').default;
const OptionalConsentsScreen = require('../src/screens/settings/OptionalConsentsScreen').default;
const SignupTermsScreen = require('../src/screens/signup/SignupTermsScreen').default;
const { SignupDraftProvider, useSignupDraft } = require('../src/auth/SignupDraftProvider');
const { readPendingSignupConsents } = require('../src/auth/pendingSignupConsents');
const PrivacyNoticeBanner = require('../src/screens/settings/PrivacyNoticeBanner').default;
const PrivacyRevisionScreen = require('../src/screens/settings/PrivacyRevisionScreen').default;
const SettingsScreen = require('../src/screens/settings/SettingsScreen').default;
const { ListRow } = require('../src/components/ui/ListRow');
const { privacyRevisionPublication, privacyRevisionDocument, shouldShowPrivacyNotice, resolvePrivacyRevisionPublication } = require('../src/legal/privacyRevision');
const { privacy } = require('../src/legal/privacy');
const publicationBefore = { ...privacyRevisionPublication };
const missing = { data: null, error: { code: 'PGRST202', status: 404 } };
let renderer, gate, user, foreground, calls, auth, navigation;
function Probe() { gate = useConsentGate(); return null; }
async function mount(Screen = Probe, props = {}) { await act(async () => { renderer = create(React.createElement(Screen, props)); }); }
const output = () => JSON.stringify(renderer.toJSON());
const button = label => renderer.root.findAll(node => typeof node.props.onPress === 'function' && node.props.accessibilityLabel === label && node.props.accessibilityRole === 'button')[0];
function legacyTransport(agreed = true) {
  return async (name, args) => {
    calls.push({ name, args });
    if (name === 'get_consent_manifest') return missing;
    if (name === 'current_terms_consent_status') return { data: [{ version: '2026-08-17', agreed }], error: null };
    if (name === 'record_terms_consent') return { data: '2026-08-17', error: null };
    throw new Error('Unexpected S1 call');
  };
}
beforeEach(async () => {
  jest.clearAllMocks(); await storage.clear(); calls = [];
  user = { id: 'self', email: 'fixture@example.test' };
  auth = { user, signOut: jest.fn(async () => null), signUpWithEmail: jest.fn(async () => ({ error: null, confirmationRequired: true, userId: 'self' })) };
  useAuth.mockImplementation(() => ({ ...auth, user }));
  navigation = { current: { name: 'Settings' }, navigate: jest.fn(), goBack: jest.fn(), resetTo: jest.fn() }; useNavigation.mockReturnValue(navigation);
  setConsentAccess('self', 'loading'); api.configureS1RpcTransport(legacyTransport(), require('./fixtures/s1').isolatedCapabilityStorage());
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => { foreground = callback; return { remove: jest.fn() }; });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount()); renderer = undefined;
  api.configureS1RpcTransport(); setConsentAccess(null, 'loading'); jest.restoreAllMocks();
  Object.assign(privacyRevisionPublication, publicationBefore);
});
it('uses the successful old consent status in legacy mode and caches probes separately per account', async () => {
  await mount(); expect(gate.state).toBe('accepted'); expect(gate.legacy).toBe(true);
  await act(async () => gate.reload());
  expect(calls.filter(call => call.name === 'get_consent_manifest')).toHaveLength(1);
  expect(calls.filter(call => call.name === 'current_terms_consent_status')).toHaveLength(2);
  user = { id: 'other', email: 'other@example.test' };
  await act(async () => renderer.update(React.createElement(Probe)));
  expect(gate.state).toBe('accepted'); expect(calls.filter(call => call.name === 'get_consent_manifest')).toHaveLength(2);
});
it('adopts S1 on the next foreground and gates new required consent instead of retaining legacy acceptance', async () => {
  const fixture = createS1Fixture(false); let activated = false;
  const old = legacyTransport(); api.configureS1RpcTransport((name, args) => activated ? fixture.rpc(name, args) : old(name, args));
  await mount(); expect(gate.state).toBe('accepted'); activated = true;
  await act(async () => foreground('active'));
  expect(gate.legacy).toBe(false); expect(gate.state).toBe('required'); expect(api.getConsentServerMode()).toBe('s1');
});
it.each(['PGRST202', '404-message'])('keeps a confirmed S1 device closed after %s across accounts and a cold restart', async shape => {
  const device = require('./fixtures/s1').isolatedCapabilityStorage(), fixture = createS1Fixture(true);
  api.configureS1RpcTransport(fixture.rpc, device); await mount(); expect(gate.state).toBe('accepted');
  const missing = shape === 'PGRST202' ? { code: 'PGRST202', status: 404 } : { status: 404, message: 'Could not find the function public.get_consent_manifest() in the schema cache' };
  const seen = [];
  // New memory with the same device storage simulates restarting after account change.
  api.configureS1RpcTransport(async name => { seen.push(name); return { data: null, error: missing }; }, device);
  user = { id: 'other', email: 'other@example.test' };
  await act(async () => renderer.update(React.createElement(Probe)));
  expect(gate.state).toBe('error'); expect(gate.legacy).toBe(false);
  expect(api.getConsentServerMode()).toBe('s1'); expect(seen).toEqual(['get_consent_manifest']);
});
it('keeps latest privacy values and the conflict explanation after S1004 reload', async () => {
  const fixture = createS1Fixture(true); api.configureS1RpcTransport(fixture.rpc); await api.fetchConsentManifest(); setConsentAccess('self', 'accepted');
  const original = { revision: '0', settings: { birthdate: 'private', gender: 'private', bio: 'private', bank_account: 'private', origin: 'private' } };
  profile.fetchProfileVisibility.mockResolvedValueOnce({ data: original, error: null }).mockResolvedValueOnce({ data: { ...original, revision: '2', settings: { ...original.settings, gender: 'public' } }, error: null });
  profile.setProfileVisibility.mockResolvedValue({ data: null, error: { code: 'S1004' } });
  await mount(PrivacyScreen);
  await act(async () => renderer.root.findAllByType(Switch)[0].props.onChange(true));
  expect(renderer.root.findAllByType(Switch)[1].props.value).toBe(true);
  expect(output()).toContain(require('../src/consents/contracts').consentErrorMessage({ code: 'S1004' }));
});
it.each(['bundle', 'document'])('resets signup checks and the open document when the %s identity changes', async changed => {
  setConsentAccess(null, 'loading');
  const fixture = createS1Fixture(false); api.configureS1RpcTransport(fixture.rpc);
  function Signup() { return React.createElement(SignupTermsScreen); }
  await mount(() => React.createElement(SignupDraftProvider, null, React.createElement(Signup)));
  await act(async () => renderer.root.findAllByType(Checkbox)[0].props.onChange(true));
  await act(async () => button('[필수] 서비스 이용약관 보기').props.onPress());
  const LegalSheet = require('../src/screens/settings/LegalDocumentSheet').default;
  expect(renderer.root.findByType(LegalSheet).props.view).not.toBeNull();
  fixture.manifest = changed === 'bundle' ? { ...fixture.manifest, bundle_version: 'new' } : { ...fixture.manifest, documents: { ...fixture.manifest.documents, privacy: { ...fixture.manifest.documents.privacy, version: 'new' } } };
  await act(async () => foreground('active'));
  const checks = renderer.root.findAllByType(Checkbox);
  if (changed === 'bundle') expect(checks.every(node => !node.props.checked)).toBe(true);
  else { expect(checks[1].props.checked).toBe(true); expect(checks[2].props.checked).toBe(false); expect(checks[3].props.checked).toBe(true); }
  expect(renderer.root.findByType(LegalSheet).props.view).toBeNull();
  expect(button('회원가입 끝내기').props.disabled).toBe(true);
});
it('reprobes anonymous signup on foreground as well', async () => {
  let view, activated = false; const fixture = createS1Fixture(false), old = legacyTransport();
  setConsentAccess(null, 'loading'); api.configureS1RpcTransport((name, args) => activated ? fixture.rpc(name, args) : old(name, args));
  function ManifestProbe() { view = useConsentManifest(); return null; }
  await mount(ManifestProbe); expect(view.legacy).toBe(true);
  activated = true; await act(async () => foreground('active'));
  expect(view.legacy).toBe(false); expect(view.manifest.bundle_version).toBe(fixture.manifest.bundle_version);
});
it('clears legacy eligibility immediately while an anonymous foreground probe is pending', async () => {
  let view, activated = false, finish;
  const fixture = createS1Fixture(false), old = legacyTransport();
  setConsentAccess(null, 'loading');
  api.configureS1RpcTransport((name, args) => activated ? new Promise(resolve => { finish = () => fixture.rpc(name, args).then(resolve); }) : old(name, args));
  function ManifestProbe() { view = useConsentManifest(); return null; }
  await mount(ManifestProbe); expect(view.legacy).toBe(true);
  activated = true; await act(async () => foreground('active'));
  expect(view.loading).toBe(true); expect(view.legacy).toBe(false); expect(view.manifest).toBeNull();
  await act(async () => finish()); expect(view.loading).toBe(false); expect(view.manifest).toBeTruthy();
});
it.each([
  { status: 0, message: 'Network request failed' }, { status: 500, code: 'PGRST202' },
  { status: 503 }, { status: 404 }, { status: 404, code: '42P01' }, { code: '42883' }, { status: 403 },
])('never treats a network/server/unrelated error as a missing manifest: %j', async error => {
  api.configureS1RpcTransport(async name => { calls.push({ name }); return { data: null, error }; });
  await mount(); expect(gate.state).toBe('error'); expect(gate.legacy).toBe(false);
  expect(calls.map(call => call.name)).toEqual(['get_consent_manifest']);
});
it('accepts only the explicit PostgREST missing-function 404 shape without a code', () => {
  expect(api.isMissingConsentManifest({ status: 404, message: 'Could not find the function public.get_consent_manifest() in the schema cache' })).toBe(true);
  expect(api.isMissingConsentManifest({ status: 404, message: 'Could not find the function public.other() in the schema cache' })).toBe(false);
});
it.each([null, [], { version: 'old', agreed: 'true' }])('keeps empty or malformed legacy consent behind an error gate: %j', async data => {
  api.configureS1RpcTransport(async name => name === 'get_consent_manifest' ? missing : { data, error: null });
  await mount(); expect(gate.state).toBe('error');
});
it('does not open when the legacy status RPC fails', async () => {
  api.configureS1RpcTransport(async name => name === 'get_consent_manifest' ? missing : { data: null, error: { status: 503 } });
  await mount(); expect(gate.state).toBe('error');
});
it('uses the outer PostgREST HTTP status and refuses a misleading missing-function code on 5xx', async () => {
  api.configureS1RpcTransport(async () => ({ status: 502, data: null, error: { code: 'PGRST202' } }));
  await mount(); expect(gate.state).toBe('error'); expect(gate.legacy).toBe(false);
});
it('submits legacy reconsent via the old RPC and omits health controls', async () => {
  api.configureS1RpcTransport(legacyTransport(false)); const onDone = jest.fn();
  await mount(ReConsentScreen, { onDone });
  expect(renderer.root.findAllByType(Checkbox)).toHaveLength(4);
  await act(async () => renderer.root.findAllByType(Checkbox)[0].props.onChange(true));
  await act(async () => button('동의하고 계속하기').props.onPress());
  expect(calls.find(call => call.name === 'record_terms_consent').args).toEqual({ marketing_opt_in: true });
  expect(onDone).toHaveBeenCalledTimes(1); expect(button('건강정보 동의 철회')).toBeUndefined();
});
it('keeps legacy signup on the existing metadata/confirmation flow without S1 consent persistence', async () => {
  function Signup() {
    const { updateDraft } = useSignupDraft();
    React.useEffect(() => updateDraft({ nickname: '메이트', email: user.email, password: 'fixture-password' }), [updateDraft]);
    return React.createElement(SignupTermsScreen);
  }
  await mount(() => React.createElement(SignupDraftProvider, null, React.createElement(Signup)));
  expect(renderer.root.findAllByType(Checkbox)).toHaveLength(4);
  await act(async () => renderer.root.findAllByType(Checkbox)[0].props.onChange(true));
  await act(async () => button('회원가입 끝내기').props.onPress());
  expect(auth.signUpWithEmail).toHaveBeenCalledWith({ email: user.email, password: 'fixture-password', displayName: '메이트', marketingOptIn: true });
  expect(navigation.resetTo).toHaveBeenCalledWith('Login'); expect(await readPendingSignupConsents(storage)).toBeNull();
  expect(calls.map(call => call.name)).toEqual(['get_consent_manifest']);
});
it('renders unavailable legacy privacy controls and never reads or writes S1 visibility', async () => {
  await api.fetchConsentManifest(); setConsentAccess('self', 'accepted');
  await mount(PrivacyScreen); expect(output()).toContain('곧 이용할 수 있어요');
  expect(renderer.root.findAllByType(Switch).every(node => node.props.disabled)).toBe(true);
  expect(button('저장하기').props.disabled).toBe(true);
  expect(profile.fetchProfileVisibility).not.toHaveBeenCalled(); expect(profile.setProfileVisibility).not.toHaveBeenCalled();
});
it('does not expose optional mutation controls on a legacy server', async () => {
  await mount(OptionalConsentsScreen); expect(output()).toContain('곧 이용할 수 있어요');
  expect(button('건강정보 동의하기')).toBeUndefined(); expect(button('건강정보 동의 철회')).toBeUndefined();
  expect(calls.map(call => call.name)).toEqual(['get_consent_manifest']);
});
it('hides an undated/disabled notice and removes the banner in S1 mode', () => {
  const dated = { ...privacyRevisionPublication, announce: true, effectiveDate: '2026-11-01' };
  expect(shouldShowPrivacyNotice('legacy', resolvePrivacyRevisionPublication(null))).toBe(false);
  expect(shouldShowPrivacyNotice('legacy', { ...dated, effectiveDate: null })).toBe(false);
  expect(shouldShowPrivacyNotice('legacy', { ...dated, announce: false })).toBe(false);
  expect(shouldShowPrivacyNotice('legacy', dated)).toBe(true);
  expect(shouldShowPrivacyNotice('s1', dated)).toBe(false);
  expect(shouldShowPrivacyNotice('unknown', dated)).toBe(false);
});
it('routes a dated notice to its summary, dismisses it, and keeps a Settings reopening path', async () => {
  Object.assign(privacyRevisionPublication, { announce: true, effectiveDate: '2026-11-01' });
  await api.fetchConsentManifest(); navigation.current.name = 'Home';
  await mount(PrivacyNoticeBanner);
  expect(output()).toContain('2026년 11월 1일');
  await act(async () => button('개인정보 처리방침 바뀌는 점 보기').props.onPress());
  expect(navigation.navigate).toHaveBeenCalledWith('PrivacyRevision');
  await act(async () => button('개인정보 처리방침 예고 닫기').props.onPress());
  expect(renderer.toJSON()).toBeNull();
  await act(async () => renderer.unmount()); renderer = undefined;
  navigation.current.name = 'Settings'; await mount(SettingsScreen);
  const row = renderer.root.findAllByType(ListRow).find(node => node.props.title === '개인정보 처리방침 개정 예고');
  await act(async () => row.props.onPress()); expect(navigation.navigate).toHaveBeenLastCalledWith('PrivacyRevision');
});
it('renders the approved draft and preserves the original eleven-section first edition through previous-edition viewing', async () => {
  Object.assign(privacyRevisionPublication, resolvePrivacyRevisionPublication(null));
  const original = JSON.stringify(privacy);
  expect(privacyRevisionPublication).toMatchObject({ edition: null, effectiveDate: null, version: null, contentHash: null });
  const revised = privacyRevisionDocument(); expect(revised.sections).toHaveLength(11);
  expect(revised.sections[2].paragraphs[0]).toContain('친구 추가만으로는 보이지 않아요');
  expect(revised.sections[1].paragraphs[1]).toContain('하루 안에 지워요');
  expect(revised.sections[7]).toEqual(privacy.sections[7]); expect(revised.sections[9]).toEqual(privacy.sections[9]);
  await mount(PrivacyRevisionScreen); expect(output()).toContain('시행일은 아직 정해지지 않았어요');
  await act(async () => button('개정안 원문 보기').props.onPress());
  expect(output()).toContain('판 번호 미정'); expect(output()).toContain('정산을 요청하면 그 정산이 끝날 때까지');
  await act(async () => button('변경 요약으로').props.onPress());
  await act(async () => button('이전 판 보기 · 1판').props.onPress());
  expect(output()).toContain('2026년 10월 1일'); expect(output()).toContain('탈퇴하면 바로 지웁니다');
  expect(JSON.stringify(privacy)).toBe(original);
});

it.each([['banner', PrivacyNoticeBanner], ['settings', SettingsScreen]])('subscribes the mounted %s to server-mode changes and avoids foreground unknown-mode flicker', async (kind, Screen) => {
  Object.assign(privacyRevisionPublication, { announce: true, effectiveDate: '2026-11-01' });
  navigation.current.name = kind === 'banner' ? 'Home' : 'Settings';
  const visibleNotice = () => kind === 'banner' ? renderer.toJSON() !== null : renderer.root.findAllByType(ListRow).some(node => node.props.title === '개인정보 처리방침 개정 예고');
  await mount(Screen); expect(visibleNotice()).toBe(false);
  await act(async () => api.fetchConsentManifest()); expect(visibleNotice()).toBe(true);
  let finish; const fixture = createS1Fixture();
  await act(async () => api.configureS1RpcTransport(name => name === 'get_consent_manifest' ? new Promise(resolve => { finish = resolve; }) : fixture.rpc(name, {})));
  let probing; await act(async () => { probing = api.fetchConsentManifest(); });
  expect(api.getConsentServerMode()).toBe('unknown'); expect(api.getConsentServerModeSnapshot()).toBe('legacy'); expect(visibleNotice()).toBe(true);
  await act(async () => { finish({ data: fixture.manifest, error: null }); await probing; });
  expect(api.getConsentServerModeSnapshot()).toBe('s1'); expect(visibleNotice()).toBe(false);
});
it('uses the stable snapshot only for UI: gate and legacy/RPC guards still use the strict unknown mode', async () => {
  await api.fetchConsentManifest(); expect(api.getConsentServerMode()).toBe('legacy');
  let finish; const fixture = createS1Fixture(); const rpcNames = [];
  api.configureS1RpcTransport((name, args) => { rpcNames.push(name); return name === 'get_consent_manifest' ? new Promise(resolve => { finish = resolve; }) : fixture.rpc(name, args); });
  expect(api.getConsentServerModeSnapshot()).toBe('legacy'); expect(api.getConsentServerMode()).toBe('unknown');
  await mount(); expect(gate.state).toBe('loading'); expect(gate.legacy).toBe(false);
  expect((await api.fetchLegacyConsentStatus()).error).toBeTruthy(); expect(rpcNames).not.toContain('current_terms_consent_status');
  await act(async () => api.fetchConsentStatus());
  expect(rpcNames).toContain('get_my_consent_status'); // UI's legacy snapshot must not reject an S1 request.
  expect(gate.state).toBe('loading');
  await act(async () => finish({ data: fixture.manifest, error: null }));
  expect(gate.state).toBe('required'); expect(gate.legacy).toBe(false);
});
