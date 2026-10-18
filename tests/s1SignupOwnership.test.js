const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-linking', () => ({ getInitialURL: jest.fn(async () => null), addEventListener: () => ({ remove: jest.fn() }), createURL: path => path }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: ({ children }) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../src/theme/keyboard', () => ({ useKeyboardOverlap: () => ({ overlap: 0, remeasure: jest.fn() }) }));
jest.mock('../src/lib/supabase', () => ({ supabase: { auth: {} } }));
jest.mock('../src/lib/profile', () => ({ saveMyPrivateProfile: jest.fn(async () => null) }));
jest.mock('../src/lib/scheduleDraft', () => ({ clearSettingsDraft: jest.fn(async () => undefined) }));
jest.mock('../src/lib/confirm', () => ({ notify: jest.fn() }));
jest.mock('../src/navigation/NavigationContext', () => ({ useNavigation: jest.fn() }));
jest.mock('../src/screens/settings/notificationPermission', () => ({ queueNotificationGuide: jest.fn(async () => undefined) }));
const storage = require('@react-native-async-storage/async-storage');
const { supabase } = require('../src/lib/supabase');
const { AuthProvider, useAuth } = require('../src/auth/AuthProvider');
const { SignupDraftProvider, useSignupDraft } = require('../src/auth/SignupDraftProvider');
const SignupTermsScreen = require('../src/screens/signup/SignupTermsScreen').default;
const { useNavigation } = require('../src/navigation/NavigationContext');
const { setConsentAccess, getConsentAccess } = require('../src/consents/access');
const consents = require('../src/lib/consents');
const { createS1Fixture, isolatedCapabilityStorage } = require('./fixtures/s1');
const { PENDING_SIGNUP_PROFILE_KEY, persistPendingSignupProfile, readPendingSignupProfile } = require('../src/auth/pendingSignupProfile');
const { PENDING_SIGNUP_CONSENTS_KEY, persistPendingSignupConsents, readPendingSignupConsents } = require('../src/auth/pendingSignupConsents');
const { completePendingProfile } = require('../src/auth/completePendingProfile');
const { consentSubmission } = require('../src/legal/manifest');
const { newConsentRequestId } = require('../src/consents/contracts');
const { saveMyPrivateProfile } = require('../src/lib/profile');
const { notify } = require('../src/lib/confirm');
let renderer, auth, listener, session, fixture, navigation, response;
const draft = { nickname: '메이트', email: 'signup@example.test', password: 'fixture-password', bank: '카카오뱅크', account: '1111-2222', birth: { year: '2000', month: '1', day: '2' }, tastes: { korean: true }, consents: { service: true, privacy: true, health: true, marketing: true } };
function Seed() {
  const { updateDraft } = useSignupDraft(); auth = useAuth();
  React.useEffect(() => updateDraft(draft), [updateDraft]);
  return React.createElement(SignupTermsScreen);
}
async function mount() { await act(async () => { renderer = create(React.createElement(AuthProvider, null, React.createElement(SignupDraftProvider, null, React.createElement(Seed)))); }); }
async function submit() { await act(async () => renderer.root.findAll(node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === '회원가입 끝내기' && node.props.onPress)[0].props.onPress()); }
async function pendingEmpty() { expect(await storage.getItem(PENDING_SIGNUP_PROFILE_KEY)).toBeNull(); expect(await storage.getItem(PENDING_SIGNUP_CONSENTS_KEY)).toBeNull(); }
beforeEach(async () => {
  jest.clearAllMocks(); await storage.clear(); setConsentAccess(null, 'loading'); session = null;
  fixture = createS1Fixture(); consents.configureS1RpcTransport(fixture.rpc, isolatedCapabilityStorage());
  navigation = { goBack: jest.fn(), navigate: jest.fn(), resetTo: jest.fn() }; useNavigation.mockReturnValue(navigation);
  response = { data: { user: { id: 'new-user', email: draft.email, identities: [{ id: 'identity' }] }, session: null }, error: null };
  supabase.auth = {
    getSession: jest.fn(async () => ({ data: { session }, error: null })),
    onAuthStateChange: jest.fn(callback => { listener = callback; return { data: { subscription: { unsubscribe: jest.fn() } } }; }),
    signUp: jest.fn(async () => { if (response.data.session) { session = response.data.session; listener('SIGNED_IN', session); } return response; }),
    signOut: jest.fn(async () => ({ error: null })),
  };
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount()); renderer = undefined;
  setConsentAccess(null, 'loading'); consents.configureS1RpcTransport(); jest.restoreAllMocks();
});
it.each(['error', 'exception', 'fake-user', 'fake-user-session'])('does not leave personal fields or choices after signup %s, even when an old draft existed', async mode => {
  await persistPendingSignupProfile(storage, { ...draft, userId: 'old-user' });
  await persistPendingSignupConsents(storage, { email: draft.email, userId: 'old-user', savedAt: Date.now(), submission: consentSubmission(fixture.manifest, draft.consents, newConsentRequestId()) });
  await mount();
  if (mode === 'error') response.error = { code: 'email_address_invalid', message: 'private-provider-text' };
  if (mode === 'exception') supabase.auth.signUp.mockRejectedValueOnce({ code: 'email_address_invalid', message: 'private-provider-text' });
  if (mode.startsWith('fake-user')) { response.data.user.identities = []; if (mode === 'fake-user-session') response.data.session = { user: response.data.user }; }
  await submit(); await pendingEmpty(); expect(saveMyPrivateProfile).not.toHaveBeenCalled();
  expect(fixture.calls.some(call => call.name === 'complete_signup_consents')).toBe(false);
  if (mode.startsWith('fake-user')) {
    expect(notify).toHaveBeenCalledWith('이메일 확인 필요', '이메일의 확인 링크를 연 뒤 로그인해 주세요.');
    expect(navigation.resetTo).toHaveBeenCalledWith('Login'); expect(JSON.stringify(notify.mock.calls)).not.toContain('이미 가입');
    const existing = { id: 'existing-user', email: draft.email }; await act(async () => { session = { user: existing }; listener('SIGNED_IN', session); });
    setConsentAccess(existing.id, 'accepted'); await completePendingProfile(existing); expect(saveMyPrivateProfile).not.toHaveBeenCalled();
  } else expect(notify).toHaveBeenCalledWith('회원가입 실패', expect.any(String));
  expect(JSON.stringify(notify.mock.calls)).not.toContain('private-provider-text');
});
it('binds confirmation-wait data only to the real returned id and keeps the same non-enumerating confirmation notice', async () => {
  await mount(); await submit();
  expect((await readPendingSignupProfile(storage)).userId).toBe('new-user');
  expect((await readPendingSignupConsents(storage)).userId).toBe('new-user');
  expect(notify).toHaveBeenCalledWith('이메일 확인 필요', '이메일의 확인 링크를 연 뒤 로그인해 주세요.');
  expect(navigation.resetTo).toHaveBeenCalledWith('Login');
  setConsentAccess('existing-user', 'accepted'); await completePendingProfile({ id: 'existing-user', email: draft.email });
  expect(saveMyPrivateProfile).not.toHaveBeenCalled(); expect(await readPendingSignupProfile(storage)).toBeNull();
});
it('never persists signup fields before the provider resolves', async () => {
  let finish; await mount(); supabase.auth.signUp.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await submit(); await pendingEmpty(); expect(storage.setItem.mock.calls.filter(([key]) => [PENDING_SIGNUP_PROFILE_KEY, PENDING_SIGNUP_CONSENTS_KEY].includes(key))).toHaveLength(0);
  await act(async () => finish(response)); expect((await readPendingSignupProfile(storage)).userId).toBe('new-user');
});
it('keeps immediate-session account/birth fields off AsyncStorage and saves them only after accepted consent', async () => {
  response.data.session = { user: response.data.user };
  saveMyPrivateProfile.mockImplementation(async () => { expect(getConsentAccess()).toEqual({ userId: 'new-user', state: 'accepted' }); return null; });
  await mount(); await submit(); await pendingEmpty();
  expect(storage.setItem.mock.calls.filter(([key]) => [PENDING_SIGNUP_PROFILE_KEY, PENDING_SIGNUP_CONSENTS_KEY].includes(key))).toHaveLength(0);
  expect(saveMyPrivateProfile).toHaveBeenCalledWith('new-user', expect.objectContaining({ account: draft.account, birth: draft.birth, tastes: draft.tastes }));
});
it('discards a memory-only signup profile on logout rather than applying it to the next account', async () => {
  response.data.session = { user: response.data.user };
  consents.configureS1RpcTransport(async (name, args) => name === 'complete_signup_consents' ? { data: null, error: { code: 'S1006' } } : fixture.rpc(name, args));
  await mount(); await submit(); expect(saveMyPrivateProfile).not.toHaveBeenCalled(); await pendingEmpty();
  await act(async () => listener('SIGNED_OUT', null));
  const existing = { id: 'existing-user', email: draft.email };
  await act(async () => { session = { user: existing }; listener('SIGNED_IN', session); });
  setConsentAccess(existing.id, 'accepted'); await completePendingProfile(existing); expect(saveMyPrivateProfile).not.toHaveBeenCalled();
});
