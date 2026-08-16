import { Pressable, StyleSheet, View } from 'react-native';

import { s } from '../../theme/scale';
import { colors } from '../../theme/tokens';

type Props = {
  value: boolean;
  onChange: (next: boolean) => void;
  /** 일정 조율 화면의 "자동 연동" 처럼 작은 크기가 필요할 때 */
  size?: 'sm' | 'md';
};

/**
 * Figma 정보 공개 범위 (256:2494) 의 토글.
 * 켜짐은 브랜드 오렌지, 꺼짐은 회색이며 손잡이는 흰 원이다.
 */
export default function Toggle({ value, onChange, size = 'md' }: Props) {
  const track = size === 'md' ? styles.trackMd : styles.trackSm;
  const knob = size === 'md' ? styles.knobMd : styles.knobSm;

  return (
    <Pressable
      style={[styles.track, track, value ? styles.trackOn : styles.trackOff]}
      hitSlop={s(6)}
      onPress={() => onChange(!value)}>
      <View style={[styles.knob, knob, value && styles.knobOn]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    justifyContent: 'center',
    paddingHorizontal: s(1.5),
  },
  trackMd: {
    width: s(26),
    height: s(15),
    borderRadius: s(15),
  },
  trackSm: {
    width: s(14),
    height: s(8),
    borderRadius: s(8),
  },
  trackOn: {
    backgroundColor: colors.primary,
  },
  trackOff: {
    backgroundColor: colors.surfaceStrong,
  },
  knob: {
    backgroundColor: colors.card,
  },
  knobMd: {
    width: s(11),
    height: s(11),
    borderRadius: s(11),
  },
  knobSm: {
    width: s(6),
    height: s(6),
    borderRadius: s(6),
  },
  knobOn: {
    alignSelf: 'flex-end',
  },
});
