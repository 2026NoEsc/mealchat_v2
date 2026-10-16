import AsyncStorage from '@react-native-async-storage/async-storage';
import { Info } from 'lucide-react-native';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/AuthProvider';
import { clearPendingSignupProfile, persistPendingSignupProfile } from '../../auth/pendingSignupProfile';
import { useSignupDraft } from '../../auth/SignupDraftProvider';
import { AuthFooter, SignupStepHeader, authStyles } from '../../components/ui/AuthLayout';
import { PrimaryButton } from '../../components/ui/Button';
import TermsCard from '../../components/ui/TermsCard';
import { notify } from '../../lib/confirm';
import { authErrorMessage } from '../../lib/password';
import { saveSignupPrivateProfile } from '../../lib/profile';
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
  const agreed = draft.consents;
  const canSubmit = agreed.service && agreed.privacy;

  const completeSignup = async () => {
    if (submitting) return;
    if (!canSubmit) {
      notify('약관 동의', '필수 약관에 동의해 주세요.');
      return;
    }

    if (!draft.nickname.trim() || !draft.email.trim() || !draft.password) {
      notify('가입 정보 없음', '개인정보 입력 화면에서 가입 정보를 다시 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await signUpWithEmail({
        email: draft.email,
        password: draft.password,
        displayName: draft.nickname,
        marketingOptIn: agreed.marketing,
      });
      if (!result.error && result.userId) await queueNotificationGuide(result.userId).catch(() => undefined);

      /*
       * 계좌·생년월일은 본인만 볼 수 있는 행에 들어가고 그 쓰기는 세션을 요구한다.
       * 이메일 확인이 켜져 있으면 이 시점에 세션이 없으므로 저장할 수 없다.
       * 사용자 메타데이터로 넘기는 방법도 있지만 그건 JWT 에 실려 나가므로 쓰지 않는다.
       */
      const privateProfile = {
        bank: draft.bank,
        account: draft.account,
        birth: draft.birth,
        tastes: draft.tastes,
      };

      let privateSaveFailed = false;
      if (!result.error) {
        if (!result.confirmationRequired && result.userId) {
          const saveError = await saveSignupPrivateProfile(result.userId, privateProfile);
          privateSaveFailed = Boolean(saveError);
          /* 들어갔으면 기기에 남은 것을 지운다 - 계좌번호를 놔둘 이유가 없다 */
          if (!saveError) await clearPendingSignupProfile(AsyncStorage).catch(() => undefined);
        } else {
          /*
           * 세션이 아직 없어 지금은 쓸 수 없다. 버리면 메일을 확인하고 처음
           * 로그인했을 때 적어 넣은 값이 하나도 없다 - 기기에 맡겨 뒀다가
           * 로그인하는 순간 AuthProvider 가 옮겨 담는다.
           */
          await persistPendingSignupProfile(AsyncStorage, {
            email: draft.email,
            ...privateProfile,
          }).catch(() => undefined);
        }
      }

      if (result.error) {
        notify('회원가입 실패', authErrorMessage(result.error));
        return;
      }

      resetDraft();

      if (result.confirmationRequired) {
        notify(
          '이메일 확인 필요',
          '이메일의 확인 링크를 연 뒤 로그인해 주세요.\n적어 주신 계좌·생년월일·취향은 로그인하면 그대로 들어가요.',
        );
        resetTo('Login');
        return;
      }

      if (privateSaveFailed) {
        notify('일부 정보 미저장', '계좌와 생년월일은 프로필에서 다시 입력해 주세요.');
      }
    } catch (error) {
      notify('회원가입 실패', authErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return <View style={[authStyles.screen, { paddingTop: insets.top }]}>
    <SignupStepHeader step={4} title="거의 다 왔어요!" subtitle="서비스를 쓰려면 아래 약관에 동의해 주세요." onBack={goBack} />
    <ScrollView style={authStyles.scroll} contentContainerStyle={styles.body}>
      <View style={styles.dudu}>
        <Image source={dudu} style={styles.character} resizeMode="contain" accessible={false} />
        <Text style={styles.description}>두두가 여러분의 의견을 모아서 두두두 전해 줄게요.</Text>
      </View>
      <TermsCard agreed={agreed} disabled={submitting} onChange={(consents) => updateDraft({ consents })} onView={(key) => setLegalView(legalViewForTerm(key))} />
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
