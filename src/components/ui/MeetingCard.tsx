import { CalendarDays, MapPin, Users, Utensils } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import type { RoomStage } from '../../lib/rooms';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { Button } from './Button';

/** Only confirmed_slot represents a saved appointment time. Never use meetingDate here. */
export function meetingTimeLabel(slot: string | null | undefined, stage: RoomStage): string {
  if (!slot?.trim()) return stage !== 'scheduling' ? '시간 미정' : '시간 확정 전';
  const value = slot.trim();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return (date.getMonth() + 1) + '월 ' + date.getDate() + '일 (' + ['일','월','화','수','목','금','토'][date.getDay()] + ') ' + String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
}

/** Phone 496:1141/1217. Current contract exposes restaurants, not a separate food menu. */
export default function MeetingCard({ slot, stage, location, memberCount, onChooseRestaurant, isOwner = false, compact = false }: {
  slot?: string | null; stage: RoomStage; location?: string | null; memberCount: number; onChooseRestaurant: () => void; isOwner?: boolean; compact?: boolean;
}) {
  const canChoose = stage === 'place';
  if (compact) return <View testID="meeting-card-compact" style={[styles.card, styles.compact]}><Text style={styles.value} numberOfLines={1}>{[meetingTimeLabel(slot, stage), location?.trim() || '장소 미정', memberCount + '명'].join(' · ')}</Text></View>;
  // TODO(서버 단계): 메뉴/식당 분리 계약 후 메뉴 상태·메뉴 변경·다음 단계 카드를 표시한다.
  return <View style={styles.card}>
    <View style={styles.facts}>
      <View style={styles.fact}><CalendarDays size={16} color={colors.sub} /><Text style={styles.value}>{meetingTimeLabel(slot, stage)}</Text></View>
      <View style={styles.fact}><MapPin size={16} color={colors.sub} /><Text style={styles.value}>{location?.trim() || '장소 미정'}</Text></View>
      <View style={styles.fact}><Users size={16} color={colors.sub} /><Text style={styles.value}>{memberCount}명</Text></View>
    </View>
    {stage === 'scheduling' || stage === 'place' ? <>
      <View style={styles.divider} />
      <View style={styles.restaurant}><Utensils size={16} color={colors.selectedText} /><View style={styles.body}>
        <Text style={styles.title}>식당을 함께 골라 보세요</Text>
        <Text style={styles.note}>{stage === 'scheduling' ? '일정이 정해지면 시작할 수 있어요' : '가고 싶은 식당에 투표해 주세요'}</Text>
      </View></View>
      <Button label="식당 정하기" style={styles.action} disabled={!canChoose} onPress={onChooseRestaurant} />
      {isOwner && stage === 'place' ? <Button label="약속 확정" variant="secondary" style={styles.action} onPress={onChooseRestaurant} /> : null}
    </> : null}
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  compact: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 12 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  value: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: colors.ink, flexShrink: 1 },
  divider: { height: 1, backgroundColor: colors.border },
  restaurant: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  body: { flex: 1 },
  title: { fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 20, color: colors.ink },
  note: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.sub },
  action: { minHeight: 44, paddingVertical: 10 },
});
