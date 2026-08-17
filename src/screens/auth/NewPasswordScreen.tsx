import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/AuthProvider';
import ScreenHeader from '../../components/ScreenHeader';
import { AccentButton } from '../../components/ui/Button';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

/** Supabase 기본 최소 길이 — Dashboard 에서 올리면 서버가 다시 거른다 */
const MIN_LENGTH = 6;

/**
 * 비밀번호 재설정 링크로 들어왔을 때만 나오는 화면.
 * 링크 교환으로 이미 세션이 생긴 상태이므로, 새 비밀번호를 정하기 전에는
 * 앱 본문으로 넘어가지 못하게 막는다. (링크 = 사실상 로그인 이 되는 것을 막는다)
 */
export default function NewPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { completePasswordReset, cancelPasswordReset } = useAuth();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = password.length >= MIN_LENGTH && confirm.length > 0;

  const submit = async () => {
    if (!canSubmit) return;

    if (password !== confirm) {
      Alert.alert('입력 확인', '비밀번호가 서로 다릅니다.');
      return;
    }

    setSubmitting(true);
    const error = await completePasswordReset(password);
    setSubmitting(false);

    if (error) {
      Alert.alert('변경 실패', error.message);
      return;
    }

    Alert.alert('변경 완료', '새 비밀번호로 바뀌었어요.');
  };

  const cancel = async () => {
    const error = await cancelPasswordReset();
    if (error) Alert.alert('취소 실패', error.message);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader title="새 비밀번호 설정" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            {`쓰실 새 비밀번호를 정해주세요.\n최소 ${MIN_LENGTH}자 이상이어야 해요.`}
          </Text>

          <Text style={styles.label}>새 비밀번호</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="새 비밀번호를 입력하세요"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />

          <Text style={[styles.label, styles.labelSpacing]}>새 비밀번호 재확인</Text>
          <TextInput
            style={styles.input}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="한 번 더 입력하세요"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          <AccentButton
            label={submitting ? '변경 중' : '비밀번호 변경'}
            style={styles.submit}
            onPress={() => void submit()}
            disabled={!canSubmit || submitting}
          />

          <Pressable style={styles.cancelRow} onPress={() => void cancel()} disabled={submitting}>
            <Text style={styles.helper}>나중에 하기 (로그인 화면으로)</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: s(18),
    paddingBottom: s(30),
  },
  intro: {
    marginTop: s(28),
    marginBottom: s(14),
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(11),
    color: colors.textMuted,
  },
  label: {
    marginTop: s(4),
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    fontWeight: weight.medium,
    color: colors.textPrimary,
  },
  labelSpacing: {
    marginTop: s(8),
  },
  input: {
    marginTop: s(1),
    height: s(23),
    borderRadius: s(9),
    backgroundColor: colors.card,
    paddingHorizontal: s(8),
    paddingVertical: 0,
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    fontWeight: weight.semibold,
    color: colors.textPrimary,
  },
  submit: {
    marginTop: s(12),
    marginHorizontal: s(-6),
  },
  cancelRow: {
    marginTop: s(9),
    alignItems: 'center',
  },
  helper: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(10),
    color: colors.textMuted,
  },
});
