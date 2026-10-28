import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Checkbox } from '../../components/ui/Checkbox';
import { Action, Art, Copy, Header, Overlay, ui } from '../preview/PreviewUI';
import { previewAssets } from '../preview/previewAssets';

/** UI only. Never collects credentials or invokes Auth/deletion APIs. */
export default function AccountDeletionScreen({ onBack, onRequest }: { onBack: () => void; onRequest?: () => Promise<void> }) {
  const [step, setStep] = useState(0), [checked, setChecked] = useState(false), [error, setError] = useState('');
  return <View style={ui.screen}><Header title="계정 삭제" onBack={onBack} />
    <ScrollView contentContainerStyle={ui.body}>
      {step === 2 ? <><Art source={previewAssets.dudu} width={100} svg={false} /><Copy bold size={22}>삭제 요청 준비가 끝났어요</Copy><Copy>서버 연결 대기 · 계정은 삭제되지 않았어요.</Copy><Action label="설정으로 돌아가기" onPress={onBack} /></> : <>
        <Copy>아직 계정을 삭제하지 않았어요 · 서버 연결 대기</Copy><Copy bold size={22}>떠나기 전에 확인해 주세요</Copy><Copy>계정 삭제는 되돌릴 수 없어요. 삭제할 정보와 보관 기간은 서비스 정책에 따라 최종 안내돼요.</Copy>
        <Copy>진행 중인 정산과 방장인 방을 확인해야 해요. 서버 연결 전에는 삭제 조건을 확인할 수 없어요.</Copy>
        <Checkbox checked={checked} onChange={setChecked} label="안내를 확인했어요" />
        <Action danger label="계정 삭제" disabled={!checked} onPress={() => setStep(1)} />
      </>}
    </ScrollView>
    {step === 1 && <Overlay title="본인 확인" subtitle="서버 연결 대기 · 실제 비밀번호를 입력하지 마세요." onClose={() => setStep(0)}>
      <Copy>연결 후 안전한 본인 확인을 진행해요. 지금은 비밀번호를 수집하지 않아요.</Copy>
      {!!error && <Copy>{error}</Copy>}
      <View style={ui.row}><Action secondary label="돌아가기" onPress={() => setStep(0)} /><Action label="삭제 요청 준비" onPress={() => { if (!onRequest) setStep(2); else void onRequest().then(() => setStep(2)).catch(() => setError("요청하지 못했어요. 다시 시도해 주세요.")); }} /></View>
    </Overlay>}
  </View>;
}
