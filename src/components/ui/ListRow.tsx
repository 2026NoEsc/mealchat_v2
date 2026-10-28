import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { v3Layout } from '../../theme/scale';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

export type ListRowProps = {
  title: string;
  value?: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** Target: 518:1280. Values can wrap and grow the row for larger system text. */
export function ListRow({ title, value, onPress, disabled = false, accessibilityLabel, style }: ListRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, value].filter(Boolean).join(', ')}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, style, pressed && !disabled && styles.pressed, disabled && styles.disabled]}>
      <Text style={styles.title}>{title}</Text>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.arrowSlot}>
        <ChevronRight size={20} color={colors.sub} />
      </View>
    </Pressable>
  );
}

export default ListRow;

const styles = StyleSheet.create({
  row: {
    minHeight: v3Layout.rowHeight,
    minWidth: v3Layout.minTouchTarget,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    gap: 8,
  },
  title: { flex: 1, fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 24, color: colors.ink },
  value: { flexShrink: 1, maxWidth: '50%', textAlign: 'right', fontFamily: fontFamily.body, fontSize: 14, lineHeight: 22, color: colors.sub },
  // The icon area can overlap padding while the row remains 56 at default text size.
  arrowSlot: { width: 28, height: 44, marginVertical: -8, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
});
