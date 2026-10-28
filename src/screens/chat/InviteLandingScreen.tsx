import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { copyToClipboard } from '../../components/ui/CopyButton';
import { useNavigation } from '../../navigation/NavigationContext';
import { Action, Art, Card, Copy, Header, ui } from '../preview/PreviewUI';
/** Phone 543:1609. Reads only the invite code; room details and store links stay pending until the server team connects them. */
export default function InviteLandingScreen() {
  const { current, goBack } = useNavigation();
  const code = typeof current.params?.code === 'string' ? current.params.code : '';
  const [note, setNote] = useState('');
  return <View style={ui.screen}><Header title="밥약 초대" onBack={goBack} /><ScrollView contentContainerStyle={ui.body}>
    <Art source={require('../preview/assets/inviteMoa.png')} width={100} svg={false} /><Copy bold size={24}>함께 먹을 밥약에 초대해요</Copy>
    <Card><Copy bold>밥약 정보</Copy><Copy>MEALCHAT에서 일정·메뉴·정산을 한 번에 맞춰요.</Copy><Copy sub>약속 시간과 장소는 방에 들어가면 보여요.</Copy></Card>
    <Card style={styles.codeCard}><View style={ui.grow}><Copy size={12} sub>초대 코드</Copy><Copy bold size={26}>{code || '초대 코드 없음'}</Copy></View>
      <View style={styles.copy}><Action label="초대 코드 복사" disabled={!code} onPress={() => { void copyToClipboard(code).then(() => setNote('초대 코드를 복사했어요')).catch(() => setNote('복사하지 못했어요. 다시 시도해 주세요.')); }} /></View></Card>
    <Card><Copy bold>이렇게 들어와요</Copy><Copy>1. 앱을 열거나 설치해요.</Copy><Copy>2. 초대 코드를 입력해 방에 들어와요.</Copy></Card>
    {!!note && <Copy>{note}</Copy>}
  </ScrollView>
  <View style={styles.footer}>
    <Copy sub>앱에서 열려 있어요. 뒤로 가서 방을 확인할 수 있어요.</Copy>
    <View style={styles.row}><Action label="앱에서 열기" onPress={goBack} /></View>
    <View style={styles.row}><Action secondary label="앱 설치 안내" onPress={() => setNote('스토어 연결 대기 · 설치 링크는 아직 준비 중이에요.')} /></View>
  </View></View>;
}
const styles = StyleSheet.create({
  codeCard: { flexDirection: 'row', alignItems: 'center', gap: 12 }, copy: { width: 140, flexDirection: 'row' },
  footer: { gap: 8, padding: 20, borderTopWidth: 1, borderTopColor: '#E8E3DC', backgroundColor: '#FFFFFF' }, row: { flexDirection: 'row' },
});
