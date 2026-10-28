import { CONSENT_KINDS, type ConsentSubmission, type ConsentManifest } from '../consents/contracts';
import type { PendingSignupProfileStorage } from './pendingSignupProfile';

export const PENDING_SIGNUP_CONSENTS_KEY = 'mealchat.auth.pending-signup-consents.v1';
export const PENDING_SIGNUP_CONSENTS_TTL_MS = 3 * 24 * 60 * 60 * 1000;
export type PendingSignupConsents = { email: string; userId: string; savedAt: number; submission: ConsentSubmission };

export async function readPendingSignupConsents(storage: PendingSignupProfileStorage, now = Date.now()): Promise<PendingSignupConsents | null> {
  const raw = await storage.getItem(PENDING_SIGNUP_CONSENTS_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as PendingSignupConsents;
    if (!value || typeof value.email !== 'string' || !value.email.trim() || !(typeof value.userId === 'string' && value.userId.trim())
      || typeof value.savedAt !== 'number' || !Number.isFinite(value.savedAt) || now < value.savedAt || now - value.savedAt > PENDING_SIGNUP_CONSENTS_TTL_MS
      || typeof value.submission?.p_request_id !== 'string' || !/^[a-f0-9-]{36}$/i.test(value.submission.p_request_id)
      || typeof value.submission.p_bundle_version !== 'string'
      || CONSENT_KINDS.some(kind => typeof value.submission.p_choices?.[kind] !== 'boolean'
        || typeof value.submission.p_documents?.[kind]?.version !== 'string'
        || !/^[a-f0-9]{64}$/.test(value.submission.p_documents?.[kind]?.content_hash ?? ''))) throw new Error();
    // Project only the allowed metadata; never restore extra password/token/health payload keys.
    const documents = Object.fromEntries(CONSENT_KINDS.map(kind => [kind, { version: value.submission.p_documents[kind]!.version, content_hash: value.submission.p_documents[kind]!.content_hash }]));
    const choices = Object.fromEntries(CONSENT_KINDS.map(kind => [kind, value.submission.p_choices[kind]]));
    return { email: value.email, userId: value.userId, savedAt: value.savedAt, submission: { p_request_id: value.submission.p_request_id, p_bundle_version: value.submission.p_bundle_version, p_documents: documents, p_choices: choices } };
  } catch { await storage.removeItem(PENDING_SIGNUP_CONSENTS_KEY); return null; }
}
export async function persistPendingSignupConsents(storage: PendingSignupProfileStorage, value: PendingSignupConsents) {
  const { email, userId, savedAt, submission } = value;
  if (!userId?.trim()) { await clearPendingSignupConsents(storage); return; }
  const documents = Object.fromEntries(CONSENT_KINDS.map(kind => [kind, { version: submission.p_documents[kind]!.version, content_hash: submission.p_documents[kind]!.content_hash }]));
  const choices = Object.fromEntries(CONSENT_KINDS.map(kind => [kind, submission.p_choices[kind] === true]));
  await storage.setItem(PENDING_SIGNUP_CONSENTS_KEY, JSON.stringify({ email: email.trim().toLowerCase(), userId, savedAt,
    submission: { p_request_id: submission.p_request_id, p_bundle_version: submission.p_bundle_version, p_documents: documents, p_choices: choices } }));
}
export const clearPendingSignupConsents = (storage: PendingSignupProfileStorage) => storage.removeItem(PENDING_SIGNUP_CONSENTS_KEY);
export function pendingConsentMatches(pending: PendingSignupConsents, user: { id: string; email?: string }, manifest: ConsentManifest): boolean {
  return Boolean(pending.userId) && pending.userId === user.id && pending.email.trim().toLowerCase() === user.email?.trim().toLowerCase()
    && pending.submission.p_bundle_version === manifest.bundle_version
    && CONSENT_KINDS.every(kind => pending.submission.p_documents[kind]?.version === manifest.documents[kind].version
      && pending.submission.p_documents[kind]?.content_hash === manifest.documents[kind].content_hash);
}
