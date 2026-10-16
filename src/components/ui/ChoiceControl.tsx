import type { ReactNode } from 'react';
import { Check } from 'lucide-react-native';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

import { v3Layout } from '../../theme/scale';
import { v3Colors as colors, v3Radii } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

export type ChoiceProps = {
  label: string;
  children?: ReactNode;
  radioSize?: 24;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

/** Internal visual shared by Radio and Checkbox; the whole row is the target. */
export function ChoiceControl({
  label, checked, onPress, kind, disabled = false, accessibilityLabel, style, children, radioSize, labelStyle,
}: ChoiceProps & { checked: boolean; onPress: () => void; kind: 'radio' | 'checkbox' }) {
  return (
    <Pressable
      accessibilityRole={kind}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked, disabled }}
      aria-checked={checked}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, style, pressed && !disabled && styles.pressed, disabled && styles.disabled]}>
      <View accessible={false} importantForAccessibility="no-hide-descendants"
        style={kind === 'checkbox' ? styles.checkboxTarget : undefined}>
        <View style={[
          styles.control,
          kind === 'radio' ? styles.radio : styles.checkbox,
          checked && (kind === 'radio' ? styles.radioChecked : styles.checkboxChecked),
          kind === 'radio' && radioSize === 24 && { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
        ]}>
          {checked && kind === 'radio' && radioSize === 24 ? <View style={styles.radioDot} /> : null}
          {checked && kind === 'checkbox' ? <Check size={16} color={colors.onPrimary} strokeWidth={2.5} /> : null}
        </View>
      </View>
      {children ?? <Text style={[styles.label, kind === 'radio' && styles.radioLabel, kind === 'radio' && checked && styles.radioLabelChecked, labelStyle]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: v3Layout.minTouchTarget,
    minWidth: v3Layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  control: { borderWidth: 1.5, borderColor: colors.sub, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  radio: { width: 20, height: 20, borderRadius: 10 },
  radioChecked: { borderWidth: 6, borderColor: colors.primary },
  checkboxTarget: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  checkbox: { width: 22, height: 22, borderRadius: v3Radii.checkbox },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { fontFamily: fontFamily.body, fontSize: 16, lineHeight: 24, color: colors.ink, flexShrink: 1 },
  radioLabel: { fontSize: 14, fontFamily: fontFamily.regular },
  radioLabelChecked: { fontFamily: fontFamily.bold },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
});
