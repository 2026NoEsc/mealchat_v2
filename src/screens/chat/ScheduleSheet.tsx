import { Check, Clock3 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import AvailabilityGrid from '../../components/AvailabilityGrid';
import Avatar from '../../components/Avatar';
import BottomSheet from '../../components/ui/BottomSheet';
import { PrimaryButton, SecondaryButton, TextButton } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { meetingTimeLabel } from '../../components/ui/MeetingCard';
import {
  fetchRoomAvailability,
  saveMyAvailability,
  type AvailabilityStatus,
} from '../../lib/availability';
import { advanceRoomStage, fetchRoom, type RoomSummary } from '../../lib/rooms';
import { buildNextDays, cellKey, isPastCell, toSlots } from '../../lib/scheduleSlots';
import { v3Layout } from '../../theme/scale';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

type Props = {
  visible: boolean;
  roomId: string | null;
  /** 단계를 넘기는 건 방장만 할 수 있다 — advance_room_stage 가 서버에서 막는다 */
  isOwner: boolean;
  onClose: () => void;
  /** 상태 RPC가 끝난 뒤 부모의 스냅샷을 갱신한다. 임의 시스템 메시지는 만들지 않는다. */
  onStateChanged: () => void;
};

const ROOM_FAILURE = '방 정보를 불러오지 못해 지금은 일정을 낼 수 없어요. 다시 불러와 주세요.';
type PendingMutation = { kind: 'saving' | 'advancing'; succeeded: boolean };
// Room-scoped locks survive closing/reopening and even remounting the sheet. No data is persisted here.
const pendingMutations = new Map<string, PendingMutation>();
const mutationListeners = new Set<() => void>();
const subscribeMutations = (listener: () => void) => {
  mutationListeners.add(listener);
  return () => { mutationListeners.delete(listener); };
};
function beginMutation(roomId: string, kind: PendingMutation['kind']) {
  if (pendingMutations.has(roomId)) return null;
  const mutation: PendingMutation = { kind, succeeded: false };
  pendingMutations.set(roomId, mutation);
  mutationListeners.forEach(listener => listener());
  return mutation;
}
function endMutation(roomId: string, mutation: PendingMutation) {
  if (pendingMutations.get(roomId) !== mutation) return;
  pendingMutations.delete(roomId);
  mutationListeners.forEach(listener => listener());
}

/** Phone 527:1613. Existing availability persistence and owner-only stage transition. */
export default function ScheduleSheet({
  visible,
  roomId,
  isOwner,
  onClose,
  onStateChanged,
}: Props) {
  const { user } = useAuth();
  const myId = user?.id ?? null;

  const days = useMemo(() => buildNextDays(5), []);

  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<AvailabilityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [roomError, setRoomError] = useState(false);
  const [roomLoading, setRoomLoading] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(false);
  const request = useRef(0);
  const roomRequest = useRef(0);
  const lifecycle = useRef(0);
  const roomIdentity = useRef({ roomId });
  if (roomIdentity.current.roomId !== roomId) roomIdentity.current = { roomId };
  const callbacks = useRef({ onStateChanged, onClose });
  callbacks.current = { onStateChanged, onClose };
  const getMutation = useCallback(() => roomId ? pendingMutations.get(roomId) : undefined, [roomId]);
  const pending = useSyncExternalStore(subscribeMutations, getMutation, getMutation);
  const saving = pending?.kind === 'saving';
  const advancing = pending?.kind === 'advancing';
  const isLocked = () => Boolean(roomId && pendingMutations.has(roomId));
  const ownMutation = useRef<{ mutation: PendingMutation; cycle: number } | null>(null);
  const observedMutation = useRef<{ roomId: string | null; mutation: PendingMutation | undefined } | null>(null);
  /** 낸 뒤에도 "일정 수정" 으로 격자를 다시 열 수 있다 */
  const [editing, setEditing] = useState(false);

  const loadAvailability = useCallback(async () => {
    if (!roomId || !myId) return;
    const revision = ++request.current;
    setLoading(true);
    setError('');
    try {
      const { data, error: loadError } = await fetchRoomAvailability(roomId);
      if (!active.current || revision !== request.current) return;
      if (loadError || !data) throw new Error('Availability unavailable');
      setStatus(data); setPicked(new Set(data.mySlots)); setEditing(data.mySlots.length === 0);
    } catch {
      if (active.current && revision === request.current) {
        setStatus(null); setError('일정 제출 현황을 불러오지 못했어요. 다시 시도해 주세요.');
      }
    } finally {
      if (active.current && revision === request.current) setLoading(false);
    }
  }, [roomId, myId]);

  /** Retrying room metadata must never replace an in-progress availability draft. */
  const loadRoom = useCallback(async () => {
    if (!roomId || !myId) return;
    const revision = ++roomRequest.current;
    setRoomLoading(true);
    try {
      const { data, error: loadError } = await fetchRoom(roomId);
      if (!active.current || revision !== roomRequest.current) return;
      if (loadError || !data) throw new Error('Room unavailable');
      setRoom(data); setRoomError(false);
    } catch {
      if (active.current && revision === roomRequest.current) setRoomError(true);
    } finally {
      if (active.current && revision === roomRequest.current) setRoomLoading(false);
    }
  }, [roomId, myId]);

  useEffect(() => {
    active.current = visible;
    setStatus(null); setRoom(null); setPicked(new Set()); setEditing(false); setRoomError(false); setError('');
    if (visible && roomId && myId) void Promise.all([loadAvailability(), loadRoom()]);
    else setLoading(false);
    const invalidate = () => { ++request.current; ++roomRequest.current; ++lifecycle.current; };
    return () => { active.current = false; invalidate(); };
  }, [visible, roomId, myId, loadAvailability, loadRoom]);

  useEffect(() => {
    const previous = observedMutation.current;
    observedMutation.current = { roomId, mutation: pending };
    const completed = previous?.mutation;
    if (!pending && previous?.roomId === roomId && completed?.succeeded && active.current &&
      (ownMutation.current?.mutation !== completed || ownMutation.current.cycle !== lifecycle.current)) {
      // A reopened/new sheet may have loaded the pre-save snapshot while the room was locked.
      void loadAvailability();
      if (completed.kind === 'advancing') void loadRoom();
    }
  }, [pending, roomId, loadAvailability, loadRoom]);

  const scheduling = room?.stage === 'scheduling';
  const canEdit = scheduling && !roomError && !roomLoading;

  const toggle = (date: string, hour: number) => {
    if (!canEdit || isLocked() || loading || isPastCell(date, hour)) return;
    setPicked((prev) => {
      const next = new Set(prev);
      const key = cellKey(date, hour);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const slots = toSlots(picked, days);
  const busy = saving || advancing;
  const others = useMemo(() => new Set(status?.othersSlots ?? []), [status]);

  const submit = async () => {
    if (!active.current || !canEdit || !roomId || !myId || !status || loading || isLocked() || slots.length === 0) return;
    const revision = request.current;
    const cycle = lifecycle.current;
    const mutationRoom = roomIdentity.current;
    const mutation = beginMutation(roomId, 'saving');
    if (!mutation) return;
    ownMutation.current = { mutation, cycle };
    setError('');
    try {
      let latest: RoomSummary | null = null;
      try {
        const result = await fetchRoom(roomId);
        if (!result.error) latest = result.data;
      } catch { /* A failed preflight never permits an availability write. */ }
      if (!active.current || cycle !== lifecycle.current || mutationRoom !== roomIdentity.current) return;
      if (!latest) { setRoomError(true); return; }
      setRoom(latest); setRoomError(false);
      if (latest.stage !== 'scheduling') { callbacks.current.onStateChanged(); return; }
      // TODO(서버 단계): 단계 확인과 가용 시간 저장 사이의 경합은 원자적인 서버 계약으로 막아야 한다.
      const result = await saveMyAvailability(roomId, [...picked]);
      if (result) {
        if (active.current && cycle === lifecycle.current) setError('일정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
      mutation.succeeded = true;
      // Successful persistence still refreshes the parent after X/scrim closes the sheet.
      if (mutationRoom !== roomIdentity.current) return;
      callbacks.current.onStateChanged();
      if (active.current && cycle === lifecycle.current) await loadAvailability();
    } catch {
      if (active.current && revision === request.current) setError('일정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      endMutation(roomId, mutation);
    }
  };

  const members = status?.members ?? [];
  /*
   * 모두 냈다고 방이 알아서 넘어가지는 않는다. 단계를 올리는 RPC 가 방장만
   * 통과시키기 때문에, 마지막 사람이 낸 순간 자동으로 넘기면 그 사람이 방장이
   * 아닐 때 그냥 실패한다. 그래서 방장이 마무리를 눌러 넘긴다.
   */
  const allSubmitted = members.length > 0 && members.every((member) => member.submitted);
  const advance = async () => {
    if (!active.current || !canEdit || !roomId || !myId || !isOwner || !allSubmitted || loading || isLocked()) return;
    const revision = request.current;
    const cycle = lifecycle.current;
    const mutationRoom = roomIdentity.current;
    const mutation = beginMutation(roomId, 'advancing');
    if (!mutation) return;
    ownMutation.current = { mutation, cycle };
    setError('');
    try {
      const result = await advanceRoomStage(roomId, 'place');
      if (result.error) {
        if (active.current && cycle === lifecycle.current) setError('식당 정하기로 넘어가지 못했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
      mutation.succeeded = true;
      if (mutationRoom !== roomIdentity.current) return;
      callbacks.current.onStateChanged();
      if (active.current && cycle === lifecycle.current) callbacks.current.onClose();
    } catch {
      if (active.current && revision === request.current) setError('식당 정하기로 넘어가지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      endMutation(roomId, mutation);
    }
  };

  const confirmedSlot = room?.confirmedSlot?.trim();
  const canUse = Boolean(roomId && myId);
  const stageNotice = room?.stage === 'place' ? '지금은 식당 정하기 단계예요.' : room?.stage === 'confirmed' ? '약속이 확정됐어요.' : room?.stage === 'settling' ? '정산 중이에요.' : room?.stage === 'done' ? '밥약이 끝났어요.' : null;
  const announcement = !visible || !canUse ? null : loading ? '일정을 불러오는 중이에요.' : roomLoading ? '방 정보를 불러오는 중이에요.' : roomError ? ROOM_FAILURE : stageNotice;
  const lastAnnouncement = useRef<string | null>(null);
  useEffect(() => {
    if (!visible) { lastAnnouncement.current = null; return; }
    if (Platform.OS === 'ios' && announcement && announcement !== lastAnnouncement.current) {
      AccessibilityInfo.announceForAccessibilityWithOptions(announcement, { queue: true });
      lastAnnouncement.current = announcement;
    }
  }, [visible, announcement]);

  return (
    <BottomSheet
      visible={visible}
      title="일정 조율"
      subtitle="확정된 시간과 메이트들의 일정 제출 현황이에요."
      onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.body} contentContainerStyle={styles.content}>
        {!canUse ? <Text style={styles.error} accessibilityRole="alert">밥약과 로그인 정보를 확인해 주세요.</Text> : loading ? <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} accessible={false} /><Text style={styles.hint} accessibilityLiveRegion="polite">일정을 불러오는 중이에요.</Text>
        </View> : <>
          {confirmedSlot ? <View testID="schedule-confirmed" style={styles.confirmed}>
            <Clock3 size={22} color={colors.safeText} aria-hidden={true} />
            <View style={styles.grow}><Text style={styles.confirmedLabel}>확정</Text><Text style={styles.confirmedTime}>{meetingTimeLabel(confirmedSlot, room?.stage ?? 'scheduling')}</Text></View>
          </View> : !roomError ? <Text style={styles.hint} accessibilityLiveRegion="polite">{roomLoading ? '방 정보를 불러오는 중이에요.' : scheduling ? '모두 가능한 시간을 제출하면 방장이 식당 정하기로 넘어갈 수 있어요.' : '시간 미정'}</Text> : null}
          {/* [결정] 방 단계 조회 실패 시 안전하게 제출을 막고, 제출 불가 사유와 재시도 방법을 명시한다. */}
          {roomError ? <Text style={styles.hint} accessibilityLiveRegion="polite">{ROOM_FAILURE}</Text> : null}
          {roomLoading && (confirmedSlot || roomError) ? <Text style={styles.hint} accessibilityLiveRegion="polite">방 정보를 불러오는 중이에요.</Text> : null}
          {roomError ? <TextButton label="방 정보 다시 불러오기" onPress={() => void loadRoom()} loading={roomLoading} disabled={busy} /> : null}
          {stageNotice ? <Text style={styles.hint} accessibilityLiveRegion="polite">{stageNotice}</Text> : null}
          {status ? <View testID="schedule-submissions">
            <View style={styles.submissionHead}><Text accessibilityRole="header" style={styles.sectionTitle}>일정 제출</Text><Text style={styles.count}>{members.length}명 중 {members.filter(member => member.submitted).length}명</Text></View>
            {members.map(member => {
              const participant = room?.participants.find(person => person.id === member.id);
              const mine = Boolean(participant?.profileId && participant.profileId === myId);
              return <View key={member.id} testID={`schedule-submission-${member.id}`} style={styles.member} accessible accessibilityLabel={member.name + (mine ? ' (나)' : '') + ', ' + (member.submitted ? '제출' : '아직')}>
                <View accessible={false} importantForAccessibility="no-hide-descendants"><Avatar name={member.name} url={participant?.avatarUrl} seed={participant?.profileId ?? member.id} size={32} radius={16} /></View>
                <Text style={styles.memberName}>{member.name}{mine ? ' (나)' : ''}</Text>
                <View style={[styles.badge, member.submitted && styles.submitted]}>
                  {member.submitted ? <Check size={14} color={colors.safeText} aria-hidden={true} /> : null}
                  <Text style={[styles.badgeText, member.submitted && styles.submittedText]}>{member.submitted ? '제출' : '아직'}</Text>
                </View>
              </View>;
            })}
            {!members.length ? <Text style={styles.hint}>일정 제출 현황이 없어요.</Text> : null}
          </View> : null}
          {editing && status && scheduling ? <>
            <Text accessibilityRole="header" style={styles.sectionTitle}>언제 만날까요?</Text>
            <Text style={styles.hint}>가능한 시간을 눌러서 표시해 주세요. 메이트가 제출한 가능한 시간도 함께 보여요.</Text>
            {/* TODO(서버 단계): othersSlots는 익명 가능 시간이며 개인별 바쁜 시간으로 해석하지 않는다. */}
            <View pointerEvents={busy || !canEdit ? 'none' : 'auto'}><AvailabilityGrid variant="v3" days={days} picked={picked} others={others} onToggle={toggle} /></View>
            <View style={styles.picks}><Text style={styles.count}>고른 시간 {slots.length}구간 · {picked.size}시간</Text>
              {slots.map(slot => <Chip key={slot.id} label={slot.label} selected disabled={busy || !canEdit} onChange={() => setPicked(previous => {
                if (!canEdit || isLocked()) return previous;
                const next = new Set(previous);
                for (let hour = Number(slot.startTime.slice(0, 2)); hour < Number(slot.endTime.slice(0, 2)); hour++) next.delete(cellKey(slot.date, hour));
                return next;
              })} />)}
            </View>
          </> : null}
          {scheduling && allSubmitted && !isOwner ? <Text style={styles.hint}>모두 냈어요. 방장이 마치면 식당 정하기로 넘어가요.</Text> : null}
        </>}
        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
        {!loading && canUse && !status ? <TextButton label="다시 불러오기" onPress={() => void loadAvailability()} /> : null}
      </ScrollView>
      {status && !loading && canUse && canEdit ? editing ? <PrimaryButton label="선택 완료" loading={saving} disabled={busy || slots.length === 0} onPress={() => void submit()} /> : <View style={styles.buttons}>
        <SecondaryButton label="일정 수정" style={styles.grow} disabled={busy} onPress={() => { if (!isLocked()) { setError(''); setEditing(true); } }} />
        {/* [결정] 기존 advanceRoomStage(roomId, 'place')는 식당 단계다. 메뉴 흐름을 만들지 않고 실제 목적지로 표시한다. */}
        {/* TODO(서버 단계): 별도 메뉴 흐름 계약이 생기면 메뉴 진입을 연결한다. */}
        {isOwner ? <PrimaryButton label="식당 정하러 가기" style={styles.grow} loading={advancing} disabled={busy || !allSubmitted} onPress={() => void advance()} /> : null}
      </View> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: 8 },
  body: { flexShrink: 1 }, content: { gap: 16 }, grow: { flex: 1, minWidth: 0 },
  confirmed: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12, borderRadius: 16, backgroundColor: colors.safeBg },
  confirmedLabel: { fontFamily: fontFamily.bold, fontSize: 12, lineHeight: 18, color: colors.safeText },
  confirmedTime: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 26, color: colors.ink },
  submissionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBottom: 6 },
  sectionTitle: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22, color: colors.ink },
  count: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 20, color: colors.sub },
  member: { minHeight: v3Layout.minTouchTarget, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberName: { flex: 1, fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 22, color: colors.ink },
  badge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 10, gap: 4, borderRadius: 14, backgroundColor: colors.mutedBg },
  badgeText: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 20, color: colors.sub },
  submitted: { backgroundColor: colors.safeBg }, submittedText: { color: colors.safeText },
  buttons: { flexDirection: 'row', gap: 8 }, picks: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  hint: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 22, color: colors.sub },
  error: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 20, color: v3FeedbackColors.error },
});
