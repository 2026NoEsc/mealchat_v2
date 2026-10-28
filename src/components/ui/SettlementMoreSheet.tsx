import { useEffect, useState } from 'react';
import { Button } from './Button';
import { HelpCircle, MessageSquare } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import BottomSheet from './BottomSheet';
import type { Settlement } from '../../lib/settlements';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

/** 629:1858 / 629:1993. Only server-supported actions are exposed. */
export default function SettlementMoreSheet({ settlement, requester, onClose, onOpenChat, onLocalAction }: {
  settlement: Settlement | null; requester: boolean; onClose: () => void; onOpenChat: () => void; onLocalAction?: (draft: { billId: string; action: 'edit' | 'cancel' }) => void;
}) {
  // [결정] 629:2107의 원문은 요청자에게 묻기지만 E0850의 목적지는 단체 채팅방이므로 실제 동작을 문구에 명시한다.
  const [cancel, setCancel] = useState(false), [note, setNote] = useState('');
  const visible = Boolean(settlement);
  useEffect(() => { setCancel(false); setNote(''); }, [settlement?.id, requester, visible]);
  const askLabel = '금액이 이상해요 · 채팅방에서 묻기';
  return <BottomSheet visible={Boolean(settlement)} title="정산 더보기" titleStyle={styles.title} headingStyle={styles.heading} contentStyle={styles.surface} onClose={onClose}>
    {settlement?.roomId ? <Pressable accessibilityRole="button" accessibilityLabel="채팅방으로 가기" onPress={onOpenChat} style={styles.action}><MessageSquare size={20} color={colors.ink} /><Text style={styles.label}>채팅방으로 가기</Text></Pressable> : null}
    {!requester && settlement?.roomId ? <Pressable accessibilityRole="button" accessibilityLabel={askLabel} onPress={onOpenChat} style={styles.action}><HelpCircle size={20} color={colors.ink} /><Text style={styles.label}>{askLabel}</Text></Pressable> : null}
    {requester ? <View style={{ gap: 12 }}><Button variant="secondary" label="금액 · 참여 멤버 고치기" onPress={() => { if (settlement) onLocalAction?.({ billId: settlement.id, action: 'edit' }); setNote('수정 요청 준비 · 서버 연결 대기'); }} /><Button variant="text" label="정산 취소" onPress={() => setCancel(true)} /></View> : null}
    {cancel && requester ? <View style={{ padding: 16, gap: 12 }}><Text style={styles.label}>정산을 취소할까요?</Text><Text>이미 보낸 돈은 직접 돌려줘야 해요. 현재는 서버 연결 대기 상태예요.</Text><Button label="그대로 둘게요" variant="secondary" onPress={() => setCancel(false)} /><Button label="취소 요청 준비" onPress={() => { setCancel(false); if (settlement) onLocalAction?.({ billId: settlement.id, action: 'cancel' }); setNote('취소 요청 준비 · 실제 정산은 취소되지 않았어요'); }} /></View> : null}
    {!!note && <Text accessibilityRole="alert" style={styles.label}>{note}</Text>}
  </BottomSheet>;
}
const styles = StyleSheet.create({
  surface: { paddingHorizontal: 12, gap: 0 }, heading: { paddingVertical: 8, paddingLeft: 8, alignItems: 'center' }, title: { fontSize: 18, lineHeight: 26 },
  action: { minHeight: 52, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 14 }, label: { flex: 1, fontFamily: fontFamily.medium, fontSize: 16, lineHeight: 23, color: colors.ink },
});
