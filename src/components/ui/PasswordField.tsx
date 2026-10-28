import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { v3Layout } from '../../theme/scale';
import { v3Colors } from '../../theme/tokens';
import TextField, { type TextFieldProps } from './TextField';

/** 519:1229: overlay a 44-unit toggle inside the existing 52-unit TextField. */
export default function PasswordField({ containerStyle, style, ...props }: TextFieldProps) {
  const [visible, setVisible] = useState(false);
  return <TextField {...props} containerStyle={containerStyle} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false}
    style={[style, styles.input]} inputAccessory={<Pressable accessibilityRole="button" accessibilityLabel={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
      accessibilityState={{ selected: visible }} onPress={() => setVisible((value) => !value)}
      style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
      {visible ? <EyeOff size={22} color={v3Colors.sub} aria-hidden={true} /> : <Eye size={22} color={v3Colors.sub} aria-hidden={true} />}
    </Pressable>} />;
}

const styles = StyleSheet.create({
  input: { paddingRight: 52 },
  toggle: { width: v3Layout.minTouchTarget, height: v3Layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
});
