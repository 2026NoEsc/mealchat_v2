import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Checkbox } from '../../components/ui/Checkbox';
import { v3Colors as c } from '../../theme/tokens';
import { Action, Art, Card, Copy, Header, Overlay, ui } from './PreviewUI';
import { previewAssets as a } from './previewAssets';

export default function AccountPreview({ scene, onBack, onScene }: { scene: string; onBack: () => void; onScene: (scene: string) => void }) {
  const [checked, setChecked] = useState(true);
  if (scene === 'deleted') return <View style={ui.screen}><View style={{ paddingTop: 160, paddingHorizontal: 32, alignItems: 'center', gap: 16 }}><Art source={a.dudu} width={110} height={80} svg={false} /><Copy size={22} bold>계정을 삭제했어요</Copy><Copy sub size={15} style={{ textAlign: 'center' }}>그동안 함께해 줘서 고마워요.{'\n'}같은 이메일로 언제든 다시 가입할 수 있어요.</Copy><Copy size={12} sub>완료 시안 예시 · 실제 계정은 삭제되지 않았어요</Copy></View><View style={ui.grow} /><View style={ui.footer}><View style={ui.row}><Action label="처음 화면으로" onPress={onBack} /></View></View></View>;
  return <View style={ui.screen}><Header title="계정 삭제" onBack={onBack} /><ScrollView contentContainerStyle={ui.body}>
    <Copy size={22} bold>나야나님, 떠나기 전에 확인해 주세요</Copy>
    <Card><Copy bold>바로 지워지는 것</Copy><Copy>· 프로필 · 음식 취향 · 건강 관련 정보</Copy><Copy>· 내 캘린더 일정과 출발지</Copy><Copy>· 메이트 목록</Copy></Card>
    <Card style={{ backgroundColor: c.mutedBg, borderWidth: 0 }}><Copy bold>탈퇴한 뒤</Copy><Copy>· 보낸 채팅 · 정산 기록의 내 이름은 &quot;탈퇴한 메이트&quot;로 바뀌어요. 메이트의 밥약 기록에는 금액만 남고, 채팅은 방이 사라질 때(정산 뒤 24시간) 함께 지워져요</Copy><Copy>· 따로 보관하는 정보는 없어요(접속 기록만 법에 따라 3개월)</Copy></Card>
    <Card><Copy bold>삭제하려면</Copy>{['진행 중인 정산이 없어요', '내가 방장인 방이 없어요'].map(label => <View key={label} style={ui.row}><Art source={require('./assets/check.svg')} width={14} /><Copy>{label}</Copy></View>)}</Card>
    <Checkbox checked={checked} onChange={setChecked} label="안내를 모두 확인했고, 되돌릴 수 없다는 걸 알아요" />
  </ScrollView><View style={ui.footer}><Copy sub size={12}>삭제 전에 비밀번호를 한 번 더 확인해요.</Copy><View style={ui.row}><Action label="계정 삭제" danger disabled={!checked} onPress={() => onScene('password')} /></View></View>
  {scene === 'password' && <Overlay onClose={() => onScene('delete')} title="비밀번호를 한 번 더 입력해 주세요" subtitle="확인하면 바로 삭제되고 되돌릴 수 없어요."><View style={{ gap: 6 }}><Copy sub size={13}>비밀번호</Copy><View accessibilityLabel="고정 비밀번호 예시, 입력 불가" style={{ borderWidth: 2, borderColor: c.primary, borderRadius: 12, height: 52, paddingHorizontal: 16, justifyContent: 'center' }}><Copy size={16}>••••••••</Copy></View></View><View style={ui.row}><Action danger label="계정 삭제" onPress={() => onScene('deleted')} /></View></Overlay>}
  </View>;
}
