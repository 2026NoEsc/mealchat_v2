import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import AvailabilityGrid from '../../components/AvailabilityGrid';
import Avatar from '../../components/Avatar';
import BottomSheet from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { adjustedServerNow, buildKstDays, formatMeetingTime, futureKstSlots, isPastKstCell, kstDateKey } from '../../lib/meetingTime';
import { useMeetingClock } from '../../lib/useMeetingClock';
import { roomDecisionErrorMessage, selectRoomMeetingTime, submitRoomAvailability } from '../../lib/roomDecisions';
import { cellKey } from '../../lib/scheduleSlots';
import type { RoomParticipant } from '../../lib/rooms';
import { unverifiedSettlementLabel } from '../../lib/roomSettlementPolicy';
import { useRoomDecision } from '../../lib/useRoomDecision';
import { useNavigation } from '../../navigation/NavigationContext';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import DecisionFailure, { DecisionRefreshError } from '../../components/ui/DecisionFailure';

const pending = new Set<string>(), listeners = new Set<() => void>();
const publish = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
type Props = { visible: boolean; roomId: string | null; roomName?: string; onClose: () => void; onStateChanged: () => void; decision: ReturnType<typeof useRoomDecision>; participants?: RoomParticipant[] };
export default function S4ScheduleSheet({ visible, roomId, roomName, onClose, onStateChanged, decision, participants = [] }: Props) {
  const { navigate } = useNavigation(), { user } = useAuth();
  const state = decision.data, lockKey = `${user?.id}:${roomId}`;
  const currentState = useRef(state); currentState.current = state;
  const busy = useSyncExternalStore(subscribe, () => pending.has(lockKey), () => pending.has(lockKey));
  const [picked, setPicked] = useState(new Set<string>()), [editing, setEditing] = useState(false), [error, setError] = useState('');
  const initialized = useRef(false), mounted = useRef(true), draftRevision = useRef<string | null>(null);
  const loadedRevision = useRef<string | null>(null);
  const visibility = useRef({ visible });
  if (visibility.current.visible !== visible) visibility.current = { visible };
  const now = useMeetingClock(state), day = kstDateKey(now);
  const days = useMemo(() => buildKstDays(5, new Date(`${day}T00:00:00+09:00`)), [day]);
  useEffect(() => { if (visible) { initialized.current = false; setError(''); } }, [visible]);
  useEffect(() => {
    if (visible && !busy && state && (!initialized.current || (!editing && loadedRevision.current !== state.revision))) {
      initialized.current = true; loadedRevision.current = state.revision; setPicked(new Set(state.availability.my_slots)); setEditing(state.availability.my_slots.length === 0); draftRevision.current = state.revision;
    }
  }, [state, visible, busy, editing]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const mutate = async (withoutTime: boolean) => {
    if (!state || !roomId || busy || pending.has(lockKey)) return;
    if (withoutTime ? !state.permissions.can_select_time || !state.availability.all_submitted || state.stage !== 'scheduling' : !state.permissions.can_submit) return;
    const slots = futureKstSlots([...picked], adjustedServerNow(state));
    if (!withoutTime && picked.size && !slots.length) { setError('고른 시간이 모두 지났어요. 앞으로 가능한 시간을 다시 골라 주세요.'); return; }
    pending.add(lockKey); publish(); setError('');
    const context = visibility.current;
    try {
      const result = withoutTime ? await selectRoomMeetingTime(roomId, null, state.revision)
        : await submitRoomAvailability(roomId, slots, draftRevision.current ?? state.revision);
      if (result.error) {
        if (mounted.current && visible && visibility.current === context) {
          setError(roomDecisionErrorMessage(result.error)); const latest = await decision.reload();
          const preserved = latest ?? currentState.current;
          if (!withoutTime && mounted.current && visibility.current === context && preserved?.room_id === roomId && ['S4005', 'S4006'].includes(result.error.code)) {
            draftRevision.current = preserved.revision; loadedRevision.current = preserved.revision; initialized.current = true;
            if (result.error.code === 'S4005') setError('일정이 바뀌었어요. 고른 시간은 유지했어요. 확인한 뒤 다시 제출해 주세요.');
          }
        }
        return;
      }
      // Persistence success refreshes the owner even if X/scrim closed the sheet during the request.
      onStateChanged();
      if (mounted.current && context.visible && visibility.current === context) {
        if (withoutTime) { onClose(); navigate('ChatRoom', { roomId, openSheet: 'menu' }); }
        else { setPicked(new Set(result.data.state.availability.my_slots)); setEditing(false); draftRevision.current = result.data.state.revision; await decision.reload(); }
      }
    } finally { pending.delete(lockKey); publish(); }
  };
  const selectTime = () => { if (!roomId || !state?.permissions.can_select_time || busy) return; onClose(); navigate('ScheduleConfirmed', { roomId, ...(roomName ? { name: roomName } : {}) }); };
  const scheduling = state?.stage === 'scheduling';
  const canSubmit = state?.permissions.can_submit === true;
  const announcement = !visible ? null : error || (decision.error ? roomDecisionErrorMessage(decision.error) : state
    ? state.stage === 'scheduling' ? `${state.availability.eligible_count}명 중 ${state.availability.submitted_count}명 일정을 제출했어요.`
      : state.stage === 'place' ? canSubmit ? '시간을 고르기 전에는 본인 일정을 수정할 수 있어요.' : '식당 정하기 단계예요. 확정 전 방장만 시간을 바꿀 수 있어요.' : '약속 확정 또는 정산 단계여서 일정을 바꿀 수 없어요.'
    : '밥약 상태를 확인하고 있어요.');
  const lastAnnouncement = useRef<string | null>(null);
  useEffect(() => {
    if (!visible) { lastAnnouncement.current = null; return; }
    if (Platform.OS === 'ios' && announcement && announcement !== lastAnnouncement.current) {
      AccessibilityInfo.announceForAccessibilityWithOptions(announcement, { queue: true }); lastAnnouncement.current = announcement;
    }
  }, [visible, announcement]);
  return <BottomSheet visible={visible} title="일정 조율" subtitle="한국 시간과 실제 메이트들의 일정 제출 현황이에요." onClose={onClose}>
    <ScrollView contentContainerStyle={styles.stack} showsVerticalScrollIndicator={false}>
      {decision.mode !== 's4' || !state ? <DecisionFailure decision={decision} /> : <>
        <DecisionRefreshError decision={decision} />
        {state.confirmation_status === 'legacy_settlement_unverified' ? <Text style={styles.note}>{unverifiedSettlementLabel(state.stage, false, true)} · 이전 정산의 약속 확정 여부는 확인할 수 없어요.</Text> : null}
        <View testID="schedule-confirmed" style={state.meeting_time ? styles.time : styles.neutral}><Text style={styles.title}>{state.meeting_time ? state.confirmation_status === 'owner_confirmed' ? '확정된 약속 시간' : '선택된 시간' : '약속 시간'}</Text><Text style={styles.value}>{formatMeetingTime(state.meeting_time, state.stage, state.legacy_time_label)}</Text></View>
        <View testID="schedule-submissions" style={styles.stack}><View style={styles.head}><Text style={styles.title}>일정 제출</Text><Text style={styles.note}>{state.availability.eligible_count}명 중 {state.availability.submitted_count}명</Text></View>
          {state.availability.members.map(member => { const participant = participants.find(p => p.id === member.participant_id), mine = participant?.profileId === user?.id; const label = !member.eligible ? '제출 대상 아님' : member.submitted ? '제출' : '아직';
            return <View key={member.participant_id} testID={`schedule-submission-${member.participant_id}`} style={styles.member} accessible accessibilityLabel={`${member.name}${mine ? ' (나)' : ''}, ${label}`}>
              <Avatar name={member.name} size={32} radius={16} url={participant?.avatarUrl} /><Text style={styles.name}>{member.name}{mine ? ' (나)' : ''}</Text><Text style={[styles.badge, member.submitted && styles.submitted]}>{label}</Text></View>;
          })}
        </View>
        {scheduling ? <Text style={styles.note}>빈 제출은 미제출이에요. 초대 대기자를 제외한 실제 메이트 모두 제출해야 방장이 진행할 수 있어요.</Text>
          : <Text style={styles.note} accessibilityLiveRegion="polite">{state.stage === 'place' ? canSubmit ? '시간을 고르기 전에는 본인 일정을 수정할 수 있어요.' : '식당 정하기 단계예요. 확정 전 방장만 시간을 바꿀 수 있어요.' : '약속 확정 또는 정산 단계여서 일정을 바꿀 수 없어요.'}</Text>}
        {editing && canSubmit ? <><Text style={styles.title}>언제 만날까요?</Text><Text style={styles.note}>한국 시간 · 메이트의 가능 시간 합집합도 표시해요.</Text><View pointerEvents={busy ? 'none' : 'auto'}><AvailabilityGrid variant="v3" timeZone="Asia/Seoul" now={now} days={days} picked={picked} others={new Set(state.availability.others_slots)} onToggle={(date, hour) => {
          if (busy || pending.has(lockKey) || isPastKstCell(date, hour, adjustedServerNow(state))) return;
          draftRevision.current ??= state.revision;
          setPicked(previous => { const next = new Set(previous), key = cellKey(date, hour); if (next.has(key)) next.delete(key); else next.add(key); return next; });
        }} /></View><Text style={styles.note}>{picked.size ? `${picked.size}시간 선택` : '제출 철회를 누르면 미제출 상태가 돼요.'}</Text></> : null}
        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      </>}
    </ScrollView>
    {state && decision.mode === 's4' ? <View style={styles.stack}>
      {canSubmit ? editing ? <Button label={picked.size ? '선택 완료' : '제출 철회'} disabled={busy || (!picked.size && !state.availability.my_slots.length)} loading={busy} onPress={() => void mutate(false)} />
        : <Button label="일정 수정" variant="secondary" disabled={busy} onPress={() => { draftRevision.current = state.revision; setEditing(true); setError(''); }} /> : null}
      {state.permissions.can_select_time && (state.stage === 'place' || (scheduling && state.availability.all_submitted)) ? <Button label={state.meeting_time ? '시간 수정하기' : '시간 선택하기'} disabled={busy} onPress={selectTime} /> : null}
      {scheduling && state.permissions.can_select_time && state.availability.all_submitted ? <><Text style={styles.note}>시간 없이 식당 단계에 갈 수 있지만, 최종 확정 전에는 시간을 골라야 해요.</Text><Button label="시간 없이 식당 정하기" variant="text" disabled={busy} onPress={() => void mutate(true)} /></> : null}
    </View> : null}
  </BottomSheet>;
}
const styles = StyleSheet.create({
  stack: { gap: 12 }, head: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  title: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 23, color: colors.ink }, value: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 25, color: colors.ink },
  note: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 20, color: colors.sub }, time: { backgroundColor: colors.safeBg, borderRadius: 16, padding: 16, gap: 6 }, neutral: { backgroundColor: colors.mutedBg, borderRadius: 16, padding: 16, gap: 6 },
  member: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 }, name: { flex: 1, fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 23, color: colors.ink },
  badge: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 20, color: colors.sub, backgroundColor: colors.mutedBg, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 14 }, submitted: { color: colors.safeText, backgroundColor: colors.safeBg },
  error: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 20, color: v3FeedbackColors.error },
});
