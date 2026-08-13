import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

/**
 * Figma 일정 추가 STEP 1 (309:1065) / STEP 2 (160:733) 상단.
 * AppHeader 아래의 진행바 + 우측 STEP 라벨 + 타이틀/서브타이틀.
 */
export default function ScheduleStepHeader({
  step,
  title,
  subtitle,
}: {
  step: 1 | 2;
  title: string;
  subtitle: string;
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
      <Text style={styles.title}>{title}</Text>
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
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    fontWeight: weight.bold,
    color: colors.primary,
  },
  title: {
    marginTop: s(4),
    marginLeft: s(11.5),
    fontFamily: fontFamily.body,
    fontSize: fs(12),
    lineHeight: fs(16),
    fontWeight: weight.extrabold,
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
