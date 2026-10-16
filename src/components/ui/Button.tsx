import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';

import { v3Layout } from '../../theme/scale';
import { colors as legacyColors, v3Colors as colors, v3FeedbackColors, v3Radii } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: 'primary' | 'secondary' | 'text';
  loading?: boolean;
  showNext?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Figma Button set 493:1052; geometry supplied from the coordinator's measurements. */
export function Button(props: ButtonProps) {
  return <ButtonControl {...props} />;
}

export default Button;

function ButtonControl({
  label,
  variant = 'primary',
  disabled = false,
  loading = false,
  showNext = false,
  style,
  accessibilityState,
  accessibilityLabel,
  ...rest
}: Omit<ButtonProps, 'variant'> & { variant?: ButtonProps['variant'] | 'danger' }) {
  const inactive = disabled || loading;
  const foreground = variant === 'danger'
    ? v3FeedbackColors.error
    : variant === 'primary' ? colors.onPrimary : colors.ink;

  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ ...accessibilityState, disabled: inactive, busy: loading }}
      aria-busy={loading}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        style,
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
      ]}>
      {loading ? <ActivityIndicator color={foreground} accessible={false} /> : null}
      <Text style={[styles.label, { color: foreground }]}>
        {showNext ? `${label} →` : label}
      </Text>
    </Pressable>
  );
}

export function PrimaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button {...props} variant="primary" />;
}

export function SecondaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button {...props} variant="secondary" />;
}

export function TextButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button {...props} variant="text" />;
}

/** Complete keeps one legacy alias; former Accent callers now use PrimaryButton. */
export { PrimaryButton as CompleteButton };

export function AddButton({ label = '+ 메이트 초대', ...rest }: Omit<ButtonProps, 'label' | 'variant'> & { label?: string }) {
  return <PrimaryButton {...rest} label={label} />;
}

export function DangerButton(props: Omit<ButtonProps, 'variant'>) {
  return <ButtonControl {...props} variant="danger" />;
}

const styles = StyleSheet.create({
  base: {
    minHeight: v3Layout.buttonHeight,
    minWidth: v3Layout.minTouchTarget,
    borderRadius: v3Radii.button,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  text: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.surface, borderWidth: 1, borderColor: legacyColors.danger },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    flexShrink: 1,
  },
});
