import { FileText } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/AuthProvider';
import { AuthFooter, authStyles } from '../../components/ui/AuthLayout';
import { PrimaryButton, TextButton } from '../../components/ui/Button';
import TermsCard, { type TermChoices } from '../../components/ui/TermsCard';
import { completeSignupConsents, recordRequiredConsents, recordLegacyTermsConsent } from '../../lib/consents';
import { consentErrorMessage, newConsentRequestId, type ConsentManifest, type ConsentStatus, type ConsentSubmission } from '../../consents/contracts';
import { useConsentManifest } from '../../consents/useConsentManifest';
import { changedConsentKinds, consentDocumentIdentity } from '../../consents/documentIdentity';
import { consentSubmission, manifestDocument } from '../../legal/manifest';
import OptionalConsentControls from '../settings/OptionalConsentControls';
import AccountDeletionScreen from '../settings/AccountDeletionScreen';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import LegalDocumentSheet, { legalViewForTerm, type LegalView } from '../settings/LegalDocumentSheet';

/** 558:1712. Existing consent RPC remains the only persistence path. */
export default function ReConsentScreen({ onDone, manifest: initialManifest, status, gateError = false, gateErrorMessage, onRetry, signupReview = false, legacy: gateLegacy = false }: {
  onDone: () => void; manifest?: ConsentManifest | null; status?: ConsentStatus | null; gateError?: boolean; gateErrorMessage?: string; onRetry?: () => void; signupReview?: boolean; legacy?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [agreed, setAgreed] = useState<TermChoices>({ service: false, privacy: false, health: false, marketing: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [legalView, setLegalView] = useState<LegalView | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { manifest, legacy: detectedLegacy, loading, reload } = useConsentManifest(initialManifest);
  const legacy = gateLegacy || detectedLegacy;
  const request = useRef<{ key: string; submission: ConsentSubmission } | null>(null);
  const mounted = useRef(true), locked = useRef(false);
  const identity = consentDocumentIdentity(manifest, legacy);
  const previousIdentity = useRef<string | null>(identity);
  useEffect(() => {
    if (!identity) return;
    if (previousIdentity.current && previousIdentity.current !== identity) {
      const changed = changedConsentKinds(previousIdentity.current, identity);
      request.current = null; setLegalView(null); setAgreed(current => {
        const choices = { ...current }; for (const kind of changed) choices[kind] = false; return choices;
      });
    }
    previousIdentity.current = identity;
  }, [identity]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const canSubmit = agreed.service && agreed.privacy && (Boolean(manifest) || legacy) && !gateError && (!previousIdentity.current || previousIdentity.current === identity);
  const submit = async () => {
    if (!canSubmit || locked.current || (!manifest && !legacy)) return;
    locked.current = true;
    setSubmitting(true);
    setError('');
    try {
      if (legacy) {
        const result = await recordLegacyTermsConsent(agreed.marketing);
        if (!mounted.current) return;
        if (result.error) setError(consentErrorMessage(result.error)); else onDone();
        return;
      }
      if (!manifest) return;
      const key = JSON.stringify([manifest, agreed, signupReview]);
      if (request.current?.key !== key) request.current = { key, submission: consentSubmission(manifest, agreed, newConsentRequestId(), !signupReview) };
      const result = await (signupReview ? completeSignupConsents : recordRequiredConsents)(request.current.submission);
      if (!mounted.current) return;
      if (result.error || result.data?.required.status !== 'accepted') {
        setError(consentErrorMessage(result.error));
        if ((result.error as { code?: string } | null)?.code === 'S1002') {
          request.current = null; setAgreed({ service: false, privacy: false, health: false, marketing: false }); reload();
        }
        if ((result.error as { code?: string } | null)?.code === 'S1004') { request.current = null; onRetry?.(); }
      } else onDone();
    } catch { if (mounted.current) setError('동의를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    finally { locked.current = false; if (mounted.current) setSubmitting(false); }
  };
  const leave = async () => {
    if (locked.current) return;
    locked.current = true;
    setSubmitting(true);
    try {
      const result = await signOut();
      if (result && mounted.current) setError('로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } catch { if (mounted.current) setError('로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    finally { locked.current = false; if (mounted.current) setSubmitting(false); }
  };
  if (deleting) return <AccountDeletionScreen onBack={() => { setDeleting(false); onRetry?.(); }} />;
  return <View style={[authStyles.screen, { paddingTop: insets.top }]}>
    <ScrollView style={authStyles.scroll} contentContainerStyle={styles.body}>
      <View style={authStyles.iconBadge}><FileText size={26} color={colors.selectedText} aria-hidden={true} /></View>
      <View style={styles.titleGroup}>
        <Text accessibilityRole="header" style={authStyles.title}>{gateError ? '동의 상태를 확인하지 못했어요' : signupReview ? '가입 동의를 다시 확인해 주세요' : '약관이 새로 정리됐어요'}</Text>
        <Text style={authStyles.subtitle}>{gateError ? gateErrorMessage ?? '연결을 확인하고 다시 시도해 주세요. 문서 보기와 선택 동의 철회는 이용할 수 있어요.' : '계속 이용하려면 아래 항목에 동의해 주세요.'}</Text>
      </View>
      {manifest?.change_summary ? <View style={styles.summary}><Text style={authStyles.label}>바뀐 점</Text><Text style={authStyles.helper}>{manifest.change_summary}</Text></View> : null}
      {(gateError || (!manifest && !legacy)) ? <TextButton label={loading ? '동의 상태 확인 중' : '동의 상태 다시 확인'} disabled={loading} onPress={() => { reload(); onRetry?.(); }} /> : null}
      <TermsCard reconsent includeOptional={signupReview || legacy} includeHealth={!legacy} agreed={agreed} onChange={setAgreed} disabled={submitting || (!manifest && !legacy) || gateError}
        onView={(key) => setLegalView({ ...legalViewForTerm(key), ...(manifest ? { content: manifestDocument(manifest, key) } : { fallback: !legacy }) })} />
      {!legacy ? <OptionalConsentControls withdrawalOnly manifest={manifest} status={status ?? null} /> : null}
      <TextButton label="계정 삭제 안내" onPress={() => setDeleting(true)} />
      {error ? <Text accessibilityRole="alert" style={[authStyles.helper, styles.error]}>{error}</Text> : null}
    </ScrollView>
    <AuthFooter>
      <PrimaryButton label="동의하고 계속하기" loading={submitting} disabled={!canSubmit} onPress={() => void submit()} />
      <TextButton label="나중에 하기 (로그아웃)" disabled={submitting} onPress={() => void leave()} />
    </AuthFooter>
    <LegalDocumentSheet view={legalView} onClose={() => setLegalView(null)} />
  </View>;
}

const styles = StyleSheet.create({
  titleGroup: { gap: 6 },
  body: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
  error: { color: v3FeedbackColors.error },
  summary: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, gap: 4, backgroundColor: colors.mutedBg },
});
