import { LinearGradient } from 'expo-linear-gradient';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { fs, s } from '../../theme/scale';
import { colors, radii, shadows } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

type BaseProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Figma AccentButton (378:2894) / AccentAndNextButton (378:2906)
 * 그라디언트 #F66F3E 25.96% → #F6C53E 93.75%, radius 10, 높이 28
 */
export function AccentButton({
  label,
  onPress,
  disabled,
  style,
  showNext,
}: BaseProps & { showNext?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        shadows.accent,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <LinearGradient
        colors={[...colors.accentGradient]}
        locations={[...colors.accentGradientLocations]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.accentLabel}>{showNext ? `${label} →` : label}</Text>
    </Pressable>
  );
}

/**
 * Figma CompleteButton (309:2483) / CompleteAndNextButton (309:2484)
 * 단색 #FF9900, radius 10, 높이 28
 */
export function CompleteButton({
  label,
  onPress,
  disabled,
  style,
  showNext,
}: BaseProps & { showNext?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles.solid,
        shadows.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <Text style={styles.solidLabel}>{showNext ? `${label} →` : label}</Text>
    </Pressable>
  );
}

/** Figma AddButton (525:3216) — CompleteButton 과 동일 스타일, 기본 라벨만 다름 */
export function AddButton({ label = '+ 메이트 초대', onPress, disabled, style }: Partial<BaseProps>) {
  return (
    <CompleteButton label={label} onPress={onPress} disabled={disabled} style={style} />
  );
}

/**
 * Figma DangerButton (309:2422)
 * 흰 배경 + #F53942 보더 0.6, radius 8, 높이 28
 */
export function DangerButton({ label, onPress, disabled, style }: BaseProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles.danger,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <Text style={styles.dangerLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: s(28),
    borderRadius: s(radii.button),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  solid: {
    backgroundColor: colors.primary,
  },
  danger: {
    backgroundColor: colors.card,
    borderWidth: s(0.6),
    borderColor: colors.danger,
    borderRadius: s(radii.buttonOutline),
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.4,
  },
  accentLabel: {
    fontFamily: fontFamily.body,
    fontSize: fs(10),
    lineHeight: fs(15),
    fontWeight: weight.extrabold,
    color: colors.textOnAccent,
    textAlign: 'center',
  },
  solidLabel: {
    fontFamily: fontFamily.body,
    fontSize: fs(9.5),
    lineHeight: fs(20),
    fontWeight: weight.extrabold,
    color: colors.textOnAccent,
    textAlign: 'center',
  },
  dangerLabel: {
    fontFamily: fontFamily.body,
    fontSize: fs(8.5),
    lineHeight: fs(11.5),
    fontWeight: weight.semibold,
    color: colors.danger,
    textAlign: 'center',
  },
});
