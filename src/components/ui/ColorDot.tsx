import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { v3Layout } from '../../theme/scale';
import { scheduleEventColors, scheduleLayout as layout } from '../../theme/scheduleTokens';
import { v3Colors as colors } from '../../theme/tokens';

export type ColorDotProps = { color: string; label: string; selected: boolean; disabled?: boolean; onSelect: () => void };

/** Figma 598:2376/2380: 32px dot with check + outline, within a 44px target. */
export default function ColorDot({ color, label, selected, disabled = false, onSelect }: ColorDotProps) {
  const checkColor = scheduleEventColors.find((entry) => entry.value === color)?.check ?? colors.ink;
  return (
    <Pressable accessibilityRole="radio" accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }} aria-checked={selected}
      disabled={disabled} onPress={onSelect}
      style={({ pressed }) => [styles.target, pressed && !disabled && styles.pressed, disabled && styles.disabled]}>
      <View accessible={false} importantForAccessibility="no-hide-descendants"
        style={[styles.dot, { backgroundColor: color }, selected && styles.selected]}>
        {selected ? <Check size={16} color={checkColor} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  target: { width: v3Layout.minTouchTarget, height: v3Layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  dot: { width: layout.colorDot, height: layout.colorDot, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  selected: { borderWidth: 2, borderColor: colors.ink }, pressed: { opacity: 0.8 }, disabled: { opacity: 0.4 },
});
