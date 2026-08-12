import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { s } from '../theme/scale';
import { colors } from '../theme/tokens';

/** 전체 트랙 폭 (Figma 기준 x16~x196) */
const TRACK = 180;

/**
 * Figma 회원가입 진행바.
 * 채워진 구간은 하나의 연속 그라디언트(h5)이고, 남은 구간만 회색 세그먼트(h3)로 그려진다.
 * 좌표는 회원가입 각 화면에서 그대로 추출한 값.
 */
const STEPS: { fill: number; rest: number[] }[] = [
  { fill: 48, rest: [50, 94, 138] }, // STEP 1 개인정보 입력
  { fill: 92, rest: [96, 140] }, //     STEP 2 구글 캘린더 연동
  { fill: 136, rest: [138] }, //        STEP 3 취향 분석
  { fill: TRACK, rest: [] }, //         STEP 4 약관 동의
];

const SEGMENT = 42;
const pct = (v: number) => `${(v / TRACK) * 100}%` as const;

export default function StepProgress({ step }: { step: 1 | 2 | 3 | 4 }) {
  const { fill, rest } = STEPS[step - 1];

  return (
    <View style={styles.track}>
      <LinearGradient
        colors={[...colors.accentGradient]}
        locations={[...colors.accentGradientLocations]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.fill, { width: pct(fill) }]}
      />
      {rest.map((left) => (
        <View key={left} style={[styles.rest, { left: pct(left), width: pct(SEGMENT) }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    height: s(5),
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: s(5),
    borderRadius: s(3),
  },
  rest: {
    position: 'absolute',
    top: s(1),
    height: s(3),
    borderRadius: s(3),
    backgroundColor: '#D9D9D9',
  },
});
