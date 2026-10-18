const React = require('react');
const { act, create } = require('react-test-renderer');
const { AppState } = require('react-native');
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../src/lib/profile', () => ({ saveMyPrivateProfile: jest.fn(async () => null) }));
const storage = require('@react-native-async-storage/async-storage');
const { useAuth } = require('../src/auth/AuthProvider');
const { useConsentGate } = require('../src/consents/useConsentGate');
const { configureS1RpcTransport } = require('../src/lib/consents');
const { getConsentAccess, setConsentAccess } = require('../src/consents/access');
const { consentSubmission } = require('../src/legal/manifest');
const { newConsentRequestId } = require('../src/consents/contracts');
const { persistPendingSignupConsents, readPendingSignupConsents, PENDING_SIGNUP_CONSENTS_KEY, PENDING_SIGNUP_CONSENTS_TTL_MS } = require('../src/auth/pendingSignupConsents');
const { persistPendingSignupProfile } = require('../src/auth/pendingSignupProfile');
const { saveMyPrivateProfile } = require('../src/lib/profile');
const { createS1Fixture, s1Manifest, s1Status } = require('./fixtures/s1');
let renderer, gate, user, fixture, foreground;
function Probe() { gate = useConsentGate(); return null; }
beforeEach(async () => {
  saveMyPrivateProfile.mockReset().mockResolvedValue(null);
  jest.clearAllMocks(); await storage.clear(); setConsentAccess(null, 'loading');
  user = { id: 'self', email: 'fixture@example.test' }; useAuth.mockImplementation(() => ({ user }));
  fixture = createS1Fixture(); configureS1RpcTransport(fixture.rpc, require('./fixtures/s1').isolatedCapabilityStorage());
  jest.spyOn(AppState, 'addEventListener').mockImplementation((name, callback) => { foreground = callback; return { remove: jest.fn() }; });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount()); renderer = undefined;
  configureS1RpcTransport(); setConsentAccess(null, 'loading'); jest.restoreAllMocks(); jest.useRealTimers();
});
async function mount() { await act(async () => { renderer = create(React.createElement(Probe)); }); }
async function queue(overrides = {}) {
  const pending = { email: user.email, userId: user.id, savedAt: Date.now(), submission: consentSubmission(s1Manifest, { service: true, privacy: true, health: false, marketing: false }, newConsentRequestId()), ...overrides };
  await persistPendingSignupConsents(storage, pending); return pending;
}
it.each(['empty', 'returned', 'thrown', 'configuration'])('keeps a failed or unknown status behind the error gate (%s)', async mode => {
  configureS1RpcTransport(async name => {
    if (name === 'get_consent_manifest') return { data: s1Manifest, error: null };
    if (mode === 'thrown') throw new Error('private diagnostic');
    return { data: null, error: mode === 'empty' ? null : { code: mode === 'configuration' ? 'S1006' : 'XX000' } };
  });
  await mount(); expect(gate.state).toBe('error'); expect(gate.needsConsent).toBe(true); expect(getConsentAccess().state).toBe('error');
  expect(saveMyPrivateProfile).not.toHaveBeenCalled();
});
it('opens only after an accepted response and rechecks on foreground instead of trusting a cache', async () => {
  fixture.status = s1Status(true); await mount(); expect(gate.state).toBe('accepted');
  fixture.status = s1Status(false); await act(async () => foreground('active'));
  expect(gate.state).toBe('required'); expect(gate.needsConsent).toBe(true);
});
it('does not open on markConsented without a subsequent accepted status', async () => {
  await mount(); expect(gate.state).toBe('required');
  await act(async () => gate.markConsented()); expect(gate.state).toBe('required');
});
it('rechecks a required snapshot when concurrent signup has already completed and cleared pending', async () => {
  let first = true;
  configureS1RpcTransport(async (name, args) => {
    if (name === 'get_my_consent_status' && first) {
      first = false; const stale = s1Status(false); fixture.status = s1Status(true); return { data: stale, error: null };
    }
    return fixture.rpc(name, args);
  });
  await mount(); expect(gate.state).toBe('accepted'); expect(gate.signupReview).toBe(false);
});
it('keeps another account behind loading and ignores an old in-flight acceptance', async () => {
  let finish;
  configureS1RpcTransport(async name => name === 'get_consent_manifest' ? { data: s1Manifest, error: null } : new Promise(resolve => { finish = resolve; }));
  await mount(); expect(gate.state).toBe('loading'); const oldFinish = finish;
  user = { id: 'other', email: 'other@example.test' };
  await act(async () => renderer.update(React.createElement(Probe)));
  await act(async () => oldFinish({ data: s1Status(true), error: null }));
  expect(gate.state).toBe('loading'); expect(getConsentAccess().userId).toBe('other');
  await act(async () => finish({ data: s1Status(false), error: null }));
  expect(gate.state).toBe('loading'); // Required snapshots get one final concurrent-signup check.
  await act(async () => finish({ data: s1Status(false), error: null })); expect(gate.state).toBe('required');
});
it('completes matching pending signup before storing personal data, using the original request id', async () => {
  const pending = await queue();
  await persistPendingSignupProfile(storage, { email: user.email, userId: user.id, bank: null, account: '', birth: { year: '', month: '', day: '' }, tastes: { korean: true } });
  saveMyPrivateProfile.mockImplementation(async () => { expect(fixture.status.required.status).toBe('accepted'); expect(getConsentAccess().state).toBe('accepted'); return null; });
  await mount(); expect(gate.state).toBe('accepted');
  expect(fixture.calls.find(call => call.name === 'complete_signup_consents').args.p_request_id).toBe(pending.submission.p_request_id);
  expect(saveMyPrivateProfile).toHaveBeenCalledTimes(1); expect(await readPendingSignupConsents(storage)).toBeNull();
});
it.each(['wrong-id', 'wrong-email', 'expired', 'document-changed', 'already-changed', 'unbound'])('does not replay unsafe pending signup (%s)', async mode => {
  const overrides = mode === 'wrong-id' ? { userId: 'other' } : mode === 'wrong-email' ? { email: 'other@example.test' } : mode === 'expired' ? { savedAt: Date.now() - PENDING_SIGNUP_CONSENTS_TTL_MS - 1 } : {};
  const queued = await queue(overrides);
  if (mode === 'unbound') await storage.setItem(PENDING_SIGNUP_CONSENTS_KEY, JSON.stringify({ ...queued, userId: null }));
  if (mode === 'document-changed') fixture.manifest = { ...fixture.manifest, bundle_version: 'new-bundle' }, fixture.status = { ...fixture.status, bundle_version: 'new-bundle' };
  if (mode === 'already-changed') fixture.status = { ...fixture.status, health: { ...fixture.status.health, revision: '1', status: 'withdrawn' } };
  await mount(); expect(gate.state).toBe('required');
  expect(fixture.calls.some(call => call.name === 'complete_signup_consents')).toBe(false);
  expect(await storage.getItem(PENDING_SIGNUP_CONSENTS_KEY)).toBeNull();
  if (mode === 'expired') expect(gate.signupReview).toBe(true);
});
it('does not flush or remove B pending profile after an A storage read completes late', async () => {
  const { completePendingProfile } = require('../src/auth/completePendingProfile');
  const pending = { email: user.email, userId: user.id, bank: null, account: '', birth: {}, tastes: {}, savedAt: Date.now() };
  let finish;
  storage.getItem.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  setConsentAccess('self', 'accepted'); const work = completePendingProfile(user);
  setConsentAccess('other', 'accepted'); finish(JSON.stringify(pending)); await work;
  expect(saveMyPrivateProfile).not.toHaveBeenCalled();
  expect(storage.removeItem).not.toHaveBeenCalled();
});
it('deletes a pending personal profile immediately after its accepted save succeeds', async () => {
  const { completePendingProfile } = require('../src/auth/completePendingProfile');
  const { PENDING_SIGNUP_PROFILE_KEY } = require('../src/auth/pendingSignupProfile');
  await persistPendingSignupProfile(storage, { email: user.email, userId: user.id, bank: '은행', account: '1234', birth: { year: '2000', month: '1', day: '1' }, tastes: {} });
  setConsentAccess('self', 'accepted'); await completePendingProfile(user);
  expect(await storage.getItem(PENDING_SIGNUP_PROFILE_KEY)).toBeNull();
});
it('retains pending request identity across a lost response and replays idempotently', async () => {
  const pending = await queue(); let lost = true;
  configureS1RpcTransport(async (name, args) => {
    const result = await fixture.rpc(name, args);
    if (name === 'complete_signup_consents' && lost) { lost = false; throw new Error('response lost'); }
    return result;
  });
  await mount(); expect(gate.state).toBe('error');
  expect((await readPendingSignupConsents(storage)).submission.p_request_id).toBe(pending.submission.p_request_id);
  await act(async () => gate.reload()); expect(gate.state).toBe('accepted'); expect(await readPendingSignupConsents(storage)).toBeNull();
  expect(fixture.status.health.revision).toBe('1');
});
it('stores only explicit metadata, never passwords, tokens, or health payloads', async () => {
  const pending = await queue();
  await persistPendingSignupConsents(storage, { ...pending, password: 'fixture-secret', allergies: ['fixture-allergy'], token: 'fixture-token', submission: { ...pending.submission, token: 'fixture-token' } });
  const raw = await storage.getItem(PENDING_SIGNUP_CONSENTS_KEY);
  expect(raw).not.toMatch(/password|allergies|token|fixture-secret|fixture-allergy/);
});

it('leaves the spinner for an actionable error gate even if local pending storage hangs', async () => {
  jest.useFakeTimers();
  storage.getItem.mockImplementationOnce(() => new Promise(() => {}));
  await mount(); expect(gate.state).toBe('loading');
  await act(async () => jest.advanceTimersByTimeAsync(15001));
  expect(gate.state).toBe('error'); expect(gate.needsConsent).toBe(true);
});

it.each(['missing-id', 'wrong-id'])('never applies %s pending personal fields even to the same email account', async mode => {
  const { PENDING_SIGNUP_PROFILE_KEY } = require('../src/auth/pendingSignupProfile');
  const pending = { email: user.email, savedAt: Date.now(), bank: '은행', account: 'fixture-account', birth: { year: '2000', month: '1', day: '1' }, tastes: { korean: true }, ...(mode === 'wrong-id' ? { userId: 'other' } : {}) };
  await storage.setItem(PENDING_SIGNUP_PROFILE_KEY, JSON.stringify(pending)); fixture.status = s1Status(true);
  await mount(); expect(gate.state).toBe('accepted'); expect(saveMyPrivateProfile).not.toHaveBeenCalled();
  expect(await storage.getItem(PENDING_SIGNUP_PROFILE_KEY)).toBeNull();
});
