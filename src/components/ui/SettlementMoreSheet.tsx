import { Copy, HelpCircle, MessageSquare } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import BottomSheet from './BottomSheet';
import { copyToClipboard } from './CopyButton';
import Toast, { useToast } from './Toast';
import { formatAmount } from '../../lib/format';
import type { Settlement } from '../../lib/settlements';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

/** 629:1858 / 629:1993. The existing list remains the backing screen. */
export default function SettlementMoreSheet({ settlement, requester, onClose, onOpenChat }: {
  settlement: Settlement | null; requester: boolean; onClose: () => void; onOpenChat: () => void;
}) {
  const { showToast, toastProps } = useToast(); const [error, setError] = useState<string | null>(null);
  useEffect(() => { setError(null); }, [settlement?.id]);
  const copy = async () => {
    if (!settlement) return;
    const each = settlement.splitCount > 0 ? Math.ceil(settlement.totalAmount / settlement.splitCount) : settlement.totalAmount;
    try { await copyToClipboard(settlement.title + '\n총 ' + formatAmount(settlement.totalAmount) + ' · 1인당 ' + formatAmount(each)); setError(null); showToast({ message: '정산 내용을 복사했어요' }); }
    catch { setError('복사하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
  };
  return <BottomSheet visible={Boolean(settlement)} title="정산 더보기" titleStyle={styles.title} headingStyle={styles.heading} contentStyle={styles.surface} onClose={onClose}>
    {settlement?.roomId ? <Pressable accessibilityRole="button" accessibilityLabel="채팅방으로 가기" onPress={onOpenChat} style={styles.action}><MessageSquare size={20} color={colors.ink} /><Text style={styles.label}>채팅방으로 가기</Text></Pressable> : null}
    {!requester && settlement?.roomId ? <Pressable accessibilityRole="button" accessibilityLabel="금액이 이상해요 · 채팅방에 묻기" onPress={onOpenChat} style={styles.action}><HelpCircle size={20} color={colors.ink} /><Text style={styles.label}>금액이 이상해요 · 채팅방에 묻기</Text></Pressable> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="정산 내용 복사" onPress={() => void copy()} style={styles.action}><Copy size={20} color={colors.ink} /><Text style={styles.label}>정산 내용 복사</Text></Pressable>
    {/* TODO(서버 단계): 정산 취소·금액/참가자 수정·재알림 API 계약 전에는 항목을 노출하지 않는다. */}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Toast {...toastProps} bottom={160} />
  </BottomSheet>;
}
const styles = StyleSheet.create({
  surface: { paddingHorizontal: 12, gap: 0 }, heading: { paddingVertical: 8, paddingLeft: 8, alignItems: 'center' }, title: { fontSize: 18, lineHeight: 26 },
  action: { minHeight: 52, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 14 }, label: { flex: 1, fontFamily: fontFamily.medium, fontSize: 16, lineHeight: 23, color: colors.ink },
  error: { padding: 8, fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, color: v3FeedbackColors.error },
});
