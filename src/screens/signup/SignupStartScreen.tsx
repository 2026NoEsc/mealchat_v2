import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthFooter, authStyles, BrandWordmark } from '../../components/ui/AuthLayout';
import { PrimaryButton, SecondaryButton } from '../../components/ui/Button';
import { useNavigation } from '../../navigation/NavigationContext';
import { v3Layout } from '../../theme/scale';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

const logo = require('../../../assets/brand/logo-main.png');

/** Phone 519:1216. Footer stays visible while the hero can scroll on small phones. */
export default function SignupStartScreen() {
  const { navigate } = useNavigation();
  const insets = useSafeAreaInsets();
  return <View style={[authStyles.screen, { paddingTop: insets.top }]}>
    <ScrollView style={authStyles.scroll} contentContainerStyle={styles.hero}>
      <Image source={logo} style={styles.logo} resizeMode="contain" accessible={false} />
      <BrandWordmark />
      <Text style={styles.title}>‘밥 한 끼 먹자’가 진짜 약속이 되는 곳</Text>
      <Text style={styles.subtitle}>일정 맞추기부터 메뉴, 정산까지 채팅방 하나로</Text>
      {/* Figma blobs 340×190: 대응하는 기존 자산이 없어 생성하지 않고 공간을 유지한다. */}
      <View style={styles.blobsSpace} accessible={false} />
    </ScrollView>
    <AuthFooter>
      <View style={styles.actions}>
        <PrimaryButton label="가입하기" onPress={() => navigate('SignupPersonal')} />
        <SecondaryButton label="이미 계정이 있어요 · 로그인" style={styles.login} onPress={() => navigate('Login')} />
      </View>
    </AuthFooter>
  </View>;
}

const styles = StyleSheet.create({
  hero: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 16 },
  logo: { width: 96, height: 96, borderRadius: 24 },
  title: { fontFamily: fontFamily.medium, fontSize: 17, lineHeight: 26, color: colors.ink, textAlign: 'center' },
  subtitle: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 22, color: colors.sub, textAlign: 'center' },
  blobsSpace: { width: '100%', maxWidth: 340, height: 190, borderRadius: 16 },
  actions: { gap: 10 },
  login: { minHeight: v3Layout.minTouchTarget, paddingVertical: 8 },
});
