import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccentButton } from '../../components/ui/Button';
import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

const logo = require('../../../assets/brand/logo-main.png');

/**
 * Figma 회원가입/시작 (150:125) — 220 x 486
 * 로고 x88 y111 40×40 / 타이틀 y166 / 서브 y186 / 버튼 x12 y238 197×28 / 안내 y276
 */
export default function SignupStartScreen() {
  const { navigate, replace } = useNavigation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Image source={logo} style={styles.logo} resizeMode="contain" />

      <Text style={styles.title}>
        <Text style={styles.titleBrand}>MEALCHAT </Text>
        시작하기
      </Text>
      <Text style={styles.sub}>&apos;앱 한 끼 먹자&apos; 실제로 이루어집니다</Text>

      <AccentButton
        label="가입하기"
        showNext
        style={styles.cta}
        onPress={() => navigate('SignupPersonal')}
      />

      <View style={styles.helperRow}>
        <Text style={styles.helper}>이미 계정이 있나요? </Text>
        <Pressable onPress={() => replace('Login')}>
          <Text style={styles.helperLink}>로그인</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    paddingHorizontal: s(12),
  },
  logo: {
    // y111 - 상태바 28
    marginTop: s(83),
    width: s(40),
    height: s(40),
  },
  title: {
    // 로고 하단(y151) → 타이틀(y166)
    marginTop: s(15),
    fontFamily: fontFamily.body,
    fontSize: fs(12),
    lineHeight: fs(16),
    fontWeight: weight.medium,
    color: colors.primary,
    textAlign: 'center',
  },
  titleBrand: {
    fontFamily: fontFamily.wordmark,
    fontWeight: weight.extrabold,
  },
  sub: {
    marginTop: s(6),
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: colors.textMuted,
    textAlign: 'center',
  },
  cta: {
    // y238, 서브 하단(y196) 에서 42
    marginTop: s(42),
    alignSelf: 'stretch',
  },
  helperRow: {
    marginTop: s(10),
    flexDirection: 'row',
    alignItems: 'center',
  },
  helper: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(10),
    color: colors.textMuted,
  },
  helperLink: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(10),
    fontWeight: weight.bold,
    color: colors.primary,
  },
});
