import { Pressable, PressableProps, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { v3Colors as colors } from '../../theme/tokens';

export type SwitchProps = Omit<PressableProps, 'children' | 'style' | 'onPress' | 'accessibilityLabel'> & {
  value: boolean;
  onChange: (value: boolean) => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

/** Targets: 597:2218 / 597:2221. The visual track sits inside a 56 x 44 target. */
export function Switch({ value, onChange, disabled = false, style, accessibilityState, ...rest }: SwitchProps) {
  const inactive = Boolean(disabled);
  return (
    <Pressable
      {...rest}
      accessibilityRole="switch"
      accessibilityState={{ ...accessibilityState, checked: value, disabled: inactive }}
      aria-checked={value}
      disabled={inactive}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [styles.target, style, pressed && !inactive && styles.pressed, inactive && styles.disabled]}>
      <View accessible={false} importantForAccessibility="no-hide-descendants"
        style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

export default Switch;

const styles = StyleSheet.create({
  target: { width: 56, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  track: { width: 48, height: 28, borderRadius: 14, padding: 3, backgroundColor: colors.sub },
  trackOn: { backgroundColor: colors.primary },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surface },
  knobOn: { alignSelf: 'flex-end', backgroundColor: colors.onPrimary },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
});
