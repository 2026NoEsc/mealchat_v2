import { FileText } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/AuthProvider';
import { AuthFooter, authStyles } from '../../components/ui/AuthLayout';
import { PrimaryButton, TextButton } from '../../components/ui/Button';
import TermsCard, { type TermChoices } from '../../components/ui/TermsCard';
import { recordTermsConsent } from '../../lib/consents';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import LegalDocumentSheet, { legalViewForTerm, type LegalView } from '../settings/LegalDocumentSheet';

/** 558:1712. Existing consent RPC remains the only persistence path. */
export default function ReConsentScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [agreed, setAgreed] = useState<TermChoices>({ service: false, privacy: false, marketing: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [legalView, setLegalView] = useState<LegalView | null>(null);
  const canSubmit = agreed.service && agreed.privacy;
  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await recordTermsConsent(agreed.marketing);
      if (result) setError('동의를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
      else onDone();
    } catch { setError('동의를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    finally { setSubmitting(false); }
  };
  const leave = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await signOut();
      if (result) setError('로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } catch { setError('로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    finally { setSubmitting(false); }
  };
  return <View style={[authStyles.screen, { paddingTop: insets.top }]}>
    <ScrollView style={authStyles.scroll} contentContainerStyle={styles.body}>
      <View style={authStyles.iconBadge}><FileText size={26} color={colors.selectedText} aria-hidden={true} /></View>
      <View style={styles.titleGroup}>
        <Text accessibilityRole="header" style={authStyles.title}>약관이 새로 정리됐어요</Text>
        <Text style={authStyles.subtitle}>계속 이용하려면 아래 항목에 동의해 주세요.</Text>
      </View>
      {/* TODO(서버 단계): 기존 API는 버전과 동의 여부만 제공하므로 실제 변경 요약 계약을 추가한 뒤 바뀐 점 카드를 표시한다. */}
      <TermsCard reconsent agreed={agreed} onChange={setAgreed} disabled={submitting} onView={(key) => setLegalView(legalViewForTerm(key))} />
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
});
