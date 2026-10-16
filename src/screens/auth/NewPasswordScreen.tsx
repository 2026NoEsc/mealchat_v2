import { Lock } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/AuthProvider';
import KeyboardSafeScreen from '../../components/KeyboardSafeScreen';
import { AuthFooter, AuthTopBar, authStyles } from '../../components/ui/AuthLayout';
import { PrimaryButton, TextButton } from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import { authErrorMessage, confirmProblem, passwordProblem } from '../../lib/password';
import { v3Colors as colors } from '../../theme/tokens';

type Props = { onCancelRequested?: () => void; onCancelFailed?: () => void; onPasswordChanged?: () => void };

export default function NewPasswordScreen({ onCancelRequested, onCancelFailed, onPasswordChanged }: Props = {}) {
  const insets = useSafeAreaInsets();
  const { user, completePasswordReset, cancelPasswordReset } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const busy = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const passwordError = password ? passwordProblem(password) ?? undefined : undefined;
  const confirmError = confirm ? confirmProblem(password, confirm) ?? undefined : undefined;
  const canSubmit = !passwordProblem(password) && !confirmProblem(password, confirm);
  const submit = async () => {
    if (!canSubmit || busy.current) return;
    busy.current = true;
    setSubmitting(true);
    setError('');
    try {
      const result = await completePasswordReset(password);
      if (result) { if (mounted.current) setError(authErrorMessage(result.message)); }
      else onPasswordChanged?.();
    } catch { if (mounted.current) setError('변경하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    finally { busy.current = false; if (mounted.current) setSubmitting(false); }
  };
  const cancel = async () => {
    if (busy.current) return;
    busy.current = true;
    onCancelRequested?.();
    setSubmitting(true);
    try {
      const result = await cancelPasswordReset();
      if (result) {
        onCancelFailed?.();
        if (mounted.current) setError(authErrorMessage(result.message));
      }
    } catch {
      onCancelFailed?.();
      if (mounted.current) setError('취소하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally { busy.current = false; if (mounted.current) setSubmitting(false); }
  };
  return <KeyboardSafeScreen style={[authStyles.screen, { paddingTop: insets.top }]}>
    <AuthTopBar />
    <ScrollView style={authStyles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={authStyles.iconBadge}><Lock size={26} color={colors.selectedText} aria-hidden={true} /></View>
      <View style={styles.title}>
        <Text accessibilityRole="header" style={authStyles.title}>새 비밀번호를 정해 주세요</Text>
        <Text style={authStyles.subtitle}>{user?.email ? `${user.email} 계정의 비밀번호를 바꿔요.` : '계정의 비밀번호를 바꿔요.'}</Text>
      </View>
      <TextField label="새 비밀번호" value={password} secureTextEntry autoCapitalize="none" autoCorrect={false} onChangeText={(value) => { setPassword(value); setError(''); }}
        helper="8자 이상" error={passwordError || error || undefined} autoFocus autoComplete="new-password" />
      <TextField label="새 비밀번호 재확인" value={confirm} secureTextEntry autoCapitalize="none" autoCorrect={false} onChangeText={setConfirm} error={confirmError}
        helper={confirm && !confirmError ? '비밀번호가 일치해요.' : undefined} autoComplete="new-password" />
    </ScrollView>
    <AuthFooter>
      <PrimaryButton label="비밀번호 바꾸기" loading={submitting} disabled={!canSubmit} onPress={() => void submit()} />
      <TextButton label="나중에 하기 (로그인 화면으로)" disabled={submitting} onPress={() => void cancel()} />
    </AuthFooter>
  </KeyboardSafeScreen>;
}

const styles = StyleSheet.create({
  body: { paddingTop: 8, paddingHorizontal: 20, paddingBottom: 24, gap: 18 },
  title: { gap: 6 },
});
