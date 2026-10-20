import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import KeyboardSafeScreen from '../components/KeyboardSafeScreen';
import { AuthTopBar, authStyles } from '../components/ui/AuthLayout';
import { PrimaryButton } from '../components/ui/Button';
import PasswordField from '../components/ui/PasswordField';
import TextField from '../components/ui/TextField';
import { authErrorMessage } from '../lib/password';
import { useNavigation } from '../navigation/NavigationContext';
import { v3Layout } from '../theme/scale';
import { v3Colors as colors } from '../theme/tokens';
import { fontFamily } from '../theme/typography';
import PasswordResetSheet from './auth/PasswordResetSheet';

const logo = require('../../assets/brand/logo-main.png');

export default function LoginScreen() {
  const { navigate, goBack, canGoBack, replace } = useNavigation();
  const insets = useSafeAreaInsets();
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const canSubmit = email.trim().length > 0 && password.length > 0;
  const signIn = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await signInWithEmail(email, password);
      if (result) setError(authErrorMessage(result.message));
    } catch { setError('로그인하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    finally { setSubmitting(false); }
  };
  return <KeyboardSafeScreen style={[authStyles.screen, { paddingTop: insets.top }]}>
    <AuthTopBar title="로그인" alignTitle="left" onBack={() => canGoBack ? goBack() : replace('SignupStart')} />
    <ScrollView style={authStyles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={styles.greeting}>
        <Image source={logo} style={styles.logo} resizeMode="contain" accessible={false} />
        <Text style={styles.greetingText}>다시 오셨네요, 반가워요!</Text>
      </View>
      <TextField label="이메일" value={email} onChangeText={(value) => { setEmail(value); setError(''); }}
        placeholder="이메일을 입력해 주세요" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
      <PasswordField label="비밀번호" value={password} onChangeText={(value) => { setPassword(value); setError(''); }}
        placeholder="비밀번호를 입력해 주세요" autoComplete="current-password" error={error || undefined} />
      <PrimaryButton label="로그인" loading={submitting} onPress={() => void signIn()} disabled={!canSubmit} />
      <View style={styles.links}>
        <Pressable accessibilityRole="button" onPress={() => setResetOpen(true)} style={({ pressed }) => [styles.link, pressed && authStyles.pressed]}>
          <Text style={styles.forgot}>비밀번호를 잊었나요?</Text>
        </Pressable>
        <View style={styles.signupRow}>
          <Text style={styles.signupHint}>아직 계정이 없나요?</Text>
          <Pressable accessibilityRole="button" onPress={() => navigate('SignupPersonal')} style={({ pressed }) => [styles.link, pressed && authStyles.pressed]}>
            <Text style={styles.signup}>회원가입</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
    {resetOpen ? <PasswordResetSheet initialEmail={email} onClose={() => setResetOpen(false)} /> : null}
  </KeyboardSafeScreen>;
}

const styles = StyleSheet.create({
  body: { paddingTop: 24, paddingHorizontal: 20, paddingBottom: 24, gap: 20 },
  greeting: { paddingTop: 16, paddingBottom: 12, gap: 10, alignItems: 'center' },
  logo: { width: 72, height: 72, borderRadius: 18 },
  greetingText: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 28, color: colors.ink },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' },
  link: { minHeight: v3Layout.minTouchTarget, minWidth: v3Layout.minTouchTarget, justifyContent: 'center' },
  forgot: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 22, color: colors.sub },
  signupRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  signupHint: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 22, color: colors.sub },
  signup: { fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 22, color: colors.selectedText },
});
