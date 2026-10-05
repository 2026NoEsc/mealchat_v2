import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import BackButton from '../../components/BackButton';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

/**
 * Figma 일정 추가 STEP 1 (309:1065) / STEP 2 (160:733) 상단.
 * AppHeader 아래의 진행바 + 우측 STEP 라벨 + 타이틀/서브타이틀.
 */
export default function ScheduleStepHeader({
  step,
  title,
  subtitle,
  onBack,
}: {
  step: 1 | 2;
  title: string;
  subtitle: string;
  onBack?: () => void;
}) {
  return (
    <View>
      <View style={styles.track}>
        <LinearGradient
          colors={[...colors.accentGradient]}
          locations={[...colors.accentGradientLocations]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.fill, { width: `${(step / 3) * 100}%` }]}
        />
      </View>

      <Text style={styles.step}>STEP {step}</Text>

      {/* 뒤로가기는 타이틀 왼쪽에 붙는다 — 무엇에서 돌아가는지가 바로 읽힌다 */}
      <View style={styles.titleRow}>
        {onBack ? <BackButton onPress={onBack} /> : null}
        <Text style={styles.title}>{title}</Text>
      </View>

      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    marginTop: s(8),
    marginHorizontal: s(11.5),
    height: s(5),
    borderRadius: s(3),
    backgroundColor: '#D9D9D9',
    overflow: 'hidden',
  },
  fill: {
    height: s(5),
    borderRadius: s(3),
  },
  step: {
    marginTop: s(4),
    marginRight: s(11.5),
    textAlign: 'right',
    fontFamily: fontFamily.bold,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.primary,
  },
  /*
   * 타이틀 줄. 칩(13)이 글자 줄(16)보다 낮아 줄 높이를 밀지 않으므로,
   * 뒤로가기가 있든 없든 시안(2111:15252) 의 y 좌표가 그대로 유지된다.
   */
  titleRow: {
    marginTop: s(4),
    marginLeft: s(11.5),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
  },
  title: {
    fontFamily: fontFamily.extrabold,
    fontSize: fs(12),
    lineHeight: fs(16),
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: s(3),
    marginLeft: s(11.5),
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: colors.textMuted,
  },
});
