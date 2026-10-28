jest.mock('../src/lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn(async () => ({ data: { session: { user: { id: require('../src/consents/access').getConsentAccess().userId } } }, error: null })) }, from: jest.fn(), rpc: jest.fn(async () => ({ data: null, error: { code: 'XX000' } })) } }));
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { canonicalLegalDocument, parseLegalDocument } from '../src/legal/canonical';
import generated from '../src/legal/documents.generated.json';
import { terms } from '../src/legal/terms';
import { manifestDocument, consentSubmission } from '../src/legal/manifest';
import { configureS1RpcTransport, fetchConsentStatus, fetchConsentManifest, completeSignupConsents, recordRequiredConsents, setOptionalConsent, parseConsentStatus } from '../src/lib/consents';
import { setConsentAccess, getConsentAccess, registerSensitiveConsentClearer, subscribeConsentAccess } from '../src/consents/access';
import { newConsentRequestId } from '../src/consents/contracts';
import { normalizePrivacySettings, fetchProfileVisibility, setProfileVisibility, saveTastes, fetchMyProfile, saveMyGender } from '../src/lib/profile';
import { supabase } from '../src/lib/supabase';
import { createS1Fixture, s1Manifest, s1Status } from './fixtures/s1';
import { isolatedCapabilityStorage } from './fixtures/s1';
beforeEach(() => configureS1RpcTransport(undefined, isolatedCapabilityStorage()));
it.each(['context', 'session'])('never saves A food data after the %s switches to B during the read', async mode => {
  setConsentAccess('self', 'accepted');
  let finish!: (value: { data: unknown; error: null }) => void;
  const calls: string[] = [];
  configureS1RpcTransport(async name => { calls.push(name); return new Promise(resolve => { finish = resolve; }); });
  const saving = saveTastes('self', { korean: true });
  if (mode === 'context') setConsentAccess('other', 'accepted');
  else (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({ data: { session: { user: { id: 'other' } } }, error: null });
  finish({ data: { schema_version: 1, preferences: {}, revision: '0' }, error: null });
  expect(await saving).toMatchObject({ code: 'S1001' });
  expect(calls).toEqual(['get_my_food_preferences']);
});

afterEach(() => { configureS1RpcTransport(); setConsentAccess(null, 'loading'); jest.useRealTimers(); });
it('reproduces all four canonical hashes and checks the generated seed artifact without writing', () => {
  for (const document of Object.values(generated)) {
    expect(createHash('sha256').update(document.canonical_content, 'utf8').digest('hex')).toBe(document.content_hash);
    expect(canonicalLegalDocument(parseLegalDocument(document.canonical_content))).toBe(document.canonical_content);
  }
  expect(generated.service.content_hash).toBe('81ba373c21fafc5711b47013b32f7e9b37150100d84d49e937711524b38ba0cf');
  expect(generated.privacy.content_hash).toBe('a2764f66fb163ef85e97072b4fc829b6ae44605c573b90336a0162be6e47c460');
  expect(execFileSync(process.execPath, ['scripts/generate-legal-hashes.mjs', '--check'], { encoding: 'utf8' })).toContain(generated.health.content_hash);
});
it('normalizes line endings and NFC but preserves spaces and section/paragraph ordering', () => {
  const doc = { ...terms, title: 'e\u0301\r\n x\r' };
  expect(canonicalLegalDocument(doc)).toContain('é\\n x\\n');
  expect(canonicalLegalDocument({ ...doc, title: 'é\n x\n' })).toBe(canonicalLegalDocument(doc));
  expect(canonicalLegalDocument({ ...doc, title: 'é\nx\n' })).not.toBe(canonicalLegalDocument(doc));
  expect(canonicalLegalDocument({ ...terms, sections: [...terms.sections].reverse() })).not.toBe(canonicalLegalDocument(terms));
});
it('renders server canonical content when its hash differs from the bundled document', () => {
  const changed = JSON.parse(JSON.stringify(s1Manifest));
  const doc = { ...terms, title: '새 원문', edition: 3 };
  changed.documents.service = { ...changed.documents.service, version: 'service-test-v3', edition: 3, canonical_content: canonicalLegalDocument(doc), content_hash: 'a'.repeat(64) };
  expect(manifestDocument(changed, 'service').title).toBe('새 원문');
});
it('uses the live adapter by default without fabricating acceptance on a failed RPC', async () => {
  expect((await fetchConsentManifest()).error).toMatchObject({ code: 'S1006' });
  expect((await fetchConsentStatus()).data).toBeNull();
});
it.each([null, {}, [], { version: null, agreed: true }])('rejects empty/legacy status instead of opening the gate (%j)', async value => {
  configureS1RpcTransport(async () => ({ data: value, error: null }));
  setConsentAccess('self', 'accepted');
  expect((await fetchConsentStatus()).error).toBeTruthy();
  expect(getConsentAccess().state).toBe('error');
});
it('uses direct JSON RPC data, four explicit signup choices and required-only reconsent', async () => {
  const mock = createS1Fixture(); configureS1RpcTransport(mock.rpc);
  const manifest = (await fetchConsentManifest()).data!;
  const signup = consentSubmission(manifest, { service: true, privacy: true, health: false, marketing: false }, newConsentRequestId());
  expect((await completeSignupConsents(signup)).data?.required.status).toBe('accepted');
  const before = JSON.stringify([mock.status.health, mock.status.marketing]);
  const required = consentSubmission(manifest, { service: true, privacy: true, health: true, marketing: true }, newConsentRequestId(), true);
  expect(Object.keys(required.p_choices)).toEqual(['service', 'privacy']);
  expect(Object.keys(required.p_documents)).toEqual(['service', 'privacy']);
  expect((await recordRequiredConsents(required)).error).toBeNull();
  expect(JSON.stringify([mock.status.health, mock.status.marketing])).toBe(before);
  expect(mock.calls[0]).toEqual({ name: 'get_consent_manifest', args: {} });
});
it('keeps pre-S1 profile/taste reads and writes on their existing table contract', async () => {
  const calls: string[] = [];
  configureS1RpcTransport(async name => { calls.push(name); return { data: null, error: { code: 'PGRST202' } }; });
  setConsentAccess('self', 'accepted'); await fetchConsentManifest();
  const query = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn(), update: jest.fn() };
  query.select.mockReturnValue(query); query.update.mockReturnValue(query); query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValueOnce({ data: { id: 'self', name: '테스트', tag: 'test', avatar_color: '', avatar_url: null }, error: null })
    .mockResolvedValueOnce({ data: { tastes: { korean: true, allergy: true }, personal_data: {} }, error: null });
  (supabase.from as jest.Mock).mockReturnValue(query);
  const result = await fetchMyProfile('self');
  expect(result.error).toBeNull(); expect(result.data?.privateProfile.tastes).toEqual({ korean: true });
  expect(query.select.mock.calls[1][0]).toContain(', tastes');
  query.eq.mockResolvedValue({ error: null });
  expect(await saveTastes('self', { korean: false })).toBeNull();
  expect(query.update).toHaveBeenCalledWith({ tastes: { korean: false } });
  expect((await setProfileVisibility('gender', 'public', '0')).error).toMatchObject({ code: 'S1_UNAVAILABLE' });
  expect(calls).toEqual(['get_consent_manifest']);
});
it('retains current withdrawal on an old grant replay and rejects changed-payload reuse', async () => {
  const mock = createS1Fixture(true); configureS1RpcTransport(mock.rpc);
  const grant = { p_request_id: newConsentRequestId(), p_kind: 'health' as const, p_action: 'grant' as const, p_document_version: generated.health.version, p_content_hash: generated.health.content_hash, p_expected_revision: '0', p_source: 'settings' as const };
  expect((await setOptionalConsent(grant)).data?.status).toBe('granted');
  const withdraw = { ...grant, p_request_id: newConsentRequestId(), p_action: 'withdraw' as const, p_document_version: null, p_content_hash: null, p_expected_revision: null };
  expect((await setOptionalConsent(withdraw)).data).toMatchObject({ status: 'withdrawn', data_deleted: true, valid_until: null });
  expect((await setOptionalConsent(grant)).data?.status).toBe('withdrawn');
  expect((await setOptionalConsent({ ...withdraw, p_action: 'decline' })).error).toMatchObject({ code: 'S1007' });
});
it('allows null-document withdrawal during pending/error and clears sensitive caches only after success', async () => {
  const mock = createS1Fixture(); configureS1RpcTransport(mock.rpc); setConsentAccess('self', 'error');
  const clear = jest.fn(), unsubscribe = registerSensitiveConsentClearer(clear);
  const input = { p_request_id: newConsentRequestId(), p_kind: 'health' as const, p_action: 'withdraw' as const, p_document_version: null, p_content_hash: null, p_expected_revision: null, p_source: 'settings' as const };
  configureS1RpcTransport(async () => ({ data: null, error: { code: 'XX000' } }));
  await setOptionalConsent(input); expect(clear).not.toHaveBeenCalled();
  configureS1RpcTransport(mock.rpc); await setOptionalConsent(input); expect(clear).toHaveBeenCalledTimes(1); unsubscribe();
});
it('treats health expiry at server time as expired and keeps marketing due granted/sending disabled', () => {
  const status = s1Status(true);
  status.health = { status: 'granted', document_version: generated.health.version, granted_at: '2025-10-17T00:00:00Z', valid_until: status.server_time, revision: '3' };
  status.marketing = { status: 'granted', document_version: generated.marketing.version, granted_at: '2024-10-17T00:00:00Z', next_confirmation_at: status.server_time, confirmation_due: true, sending_enabled: false, revision: '2' };
  expect(parseConsentStatus(status).health.status).toBe('expired');
  expect(parseConsentStatus(status).marketing).toMatchObject({ status: 'granted', confirmation_due: true, sending_enabled: false });
});
it('normalizes aliases conservatively and defaults all five fields to private', () => {
  expect(Object.values(normalizePrivacySettings({}))).toEqual(Array(5).fill('private'));
  expect(normalizePrivacySettings({ birth: 'public', birthdate: 'private', account: 'public', unknown: 'public' })).toEqual({ birthdate: 'private', gender: 'private', bio: 'private', bank_account: 'public', origin: 'private' });
  expect(normalizePrivacySettings({ birthdate: 'public', birth: 'bogus' }).birthdate).toBe('private');
});
it('uses a single field and decimal revision, conflicts without overwrite, and does not touch settlements', async () => {
  const mock = createS1Fixture(true); configureS1RpcTransport(mock.rpc); setConsentAccess('self', 'accepted');
  expect((await fetchProfileVisibility()).data?.revision).toBe('0');
  expect((await setProfileVisibility('bank_account', 'public', '0')).data?.revision).toBe('1');
  expect((await setProfileVisibility('birthdate', 'public', '0')).error).toMatchObject({ code: 'S1004' });
  expect(mock.calls[1]).toEqual({ name: 'set_profile_visibility', args: { p_field: 'bank_account', p_visibility: 'public', p_expected_revision: '0' } });
  expect(mock.calls.every(call => !call.name.includes('settlement'))).toBe(true);
});
it('blocks data APIs before consent and rejects health/unknown keys from ordinary tastes', async () => {
  const mock = createS1Fixture(); configureS1RpcTransport(mock.rpc);
  expect((await fetchProfileVisibility()).error).toMatchObject({ code: 'S1001' });
  expect(mock.calls).toHaveLength(0);
  setConsentAccess('self', 'accepted');
  expect(await saveTastes('self', { allergy: true })).toMatchObject({ code: '22023' });
  expect(mock.calls).toHaveLength(0);
});
it('bounds a hanging status request and never grants access on timeout', async () => {
  jest.useFakeTimers(); configureS1RpcTransport(() => new Promise(() => {})); setConsentAccess('self', 'accepted');
  const request = fetchConsentStatus(); await jest.advanceTimersByTimeAsync(10001);
  expect((await request).error).toBeTruthy(); expect(getConsentAccess().state).toBe('error');
});

it('rejects unsupported contract versions with an update-required error', async () => {
  configureS1RpcTransport(async () => ({ data: { ...s1Manifest, contract_version: 2 }, error: null }));
  expect((await fetchConsentManifest()).error).toMatchObject({ code: 'S1008' });
});

it('still closes and notifies the gate when one cache cleanup fails', () => {
  const unsubscribeClear = registerSensitiveConsentClearer(() => { throw new Error('synthetic cleanup failure'); });
  const notify = jest.fn(), unsubscribe = subscribeConsentAccess(notify);
  setConsentAccess('self', 'required');
  expect(getConsentAccess().state).toBe('required'); expect(notify).toHaveBeenCalledTimes(1);
  unsubscribeClear(); unsubscribe();
});

it.each(['context', 'session'])('does not send a visibility write after the %s switches account', async mode => {
  setConsentAccess('self', 'accepted');
  let finish!: (value: unknown) => void;
  (supabase.auth.getSession as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const calls: string[] = []; configureS1RpcTransport(async name => { calls.push(name); return { data: null, error: null }; });
  const saving = setProfileVisibility('bank_account', 'public', '0');
  if (mode === 'context') setConsentAccess('other', 'accepted');
  finish({ data: { session: { user: { id: mode === 'session' ? 'other' : 'self' } } }, error: null });
  expect((await saving).error).toMatchObject({ code: 'S1001' }); expect(calls).toEqual([]);
});
it.each(['context', 'session'])('rechecks the %s owner immediately before a gender write after the read', async mode => {
  setConsentAccess('self', 'accepted');
  let finish!: (value: unknown) => void;
  const query = { select: jest.fn(), eq: jest.fn(), single: jest.fn(), update: jest.fn() };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
  query.single.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  (supabase.from as jest.Mock).mockReturnValueOnce(query);
  const saving = saveMyGender('self', 'male', 'none');
  if (mode === 'context') setConsentAccess('other', 'accepted');
  else (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({ data: { session: { user: { id: 'other' } } }, error: null });
  finish({ data: { personal_data: { gender: 'none', bio: '기존 소개' }, updated_at: '2026-10-17T00:00:00Z' }, error: null });
  expect(await saving).toMatchObject({ code: 'S1001' }); expect(query.update).not.toHaveBeenCalled();
});
