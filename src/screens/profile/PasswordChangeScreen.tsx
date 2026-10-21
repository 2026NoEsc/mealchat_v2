import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/AuthProvider';
import KeyboardSafeScreen from '../../components/KeyboardSafeScreen';
import { AuthFooter, AuthTopBar, authStyles } from '../../components/ui/AuthLayout';
import { PrimaryButton } from '../../components/ui/Button';
import PasswordField from '../../components/ui/PasswordField';
import { authErrorMessage, confirmProblem, passwordProblem } from '../../lib/password';
import { verifyCurrentPassword } from '../../lib/passwordReauthentication';
import { useNavigation } from '../../navigation/NavigationContext';

function passwordChangeError(error: unknown): string {
  const detail = error && typeof error === 'object' ? error as { code?: unknown; status?: unknown; message?: unknown } : null;
  if (detail?.status === 429 || detail?.code === 'over_request_rate_limit') {
    return '요청이 많아요. 잠시 후 다시 시도해 주세요.';
  }
  if (detail?.code === 'invalid_credentials' || (!detail?.code && detail?.message === 'Invalid login credentials')) {
    return '현재 비밀번호가 맞지 않아요. 다시 확인해 주세요.';
  }
  if (detail?.status === 0 || (!detail?.code && ['Network request failed', 'Failed to fetch', 'fetch failed'].includes(String(detail?.message)))) {
    return '네트워크 연결을 확인한 뒤 다시 시도해 주세요.';
  }
  return authErrorMessage(error);
}

/** Phone 601:2733. 화면 단 재확인(서버 강제 아님) 뒤 기존 updatePassword API를 호출한다. */
export default function PasswordChangeScreen() {
  const { user, updatePassword } = useAuth();
  const currentUser = useRef(user);
  currentUser.current = user;
  const { canGoBack, goBack, goBackWith, resetTo } = useNavigation();
  const insets = useSafeAreaInsets();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const mounted = useRef(true);
  const locked = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const newProblem = password ? passwordProblem(password) ?? (password === currentPassword ? '지금 비밀번호와 다르게 입력해 주세요.' : null) : null;
  const mismatch = confirm ? confirmProblem(password, confirm) : null;
  const providers = user?.app_metadata?.providers;
  const identities = user?.identities;
  const knownProviders = Array.isArray(providers) && providers.length > 0;
  const knownIdentities = Array.isArray(identities) && identities.length > 0;
  const passwordAccount = Boolean(user?.email && (
    (!knownProviders && !knownIdentities && !user?.app_metadata?.provider)
    || (knownProviders && providers.includes('email')) || user?.app_metadata?.provider === 'email'
    || (knownIdentities && identities.some((identity) => identity.provider === 'email'))
  ));
  const valid = Boolean(passwordAccount && currentPassword && password && confirm && !newProblem && !mismatch);
  const change = (setter: (value: string) => void) => (value: string) => { setter(value); setError(undefined); };
  const submit = async () => {
    if (locked.current || !valid) return;
    locked.current = true;
    setSaving(true);
    setError(undefined);
    try {
      const expectedUserId = user?.id;
      if (!expectedUserId) return;
      const verificationError = await verifyCurrentPassword(expectedUserId, currentPassword);
      if (!mounted.current) return;
      if (verificationError) { setError(passwordChangeError(verificationError)); return; }
      if (currentUser.current?.id !== expectedUserId) { setError('잠시 후 다시 시도해 주세요.'); return; }
      const result = await updatePassword(password);
      if (!mounted.current) return;
      if (result) { setError(passwordChangeError(result)); return; }
      // The destination owns the Toast, so it remains visible after this screen unmounts.
      if (canGoBack) goBackWith({ passwordChanged: true });
      else resetTo('ProfileEdit', { passwordChanged: true });
    } catch (failure) {
      if (mounted.current) setError(passwordChangeError(failure));
    } finally {
      if (mounted.current) { locked.current = false; setSaving(false); }
    }
  };
  return <KeyboardSafeScreen style={[authStyles.screen, { paddingTop: insets.top }]}>
    <AuthTopBar title="비밀번호 변경" onBack={() => canGoBack ? goBack() : resetTo('ProfileEdit')} />
    <ScrollView style={authStyles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <PasswordField label="현재 비밀번호" value={currentPassword} onChangeText={change(setCurrentPassword)} autoComplete="current-password" editable={!saving && passwordAccount}
        helper={!passwordAccount ? '이 로그인 방법에서는 비밀번호를 바꿀 수 없어요.' : undefined} />
      <PasswordField label="새 비밀번호" value={password} onChangeText={change(setPassword)} autoComplete="new-password" editable={!saving}
        helper="8자 이상, 지금 비밀번호와 다르게" error={newProblem ?? undefined} />
      <PasswordField label="새 비밀번호 확인" value={confirm} onChangeText={change(setConfirm)} autoComplete="new-password" editable={!saving}
        helper={confirm && !mismatch ? '비밀번호가 일치해요.' : undefined} error={mismatch ?? error} />
    </ScrollView>
    <AuthFooter><PrimaryButton label="비밀번호 바꾸기" disabled={!valid || saving} loading={saving} onPress={() => void submit()} /></AuthFooter>
  </KeyboardSafeScreen>;
}

const styles = StyleSheet.create({
  body: { paddingTop: 8, paddingHorizontal: 20, paddingBottom: 20, gap: 18 },
});
