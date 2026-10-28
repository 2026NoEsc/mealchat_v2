const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('expo-secure-store', () => require('./fixtures/secureStore')());
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-linking', () => ({ getInitialURL: jest.fn(async () => null), addEventListener: () => ({ remove: jest.fn() }), createURL: path => path }));
jest.mock('../src/lib/supabase', () => ({ supabase: { auth: {} }, createPasswordVerificationAuth: jest.fn() }));
jest.mock('../src/lib/supabaseConfig', () => ({ getSupabaseConfig: () => ({ url: 'https://example.supabase.co', publishableKey: 'sb_publishable_fixture' }) }));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({ auth: {} })), processLock: jest.fn() }));
jest.mock('../src/lib/profile', () => ({ saveMyPrivateProfile: jest.fn(async () => null) }));

const { supabase, createPasswordVerificationAuth } = require('../src/lib/supabase');
const { verifyCurrentPassword } = require('../src/lib/passwordReauthentication');
const { AuthProvider, useAuth } = require('../src/auth/AuthProvider');
let verifier, user, renderer, authContext;
beforeEach(() => {
  require('expo-secure-store').reset();
  jest.clearAllMocks();
  user = { id: 'self', email: 'fixture@example.test', app_metadata: { providers: ['email'] } };
  supabase.auth = {
    getSession: jest.fn(async () => ({ data: { session: { user } }, error: null })),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    signInWithPassword: jest.fn(), updateUser: jest.fn(), signOut: jest.fn(),
  };
  verifier = {
    signInWithPassword: jest.fn(async () => ({ data: { user }, error: null })),
    signOut: jest.fn(async () => ({ error: null })), dispose: jest.fn(async () => undefined),
  };
  createPasswordVerificationAuth.mockReturnValue(verifier);
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined;
});

it('verifies the active session email and matching returned user without adopting its session', async () => {
  await expect(verifyCurrentPassword('self', 'fixture-current')).resolves.toBeNull();
  expect(verifier.signInWithPassword).toHaveBeenCalledWith({ email: 'fixture@example.test', password: 'fixture-current' });
  expect(supabase.auth.getSession).toHaveBeenCalledTimes(2);
  expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  expect(verifier.signOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(verifier.dispose).toHaveBeenCalledTimes(1);
  expect(supabase.auth.signOut).not.toHaveBeenCalled();
});
it.each([true, false])('handles returned cleanup errors without sensitive logs, development=%s', async development => {
  const originalDev = global.__DEV__;
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  global.__DEV__ = development;
  verifier.signOut.mockResolvedValue({ error: new Error('fixture private cleanup diagnostic') });
  try {
    await expect(verifyCurrentPassword('self', 'fixture-current')).resolves.toBeNull();
    expect(verifier.dispose).toHaveBeenCalledTimes(1);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(development ? 1 : 0);
    if (development) expect(warn).toHaveBeenCalledWith('Password verification client cleanup could not be completed.');
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/fixture|private|example\.test/);
  } finally { global.__DEV__ = originalDev; warn.mockRestore(); }
});
it('retains the verification error and disposes the client even when signOut returns an error', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const rejection = { code: 'invalid_credentials', message: 'fixture credential rejection' };
  verifier.signInWithPassword.mockResolvedValue({ data: { user: null }, error: rejection });
  verifier.signOut.mockResolvedValue({ error: new Error('fixture cleanup rejection') });
  try {
    await expect(verifyCurrentPassword('self', 'fixture-current')).resolves.toBe(rejection);
    expect(verifier.dispose).toHaveBeenCalledTimes(1);
  } finally { warn.mockRestore(); }
});
it('disposes the client after a thrown cleanup error', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  verifier.signOut.mockRejectedValue(new Error('fixture cleanup rejection'));
  try {
    await expect(verifyCurrentPassword('self', 'fixture-current')).resolves.toBeNull();
    expect(verifier.dispose).toHaveBeenCalledTimes(1);
  } finally { warn.mockRestore(); }
});
it('does not replace the verification result with a dispose error', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  verifier.dispose.mockRejectedValue(new Error('fixture dispose rejection'));
  try {
    await expect(verifyCurrentPassword('self', 'fixture-current')).resolves.toBeNull();
    expect(verifier.dispose).toHaveBeenCalledTimes(1);
  } finally { warn.mockRestore(); }
});
it.each([
  { code: 'invalid_credentials', status: 400 },
  { code: 'over_request_rate_limit', status: 429 },
  { status: 0, name: 'AuthRetryableFetchError' },
])('returns verification failures before any password update (%j)', async error => {
  verifier.signInWithPassword.mockResolvedValue({ data: { user: null }, error });
  await expect(verifyCurrentPassword('self', 'fixture-current')).resolves.toBe(error);
  expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  expect(verifier.signOut).toHaveBeenCalledWith({ scope: 'local' });
});
it.each([null, { id: 'different-user' }])('rejects an absent or different verification identity (%j)', async returnedUser => {
  verifier.signInWithPassword.mockResolvedValue({ data: { user: returnedUser }, error: null });
  await expect(verifyCurrentPassword('self', 'fixture-current')).resolves.toMatchObject({ code: 'reauth_identity_mismatch' });
  expect(supabase.auth.updateUser).not.toHaveBeenCalled();
});
it.each([null, { id: 'different-user', email: 'other@example.test' }])('rejects an active account change during verification (%j)', async nextUser => {
  supabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user } }, error: null })
    .mockResolvedValueOnce({ data: { session: nextUser ? { user: nextUser } : null }, error: null });
  await expect(verifyCurrentPassword('self', 'fixture-current')).resolves.toMatchObject({ code: 'reauth_identity_mismatch' });
});
it('does not send a password when the initial session identity differs', async () => {
  await expect(verifyCurrentPassword('other', 'fixture-current')).resolves.toMatchObject({ code: 'reauth_identity_mismatch' });
  expect(createPasswordVerificationAuth).not.toHaveBeenCalled();
});
it('preserves the real AuthProvider identity and accepted gate through verification', async () => {
  let authChanged;
  supabase.auth.onAuthStateChange.mockImplementation(callback => { authChanged = callback; return { data: { subscription: { unsubscribe: jest.fn() } } }; });
  supabase.auth.updateUser.mockImplementation(async () => {
    authChanged('USER_UPDATED', { user: { ...user } });
    return { data: { user }, error: null };
  });
  function Probe() { authContext = useAuth(); return null; }
  await act(async () => { renderer = create(React.createElement(AuthProvider, null, React.createElement(Probe))); });
  await act(async () => { expect(await verifyCurrentPassword('self', 'fixture-current')).toBeNull(); });
  await act(async () => { expect(await authContext.updatePassword('fixture-new')).toBeNull(); });
  expect(authContext.user.id).toBe('self');
  expect(require('../src/consents/access').getConsentAccess().userId).toBe('self');
  expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  expect(supabase.auth.signOut).not.toHaveBeenCalled();
});
it('creates isolated clients without persistent sessions, URL login, auto refresh or shared storage keys', () => {
  const { createClient } = require('@supabase/supabase-js');
  const actual = jest.requireActual('../src/lib/supabase');
  createClient.mockClear();
  actual.createPasswordVerificationAuth(); actual.createPasswordVerificationAuth();
  const options = createClient.mock.calls.map(call => call[2].auth);
  expect(options).toHaveLength(2);
  for (const option of options) expect(option).toMatchObject({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
  expect(options[0].storageKey).not.toBe(options[1].storageKey);
});

it('does not auto-save a pending signup profile when restoring an unconfirmed-consent session', async () => {
  const storage = require('@react-native-async-storage/async-storage');
  const { persistPendingSignupProfile } = require('../src/auth/pendingSignupProfile');
  const { saveMyPrivateProfile } = require('../src/lib/profile');
  await persistPendingSignupProfile(storage, { email: user.email, userId: user.id, bank: null, account: '', birth: { year: '', month: '', day: '' }, tastes: {} });
  function Probe() { authContext = useAuth(); return null; }
  await act(async () => { renderer = create(React.createElement(AuthProvider, null, React.createElement(Probe))); });
  expect(authContext.user.id).toBe('self');
  expect(saveMyPrivateProfile).not.toHaveBeenCalled();
  await storage.clear();
});
it.each(['event', 'explicit'])('removes pending account, birth and consent data on %s logout', async path => {
  const storage = require('@react-native-async-storage/async-storage');
  const { persistPendingSignupProfile, PENDING_SIGNUP_PROFILE_KEY } = require('../src/auth/pendingSignupProfile');
  const { PENDING_SIGNUP_CONSENTS_KEY } = require('../src/auth/pendingSignupConsents');
  await persistPendingSignupProfile(storage, { email: user.email, userId: user.id, bank: '은행', account: '1234', birth: { year: '2000', month: '1', day: '1' }, tastes: {} });
  await storage.setItem(PENDING_SIGNUP_CONSENTS_KEY, '{}');
  let changed;
  supabase.auth.onAuthStateChange.mockImplementation(callback => { changed = callback; return { data: { subscription: { unsubscribe: jest.fn() } } }; });
  supabase.auth.signOut.mockResolvedValue({ error: null });
  function Probe() { authContext = useAuth(); return null; }
  await act(async () => { renderer = create(React.createElement(AuthProvider, null, React.createElement(Probe))); });
  await act(async () => { if (path === 'event') changed('SIGNED_OUT', null); else await authContext.signOut(); });
  expect(await storage.getItem(PENDING_SIGNUP_PROFILE_KEY)).toBeNull(); expect(await storage.getItem(PENDING_SIGNUP_CONSENTS_KEY)).toBeNull();
});

it('keeps optional consent choices and health data out of Auth signup metadata', async () => {
  supabase.auth.signUp = jest.fn(async () => ({ data: { user, session: null }, error: null }));
  function Probe() { authContext = useAuth(); return null; }
  await act(async () => { renderer = create(React.createElement(AuthProvider, null, React.createElement(Probe))); });
  await act(async () => authContext.signUpWithEmail({ email: user.email, password: 'fixture-password', displayName: '테스트', marketingOptIn: true }));
  expect(supabase.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: { data: { name: '테스트' }, emailRedirectTo: 'auth/callback' } }));
});

it('preserves only the legacy marketing metadata choice after an explicit missing-function probe', async () => {
  const { configureS1RpcTransport, fetchConsentManifest } = require('../src/lib/consents');
  const { setConsentAccess } = require('../src/consents/access');
  setConsentAccess(user.id, 'loading');
  configureS1RpcTransport(async () => ({ data: null, error: { code: 'PGRST202' } }), require('./fixtures/s1').isolatedCapabilityStorage());
  try {
    await fetchConsentManifest();
    supabase.auth.signUp = jest.fn(async () => ({ data: { user, session: null }, error: null }));
    function Probe() { authContext = useAuth(); return null; }
    await act(async () => { renderer = create(React.createElement(AuthProvider, null, React.createElement(Probe))); });
    await act(async () => authContext.signUpWithEmail({ email: user.email, password: 'fixture-password', displayName: '테스트', marketingOptIn: true }));
    expect(supabase.auth.signUp.mock.calls[0][0].options.data).toEqual({ name: '테스트', marketing_opt_in: true });
  } finally { configureS1RpcTransport(); }
});
