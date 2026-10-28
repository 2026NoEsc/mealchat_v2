import { createS1Fixture } from '../../tests/fixtures/s1';
import { configureS1RpcTransport, parseVisibility, requestS1 } from '../../src/lib/consents';
import { setConsentAccess } from '../../src/consents/access';
import { privacyRevisionPublication, resolvePrivacyRevisionPublication } from '../../src/legal/privacyRevision';
import type { Settlement, SettlementPayment } from '../../src/lib/settlements';
export { canEditSettlement, settlementMutationErrorMessage } from '../../src/lib/settlementAccess';

/** Isolated synthetic fixtures. No Supabase, dotenv, real accounts or remote writes. */
export const scene = new URLSearchParams(globalThis.location?.search).get('scene') ?? 'signup';
const legacy = ['legacy-privacy', 'notice', 'notice-changes'].includes(scene);
// Synthetic date exists only in the offline preview. Production metadata stays unfinalized.
if (scene.startsWith('notice')) Object.assign(privacyRevisionPublication, resolvePrivacyRevisionPublication('2026-10-25'));
export const fixture = createS1Fixture(scene !== 'signup' && scene !== 'reconsent' && scene !== 'gate-error');
const base = fixture.status;
if (scene === 'optional' || scene === 'reconsent') fixture.status = {
  ...base,
  health: { status: 'granted', document_version: fixture.manifest.documents.health.version, granted_at: base.server_time, valid_until: '2027-10-17T00:00:00Z', revision: '2' },
  marketing: { status: 'granted', document_version: fixture.manifest.documents.marketing.version, granted_at: '2024-10-17T00:00:00Z', next_confirmation_at: base.server_time, confirmation_due: true, sending_enabled: false, revision: '4' },
};
fixture.visibility = { settings: { birthdate: 'private', gender: 'public', bio: 'private', bank_account: 'private', origin: 'private' }, revision: '3' };
configureS1RpcTransport((name, args) => legacy ? Promise.resolve(name === 'get_consent_manifest'
  ? { data: null, error: { code: 'PGRST202', status: 404 } } : { data: [{ version: 'legacy-fixture', agreed: true }], error: null })
  : name === 'get_settlement_payment_details' ? paymentResponse(args)
  : scene === 'gate-error' && name.startsWith('get_') ? Promise.resolve({ data: null, error: { code: 'S1006' } }) : fixture.rpc(name, args));
setConsentAccess('s1-fixture-user', scene === 'gate-error' ? 'error' : scene === 'reconsent' ? 'required' : 'accepted');
Reflect.set(globalThis, '__s1FixtureCalls', fixture.calls);
export const useAuth = () => ({ user: { id: 's1-fixture-user', email: 'fixture@example.test' }, signOut: async () => null, signUpWithEmail: async () => ({ error: null, confirmationRequired: true, userId: 's1-fixture-user' }) });
export const useNotifications = () => ({ hasUnread: false, open: () => {} });
export const useMyProfile = () => ({ userId: 's1-fixture-user', status: 'ready', reload: () => {}, bundle: {
  profile: { id: 's1-fixture-user', name: '밀챗', tag: 'user-00000000', avatarUrl: null, avatarColor: '' },
  privateProfile: { birthDate: '2000-01-02', bankName: scene.startsWith('payment-') ? '카카오뱅크' : null, accountNumber: scene.startsWith('payment-') ? '11112222' : null, personalData: { gender: 'male' }, privacySettings: { bank_account: 'private' }, tastes: {}, startLocationName: null, startLat: null, startLng: null },
} });
export const fetchProfileVisibility = () => requestS1('get_my_profile_visibility', {}, parseVisibility);
export const setProfileVisibility = (field: string, visibility: string, revision: string) => requestS1('set_profile_visibility', { p_field: field, p_visibility: visibility, p_expected_revision: revision }, parseVisibility);
export const saveMyPrivateProfile = async () => null;

export const paymentBill: Settlement = {
  id: 'payment-fixture', roomId: 'fixture-room', creatorId: 'fixture-mate', roomTitle: '저녁 약속', title: '식사 정산', totalAmount: 52000, splitCount: 4, createdAt: '2026-10-17T00:00:00Z',
  members: [{ id: 'member-self', profileId: 's1-fixture-user', name: '밀챗', isCompleted: scene === 'payment-completed' }, { id: 'member-mate', profileId: 'fixture-mate', name: '모아', isCompleted: true }],
};
function paymentResponse(args: Record<string, unknown>) {
  fixture.calls.push({ name: 'get_settlement_payment_details', args });
  const status = scene === 'payment-unavailable' ? 'unavailable' : scene === 'payment-closed-debt' || scene === 'payment-completed' ? 'completed' : 'open';
  return Promise.resolve({ data: scene === 'payment-error' ? null : { bill_id: 'payment-fixture', status,
    payment_details: status === 'open' ? { bank_name: '카카오뱅크', account_number: '3333-01-2345678', account_holder: '모아' } : null,
    hidden_reason: status === 'open' ? null : status, server_time: '2026-10-17T00:00:00Z' }, error: scene === 'payment-error' ? { code: 'S1006' } : null });
}
export const fetchMySettlementsDetailed = async () => ({ data: [paymentBill], error: null });
export const fetchRoomSettlements = async () => ({ data: scene === 'payment-request' ? [] : [paymentBill], error: null });
export const fetchSettlementPaymentDetails = (billId: string) => requestS1('get_settlement_payment_details', { p_bill_id: billId }, value => {
  const raw = value as { status: SettlementPayment['status']; payment_details: { bank_name: string; account_number: string; account_holder: string } | null };
  return { billId, status: raw.status, details: raw.payment_details ? { bankName: raw.payment_details.bank_name, accountNumber: raw.payment_details.account_number, accountHolder: raw.payment_details.account_holder } : null };
});
export const subscribeSettlementPayments = () => () => {};
export const createRoomSettlement = async () => ({ billId: 'payment-fixture', error: null });
export const setSettlementCompleted = async () => null;
