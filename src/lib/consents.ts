import { getConsentAccess, setConsentAccess, clearOptionalConsentData, subscribeConsentAccess } from '../consents/access';
import { CONSENT_KINDS, consentError, type ConsentManifest, type ConsentStatus, type ConsentSubmission, type OptionalSubmission, type OptionalConsentResult, type ProfileVisibility } from '../consents/contracts';
import { parseLegalDocument } from '../legal/canonical';

export type { ConsentStatus } from '../consents/contracts';
export type S1RpcTransport = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown; status?: number }>;
// Lazy import keeps isolated fixtures independent of runtime public configuration.
const liveTransport: S1RpcTransport = async (name, args) => {
  const { supabase } = await import('./supabase');
  return supabase.rpc(name, args);
};
let transport: S1RpcTransport = liveTransport;
export const S1_CONFIRMED_KEY = 'mealchat.consents.s1-confirmed.v1';
type CapabilityStorage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
const deviceStorage: CapabilityStorage = {
  async getItem(key) { return (await import('@react-native-async-storage/async-storage')).default.getItem(key); },
  async setItem(key, value) { await (await import('@react-native-async-storage/async-storage')).default.setItem(key, value); },
};
let capabilityStorage = deviceStorage;
let confirmedS1 = false;
export type ConsentServerMode = 'unknown' | 'legacy' | 's1';
type ManifestResult = { data: ConsentManifest | null; error: Error | null; legacy?: boolean };
const capabilities = new Map<string, { mode: ConsentServerMode; result: Promise<ManifestResult> }>();
const accountKey = () => getConsentAccess().userId ?? '__anonymous__';
export function getConsentServerMode(): ConsentServerMode { return confirmedS1 ? 's1' : capabilities.get(accountKey())?.mode ?? 'unknown'; }
const modeListeners = new Set<() => void>();
const knownModes = new Map<string, ConsentServerMode>();
/** UI-only snapshot: keep the last known mode during a foreground probe. RPC guards use the strict getter above. */
export function getConsentServerModeSnapshot(): ConsentServerMode {
  const mode = getConsentServerMode();
  return mode === 'unknown' ? knownModes.get(accountKey()) ?? 'unknown' : mode;
}
export function subscribeConsentServerMode(listener: () => void) {
  modeListeners.add(listener);
  const unsubscribe = subscribeConsentAccess(listener);
  return () => { modeListeners.delete(listener); unsubscribe(); };
}
function publishConsentServerMode() {
  const mode = getConsentServerMode();
  if (mode !== 'unknown') knownModes.set(accountKey(), mode);
  for (const listener of modeListeners) listener();
}
export function invalidateConsentServerMode() { capabilities.clear(); publishConsentServerMode(); }
export function configureS1RpcTransport(next?: S1RpcTransport, storage?: CapabilityStorage) {
  transport = next ?? liveTransport;
  // A replacement storage represents an isolated device in contract tests only.
  if (storage) { capabilityStorage = storage; confirmedS1 = false; knownModes.clear(); }
  invalidateConsentServerMode();
}
/** Only a missing manifest function permits fallback; a bare HTTP 404 is insufficient. */
export function isMissingConsentManifest(error: unknown): boolean {
  const item = error as { code?: string; status?: number; message?: string } | null;
  if (!item || (item.status !== undefined && item.status !== 404)) return false;
  return item.code === 'PGRST202' || (item.status === 404 && typeof item.message === 'string'
    && /^Could not find the function public\.get_consent_manifest\([^)]*\) in the schema cache\.?$/.test(item.message));
}
async function callRpc(name: string, args: Record<string, unknown>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([transport(name, args), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(consentError()), 10000);
    })]);
    // postgrest-js keeps HTTP status on the response, not on PostgrestError.
    const error = result.error as { code?: string; status?: number; message?: string } | null;
    return error ? { ...result, error: { code: error.code, message: error.message, status: result.status ?? error.status } } : result;
  } finally { if (timer) clearTimeout(timer); }
}
export async function requestS1<T>(name: string, args: Record<string, unknown>, validate: (value: unknown) => T): Promise<{ data: T | null; error: Error | null }> {
  const owner = getConsentAccess().userId;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (getConsentServerMode() === 'legacy') return { data: null, error: consentError('S1_UNAVAILABLE') };
    const result = await Promise.race([
      transport(name, args),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(consentError()), 10000); }),
    ]);
    if (result.error) {
      const code = (result.error as { code?: string }).code;
      if ((code === 'S1003' || code === 'S1005') && getConsentAccess().userId === owner) clearOptionalConsentData();
      if ((code === 'S1001' || code === 'S1006' || code === 'S1008' || name === 'get_my_consent_status') && getConsentAccess().userId === owner) {
        const { userId } = getConsentAccess();
        setConsentAccess(userId, code === 'S1001' ? 'required' : 'error');
      }
      return { data: null, error: consentError(code ?? 'S1006') };
    }
    const parsed = validate(result.data);
    if (name === 'get_my_consent_status' && (parsed as ConsentStatus).required.status === 'required' && getConsentAccess().userId === owner) setConsentAccess(owner, 'required');
    return { data: parsed, error: null };
  } catch (error) {
    if (name === 'get_my_consent_status' && getConsentAccess().userId === owner) setConsentAccess(owner, 'error');
    return { data: null, error: consentError((error as { code?: string } | null)?.code === 'S1008' ? 'S1008' : 'S1006') };
  }
  finally { if (timer) clearTimeout(timer); }
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw consentError();
  return value as Record<string, unknown>;
};
const revision = (value: unknown) => typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value);
const date = (value: unknown) => typeof value === 'string' && /(Z|\+00:00)$/.test(value) && Number.isFinite(Date.parse(value));
const nullableString = (value: unknown) => value === null || typeof value === 'string';
const statuses = ['not_asked', 'granted', 'declined', 'withdrawn', 'expired'];
export function parseConsentManifest(value: unknown): ConsentManifest {
  const item = object(value), documents = object(item.documents);
  if (item.contract_version !== 1) throw consentError('S1008');
  if (item.contract_version !== 1 || typeof item.bundle_version !== 'string' || !item.bundle_version || !date(item.effective_from) || !date(item.server_time) || typeof item.change_summary !== 'string') throw consentError();
  for (const kind of CONSENT_KINDS) {
    const document = object(documents[kind]);
    if (typeof document.version !== 'string' || !document.version || typeof document.content_hash !== 'string' || !/^[a-f0-9]{64}$/.test(document.content_hash) || !Number.isInteger(document.edition) || typeof document.canonical_content !== 'string') throw consentError();
    const legal = parseLegalDocument(document.canonical_content);
    if (legal.id !== (kind === 'service' ? 'terms' : kind) || legal.edition !== document.edition) throw consentError();
  }
  return value as ConsentManifest;
}
export function parseConsentStatus(value: unknown): ConsentStatus {
  const item = object(value), required = object(item.required), health = object(item.health), marketing = object(item.marketing);
  if (item.contract_version !== 1) throw consentError('S1008');
  if (item.contract_version !== 1 || typeof item.bundle_version !== 'string' || !item.bundle_version || !date(item.server_time) || !['accepted', 'required'].includes(String(required.status)) || typeof required.service_agreed !== 'boolean' || typeof required.privacy_agreed !== 'boolean' || (required.status === 'accepted' && (!required.service_agreed || !required.privacy_agreed))) throw consentError();
  for (const optional of [health, marketing]) {
    if (!statuses.includes(String(optional.status)) || !revision(optional.revision) || !nullableString(optional.document_version) || !(optional.granted_at === null || date(optional.granted_at))) throw consentError();
  }
  if (!(health.valid_until === null || date(health.valid_until)) || !(marketing.next_confirmation_at === null || date(marketing.next_confirmation_at)) || typeof marketing.confirmation_due !== 'boolean' || marketing.sending_enabled !== false) throw consentError();
  if (health.status === 'granted' && (!date(health.granted_at) || !date(health.valid_until) || !health.document_version)) throw consentError();
  if (marketing.status === 'granted' && (!date(marketing.granted_at) || !date(marketing.next_confirmation_at))) throw consentError();
  const original = value as ConsentStatus;
  const status = { ...original, required: { ...original.required }, health: { ...original.health }, marketing: { ...original.marketing } };
  if (status.health.status === 'granted' && Date.parse(status.server_time) >= Date.parse(status.health.valid_until!)) status.health.status = 'expired';
  return status;
}
export function parseVisibility(value: unknown): ProfileVisibility {
  const item = object(value), settings = object(item.settings);
  const keys = ['birthdate', 'gender', 'bio', 'bank_account', 'origin'];
  if (!revision(item.revision) || Object.keys(settings).length !== 5 || keys.some(key => !['public', 'private'].includes(String(settings[key])))) throw consentError();
  return value as ProfileVisibility;
}
export function fetchConsentManifest(): Promise<ManifestResult> {
  const key = accountKey();
  const cached = capabilities.get(key);
  if (cached && !(confirmedS1 && cached.mode === 'legacy')) return cached.result;
  const entry = { mode: 'unknown' as ConsentServerMode, result: Promise.resolve<ManifestResult>({ data: null, error: null }) };
  capabilities.set(key, entry);
  entry.result = (async () => {
    try {
      // Account/cache invalidation must never erase a device's confirmed S1 boundary.
      const remembered = await capabilityStorage.getItem(S1_CONFIRMED_KEY);
      if (remembered !== null && remembered !== '1') throw consentError();
      if (remembered === '1') { confirmedS1 = true; publishConsentServerMode(); }
      const response = await callRpc('get_consent_manifest', {});
      if (response.error) {
        if (!confirmedS1 && isMissingConsentManifest(response.error)) { entry.mode = 'legacy'; publishConsentServerMode(); return { data: null, error: null, legacy: true }; }
        throw response.error;
      }
      const data = parseConsentManifest(response.data);
      confirmedS1 = true;
      await capabilityStorage.setItem(S1_CONFIRMED_KEY, '1');
      entry.mode = 's1'; publishConsentServerMode();
      return { data, error: null };
    } catch (error) {
      // Failed probes are retryable, never cached as legacy or as consent acceptance.
      if (capabilities.get(key) === entry) capabilities.delete(key);
      publishConsentServerMode();
      return { data: null, error: consentError((error as { code?: string } | null)?.code === 'S1008' ? 'S1008' : 'S1006') };
    }
  })();
  return entry.result;
}
export async function fetchLegacyConsentStatus(): Promise<{ data: { version: string; agreed: boolean } | null; error: Error | null }> {
  if (getConsentServerMode() !== 'legacy') return { data: null, error: consentError() };
  try {
    const result = await callRpc('current_terms_consent_status', {});
    if (result.error) throw result.error;
    const row = Array.isArray(result.data) && result.data.length === 1 ? result.data[0] : result.data;
    if (!row || Array.isArray(row) || typeof row.version !== 'string' || !row.version || typeof row.agreed !== 'boolean') throw consentError();
    return { data: row, error: null };
  } catch { return { data: null, error: consentError() }; }
}
export async function recordLegacyTermsConsent(marketing: boolean): Promise<{ error: Error | null }> {
  if (getConsentServerMode() !== 'legacy') return { error: consentError() };
  try {
    const result = await callRpc('record_terms_consent', { marketing_opt_in: marketing });
    if (result.error || typeof result.data !== 'string' || !result.data) throw consentError();
    return { error: null };
  } catch { return { error: consentError() }; }
}
export const fetchConsentStatus = () => requestS1('get_my_consent_status', {}, parseConsentStatus);
export const completeSignupConsents = (input: ConsentSubmission) => requestS1('complete_signup_consents', input, parseConsentStatus);
export const recordRequiredConsents = (input: ConsentSubmission) => requestS1('record_required_consents', input, parseConsentStatus);
export async function setOptionalConsent(input: OptionalSubmission) {
  const result = await requestS1('set_optional_consent', input, value => {
    const item = object(value);
    if (item.kind !== input.p_kind || !statuses.includes(String(item.status)) || !revision(item.revision) || !date(item.server_time) || typeof item.data_deleted !== 'boolean' || !nullableString(item.document_version) || ![item.granted_at, item.valid_until, item.next_confirmation_at].every(value => value === null || date(value)) || (input.p_kind === 'marketing' && (item.sending_enabled !== false || typeof item.confirmation_due !== 'boolean')) || (input.p_kind === 'health' && ['withdrawn', 'declined'].includes(String(item.status)) && item.data_deleted !== true)) throw consentError();
    if (item.status === 'granted' && (!date(item.granted_at) || !item.document_version || (input.p_kind === 'health' ? !date(item.valid_until) : !date(item.next_confirmation_at)))) throw consentError();
    return value as OptionalConsentResult;
  });
  if (!result.error && result.data && result.data.status !== 'granted') clearOptionalConsentData();
  return result;
}
