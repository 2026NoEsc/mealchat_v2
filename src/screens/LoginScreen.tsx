import { useState } from 'react';
import {
  Alert,
  Image,
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

import { useAuth } from '../auth/AuthProvider';
import ScreenHeader from '../components/ScreenHeader';
import { AccentButton } from '../components/ui/Button';
import { useNavigation } from '../navigation/NavigationContext';
import { fs, s } from '../theme/scale';
import { colors } from '../theme/tokens';
import { fontFamily, weight } from '../theme/typography';

const logo = require('../../assets/brand/logo-main.png');

/**
 * Figma 회원가입/로그인 (150:124) — 220 x 486
 * 좌표 기준(프레임 절대값): 로고 y138 / 워드마크 y188 / 태그라인 y204 /
 * 아이디 y218·입력 y229 / 비밀번호 y260·입력 y271 / 버튼 y302 / 안내 y337, y356
 */
export default function LoginScreen() {
  const { navigate, goBack, canGoBack } = useNavigation();
  const insets = useSafeAreaInsets();
  const { sendPasswordReset, signInWithEmail } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  const signIn = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    const error = await signInWithEmail(email, password);
    setSubmitting(false);

    if (error) Alert.alert('로그인 실패', error.message);
  };

  const resetPassword = async () => {
    if (!email.trim()) {
      Alert.alert('이메일 입력', '비밀번호 재설정 메일을 받을 이메일을 입력해 주세요.');
      return;
    }

    const error = await sendPasswordReset(email);
    if (error) {
      Alert.alert('재설정 메일 전송 실패', error.message);
    } else {
      Alert.alert('메일 전송 완료', '이메일의 재설정 링크를 열어 새 비밀번호를 설정해 주세요.');
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader title="로그인" onBack={canGoBack ? goBack : undefined} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <Image source={logo} style={styles.logo} resizeMode="contain" />
            <Text style={styles.wordmark}>MEALCHAT</Text>
            <Text style={styles.tagline}>다시 오셨네요, 반가워요!</Text>
          </View>

          <Text style={styles.label}>이메일</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="이메일을 입력하세요"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.label, styles.labelSpacing]}>비밀번호</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="비밀번호를 입력하세요"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
          />

          <AccentButton
            label={submitting ? '로그인 중' : '로그인'}
            style={styles.submit}
            onPress={() => void signIn()}
            disabled={!canSubmit || submitting}
          />

          <View style={styles.signupRow}>
            <Text style={styles.helper}>아직 계정이 없나요? </Text>
            <Pressable onPress={() => navigate('SignupStart')}>
              <Text style={styles.signupLink}>회원가입</Text>
            </Pressable>
          </View>

          <Pressable style={styles.findRow} onPress={() => void resetPassword()}>
            <Text style={styles.helper}>아이디 비밀번호 찾기</Text>
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
    // 라벨·입력창이 x18 에서 시작하고 폭이 184 (= 220 - 18*2)
    paddingHorizontal: s(18),
    paddingBottom: s(30),
  },
  brand: {
    alignItems: 'center',
    // 헤더 블록 종료(y65) → 로고 상단(y138)
    marginTop: s(73),
  },
  logo: {
    width: s(39.06),
    height: s(38.94),
  },
  wordmark: {
    // 로고 하단(y177) → 워드마크(y188)
    marginTop: s(11),
    fontFamily: fontFamily.wordmark,
    fontSize: fs(10.8),
    lineHeight: fs(13),
    fontWeight: weight.extrabold,
    color: colors.primary,
    letterSpacing: fs(-0.1),
  },
  tagline: {
    marginTop: s(6),
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
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
    // 아이디 입력 하단(y252) → 비밀번호 라벨(y260)
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
    // 버튼은 x12 w197 로 입력창(x18 w184)보다 바깥으로 6 만큼 넓다
    marginTop: s(8),
    marginHorizontal: s(-6),
  },
  signupRow: {
    marginTop: s(7),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helper: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(10),
    color: colors.textMuted,
  },
  signupLink: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(10),
    fontWeight: weight.bold,
    color: colors.primary,
  },
  findRow: {
    marginTop: s(9),
    alignItems: 'center',
  },
});
