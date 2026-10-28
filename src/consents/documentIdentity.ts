import { CONSENT_KINDS, type ConsentManifest } from './contracts';

/** Server time is not a document identity; bundle/version/hash are. */
export function consentDocumentIdentity(manifest: ConsentManifest | null, legacy: boolean): string | null {
  return manifest ? JSON.stringify([manifest.bundle_version, ...CONSENT_KINDS.map(kind => [kind, manifest.documents[kind].version, manifest.documents[kind].content_hash])]) : legacy ? 'legacy' : null;
}
export function changedConsentKinds(previous: string, next: string) {
  if (previous === next) return [];
  if (previous === 'legacy' || next === 'legacy') return [...CONSENT_KINDS];
  try {
    const old = JSON.parse(previous), current = JSON.parse(next);
    return old[0] !== current[0] ? [...CONSENT_KINDS] : CONSENT_KINDS.filter((_kind, index) => JSON.stringify(old[index + 1]) !== JSON.stringify(current[index + 1]));
  } catch { return [...CONSENT_KINDS]; }
}
