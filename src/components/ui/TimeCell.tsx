import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { v3Layout } from '../../theme/scale';
import { scheduleColors, scheduleLayout as layout } from '../../theme/scheduleTokens';
import { v3Colors as colors } from '../../theme/tokens';

export type TimeCellProps = {
  state: 'mine' | 'busy' | 'free' | 'shared';
  label: string;
  shared?: boolean;
  width?: number;
  disabled?: boolean;
  onPress: () => void;
};

/** Figma 597:2236/2239: 56×36 visual, separate non-overlapping 56×44 target. */
export default function TimeCell({ state, label, shared = state === 'shared', width = layout.timeWidth, disabled = false, onPress }: TimeCellProps) {
  const cellWidth = Math.max(v3Layout.minTouchTarget, Math.min(layout.timeWidth, width));
  const inactive = disabled || state === 'busy';
  return (
    <Pressable accessibilityRole="checkbox" accessibilityLabel={label}
      accessibilityState={{ checked: state === 'mine', disabled: inactive }}
      aria-checked={state === 'mine'} disabled={inactive} onPress={onPress}
      style={({ pressed }) => [styles.target, { width: cellWidth }, pressed && !inactive && styles.pressed]}>
      <View accessible={false} importantForAccessibility="no-hide-descendants"
        style={[styles.cell, { width: cellWidth }, styles[state], disabled && styles.past]}>
        {state === 'mine' ? <Check size={14} strokeWidth={3} color={colors.onPrimary} /> : null}
        {shared ? <View testID="mate-available-marker" style={[styles.marker, state === 'mine' && styles.mineMarker]}><View style={styles.dot} /><View style={styles.dot} /><View style={styles.dot} /></View> : null}
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  target: { width: layout.timeWidth, minHeight: v3Layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  cell: { width: layout.timeWidth, height: layout.timeHeight, borderRadius: layout.timeRadius, alignItems: 'center', justifyContent: 'center' },
  marker: { flexDirection: 'row', gap: 2 },
  mineMarker: { position: 'absolute', right: 4, bottom: 4 },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.ink },
  mine: { backgroundColor: colors.primary },
  busy: { backgroundColor: scheduleColors.busy },
  shared: { backgroundColor: scheduleColors.busy },
  free: { backgroundColor: colors.mutedBg },
  past: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
});
