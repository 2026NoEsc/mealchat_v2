import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Checkbox } from '../../components/ui/Checkbox';
import { Radio } from '../../components/ui/Radio';
import { v3Colors as c } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { Action, Art, Card, Copy, Header, IconAction, Overlay, ui } from './PreviewUI';
import { previewAssets as a } from './previewAssets';

export default function ChatPreview({ scene, onBack, notify }: { scene: string; onBack: () => void; notify: (text: string) => void }) {
  const [open, setOpen] = useState(scene === 'report' || scene === 'block');
  const [reply, setReply] = useState(true);
  const [message, setMessage] = useState(scene === 'reply' ? '국물이면 샤브샤브 어때요?' : '');
  const [sent, setSent] = useState<string[]>([]);
  const [reason, setReason] = useState('스팸 · 광고');
  const [block, setBlock] = useState(true);
  return <View style={ui.screen}><Header title="오늘 저녁팟　4" onBack={onBack} onMore={() => setOpen(true)} />
    <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}><Card style={{ gap: 10, paddingVertical: 14 }}><View style={[ui.row, { gap: 6 }]}><Art source={a.calendar} width={16} /><Copy>9월 25일 (금) 19:00</Copy><Art source={a.pin} width={16} /><Copy>서면</Copy><Art source={a.users} width={16} /><Copy>4명</Copy></View><View style={{ height: 1, backgroundColor: c.border }} /><View style={ui.row}><Art source={a.food} width={16} /><Copy bold size={16} style={[ui.grow, { color: c.selectedText }]}>삼겹살</Copy><Pressable accessibilityRole="button" onPress={() => notify('메뉴 변경 반응 예시예요.')} style={{ padding: 12, borderWidth: 1, borderColor: c.border, borderRadius: 10 }}><Copy size={13}>메뉴 변경</Copy></Pressable></View></Card></View>
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, gap: 14, paddingBottom: 12 }}>
      <Copy size={12} sub style={{ textAlign: 'center', backgroundColor: c.mutedBg, padding: 5, borderRadius: 12 }}>9월 25일 (금) 19:00로 일정이 확정됐어요</Copy>
      <Bubble name="또리" text="다들 뭐 먹고 싶어요?" avatar="ddori" />
      <View style={{ alignSelf: 'flex-end', backgroundColor: c.primary, padding: 12, borderRadius: 14 }}><Copy>고기 땡겨요</Copy></View>
      <Bubble name="모아" text="저는 국물 있는 거면 다 좋아요" avatar="moa" />
      <Copy sub size={12} style={{ textAlign: 'center', padding: 5, backgroundColor: c.mutedBg }}>메뉴가 삼겹살로 확정됐어요</Copy>
      <Card style={{ borderColor: c.primary }}><Copy bold size={16}>삼겹살로 결정했어요</Copy><Copy sub>이제 어디서 먹을까요? 서면 근처에서 찾아 드릴게요.</Copy><View style={ui.row}><Action label="식당 찾기" onPress={() => notify('식당 찾기 반응 예시예요.')} /></View></Card>
      {sent.map((text, i) => <View key={i} style={{ alignSelf: 'flex-end', padding: 12, borderRadius: 14, backgroundColor: c.primary }}><Copy>{text}</Copy><Copy size={11}>로컬 예시</Copy></View>)}
      {scene === 'message-failure' && <><View style={[ui.row, { justifyContent: 'flex-end' }]}><IconAction label="다시 보내기 예시" source={require('./assets/retry.svg')} size={20} onPress={() => notify('재전송 반응 예시 · 실제 전송되지 않아요.')} /><Copy size={12} style={{ color: '#C62828' }}>보내지 못함</Copy><View style={{ backgroundColor: c.primary, opacity: 0.6, padding: 12, borderRadius: 14 }}><Copy>저 오늘 10분 늦을 것 같아요</Copy></View></View><Card style={{ backgroundColor: c.ink }}><Copy size={13} style={{ color: 'white' }}>연결이 불안정해 보내지 못했어요. ↻를 눌러 다시 보내 주세요.</Copy><Copy size={11} style={{ color: 'white' }}>실패 시안 fixture · 실제 전송 시도가 아니에요</Copy></Card></>}
    </ScrollView>
    {scene === 'reply' && reply && <View style={[ui.row, { paddingLeft: 16, paddingVertical: 10, backgroundColor: c.mutedBg }]}><Art source={a.reply} width={18} /><View style={ui.grow}><Copy size={12} bold style={{ color: c.selectedText }}>모아에게 답장</Copy><Copy sub size={13}>저는 국물 있는 거면 다 좋아요</Copy></View><IconAction label="답장 취소" source={a.close} onPress={() => setReply(false)} /></View>}
    <View style={[ui.row, { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 20, backgroundColor: 'white' }]}><IconAction label="첨부 예시" source={a.plus} size={20} onPress={() => notify('파일을 가져오지 않는 예시예요.')} /><TextInput accessibilityLabel="미리보기 메시지" placeholder="메시지를 입력해 주세요" value={message} onChangeText={setMessage} style={{ flex: 1, minWidth: 0, height: 44, borderRadius: 22, paddingHorizontal: 16, backgroundColor: c.bg, fontFamily: fontFamily.regular, fontSize: 14 }} /><IconAction label="로컬 답장 표시" source={a.send} size={20} onPress={() => { if (message.trim()) { setSent(old => [...old, message]); setMessage(''); setReply(false); notify('로컬 예시로 표시했어요. 전송되지 않아요.'); } }} /></View>
    {open && scene === 'block' && <Overlay dialog onClose={() => setOpen(false)}><View style={{ backgroundColor: '#FDECEA', padding: 12, borderRadius: 24 }}><Art source={a.block} /></View><Copy size={19} bold>모아님을 차단할까요?</Copy><Copy sub size={13} style={{ textAlign: 'center' }}>서로 새 밥약에 초대할 수 없고, 함께 있는 방에서는 모아님의 메시지가 가려져요. 모아님에게는 알리지 않아요.</Copy><View style={ui.row}><Action label="취소" secondary onPress={() => setOpen(false)} /><Action label="차단하기" danger onPress={() => { setOpen(false); notify('차단 반응 예시 · 실제 차단되지 않았어요.'); }} /></View></Overlay>}
    {open && scene === 'report' && <Overlay onClose={() => setOpen(false)} title="신고하기" subtitle="신고 내용은 운영팀만 봐요. 모아에게는 알리지 않아요."><View>{['욕설 · 비하', '스팸 · 광고', '불쾌한 사진 · 이모티콘', '돈을 요구하거나 사기 의심', '기타 (직접 입력)'].map(label => <Radio key={label} label={label} selected={reason === label} onSelect={() => setReason(label)} />)}</View>{reason === '기타 (직접 입력)' && <TextInput accessibilityLabel="신고 사유 예시" placeholder="예시 사유를 적어 보세요" style={{ minHeight: 44, backgroundColor: c.bg, padding: 12 }} />}<Checkbox checked={block} onChange={setBlock} label="모아 차단하기도 함께"><Copy sub size={12}>차단하면 서로 새 밥약에 초대할 수 없고, 이 방 밖에서는 메시지가 안 보여요.</Copy></Checkbox><View style={ui.row}><Action label="신고 보내기" onPress={() => { setOpen(false); notify('신고 반응 예시 · 실제 접수되지 않았어요.'); }} /></View></Overlay>}
  </View>;
}
function Bubble({ name, text, avatar }: { name: string; text: string; avatar: 'ddori' | 'moa' }) {
  return <View style={ui.row}><Art source={a[avatar]} width={36} svg={false} /><View style={{ gap: 4, flexShrink: 1 }}><Copy sub size={12}>{name}</Copy><View style={{ backgroundColor: 'white', borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 }}><Copy>{text}</Copy></View></View><Copy sub size={12}>오후 6:03</Copy></View>;
}
