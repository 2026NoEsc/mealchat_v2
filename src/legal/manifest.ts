import bundled from './documents.generated.json';
import { parseLegalDocument } from './canonical';
import type { ConsentChoices, ConsentKind, ConsentManifest, ConsentSubmission, DocumentReference } from '../consents/contracts';
export function manifestDocument(manifest: ConsentManifest, kind: ConsentKind) {
  const remote = manifest.documents[kind];
  const local = bundled[kind];
  return parseLegalDocument(remote.content_hash === local.content_hash ? local.canonical_content : remote.canonical_content);
}
export function consentSubmission(manifest: ConsentManifest, choices: Partial<ConsentChoices>, requestId: string, requiredOnly = false): ConsentSubmission {
  const kinds: ConsentKind[] = requiredOnly ? ['service', 'privacy'] : ['service', 'privacy', 'health', 'marketing'];
  const documents: Partial<Record<ConsentKind, DocumentReference>> = {};
  const selected: Partial<ConsentChoices> = {};
  for (const kind of kinds) {
    const { version, content_hash } = manifest.documents[kind];
    documents[kind] = { version, content_hash };
    selected[kind] = choices[kind] === true;
  }
  return { p_request_id: requestId, p_bundle_version: manifest.bundle_version, p_documents: documents, p_choices: selected };
}
