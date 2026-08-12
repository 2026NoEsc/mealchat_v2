import { StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';

import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

type Props = TextInputProps & {
  label: string;
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * Figma 회원가입 폼 필드 — 라벨(h10) + 흰 입력창(184 x 23, radius 9)
 */
export default function TextField({ label, containerStyle, style, ...rest }: Props) {
  return (
    <View style={containerStyle}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={colors.textMuted}
        {...rest}
      />
    </View>
  );
}

export const fieldStyles = StyleSheet.create({
  box: {
    height: s(23),
    borderRadius: s(9),
    backgroundColor: colors.card,
    justifyContent: 'center',
    paddingHorizontal: s(8),
  },
  value: {
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
});

const styles = StyleSheet.create({
  label: {
    marginBottom: s(1),
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(10),
    color: colors.textMuted,
  },
  input: {
    height: s(23),
    borderRadius: s(9),
    backgroundColor: colors.card,
    paddingHorizontal: s(8),
    paddingVertical: 0,
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
});
