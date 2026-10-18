import AsyncStorage from '@react-native-async-storage/async-storage';
import { Info } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/AuthProvider';
import { clearPendingSignupProfile, persistPendingSignupProfile } from '../../auth/pendingSignupProfile';
import { clearPendingSignupConsents, persistPendingSignupConsents } from '../../auth/pendingSignupConsents';
import { completePendingProfile, forgetImmediateSignupProfile, rememberImmediateSignupProfile } from '../../auth/completePendingProfile';
import { useSignupDraft } from '../../auth/SignupDraftProvider';
import { AuthFooter, SignupStepHeader, authStyles } from '../../components/ui/AuthLayout';
import { PrimaryButton, TextButton } from '../../components/ui/Button';
import TermsCard from '../../components/ui/TermsCard';
import { notify } from '../../lib/confirm';
import { authErrorMessage } from '../../lib/password';
import { completeSignupConsents } from '../../lib/consents';
import { consentErrorMessage, newConsentRequestId, type ConsentSubmission } from '../../consents/contracts';
import { getConsentAccess, setConsentAccess } from '../../consents/access';
import { useConsentManifest } from '../../consents/useConsentManifest';
import { changedConsentKinds, consentDocumentIdentity } from '../../consents/documentIdentity';
import { consentSubmission, manifestDocument } from '../../legal/manifest';
import { useNavigation } from '../../navigation/NavigationContext';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import LegalDocumentSheet, { legalViewForTerm, type LegalView } from '../settings/LegalDocumentSheet';
import { queueNotificationGuide } from '../settings/notificationPermission';

const dudu = require('../../../assets/brand/dudu.png');

/** Phone 520:1285. The account creation and private-profile persistence contract is unchanged. */
export default function SignupTermsScreen() {
  const { resetTo, goBack } = useNavigation();
  const { signUpWithEmail } = useAuth();
  const { draft, updateDraft, resetDraft } = useSignupDraft();
  const insets = useSafeAreaInsets();
  const [submitting, setSubmitting] = useState(false);
  const [legalView, setLegalView] = useState<LegalView | null>(null);
  const { manifest, legacy, loading, reload } = useConsentManifest();
  const locked = useRef(false), mounted = useRef(true);
  const request = useRef<{ key: string; submission: ConsentSubmission } | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const agreed = draft.consents;
  const identity = consentDocumentIdentity(manifest, legacy);
  useEffect(() => {
    if (!identity) return;
    if (draft.consentIdentity && draft.consentIdentity !== identity) {
      request.current = null; setLegalView(null);
      const consents = { ...draft.consents };
      for (const kind of changedConsentKinds(draft.consentIdentity, identity)) consents[kind] = false;
      updateDraft({ consents, consentIdentity: identity });
    } else if (!draft.consentIdentity) updateDraft({ consentIdentity: identity });
  }, [identity, draft.consentIdentity, draft.consents, updateDraft]);
  const canSubmit = agreed.service && agreed.privacy && Boolean(identity) && (!draft.consentIdentity || draft.consentIdentity === identity);

  const completeSignup = async () => {
    if (locked.current || (!manifest && !legacy)) return;
    if (!canSubmit) {
      notify('약관 동의', '필수 약관에 동의해 주세요.');
      return;
    }

    if (!draft.nickname.trim() || !draft.email.trim() || !draft.password) {
      notify('가입 정보 없음', '개인정보 입력 화면에서 가입 정보를 다시 입력해 주세요.');
      return;
    }

    locked.current = true;
    setSubmitting(true);
    const clearPending = () => Promise.all([clearPendingSignupConsents(AsyncStorage), clearPendingSignupProfile(AsyncStorage)]);
    try {
      // Never leave a failed attempt's personal data or consent choices for the next login.
      await clearPending(); forgetImmediateSignupProfile();
      const savedAt = Date.now();
      if (manifest && !legacy) {
        const key = JSON.stringify([manifest.bundle_version, manifest.documents, agreed]);
        if (request.current?.key !== key) request.current = { key, submission: consentSubmission(manifest, agreed, newConsentRequestId()) };
      }
      const result = await signUpWithEmail({
        email: draft.email,
        password: draft.password,
        displayName: draft.nickname,
        ...(legacy ? { marketingOptIn: agreed.marketing } : {}),
      });
      if (result.error) {
        await clearPending();
        notify('회원가입 실패', authErrorMessage(result.error));
        return;
      }

      if (result.userId) await queueNotificationGuide(result.userId).catch(() => undefined);
      const profile = result.userId ? { email: draft.email, userId: result.userId, bank: draft.bank, account: draft.account, birth: draft.birth, tastes: draft.tastes, savedAt } : null;
      if (result.confirmationRequired || !profile) {
        // Obfuscated existing-user replies have no bindable id and leave no pending data.
        // The visible email-confirmation outcome is identical for new and existing addresses.
        if (profile) {
          if (manifest && !legacy && request.current) await persistPendingSignupConsents(AsyncStorage, { email: draft.email, userId: profile.userId, savedAt, submission: request.current.submission });
          await persistPendingSignupProfile(AsyncStorage, profile, savedAt);
        }
        notify(
          '이메일 확인 필요',
          '이메일의 확인 링크를 연 뒤 로그인해 주세요.',
        );
        resetTo('Login');
        resetDraft();
        return;
      }

      if (getConsentAccess().userId && getConsentAccess().userId !== profile.userId) return;
      rememberImmediateSignupProfile(profile);
      // Pre-S1 signup trigger owns legacy consent; the accepted gate drains the memory draft.
      if (legacy) { await completePendingProfile({ id: profile.userId, email: draft.email }); resetDraft(); return; }
      if (!request.current) return;
      const completed = await completeSignupConsents(request.current.submission);
      if (getConsentAccess().userId && getConsentAccess().userId !== profile.userId) return;
      if (completed.error || completed.data?.required.status !== 'accepted') {
        notify('동의 저장 실패', consentErrorMessage(completed.error));
        if ((completed.error as { code?: string } | null)?.code === 'S1002' && mounted.current) {
          request.current = null; updateDraft({ consents: { service: false, privacy: false, health: false, marketing: false } }); reload();
        }
        return;
      }
      if (result.userId) { setConsentAccess(result.userId, 'accepted'); await completePendingProfile({ id: result.userId, email: draft.email }); }
      resetDraft();
    } catch (error) {
      await clearPending().catch(() => undefined); forgetImmediateSignupProfile();
      notify('회원가입 실패', authErrorMessage(error));
    } finally {
      locked.current = false;
      if (mounted.current) setSubmitting(false);
    }
  };

  return <View style={[authStyles.screen, { paddingTop: insets.top }]}>
    <SignupStepHeader step={4} title="거의 다 왔어요!" subtitle="서비스를 쓰려면 아래 약관에 동의해 주세요." onBack={goBack} />
    <ScrollView style={authStyles.scroll} contentContainerStyle={styles.body}>
      <View style={styles.dudu}>
        <Image source={dudu} style={styles.character} resizeMode="contain" accessible={false} />
        <Text style={styles.description}>두두가 여러분의 의견을 모아서 두두두 전해 줄게요.</Text>
      </View>
      {!manifest && !legacy ? <><Text accessibilityLiveRegion="polite" style={authStyles.helper}>{loading ? '약관을 불러오고 있어요' : '약관을 불러오지 못했어요. 다시 확인해 주세요.'}</Text><TextButton label="약관 다시 불러오기" onPress={reload} /></> : null}
      <TermsCard agreed={agreed} includeHealth={!legacy} disabled={submitting || (!manifest && !legacy)} onChange={(consents) => updateDraft({ consents: { ...consents, health: consents.health === true } })}
        onView={(key) => setLegalView({ ...legalViewForTerm(key), ...(manifest ? { content: manifestDocument(manifest, key) } : { fallback: !legacy }) })} />
      <View style={styles.hint}>
        <Info size={16} color={colors.sub} aria-hidden={true} />
        <Text style={[authStyles.helper, styles.hintText]}>필수 약관에 모두 동의해야 가입할 수 있어요.</Text>
      </View>
    </ScrollView>
    <AuthFooter><PrimaryButton label="회원가입 끝내기" loading={submitting} disabled={!canSubmit} onPress={() => void completeSignup()} /></AuthFooter>
    <LegalDocumentSheet view={legalView} onClose={() => setLegalView(null)} />
  </View>;
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
  dudu: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 14, borderRadius: 16, backgroundColor: colors.selectedBg },
  character: { width: 72, height: 54 },
  description: { flex: 1, fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 22, color: colors.selectedText },
  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  hintText: { flex: 1 },
});
