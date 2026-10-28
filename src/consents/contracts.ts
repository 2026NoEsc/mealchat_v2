export const CONSENT_KINDS = ['service', 'privacy', 'health', 'marketing'] as const;
export type ConsentKind = typeof CONSENT_KINDS[number];
export type OptionalKind = 'health' | 'marketing';
export type ConsentChoices = Record<ConsentKind, boolean>;
export type OptionalStatus = 'not_asked' | 'granted' | 'declined' | 'withdrawn' | 'expired';
export type DocumentReference = { version: string; content_hash: string };
export type ManifestDocument = DocumentReference & { edition: number; canonical_content: string };
export type ConsentManifest = { contract_version: 1; bundle_version: string; effective_from: string; change_summary: string; documents: Record<ConsentKind, ManifestDocument>; server_time: string };
export type HealthConsentState = { status: OptionalStatus; document_version: string | null; granted_at: string | null; valid_until: string | null; revision: string };
export type MarketingConsentState = Omit<HealthConsentState, 'valid_until'> & { next_confirmation_at: string | null; confirmation_due: boolean; sending_enabled: false };
export type ConsentStatus = { contract_version: 1; bundle_version: string; required: { status: 'accepted' | 'required'; service_agreed: boolean; privacy_agreed: boolean }; health: HealthConsentState; marketing: MarketingConsentState; server_time: string };
export type ConsentSubmission = { p_request_id: string; p_bundle_version: string; p_documents: Partial<Record<ConsentKind, DocumentReference>>; p_choices: Partial<ConsentChoices> };
export type OptionalSubmission = { p_request_id: string; p_kind: OptionalKind; p_action: 'grant' | 'decline' | 'withdraw'; p_document_version: string | null; p_content_hash: string | null; p_expected_revision: string | null; p_source: 'settings' | 'food_step2' };
export type OptionalConsentResult = { kind: OptionalKind; status: OptionalStatus; document_version: string | null; granted_at: string | null; valid_until: string | null; next_confirmation_at: string | null; revision: string; data_deleted: boolean; server_time: string; confirmation_due?: boolean; sending_enabled?: false };
export type VisibilityField = 'birthdate' | 'gender' | 'bio' | 'bank_account' | 'origin';
export type Visibility = 'public' | 'private';
export type ProfileVisibility = { settings: Record<VisibilityField, Visibility>; revision: string };
export type S1Error = Error & { code: string };
export function consentError(code = 'S1006'): S1Error { return Object.assign(new Error('동의 상태를 확인하지 못했어요. 다시 시도해 주세요.'), { code }); }
export function consentErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'S1002') return '문서가 바뀌었어요. 원문을 다시 읽고 동의해 주세요.';
  if (code === 'S1004') return '다른 곳에서 변경됐어요. 최신 상태를 확인하고 다시 선택해 주세요.';
  if (code === 'S1007') return '요청 내용이 바뀌었어요. 다시 확인한 뒤 제출해 주세요.';
  if (code === 'S1008') return '앱을 업데이트한 뒤 다시 이용해 주세요.';
  if (code === 'S1001') return '현재 약관 동의가 필요해요.';
  if (code === 'S1005' || code === 'SETTLEMENT_DISCLOSURE_CLOSED') return '이미 끝난 정산은 완료를 되돌릴 수 없어요. 새 정산을 요청해 주세요.';
  if (code === 'S1_UNAVAILABLE') return '곧 이용할 수 있어요.';
  return '처리하지 못했어요. 연결을 확인하고 다시 시도해 주세요.';
}
/** Request deduplication only; never used as a credential or authorization token. */
export function newConsentRequestId(): string {
  const crypto = Reflect.get(globalThis, 'crypto') as { randomUUID?: () => string } | undefined;
  return crypto?.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, key => {
    const random = Math.floor(Math.random() * 16);
    return (key === 'x' ? random : (random & 3) | 8).toString(16);
  });
}
