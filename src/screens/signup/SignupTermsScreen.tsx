import { ChevronRight, CheckSquare, Square } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';
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
  const [agreed, setAgreed] = useState<Record<TermKey, boolean>>({
    service: true,
    privacy: true,
    marketing: true,
  });

  const allAgreed = TERMS.every((t) => agreed[t.key]);
  const canSubmit = TERMS.filter((t) => t.required).every((t) => agreed[t.key]);

  const toggleAll = () => {
    const next = !allAgreed;
    setAgreed({ service: next, privacy: next, marketing: next });
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
      ctaLabel="회원가입 끝내기"
      onNext={() => {
        if (canSubmit) resetTo('Home');
      }}
      onBack={goBack}>
      <View style={styles.terms}>
        {TERMS.map((term) => (
          <Pressable
            key={term.key}
            style={styles.row}
            onPress={() => setAgreed((p) => ({ ...p, [term.key]: !p[term.key] }))}>
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
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    lineHeight: fs(11),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
});
