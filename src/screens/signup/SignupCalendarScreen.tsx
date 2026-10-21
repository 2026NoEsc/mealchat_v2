import { Calendar, Lock } from 'lucide-react-native';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthFooter, SignupStepHeader, authStyles } from '../../components/ui/AuthLayout';
import { Button, TextButton } from '../../components/ui/Button';
import { useNavigation } from '../../navigation/NavigationContext';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
/** Phone 520:1244; replaces the obsolete 220px signup illustration wrapper. */
export default function SignupCalendarScreen() {
  const { navigate, goBack } = useNavigation(); const insets = useSafeAreaInsets();
  return <View style={[authStyles.screen, { paddingTop: insets.top }]}>
    <SignupStepHeader step={2} title="구글 캘린더를 연결할까요?" subtitle="모아가 내 빈 시간을 모아서 약속 시간을 대신 맞춰 줘요." onBack={goBack} />
    <ScrollView style={authStyles.scroll} contentContainerStyle={styles.body}>
      <View style={styles.illustration}><Image source={require('../../../assets/food-profile/calendar.jpg')} style={styles.calendar} resizeMode="cover" accessible={false} /><Image source={require('../../../assets/food-profile/moa.png')} style={styles.moa} resizeMode="contain" accessible={false} /></View>
      <View style={styles.card}>{[{ Icon: Calendar, title: '바쁜 시간만 읽어요', description: '일정 제목과 내용은 메이트에게 보이지 않아요' }, { Icon: Lock, title: '언제든 관리할 수 있어요', description: '일정 조율 탭에서 시간을 직접 관리할 수 있어요' }].map(({ Icon, title, description }) => <View key={title} style={styles.row}><View style={styles.icon}><Icon size={20} color={colors.selectedText} /></View><View style={styles.grow}><Text style={styles.title}>{title}</Text><Text style={authStyles.helper}>{description}</Text></View></View>)}</View>
      {/* TODO(서버 단계): 실제 Google OAuth/동기화 전에는 연결 성공을 표시하지 않는다. */}
      <Text style={authStyles.helper}>구글 캘린더 연결은 준비 중이에요. 연결하지 않아도 가입할 수 있어요.</Text>
    </ScrollView>
    <AuthFooter><Button label="구글 캘린더 연결하기 · 준비 중" disabled onPress={() => undefined} /><TextButton label="나중에 할게요" onPress={() => navigate('SignupTaste')} /></AuthFooter>
  </View>;
}
const styles = StyleSheet.create({ body: { paddingHorizontal: 20, paddingBottom: 24, gap: 16 }, illustration: { height: 222, borderWidth: 1, borderColor: colors.border, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface }, calendar: { width: '100%', height: 220, opacity: 0.35 }, moa: { position: 'absolute', width: 120, height: 98, top: 59, alignSelf: 'center' }, card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 14, borderRadius: 16 }, row: { flexDirection: 'row', gap: 12 }, icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.selectedBg, alignItems: 'center', justifyContent: 'center' }, grow: { flex: 1, gap: 2 }, title: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22, color: colors.ink } });
