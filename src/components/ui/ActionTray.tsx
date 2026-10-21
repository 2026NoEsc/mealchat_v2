import { CalendarDays, Smile, Users, Utensils, Wallet } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RoomStage } from '../../lib/rooms';
import { settlementConfirmationRequired } from '../../lib/roomSettlementPolicy';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

export type ChatAction = 'schedule' | 'menu' | 'settlement' | 'members' | 'emoticons';
/** Phone 527:1475. Narrow devices scroll inside the tray while targets retain their size. */
export default function ActionTray({ stage, onChoose, bottomInset = 0, canOpenSchedule = stage === 'scheduling' }: { stage: RoomStage; onChoose: (action: ChatAction) => void; bottomInset?: number; canOpenSchedule?: boolean }) {
  // TODO(서버 단계): 독립 메뉴 흐름이 없으므로 기존 식당 투표를 사실대로 표시한다.
  const items = [
    { key: 'schedule', label: '일정 조율', Icon: CalendarDays, disabled: !canOpenSchedule, reason: '시간 선택 전 일정 조율 단계에서 사용할 수 있어요' },
    { key: 'menu', label: '식당 정하기', Icon: Utensils, disabled: stage !== 'place', reason: '식당 정하기 단계에서 사용할 수 있어요' },
    { key: 'settlement', label: 'N빵 정산', Icon: Wallet, disabled: stage === 'scheduling' || stage === 'place', reason: '약속을 확정하면 정산을 시작할 수 있어요' },
    { key: 'members', label: '멤버', Icon: Users, disabled: false, reason: undefined },
    { key: 'emoticons', label: '이모티콘', Icon: Smile, disabled: false, reason: undefined },
  ] as const;
  const beforeConfirmation = stage === 'scheduling' || stage === 'place';
  return <View style={styles.tray}>{beforeConfirmation ? <Text style={styles.reason}>{settlementConfirmationRequired}</Text> : null}<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tray} contentContainerStyle={[styles.content, { paddingBottom: 28 + bottomInset }]} keyboardShouldPersistTaps="handled">
    {/* [결정] 비활성 상태는 아이콘·라벨 흐림과 이유 낭독을 함께 제공한다. */}
    {items.map(({ key, label, Icon, disabled, reason }) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} accessibilityHint={disabled ? reason : undefined} disabled={disabled}
      onPress={() => onChoose(key)} style={styles.action}>
      <View style={[styles.icon, disabled && styles.inactive]}><Icon size={24} color={colors.selectedText} /></View>
      <Text style={[styles.label, disabled && styles.disabledLabel]}>{label}</Text>
    </Pressable>)}
  </ScrollView></View>;
}
const styles = StyleSheet.create({
  tray: { flexGrow: 0, flexShrink: 0, backgroundColor: colors.surface },
  reason: { paddingHorizontal: 20, paddingTop: 12, fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.sub },
  content: { gap: 8, paddingTop: 16, paddingHorizontal: 20, paddingBottom: 28 },
  action: { width: 68, paddingVertical: 4, alignItems: 'center', gap: 6 },
  icon: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.selectedBg, alignItems: 'center', justifyContent: 'center' },
  inactive: { backgroundColor: colors.mutedBg, opacity: 0.4 },
  disabledLabel: { opacity: 0.4 },
  label: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 19, color: colors.ink, textAlign: 'center' },
});
