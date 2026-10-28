import { useState } from 'react';
import { TextInput, View } from 'react-native';
import BottomSheet from '../../components/ui/BottomSheet';
import { Action, Copy, ui } from '../preview/PreviewUI';
export type SafetyRequest = { kind: 'report' | 'block'; targetId: string; reason: string; detail: string };
export default function MessageSafetySheet({ kind, targetId, name, onClose, onSubmit }: {
  kind: 'report' | 'block'; targetId: string; name: string; onClose: () => void; onSubmit?: (request: SafetyRequest) => Promise<void>;
}) {
  const [reason, setReason] = useState('불쾌한 표현'), [detail, setDetail] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!onSubmit) { setError('서버 연결 대기 · 처리되지 않았어요. 다시 시도하거나 닫아 주세요.'); return; }
    setBusy(true); try { await onSubmit({ kind, targetId, reason, detail }); onClose(); } catch { setError('처리하지 못했어요. 다시 시도해 주세요.'); } finally { setBusy(false); }
  };
  return <BottomSheet visible title={kind === 'report' ? '신고하기' : `${name}님을 차단할까요?`} onClose={onClose}>
    <Copy>서버 연결 대기 · 실제 신고·차단은 처리되지 않아요.</Copy>
    {kind === 'report' ? <><View style={{ gap: 6 }}>{['불쾌한 표현', '광고 · 스팸', '개인정보 노출', '기타'].map(label => <Action key={label} secondary={reason !== label} label={label} onPress={() => setReason(label)} />)}</View><TextInput accessibilityLabel="신고 상세 사유" value={detail} onChangeText={setDetail} placeholder="추가 설명 (선택)" multiline maxLength={1000} style={{ minHeight: 80, padding: 12 }} /></> : <Copy>차단 후 메시지 표시 범위는 연결 시 안내돼요.</Copy>}
    {!!error && <Copy>{error}</Copy>}<View style={ui.row}><Action secondary label="취소" disabled={busy} onPress={onClose} /><Action label={kind === 'report' ? '신고 요청' : '차단 요청'} disabled={busy} onPress={() => void submit()} /></View>
  </BottomSheet>;
}
