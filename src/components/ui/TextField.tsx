import { useEffect, useId, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';

import { fs, s, v3Layout } from '../../theme/scale';
import { colors as legacyColors, v3Colors as colors, v3FeedbackColors, v3Radii } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

export type TextFieldProps = TextInputProps & {
  label: string;
  helper?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

/** Targets: 518:1264/1269/1274. Error takes precedence over focus. */
export default function TextField({
  label,
  helper,
  error,
  containerStyle,
  style,
  onFocus,
  onBlur,
  accessibilityLabel,
  accessibilityHint,
  editable = true,
  accessibilityState,
  ...rest
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const id = useId();
  const message = error || helper;
  const labelId = `${id}-label`;
  const messageId = `${id}-message`;
  const previousError = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (Platform.OS === 'ios' && error && error !== previousError.current) {
      AccessibilityInfo.announceForAccessibility(`오류: ${error}`);
    }
    previousError.current = error;
  }, [error]);

  return (
    <View style={containerStyle}>
      <Text nativeID={labelId} style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.sub}
        {...rest}
        editable={editable}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityLabelledBy={labelId}
        accessibilityHint={error ? `오류: ${message}` : accessibilityHint ?? message}
        accessibilityState={{ ...accessibilityState, disabled: !editable }}
        aria-invalid={Boolean(error)}
        aria-describedby={message ? messageId : undefined}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        style={[
          styles.input,
          style,
          focused && styles.focused,
          Boolean(error) && styles.errorInput,
          !editable && styles.disabled,
        ]}
      />
      {message ? (
        <Text
          nativeID={messageId}
          accessibilityLabel={error ? `오류: ${message}` : undefined}
          accessibilityLiveRegion={Platform.OS === 'android' && error ? 'polite' : 'none'}
          aria-live={Platform.OS === 'web' && error ? 'polite' : undefined}
          style={[styles.message, Boolean(error) && styles.errorMessage]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

/** Legacy pickers spread these styles; keep their 220-coordinate geometry. */
export const fieldStyles = StyleSheet.create({
  box: {
    height: s(23),
    borderRadius: s(9),
    backgroundColor: legacyColors.card,
    justifyContent: 'center',
    paddingHorizontal: s(8),
  },
  value: {
    fontFamily: fontFamily.bold,
    fontSize: fs(8),
    color: legacyColors.textPrimary,
  },
});

const styles = StyleSheet.create({
  label: {
    marginBottom: 6,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 20,
    color: colors.sub,
  },
  input: {
    // The 2px focus border replaces the browser's black default outline.
    ...Platform.select({ web: { outlineStyle: 'solid' as const, outlineWidth: 0 } }),
    minHeight: v3Layout.fieldHeight,
    borderRadius: v3Radii.field,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fontFamily.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
  },
  focused: { borderColor: colors.primary, borderWidth: 2 },
  errorInput: { borderColor: v3FeedbackColors.error, borderWidth: 2 },
  disabled: { opacity: 0.4 },
  message: { marginTop: 6, fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18, color: colors.sub },
  errorMessage: { color: v3FeedbackColors.error },
});
