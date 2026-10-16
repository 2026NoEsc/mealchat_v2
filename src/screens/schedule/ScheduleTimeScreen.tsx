import { Check } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import AvailabilityGrid from '../../components/AvailabilityGrid';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { fetchRoomAvailability, saveMyAvailability, type AvailabilityStatus } from '../../lib/availability';
import type { MyLocation } from '../../lib/myLocation';
import { leaveRoom } from '../../lib/rooms';
import { buildNextDays, cellKey, isPastCell, toSlots } from '../../lib/scheduleSlots';
import { useNavigation } from '../../navigation/NavigationContext';
import { scheduleColors } from '../../theme/scheduleTokens';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import ScheduleFrame from './ScheduleFrame';

type Params = { roomId?: string; name?: string; invitees?: string[]; origin?: MyLocation; originSource?: 'profile' | 'gps' | 'search' };

export default function ScheduleTimeScreen() {
  /* 상태바 높이는 insets.top 만으로는 모자란 기기가 있다 */
  const { navigate, goBackWith, current } = useNavigation();

  const params = current.params as Params | undefined;

  const roomId = params?.roomId ?? null;
  const name = params?.name ?? '';
  const invitees = params?.invitees ?? [];
  const origin = params?.origin;

  const days = useMemo(() => buildNextDays(5), []);

  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<AvailabilityStatus | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!roomId) return;
    const { data, error } = await fetchRoomAvailability(roomId);
    if (error || !data) return;

    setStatus(data);
    /* 전에 낸 답이 있으면 격자에 되살린다 */
    setPicked(new Set(data.mySlots));
  }, [roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (date: string, hour: number) => {
    if (isPastCell(date, hour)) {
      return;
    }

    setPicked((prev) => {
      const next = new Set(prev);
      const k = cellKey(date, hour);

      if (next.has(k)) {
        next.delete(k);
      } else {
        next.add(k);
      }

      return next;
    });
  };

  const slots = toSlots(picked, days);

  const othersCells = useMemo(
    () => new Set(status?.othersSlots ?? []),
    [status],
  );

  /* 내 답을 방에 저장하고 AI 추천으로 넘어간다 */
  const goNext = async () => {
    if (!roomId || !origin || slots.length === 0) return;

    setSaving(true);
    const error = await saveMyAvailability(roomId, [...picked]);
    setSaving(false);

    if (error) {
      Alert.alert('저장 실패', error.message);
      return;
    }

    navigate('ScheduleConfirmed', { roomId, name, invitees, origin, originSource: params?.originSource });
  };

  /*
   * 뒤로 갈 때 STEP 1 이 다시 채울 수 있게 입력값을 실어 보낸다.
   *
   * 방은 여기서 지운다. STEP 1 의 "다음" 이 방을 먼저 만들기 때문에 — 조율은
   * 방이 있어야 시작되니 어쩔 수 없다 — 그냥 돌아가면 아무도 안 쓰는 방이
   * 채팅 목록에 남고, 다시 "다음" 을 누르면 방이 하나 더 생겼다.
   * leave_room 은 마지막 사람이 나가면 방까지 지운다.
   */
  const goPrev = () => {
    if (roomId) void leaveRoom(roomId);
    goBackWith({ name, invitees, origin, originSource: params?.originSource });
  };

  return <ScheduleFrame bodyGap={12} step={2} title="언제 만날까요?" subtitle="가능한 시간을 눌러서 표시해 주세요. 메이트가 제출한 가능한 시간도 함께 보여요." onBack={goPrev}
    footer={<Button label="선택 완료" loading={saving} disabled={saving || slots.length === 0 || !origin} onPress={() => void goNext()} />}>
    {/* TODO(서버 단계): 메이트 바쁜 시간 계약이 없어 기존 othersSlots(가능 시간)의 뜻을 유지한다. */}
    <View style={styles.legend}>
      <View style={styles.legendItem}><View style={[styles.swatch, styles.mine]}><Check size={10} strokeWidth={3} color={colors.onPrimary} /></View><Text style={styles.legendText}>내가 가능</Text></View>
      <View style={styles.legendItem}><View style={[styles.swatch, styles.shared]}><View style={styles.mateDot} /><View style={styles.mateDot} /><View style={styles.mateDot} /></View><Text style={styles.legendText}>메이트 가능</Text></View>
      <View style={styles.legendItem}><View style={[styles.swatch, styles.free]} /><Text style={styles.legendText}>비어 있음</Text></View>
    </View>
    <AvailabilityGrid variant="v3" days={days} picked={picked} others={othersCells} onToggle={toggle} />
    <View style={styles.summary}>
      <Text style={styles.summaryText}>고른 시간 {slots.length}구간 · {picked.size}시간</Text>
      {slots.map((slot) => <Chip key={slot.id} label={Number(slot.date.slice(8)) + '일 ' + Number(slot.startTime.slice(0, 2)) + '–' + Number(slot.endTime.slice(0, 2)) + '시'} selected onChange={() => setPicked((previous) => {
        const next = new Set(previous);
        for (let hour = Number(slot.startTime.slice(0, 2)); hour < Number(slot.endTime.slice(0, 2)); hour += 1) next.delete(cellKey(slot.date, hour));
        return next;
      })} />)}
      {!slots.length ? <Text style={styles.legendText}>가능한 시간을 한 칸 이상 골라 주세요.</Text> : null}
    </View>
  </ScheduleFrame>;
}
const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 14, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  mateDot: { width: 2, height: 2, borderRadius: 1, backgroundColor: colors.ink },
  mine: { backgroundColor: colors.primary }, shared: { backgroundColor: scheduleColors.busy, flexDirection: 'row', gap: 1 }, free: { backgroundColor: colors.mutedBg },
  legendText: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 17, color: colors.sub },
  summary: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  summaryText: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 19, color: colors.ink },
});
