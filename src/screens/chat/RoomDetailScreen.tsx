import { CalendarDays, ChevronLeft, Info, MapPin, Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import DestructiveDialog from '../../components/ui/DestructiveDialog';
import FailureCard from '../../components/ui/FailureCard';
import InviteCodeBox from '../../components/ui/InviteCodeBox';
import MateInviteSheet from '../../components/ui/MateInviteSheet';
import { meetingTimeLabel } from '../../components/ui/MeetingCard';
import RoomMemberRow from '../../components/ui/RoomMemberRow';
import RoomTimer from '../../components/ui/RoomTimer';
import { canInviteToRoom } from '../../lib/roomMembership';
import { leaveRoom } from '../../lib/rooms';
import { unverifiedSettlementLabel } from '../../lib/roomSettlementPolicy';
import { useNavigation } from '../../navigation/NavigationContext';
import { useRoom } from '../../rooms/useMyRooms';
import { useTopInset } from '../../theme/insets';
import { v3Layout } from '../../theme/scale';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

/** Map only known codes; never surface SQL, identifiers, or arbitrary backend text. */
export function roomDeletionErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === '42501') return '방장만 방을 없앨 수 있어요. 참여 정보를 확인해 주세요.';
  if (code === 'PGRST301' || code === '28000') return '다시 로그인한 뒤 시도해 주세요.';
  return '방을 없애지 못했어요. 잠시 후 다시 시도해 주세요.';
}

/** Phone 528:1525 / 561:1734. Room APIs and owner/settling restrictions are unchanged. */
export default function RoomDetailScreen() {
  const topInset = useTopInset();
  const { goBack, navigate, resetTo, current } = useNavigation();
  const { user } = useAuth();
  const params = current.params as { roomId?: string; title?: string } | undefined;
  const roomId = params?.roomId ?? null;
  const { room, status, reload } = useRoom(roomId);
  const title = params?.title ?? room?.title ?? '밥약';
  const members = room?.participants ?? [];
  const isOwner = Boolean(user?.id && room?.ownerId && user.id === room.ownerId);
  const settling = room?.stage === 'settling';
  const [inviting, setInviting] = useState(false);
  const canInvite = canInviteToRoom(room?.stage);
  useEffect(() => { if (!canInvite) setInviting(false); }, [canInvite]);
  const [deletionOpen, setDeletionOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deletionError, setDeletionError] = useState<string | null>(null);
  const deleting = useRef(false);
  const openChatSheet = (openSheet: 'menu' | 'members') => { if (roomId && room && (openSheet !== 'menu' || room.stage === 'place')) navigate('ChatRoom', { roomId, title, openSheet }); };
  const confirmDeletion = async () => {
    if (!roomId || !user?.id || deleting.current) return;
    deleting.current = true;
    setLeaving(true);
    setDeletionError(null);
    try {
      const error = await leaveRoom(roomId);
      if (error) { setDeletionError(roomDeletionErrorMessage(error)); return; }
      setDeletionOpen(false);
      // Existing success event: Home consumes this only after the real API succeeds.
      resetTo('Home', { deletedRoomId: roomId, deletedRoomTitle: title });
    } catch { setDeletionError('방을 없애지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    finally { deleting.current = false; setLeaving(false); }
  };
  return <View style={styles.screen}>
    <View style={{ height: topInset }} />
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="뒤로" style={styles.iconButton} onPress={goBack}><ChevronLeft size={24} color={colors.ink} /></Pressable><Text style={styles.headerTitle}>방 상세정보</Text></View>
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      {status === 'error' ? <FailureCard title="방 정보를 불러오지 못했어요" reason="잠시 후 다시 시도해 주세요." icon={<Info size={26} color={colors.sub} />} onRetry={reload} /> : null}
      {canInvite || !room ? <View style={styles.card}><InviteCodeBox code={room?.code ?? null} loading={!room && status !== 'error'} /></View> : null}
      <View style={[styles.card, styles.appointment]}>
        {room?.decisionMode === 's4' && (settling || room.stage === 'done') ? <RoomTimer expiresAt={room.expiresAt} settled={room.stage === 'done'} boundedSettlement /> : null}
        {room && unverifiedSettlementLabel(room.stage, Boolean(room.appointmentConfirmedAt), room.decisionMode === 's4') ? <Text style={styles.hint}>{unverifiedSettlementLabel(room.stage, Boolean(room.appointmentConfirmedAt), true)} · 이전 정산의 약속 확정 여부는 확인할 수 없어요.</Text> : null}
        <View style={styles.infoRow}><CalendarDays size={20} color={colors.sub} /><View style={styles.valueBox}><Text style={styles.label}>일정</Text><Text style={[styles.value, !room?.meetingTime && !room?.confirmedSlot?.trim() && styles.unset]}>{meetingTimeLabel(room?.confirmedSlot, room?.stage ?? 'scheduling', room?.meetingTime)}</Text></View></View>
        {/* TODO(서버 단계): confirmed_menu는 식당 이름이며 RoomSummary에 별도 메뉴가 없다. 메뉴 줄은 계약이 생기면 표시한다. */}
        <View style={styles.infoRow}><MapPin size={20} color={colors.sub} /><View style={styles.valueBox}><Text style={styles.label}>장소</Text><Text style={[styles.value, !room?.locationName?.trim() && styles.unset]}>{room?.locationName?.trim() || '아직 정하지 않았어요'}</Text></View>
          {room && room.stage === 'place' && !room.locationName?.trim() && roomId ? <Pressable accessibilityRole="button" accessibilityLabel="장소 정하기" style={styles.choose} onPress={() => openChatSheet('menu')}><Text style={styles.chooseText}>정하기</Text></Pressable> : null}
        </View>
      </View>
      <View style={[styles.card, styles.memberCard]}>
        <View style={styles.memberHead}><Text style={styles.cardTitle}>{room ? '메이트 ' + members.length + '명' : '메이트'}</Text>{canInvite && roomId && room?.code ? <Pressable accessibilityRole="button" accessibilityLabel="메이트 초대" style={styles.invite} onPress={() => setInviting(true)}><Plus size={16} color={colors.selectedText} /><Text style={styles.chooseText}>초대</Text></Pressable> : null}</View>
        {room && !canInvite ? <Text style={styles.hint}>정산이 시작되어 메이트를 더 초대할 수 없어요.</Text> : null}
        {members.length ? members.map(member => <RoomMemberRow key={member.id} participant={member} myId={user?.id ?? null} ownerId={room?.ownerId ?? null} />) : <Text style={styles.hint}>{room || status === 'error' ? '참여 멤버를 불러오지 못했어요' : '메이트를 불러오는 중이에요'}</Text>}
      </View>
      {/* [결정] leave_room은 settling에서만 막으므로, 다른 단계에 정산 완료 조건을 안내하지 않는다. */}
      {isOwner ? <>
        <Pressable accessibilityRole="button" accessibilityLabel="방 없애기" accessibilityState={{ disabled: leaving || settling }} disabled={leaving || settling}
          onPress={() => { setDeletionError(null); setDeletionOpen(true); }} style={[styles.delete, (leaving || settling) && styles.disabled]}>
          <Trash2 size={18} color={v3FeedbackColors.error} /><Text style={styles.deleteText}>방 없애기</Text>
        </Pressable>
        <View style={styles.hintRow}><Info size={16} color={colors.sub} /><Text style={styles.hint}>{settling ? '정산이 끝나면 없앨 수 있어요.' : '방을 없애면 메이트 모두에게서 방이 사라져요. 정산 내역은 남아 있어요.'}</Text></View>
      </> : room ? <Text style={styles.hint}>방은 방장만 없앨 수 있어요.</Text> : null}
      {/* TODO(서버 단계): 메이트의 방 나가기 계약이 없으므로 버튼을 표시하지 않는다. */}
    </ScrollView>
    {canInvite && room?.code ? <MateInviteSheet visible={inviting} code={room.code} onClose={() => setInviting(false)} /> : null}
    <DestructiveDialog visible={deletionOpen} busy={leaving} error={deletionError} onClose={() => setDeletionOpen(false)} onConfirm={() => void confirmDeletion()} />
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { minHeight: v3Layout.headerHeight, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconButton: { width: v3Layout.minTouchTarget, height: v3Layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 25, color: colors.ink },
  body: { padding: 20, paddingTop: 4, gap: 12, paddingBottom: 40 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, padding: 16 },
  appointment: { paddingLeft: 16, paddingRight: 8, paddingVertical: 8 },
  infoRow: { minHeight: 56, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 12 },
  valueBox: { flex: 1, minWidth: 0 },
  label: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 18, color: colors.sub },
  value: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22, color: colors.ink },
  unset: { fontFamily: fontFamily.body, color: colors.sub },
  choose: { minHeight: v3Layout.minTouchTarget, minWidth: v3Layout.minTouchTarget, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },
  chooseText: { fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 20, color: colors.selectedText },
  memberCard: { gap: 4 },
  memberHead: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { flex: 1, fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22, color: colors.ink },
  invite: { minHeight: v3Layout.minTouchTarget, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  delete: { minHeight: v3Layout.buttonHeight, borderWidth: 1.5, borderColor: v3FeedbackColors.error, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.surface },
  deleteText: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 24, color: v3FeedbackColors.error },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  hint: { flex: 1, fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.sub },
  disabled: { opacity: 0.4 },
});
