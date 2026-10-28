import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Action, Art, Copy, Header, IconAction, ui } from '../preview/PreviewUI';
import { previewAssets as a } from '../preview/previewAssets';
export type ReceiptItem = { name: string; quantity: number; amount: number };
/** Phone 589:1890: recognition may return line items; manual input has none. `uncertain` marks lines the reader was unsure about. */
export type ReceiptDraft = { merchant: string; amount: number; items?: ReceiptItem[]; uncertain?: boolean };
/** Device permission / image recognition boundary. No device or server access by default. */
export default function ReceiptCaptureFlow({ onClose, recognize, requestPermission, onDraft }: {
  onClose: () => void; recognize?: () => Promise<ReceiptDraft>; requestPermission?: () => Promise<boolean>; onDraft?: (draft: ReceiptDraft) => void;
}) {
  const [state, setState] = useState('camera'), [flash, setFlash] = useState(false), [merchant, setMerchant] = useState(''), [amount, setAmount] = useState(''), [items, setItems] = useState<ReceiptItem[]>([]), [uncertain, setUncertain] = useState(false);
  const capture = async () => {
    try {
      if (!requestPermission || !await requestPermission()) { setState('denied'); return; }
      setState('loading');
      if (!recognize) { setState('failure'); return; }
      const draft = await recognize(); setMerchant(draft.merchant); setAmount(String(draft.amount)); setItems(draft.items ?? []); setUncertain(!!draft.uncertain); setState('result');
    } catch { setState('failure'); }
  };
  if (state === 'camera') return <View style={[ui.screen, { backgroundColor: '#111' }]}>
    <View style={ui.header}><IconAction label="뒤로가기" source={a.cameraClose} onPress={onClose} /><Copy bold size={17} style={[ui.grow, { color: 'white', textAlign: 'center' }]}>영수증 찍기</Copy><IconAction label={flash ? '플래시 끄기' : '플래시 켜기'} source={flash ? a.flashOn : a.flashOff} onPress={() => setFlash(!flash)} /></View>
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}><View style={{ width: '80%', maxWidth: 300, aspectRatio: 300 / 460, borderRadius: 16, borderWidth: 3, borderStyle: 'dashed', borderColor: '#FF9900', overflow: 'hidden' }}><View style={{ opacity: 0.35 }}><Art source={a.guide} width={294} height={454} svg={false} resizeMode="cover" /></View></View><Copy style={{ color: 'white', textAlign: 'center' }}>영수증이 네모 안에 다 들어오게 맞춰 주세요</Copy><Copy size={12} style={{ color: '#D6D3CE' }}>촬영 · 인식 서버 연결 대기</Copy></View>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 24 }}><IconAction label="앨범에서 선택" source={a.album} onPress={() => setState('failure')} /><IconAction label="촬영" source={a.shutter} size={72} onPress={() => void capture()} /><View style={{ width: 44 }} /></View>
  </View>;
  return <View style={ui.screen}><Header title="영수증 찍기" onBack={onClose} /><ScrollView contentContainerStyle={ui.body}>
    <Copy sub>서버 연결 대기 · 사진 촬영과 인식은 아직 연결되지 않았어요.</Copy>
    {state === 'denied' ? <><Copy bold size={20}>카메라 권한이 꺼져 있어요</Copy><Copy>카메라 연결 전이에요. 직접 입력하거나 앨범을 이용해 주세요.</Copy><Action label="권한 다시 확인" onPress={() => void capture()} /><Action secondary label="앨범에서 선택" onPress={() => setState('failure')} /></> : null}
    {state === 'failure' ? <><Copy bold size={20}>영수증을 읽지 못했어요</Copy><Copy>인식 서비스 연결 대기 · 금액을 직접 입력할 수 있어요.</Copy><Action label="다시 찍기" onPress={() => setState('camera')} /></> : null}
    {state === 'loading' ? <Copy>영수증을 읽고 있어요</Copy> : null}
    {['denied', 'failure'].includes(state) ? <Action secondary label="직접 입력" onPress={() => setState('result')} /> : null}
    {state === 'result' ? <><Copy bold size={20}>영수증 입력 결과 확인</Copy><Copy>입력한 금액을 확인해 주세요. 로컬 초안으로만 보관해요.</Copy>
      {uncertain && <Copy size={13} style={{ color: '#B45309' }}>일부 항목을 정확히 읽지 못했을 수 있어요. 금액을 확인해 주세요.</Copy>}
      {items.map((item, i) => <View key={`${item.name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E8E3DC' }}><Copy style={{ flex: 1 }}>{item.name}</Copy><Copy size={12} sub>x{item.quantity}</Copy><Copy bold>{item.amount.toLocaleString('ko-KR')}원</Copy></View>)}
      <TextInput accessibilityLabel="가게 이름" placeholder="가게 이름" value={merchant} onChangeText={setMerchant} style={{ minHeight: 48, borderWidth: 1, padding: 12 }} />
      <TextInput accessibilityLabel="영수증 합계" placeholder="합계 금액" keyboardType="numeric" value={amount} onChangeText={setAmount} style={{ minHeight: 48, borderWidth: 1, padding: 12 }} />
      <View style={{ flexDirection: 'row', gap: 8 }}><Action secondary label="다시 찍기" onPress={() => setState('camera')} /><Action disabled={!merchant.trim() || !Number.isSafeInteger(Number(amount)) || Number(amount) <= 0} label="로컬 초안으로 넣기" onPress={() => { onDraft?.({ merchant: merchant.trim(), amount: Number(amount), ...(items.length ? { items, uncertain } : {}) }); onClose(); }} /></View>
    </> : null}
  </ScrollView></View>;
}
