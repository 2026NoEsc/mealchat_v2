import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronRight, CheckSquare, Square } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import {
  clearPendingSignupProfile,
  persistPendingSignupProfile,
} from '../../auth/pendingSignupProfile';
import { useSignupDraft } from '../../auth/SignupDraftProvider';
import { notify } from '../../lib/confirm';
import { authErrorMessage } from '../../lib/password';
import { saveSignupPrivateProfile } from '../../lib/profile';
import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import SignupIllustrationScreen from './SignupIllustrationScreen';

const dudu = require('../../../assets/brand/dudu.png');

const TERMS = [
  { key: 'service', label: '[필수] 서비스 이용약관', required: true },
  { key: 'privacy', label: '[필수] 개인정보 처리방침', required: true },
  { key: 'marketing', label: '[선택] 마케팅 정보 수신', required: false },
] as const;

type TermKey = (typeof TERMS)[number]['key'];

/**
 * Figma 회원가입/약관 동의 (150:126) — dudu x57 y174 107×78
 * 약관 행 y329 / y347 / y366, 구분선 y385, 전체 동의 y393
 */
export default function SignupTermsScreen() {
  const { resetTo, goBack } = useNavigation();
  const { signUpWithEmail } = useAuth();
  const { draft, updateDraft, resetDraft } = useSignupDraft();
  const [submitting, setSubmitting] = useState(false);
  const agreed: Record<TermKey, boolean> = draft.consents;

  const allAgreed = TERMS.every((t) => agreed[t.key]);
  const canSubmit = TERMS.filter((t) => t.required).every((t) => agreed[t.key]);

  const toggleAll = () => {
    const next = !allAgreed;
    updateDraft({ consents: { service: next, privacy: next, marketing: next } });
  };

  const completeSignup = async () => {
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
        notify('회원가입 실패', authErrorMessage(result.error.message));
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
    } catch {
      notify('회원가입 실패', '계정을 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SignupIllustrationScreen
      title="약관 동의"
      step={4}
      stepLabel="다왔어요!"
      characterName="두두"
      character={dudu}
      characterBox={{ left: 41, top: 47, width: 107, height: 78 }}
      description={['두두가 열심히 여러분들의', '의견을 두두두 알해줄거예요']}
      ctaLabel={submitting ? '계정 만드는 중' : '회원가입 끝내기'}
      onNext={() => void completeSignup()}
      onBack={goBack}
      submitting={submitting}>
      <View style={styles.terms}>
        {TERMS.map((term) => (
          <Pressable
            key={term.key}
            style={styles.row}
            onPress={() =>
              updateDraft({
                consents: { ...agreed, [term.key]: !agreed[term.key] },
              })
            }>
            <Check checked={agreed[term.key]} />
            <Text style={styles.label}>{term.label}</Text>
            <ChevronRight size={s(8)} color={colors.textMuted} strokeWidth={2} />
          </Pressable>
        ))}
      </View>

      <View style={styles.divider} />

      <Pressable style={styles.allRow} onPress={toggleAll}>
        <Check checked={allAgreed} />
        <Text style={styles.allLabel}>전체 동의</Text>
      </Pressable>
    </SignupIllustrationScreen>
  );
}

function Check({ checked }: { checked: boolean }) {
  return checked ? (
    <CheckSquare size={s(10)} color={colors.textPrimary} strokeWidth={2} />
  ) : (
    <Square size={s(10)} color={colors.textMuted} strokeWidth={2} />
  );
}

const styles = StyleSheet.create({
  terms: {
    // 카드 하단(y317) → 첫 행(y329)
    marginTop: s(12),
    gap: s(8),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    paddingLeft: s(3),
  },
  label: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: colors.textPrimary,
  },
  divider: {
    // y385
    marginTop: s(9),
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: s(3),
  },
  allRow: {
    // y393
    marginTop: s(8),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    paddingLeft: s(4),
  },
  allLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fs(8),
    lineHeight: fs(11),
    color: colors.textPrimary,
  },
});
