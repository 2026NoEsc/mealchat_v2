import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { s } from '../theme/scale';
import { colors } from '../theme/tokens';

/** Figma BackButton (525:3226) — 14 x 13 흰 칩 안의 왼쪽 화살표 */
export default function BackButton({
  onPress,
  style,
}: {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable style={[styles.chip, style]} onPress={onPress} hitSlop={s(8)}>
      <Svg width={s(7)} height={s(7)} viewBox="0 0 8 8" fill="none">
        <Path
          d="M7 4H1M1 4L3.6 1.4M1 4L3.6 6.6"
          stroke={colors.textPrimary}
          strokeWidth={1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: s(14),
    height: s(13),
    borderRadius: s(4),
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
