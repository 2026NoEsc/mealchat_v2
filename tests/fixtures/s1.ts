import documents from '../../src/legal/documents.generated.json';
import type { ConsentManifest, ConsentStatus, ProfileVisibility } from '../../src/consents/contracts';
import type { S1RpcTransport } from '../../src/lib/consents';
export function isolatedCapabilityStorage(initial: string | null = null) {
  let value = initial;
  return { async getItem() { return value; }, async setItem(_key: string, next: string) { value = next; } };
}

/** Synthetic contract fixtures only. Never imported by the production app. */
export const s1Manifest: ConsentManifest = {
  contract_version: 1, bundle_version: 'mealchat-2026-10-01-r1', effective_from: '2026-09-30T15:00:00Z',
  change_summary: '서비스 약관 2판 및 개인정보 처리방침 1판 동의', documents, server_time: '2026-10-17T00:00:00Z',
};
export function s1Status(accepted = false): ConsentStatus {
  return {
    contract_version: 1, bundle_version: s1Manifest.bundle_version,
    required: { status: accepted ? 'accepted' : 'required', service_agreed: accepted, privacy_agreed: accepted },
    health: { status: 'not_asked', document_version: null, granted_at: null, valid_until: null, revision: '0' },
    marketing: { status: 'not_asked', document_version: null, granted_at: null, next_confirmation_at: null, confirmation_due: false, sending_enabled: false, revision: '0' },
    server_time: s1Manifest.server_time,
  };
}
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
export function createS1Fixture(accepted = false) {
  let status = s1Status(accepted);
  let manifest = clone(s1Manifest);
  let visibility: ProfileVisibility = { settings: { birthdate: 'private', gender: 'private', bio: 'private', bank_account: 'private', origin: 'private' }, revision: '0' };
  let food = { schema_version: 1, preferences: {} as Record<string, boolean>, revision: '0' };
  const requests = new Map<string, string>();
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const rpc: S1RpcTransport = async (name, args) => {
    calls.push({ name, args: clone(args) });
    const fail = (code: string) => ({ data: null, error: { code, message: 'synthetic private diagnostic' } });
    if (name === 'get_consent_manifest') return { data: clone(manifest), error: null };
    if (name === 'get_my_consent_status') return { data: clone(status), error: null };
    if (name === 'get_my_profile_visibility') return { data: clone(visibility), error: null };
    if (name === 'set_profile_visibility') {
      if (args.p_expected_revision !== visibility.revision) return fail('S1004');
      const field = args.p_field as keyof typeof visibility.settings;
      if (!(field in visibility.settings) || !['public', 'private'].includes(String(args.p_visibility))) return fail('22023');
      if (visibility.settings[field] !== args.p_visibility) visibility = { settings: { ...visibility.settings, [field]: args.p_visibility }, revision: String(BigInt(visibility.revision) + 1n) };
      return { data: clone(visibility), error: null };
    }
    if (name === 'get_my_food_preferences') return { data: clone(food), error: null };
    if (name === 'save_my_food_preferences') {
      if (args.p_expected_revision !== food.revision) return fail('S1004');
      food = { ...food, preferences: args.p_preferences as Record<string, boolean>, revision: String(BigInt(food.revision) + 1n) };
      return { data: clone(food), error: null };
    }
    const requestId = String(args.p_request_id);
    const payload = JSON.stringify([name, args]);
    if (requests.has(requestId) && requests.get(requestId) !== payload) return fail('S1007');
    const replay = requests.has(requestId);
    if (name === 'complete_signup_consents' || name === 'record_required_consents') {
      const selected = args.p_choices as Record<string, boolean>, refs = args.p_documents as Record<string, { version: string; content_hash: string }>;
      const kinds = name === 'complete_signup_consents' ? ['service', 'privacy', 'health', 'marketing'] as const : ['service', 'privacy'] as const;
      if (!selected?.service || !selected?.privacy || Object.keys(selected).length !== kinds.length || Object.keys(refs).length !== kinds.length) return fail('22023');
      if (args.p_bundle_version !== manifest.bundle_version || kinds.some(kind => refs[kind]?.version !== manifest.documents[kind].version || refs[kind]?.content_hash !== manifest.documents[kind].content_hash)) return fail('S1002');
      if (!replay) {
        if (name === 'complete_signup_consents' && (status.health.revision !== '0' || status.marketing.revision !== '0')) return fail('S1004');
        status.required = { status: 'accepted', service_agreed: true, privacy_agreed: true };
        if (name === 'complete_signup_consents') {
          status.health = { status: selected.health ? 'granted' : 'declined', document_version: documents.health.version, granted_at: selected.health ? status.server_time : null, valid_until: selected.health ? '2027-10-17T00:00:00Z' : null, revision: '1' };
          status.marketing = { status: selected.marketing ? 'granted' : 'declined', document_version: documents.marketing.version, granted_at: selected.marketing ? status.server_time : null, next_confirmation_at: selected.marketing ? '2028-10-17T00:00:00Z' : null, confirmation_due: false, sending_enabled: false, revision: '1' };
        }
        requests.set(requestId, payload);
      }
      return { data: clone(status), error: null };
    }
    if (name === 'set_optional_consent') {
      const kind = args.p_kind as 'health' | 'marketing', grant = args.p_action === 'grant';
      if (!['health', 'marketing'].includes(kind)) return fail('22023');
      if (grant && status.required.status !== 'accepted') return fail('S1001');
      if (grant && (args.p_document_version !== manifest.documents[kind].version || args.p_content_hash !== manifest.documents[kind].content_hash)) return fail('S1002');
      if (grant && args.p_expected_revision !== status[kind].revision && !replay) return fail('S1004');
      if (!replay) {
        const base = { status: grant ? 'granted' : 'withdrawn', document_version: grant ? manifest.documents[kind].version : status[kind].document_version, granted_at: grant ? status.server_time : null, revision: String(BigInt(status[kind].revision) + 1n) } as const;
        if (kind === 'health') status.health = { ...base, valid_until: grant ? '2027-10-17T00:00:00Z' : null };
        else status.marketing = { ...base, next_confirmation_at: grant ? '2028-10-17T00:00:00Z' : null, confirmation_due: false, sending_enabled: false };
        requests.set(requestId, payload);
      }
      return { data: { kind, ...clone(status[kind]), valid_until: kind === 'health' ? status.health.valid_until : null, next_confirmation_at: kind === 'marketing' ? status.marketing.next_confirmation_at : null, data_deleted: kind === 'health' && status.health.status !== 'granted', server_time: status.server_time }, error: null };
    }
    return fail('S1006');
  };
  return { rpc, calls, get status() { return status; }, set status(value: ConsentStatus) { status = clone(value); }, get manifest() { return manifest; }, set manifest(value: ConsentManifest) { manifest = clone(value); }, get visibility() { return visibility; }, set visibility(value: ProfileVisibility) { visibility = clone(value); } };
}
