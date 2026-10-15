import { Check } from 'lucide-react-native';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { v3Layout } from '../../theme/scale';
import { v3Colors as colors, v3Radii } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

export type ChipProps = {
  label: string;
  selected: boolean;
  onChange: (selected: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** Target: 493:1045. Independent selection allows multiple chips to be checked. */
export function Chip({ label, selected, onChange, disabled = false, accessibilityLabel, style }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      disabled={disabled}
      onPress={() => onChange(!selected)}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        style,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}>
      {selected ? (
        <View accessible={false} importantForAccessibility="no-hide-descendants">
          <Check size={14} color={colors.selectedText} />
        </View>
      ) : null}
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

export default Chip;

const styles = StyleSheet.create({
  chip: {
    minHeight: v3Layout.minTouchTarget,
    minWidth: v3Layout.minTouchTarget,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: v3Radii.chip,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.selectedBg, borderColor: colors.selectedText, borderWidth: 1.5, paddingVertical: 9.5, paddingHorizontal: 15.5 },
  label: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 22, color: colors.sub, flexShrink: 1 },
  selectedLabel: { color: colors.selectedText, fontFamily: fontFamily.bold },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
});
