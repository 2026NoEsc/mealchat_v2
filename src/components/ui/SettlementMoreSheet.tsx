import { HelpCircle, MessageSquare } from 'lucide-react-native';
import { Pressable, StyleSheet, Text } from 'react-native';
import BottomSheet from './BottomSheet';
import type { Settlement } from '../../lib/settlements';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

/** 629:1858 / 629:1993. Only server-supported actions are exposed. */
export default function SettlementMoreSheet({ settlement, requester, onClose, onOpenChat }: {
  settlement: Settlement | null; requester: boolean; onClose: () => void; onOpenChat: () => void;
}) {
  // [결정] 629:2107의 원문은 요청자에게 묻기지만 E0850의 목적지는 단체 채팅방이므로 실제 동작을 문구에 명시한다.
  const askLabel = '금액이 이상해요 · 채팅방에서 묻기';
  return <BottomSheet visible={Boolean(settlement)} title="정산 더보기" titleStyle={styles.title} headingStyle={styles.heading} contentStyle={styles.surface} onClose={onClose}>
    {settlement?.roomId ? <Pressable accessibilityRole="button" accessibilityLabel="채팅방으로 가기" onPress={onOpenChat} style={styles.action}><MessageSquare size={20} color={colors.ink} /><Text style={styles.label}>채팅방으로 가기</Text></Pressable> : null}
    {!requester && settlement?.roomId ? <Pressable accessibilityRole="button" accessibilityLabel={askLabel} onPress={onOpenChat} style={styles.action}><HelpCircle size={20} color={colors.ink} /><Text style={styles.label}>{askLabel}</Text></Pressable> : null}
    {/* [결정] S6/S7의 취소·금액/참가자 수정·재알림은 숨기며 Figma에 없는 정산 복사는 제외한다. */}
  </BottomSheet>;
}
const styles = StyleSheet.create({
  surface: { paddingHorizontal: 12, gap: 0 }, heading: { paddingVertical: 8, paddingLeft: 8, alignItems: 'center' }, title: { fontSize: 18, lineHeight: 26 },
  action: { minHeight: 52, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 14 }, label: { flex: 1, fontFamily: fontFamily.medium, fontSize: 16, lineHeight: 23, color: colors.ink },
});
