import { StyleSheet, Text, View } from 'react-native';

import { fs, s } from '../theme/scale';
import { colors } from '../theme/tokens';
import { fontFamily, weight } from '../theme/typography';
import ScreenHeader from './ScreenHeader';
import StepProgress from './StepProgress';

type Props = {
  title: string;
  step: 1 | 2 | 3 | 4;
  stepLabel: string;
  onBack?: () => void;
};

/** 회원가입 4단계 공통 헤더 — 타이틀 y45 / 진행바 y77 / STEP 라벨 y82 */
export default function SignupHeader({ title, step, stepLabel, onBack }: Props) {
  return (
    <ScreenHeader
      title={title}
      onBack={onBack}
      below={
        <>
          <View style={styles.progress}>
            <StepProgress step={step} />
          </View>
          <View style={styles.labelRow}>
            <Text style={styles.step}>STEP {step}</Text>
            <Text style={styles.stepLabel}>{stepLabel}</Text>
          </View>
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  progress: {
    // 타이틀 박스 하단(y67) → 진행바(y77)
    marginTop: s(11),
  },
  labelRow: {
    marginTop: s(6),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },
  step: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(10),
    fontWeight: weight.extrabold,
    color: colors.primary,
  },
  stepLabel: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(10),
    fontWeight: weight.bold,
    color: colors.primary,
  },
});
