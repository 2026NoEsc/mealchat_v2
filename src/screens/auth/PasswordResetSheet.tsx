import { Mail } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import BottomSheet from '../../components/ui/BottomSheet';
import { PrimaryButton } from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import { isEmailShaped } from '../../lib/emailFormat';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

function deliveryError(error: unknown): string | null {
  const detail = error as { status?: number; name?: string; code?: string } | null;
  // 사용자 정책: 계정 열거를 막기 위해 5xx·계정 없음·메일 쿨다운은 성공과 같은 안내로 응답한다.
  // AuthRetryableFetchError는 5xx도 포함하며 네트워크 오류 구분 기준은 status === 0이다.
  if (!detail || (detail.status !== undefined && detail.status >= 500) || detail.code === 'over_email_send_rate_limit') return null;
  if (detail.status === 429) return '요청이 많아요. 잠시 후 다시 시도해 주세요.';
  if (detail.status === 0 || detail.name === 'AuthRetryableFetchError' || detail.name === 'TypeError') {
    return '네트워크 연결을 확인한 뒤 다시 시도해 주세요.';
  }
  return null;
}

/** 558:1631. Never render provider error messages that could disclose an account. */
export default function PasswordResetSheet({ initialEmail, onClose }: { initialEmail: string; onClose: () => void }) {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const submit = async () => {
    if (request.current) return;
    if (!isEmailShaped(email)) { setError('이메일 주소 형식을 확인해 주세요.'); return; }
    request.current = true;
    setSending(true);
    setSent(false);
    setError('');
    try {
      const result = await sendPasswordReset(email.trim().toLowerCase());
      if (!mounted.current) return;
      const message = deliveryError(result);
      if (message) setError(message);
      else setSent(true);
    } catch (result) {
      if (!mounted.current) return;
      const message = deliveryError(result);
      if (message) setError(message);
      else setSent(true);
    } finally { request.current = false; if (mounted.current) setSending(false); }
  };
  return <BottomSheet visible title="비밀번호 재설정" subtitle="가입한 이메일로 새 비밀번호를 정하는 링크를 보내 드려요." onClose={onClose}>
    <TextField label="이메일" value={email} onChangeText={(value) => { setEmail(value); setError(''); setSent(false); }}
      placeholder="이메일을 입력해 주세요" keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
      autoFocus editable={!sending} error={error || undefined} />
    {sent ? <View style={styles.success} accessibilityLiveRegion="polite">
      <Mail size={18} color={colors.safeText} aria-hidden={true} />
      {/* TODO(서버 단계): 재설정 링크 만료 시간을 Auth 설정과 대조해 1시간 안내를 확인한다. */}
      <Text style={styles.successText}>{'메일을 보냈어요. 링크는 1시간 동안 열 수 있어요.\n메일이 오지 않으면 잠시 뒤 다시 보내 주세요.'}</Text>
    </View> : null}
    <PrimaryButton label="재설정 메일 보내기" loading={sending} onPress={() => void submit()} />
  </BottomSheet>;
}

const styles = StyleSheet.create({
  success: { paddingVertical: 12, paddingHorizontal: 14, gap: 10, borderRadius: 12, backgroundColor: colors.safeBg, flexDirection: 'row', alignItems: 'center' },
  successText: { flex: 1, fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 20, color: colors.safeText },
});
