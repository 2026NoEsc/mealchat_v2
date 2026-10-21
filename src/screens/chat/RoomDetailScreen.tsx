import { CalendarDays, ChevronLeft, Crown, Info, LogOut, MapPin, Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import DestructiveDialog from '../../components/ui/DestructiveDialog';
import FailureCard from '../../components/ui/FailureCard';
import InviteCodeBox from '../../components/ui/InviteCodeBox';
import MateInviteSheet from '../../components/ui/MateInviteSheet';
import MateProfileSheet from '../../components/ui/MateProfileSheet';
import { meetingTimeLabel } from '../../components/ui/MeetingCard';
import RoomMemberRow from '../../components/ui/RoomMemberRow';
import RoomTimer from '../../components/ui/RoomTimer';
import {
  createRoomLifecycleController,
  type RoomLifecycleView,
} from '../../lib/roomLifecycleController';
import {
  fetchS3Capabilities,
  registerRoomLifecycleResources,
  roomLifecycleErrorMessage,
  lifecycleError,
  subscribeRoomLifecycle,
} from '../../lib/roomLifecycle';
import { canInviteToRoom } from '../../lib/roomMembership';
import type { RoomParticipant } from '../../lib/rooms';
import { leaveRoom } from '../../lib/rooms';
import { unverifiedSettlementLabel } from '../../lib/roomSettlementPolicy';
import { useNavigation } from '../../navigation/NavigationContext';
import { useRoom } from '../../rooms/useMyRooms';
import MemberLeaveDialog from '../room/MemberLeaveDialog';
import OwnerTransferCard from '../room/OwnerTransferCard';
import OwnerTransferSheet from '../room/OwnerTransferSheet';
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
  const isScheduleLocked = ['confirmed', 'settling', 'done'].includes(room?.stage ?? '');
  const scheduleValue = meetingTimeLabel(room?.confirmedSlot, room?.stage ?? 'scheduling', room?.meetingTime);
  const [inviting, setInviting] = useState(false);
  const [selectedMate, setSelectedMate] = useState<RoomParticipant | null>(null);
  const canInvite = canInviteToRoom(room?.stage);
  useEffect(() => { if (!canInvite) setInviting(false); }, [canInvite]);

  // S3 생명주기 컨트롤러 연결
  const [s3Supported, setS3Supported] = useState<boolean | null>(null);
  const [capabilityFailed, setCapabilityFailed] = useState(false);
  const [probeAttempt, setProbeAttempt] = useState(0);
  const [lifecycleView, setLifecycleView] = useState<RoomLifecycleView | null>(null);
  const controllerRef = useRef<ReturnType<typeof createRoomLifecycleController> | null>(null);
  const lastAction = useRef<'leave' | 'close' | null>(null);
  const autoRefreshAllowed = useRef(false);
  const lastTransfer = useRef<RoomLifecycleView['transferState']>(null);
  const [lifecycleNotice, setLifecycleNotice] = useState<Error | null>(null);
  const departedHandled = useRef(false);
  const [busyAction, setBusyAction] = useState(false);

  useEffect(() => {
    let active = true;
    setS3Supported(null);
    setCapabilityFailed(false);
    void fetchS3Capabilities().then(cap => {
      if (!active) return;
      setS3Supported(cap.mode === 's3' ? true : cap.mode === 'legacy' ? false : null);
      setCapabilityFailed(cap.mode === 'error');
    }).catch(() => {
      if (active) setCapabilityFailed(true);
    });
    return () => { active = false; };
  }, [roomId, probeAttempt]);

  useEffect(() => {
    if (!roomId || s3Supported !== true) { lastTransfer.current = null; setLifecycleView(null); return; }
    autoRefreshAllowed.current = false;
    lastTransfer.current = null;
    departedHandled.current = false;
    lastAction.current = null;
    setLifecycleNotice(null);
    const controller = createRoomLifecycleController(roomId);
    controllerRef.current = controller;
    const unsubscribe = controller.subscribe(view => {
      if (view.state) {
        autoRefreshAllowed.current = true;
        lastTransfer.current = view.transferState;
        if (!view.pending && !view.error) setLifecycleNotice(null);
      }
      if (view.error) {
        setLifecycleNotice(view.error);
        if ((view.error as Error & { code?: string }).code === 'ACCOUNT_CHANGED') lastTransfer.current = null;
      }
      setLifecycleView(view);
    });
    const unregister = registerRoomLifecycleResources(roomId, {
      invalidate: reload,
      unsubscribe: () => {},
    });
    const unsubscribeInvalidation = subscribeRoomLifecycle(event => {
      const view = controller.getState();
      if (event.roomId === roomId && ['changed', 'uncertain'].includes(event.reason) && !view.pending && !view.departed) {
        autoRefreshAllowed.current = true;
        setLifecycleView(view);
      }
    });
    void controller.refresh();
    return () => {
      unregister();
      unsubscribeInvalidation();
      unsubscribe();
      controller.dispose();
      controllerRef.current = null;
    };
  }, [roomId, reload, s3Supported]);

  // [결정] 오류/외부 무효화 후 한 번 재조회. 재조회 실패는 명시 재시도로 남긴다.
  useEffect(() => {
    if (!busyAction && s3Supported && controllerRef.current && lifecycleView && lifecycleView.state === null && !lifecycleView.pending && !lifecycleView.departed && autoRefreshAllowed.current && (lifecycleView.error as (Error & { code?: string }) | null)?.code !== 'ACCOUNT_CHANGED') {
      autoRefreshAllowed.current = false;
      void controllerRef.current.refresh();
    }
  }, [busyAction, s3Supported, lifecycleView]);

  useEffect(() => {
    if (lifecycleView?.departed && roomId && !departedHandled.current) {
      departedHandled.current = true;
      if (lastAction.current === 'leave') {
        resetTo('Home', { leftRoomId: roomId, leftRoomTitle: title });
      } else if (lastAction.current === 'close') {
        resetTo('Home', { deletedRoomId: roomId, deletedRoomTitle: title });
      } else {
        resetTo('Home');
      }
    }
  }, [lifecycleView?.departed, roomId, resetTo, title]);

  const [deletionOpen, setDeletionOpen] = useState(false);
  const [deletionError, setDeletionError] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const deleting = useRef(false);

  // [결정] B2: 레거시 서버에서는 기존 settling 기준으로 방 없애기 비활성 결정, S3 활성화 시에는 서버 canClose 신뢰
  const isCloseDisabled = busyAction || s3Supported === null || (s3Supported === true ? !lifecycleView?.canClose : settling);

  const openChatSheet = (openSheet: 'menu' | 'members') => { if (roomId && room && (openSheet !== 'menu' || room.stage === 'place')) navigate('ChatRoom', { roomId, title, openSheet }); };

  const confirmDeletion = async () => {
    if (!roomId || !user?.id || deleting.current) return;
    deleting.current = true;
    setBusyAction(true);
    setDeletionError(null);
    lastAction.current = 'close';
    try {
      if (s3Supported === null) {
        setDeletionError('서버 상태를 확인한 뒤 다시 시도해 주세요.');
        return;
      }
      if (s3Supported) {
        if (!controllerRef.current?.getState().canClose) {
          setDeletionError('현재 방 상태를 다시 확인한 뒤 시도해 주세요.');
          return;
        }
        setLifecycleNotice(null);
        await controllerRef.current.close();
        const err = controllerRef.current.getState().error;
        if (err) {
          setDeletionError(roomLifecycleErrorMessage(err));
          return;
        }
      } else {
        const error = await leaveRoom(roomId);
        if (error) { setDeletionError(roomDeletionErrorMessage(error)); return; }
        setDeletionOpen(false);
        resetTo('Home', { deletedRoomId: roomId, deletedRoomTitle: title });
      }
    } catch {
      lastAction.current = null;
      setDeletionError('방을 없애지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      if (!controllerRef.current?.getState().departed || controllerRef.current.getState().error) lastAction.current = null;
      deleting.current = false;
      setBusyAction(false);
    }
  };

  const confirmLeave = async () => {
    if (!roomId || !user?.id || !controllerRef.current || deleting.current) return;
    if (!controllerRef.current.getState().canLeave) {
      setLeaveError('현재 방 상태를 다시 확인한 뒤 시도해 주세요.');
      return;
    }
    deleting.current = true;
    setLifecycleNotice(null);
    setBusyAction(true);
    setLeaveError(null);
    lastAction.current = 'leave';
    try {
      await controllerRef.current.leave();
      const err = controllerRef.current.getState().error;
      if (err) {
        setLeaveError(roomLifecycleErrorMessage(err));
        return;
      }
    } catch (err: unknown) {
      lastAction.current = null;
      setLeaveError(roomLifecycleErrorMessage(err));
    } finally {
      if (!controllerRef.current?.getState().departed || controllerRef.current.getState().error) lastAction.current = null;
      deleting.current = false;
      setBusyAction(false);
    }
  };

  const runTransferAction = async (run: (controller: ReturnType<typeof createRoomLifecycleController>) => Promise<void>) => {
    const controller = controllerRef.current;
    if (!controller) throw lifecycleError('S4005');
    let applied = false;
    // action()은 mutation 성공 후에만 state=null/pending=true인 refresh 단계로 진입한다.
    const unsubscribe = controller.subscribe(view => {
      if (view.pending && view.state === null) applied = true;
    });
    setBusyAction(true);
    setLifecycleNotice(null);
    try {
      await run(controller);
      const err = controller.getState().error;
      if (err && !applied) throw err;
      if (err) autoRefreshAllowed.current = false;
    } finally { unsubscribe(); setBusyAction(false); }
  };

  const handleRequestTransfer = async (targetProfileId: string, leaveAfterAccept: boolean) => {
    if (!controllerRef.current?.getState().canTransfer) throw lifecycleError('S3003');
    await runTransferAction(controller => controller.requestTransfer(targetProfileId, leaveAfterAccept));
  };

  const handleCancelTransfer = async () => {
    const view = controllerRef.current?.getState();
    if (!controllerRef.current || !view?.state || view.pending || !view.transferState?.id) throw lifecycleError('S4005');
    await runTransferAction(controller => controller.cancelTransfer(view.transferState!.id));
  };

  const handleRespondTransfer = async (accept: boolean) => {
    const view = controllerRef.current?.getState();
    if (!controllerRef.current || !view?.state || view.pending || !view.transferState?.id) throw lifecycleError('S4005');
    await runTransferAction(controller => controller.respondTransfer(view.transferState!.id, accept));
  };
  return <View style={styles.screen}>
    <View style={{ height: topInset }} />
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="뒤로" style={styles.iconButton} onPress={goBack}><ChevronLeft size={24} color={colors.ink} /></Pressable><Text style={styles.headerTitle}>방 상세정보</Text></View>
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      {status === 'error' ? <FailureCard title="방 정보를 불러오지 못했어요" reason="잠시 후 다시 시도해 주세요." icon={<Info size={26} color={colors.sub} />} onRetry={reload} /> : null}
      {capabilityFailed ? <FailureCard title="서버 상태를 확인하지 못했어요" reason="잠시 후 다시 시도해 주세요." icon={<Info size={26} color={colors.sub} />} onRetry={() => setProbeAttempt(value => value + 1)} /> : null}
      {s3Supported && (lifecycleView?.error || lifecycleNotice) ? (
        <FailureCard
          title="방 상태를 불러오지 못했어요"
          reason={roomLifecycleErrorMessage(lifecycleView?.error ?? lifecycleNotice)}
          icon={<Info size={26} color={v3FeedbackColors.error} />}
          onRetry={() => {
            if (controllerRef.current?.getState().pending) return;
            setLifecycleNotice(null); autoRefreshAllowed.current = false; void controllerRef.current?.refresh();
          }}
        />
      ) : null}
      {/* [결정] S3 D2 A: 동의 기반 방장 위임 상태 카드 */}
      {(lifecycleView?.state ? lifecycleView.transferState : lastTransfer.current) ? (
        <OwnerTransferCard
          transfer={lifecycleView?.state ? lifecycleView.transferState : lastTransfer.current}
          myId={user?.id ?? null}
          participants={members}
          onCancel={handleCancelTransfer}
          onRespond={handleRespondTransfer}
        />
      ) : null}
      {/* [결정] Figma 528:1533 / 561:1742: 초대 코드 영역 클릭 시 메이트 초대 시트(MateInviteSheet) 오픈 연결 */}
      {canInvite || !room ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={room?.code ? `초대 코드 ${room.code}` : '초대 코드'}
          accessibilityHint="두 번 탭하면 메이트 초대 창을 열어요"
          disabled={!canInvite || !room?.code}
          onPress={() => { if (canInvite && room?.code) setInviting(true); }}
          style={styles.card}
        >
          <InviteCodeBox code={room?.code ?? null} loading={!room && status !== 'error'} />
        </Pressable>
      ) : null}
      <View style={[styles.card, styles.appointment]}>
        {room?.decisionMode === 's4' && (settling || room.stage === 'done') ? <RoomTimer expiresAt={room.expiresAt} settled={room.stage === 'done'} boundedSettlement /> : null}
        {room && unverifiedSettlementLabel(room.stage, Boolean(room.appointmentConfirmedAt), room.decisionMode === 's4') ? <Text style={styles.hint}>{unverifiedSettlementLabel(room.stage, Boolean(room.appointmentConfirmedAt), true)} · 이전 정산의 약속 확정 여부는 확인할 수 없어요.</Text> : null}
        {/* [결정] Figma 528:1544 / 561:1753: 일정 행 클릭 시 일정 조율 시트로 연결. 확정 이후 단계(confirmed/settling/done)에서는 일정 수정이 불가하므로 비활성화 */}
        <Pressable
          accessibilityRole={isScheduleLocked ? undefined : 'button'}
          accessibilityLabel={`일정, ${scheduleValue}`}
          accessibilityHint={isScheduleLocked ? '약속이 확정되어 일정을 변경할 수 없어요' : '두 번 탭하면 일정 조율 시트를 열어요'}
          accessibilityState={{ disabled: isScheduleLocked }}
          disabled={isScheduleLocked || !roomId}
          onPress={() => {
            if (roomId && !isScheduleLocked) navigate('ChatRoom', { roomId, title, openSheet: 'schedule' });
          }}
          style={styles.infoRow}
        >
          <CalendarDays size={20} color={colors.sub} />
          <View style={styles.valueBox}>
            <Text style={styles.label}>일정</Text>
            <Text style={[styles.value, !room?.meetingTime && !room?.confirmedSlot?.trim() && styles.unset]}>
              {scheduleValue}
            </Text>
          </View>
        </Pressable>
        {/* TODO(서버 단계): confirmed_menu는 식당 이름이며 RoomSummary에 별도 메뉴가 없다. 메뉴 줄은 계약이 생기면 표시한다. */}
        <View style={styles.infoRow}><MapPin size={20} color={colors.sub} /><View style={styles.valueBox}><Text style={styles.label}>장소</Text><Text style={[styles.value, !room?.locationName?.trim() && styles.unset]}>{room?.locationName?.trim() || '아직 정하지 않았어요'}</Text></View>
          {room && room.stage === 'place' && !room.locationName?.trim() && roomId ? <Pressable accessibilityRole="button" accessibilityLabel="장소 정하기" style={styles.choose} onPress={() => openChatSheet('menu')}><Text style={styles.chooseText}>정하기</Text></Pressable> : null}
        </View>
      </View>
      <View style={[styles.card, styles.memberCard]}>
        <View style={styles.memberHead}><Text style={styles.cardTitle}>{room ? '메이트 ' + members.length + '명' : '메이트'}</Text>{canInvite && roomId && room?.code ? <Pressable accessibilityRole="button" accessibilityLabel="메이트 초대" style={styles.invite} onPress={() => setInviting(true)}><Plus size={16} color={colors.selectedText} /><Text style={styles.chooseText}>초대</Text></Pressable> : null}</View>
        {room && !canInvite ? <Text style={styles.hint}>정산이 시작되어 메이트를 더 초대할 수 없어요.</Text> : null}
        {/* [결정] Figma 528:1573 / 561:1782: 멤버 행 클릭 시 타인은 메이트 프로필 시트, 본인은 프로필 홈(Profile)으로 연결 */}
        {members.length ? members.map(member => (
          <RoomMemberRow
            key={member.id}
            participant={member}
            myId={user?.id ?? null}
            ownerId={room?.ownerId ?? null}
            onPress={() => {
              if (user?.id && member.profileId === user.id) {
                navigate('Profile');
              } else {
                setSelectedMate(member);
              }
            }}
          />
        )) : <Text style={styles.hint}>{room || status === 'error' ? '참여 멤버를 불러오지 못했어요' : '메이트를 불러오는 중이에요'}</Text>}
      </View>
      {/* [결정] leave_room은 settling에서만 막으므로, 다른 단계에 정산 완료 조건을 안내하지 않는다. */}
      {isOwner ? <>
        {/* [결정] S3 D2 A: 동의 기반 방장 위임 버튼 */}
        {lifecycleView?.canTransfer ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="방장 넘기기"
            accessibilityState={{ disabled: busyAction || !lifecycleView.canTransfer }}
            disabled={busyAction || !lifecycleView.canTransfer}
            onPress={() => setTransferOpen(true)}
            style={[styles.transferButton, (busyAction || !lifecycleView.canTransfer) && styles.disabled]}
          >
            <Crown size={18} color={colors.primary} />
            <Text style={styles.transferButtonText}>방장 넘기기</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="방 없애기"
          accessibilityState={{ disabled: isCloseDisabled }}
          disabled={isCloseDisabled}
          onPress={() => { setDeletionError(null); setDeletionOpen(true); }}
          style={[styles.delete, isCloseDisabled && styles.disabled]}
        >
          <Trash2 size={18} color={v3FeedbackColors.error} /><Text style={styles.deleteText}>방 없애기</Text>
        </Pressable>
        <View style={styles.hintRow}><Info size={16} color={colors.sub} /><Text style={styles.hint}>{settling ? '정산이 끝나면 없앨 수 있어요.' : '방을 없애면 메이트 모두에게서 방과 모든 사람의 채팅이 사라져요. 정산 내역은 남아 있어요.'}</Text></View>
      </> : (
        /* S3 SD01 / Figma 561:1885: 메이트 방 나가기 버튼 (canLeave가 참일 때만 노출, 레거시·미지원 시 숨김) */
        lifecycleView?.canLeave ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="방 나가기"
              accessibilityState={{ disabled: busyAction || !lifecycleView.canLeave }}
              disabled={busyAction || !lifecycleView.canLeave}
              onPress={() => { setLeaveError(null); setLeaveOpen(true); }}
              style={[styles.delete, (busyAction || !lifecycleView.canLeave) && styles.disabled]}
            >
              <LogOut size={18} color={v3FeedbackColors.error} />
              <Text style={styles.deleteText}>방 나가기</Text>
            </Pressable>
            <View style={styles.hintRow}>
              <Info size={16} color={colors.sub} />
              <Text style={styles.hint}>
                {room?.stage === 'confirmed'
                  ? '정산 요청 전에 나가면 이 밥약 정산에서 빠져요.'
                  : '방에서 나가면 대화 내용과 약속 정보를 더 이상 볼 수 없어요.'}
              </Text>
            </View>
          </>
        ) : (room ? <Text style={styles.hint}>방은 방장만 없앨 수 있어요.</Text> : null)
      )}
    </ScrollView>
    {canInvite && room?.code ? <MateInviteSheet visible={inviting} roomId={roomId ?? undefined} code={lifecycleView?.state?.invite?.code ?? room.code} expiresAt={lifecycleView?.state?.invite?.expires_at} onClose={() => setInviting(false)} /> : null}
    <MateProfileSheet
      visible={Boolean(selectedMate)}
      profileId={selectedMate?.profileId ?? null}
      roomId={roomId}
      myId={user?.id ?? null}
      name={selectedMate?.name}
      avatarUrl={selectedMate?.avatarUrl}
      onClose={() => setSelectedMate(null)}
      onEditProfile={() => {
        setSelectedMate(null);
        navigate('Profile');
      }}
    />
    <OwnerTransferSheet
      visible={transferOpen}
      roomId={roomId ?? ''}
      stage={room?.stage}
      myId={user?.id ?? null}
      participants={members}
      onClose={() => setTransferOpen(false)}
      onSubmit={handleRequestTransfer}
    />
    <MemberLeaveDialog
      visible={leaveOpen}
      busy={busyAction}
      stage={room?.stage}
      roomTitle={title}
      error={leaveError}
      onClose={() => setLeaveOpen(false)}
      onConfirm={() => void confirmLeave()}
    />
    <DestructiveDialog
      visible={deletionOpen}
      busy={busyAction}
      error={deletionError}
      title="방을 없앨까요?"
      description={"메이트 모두에게서 방과 모든 사람의 채팅이 사라져요.\n정산 내역은 남아 있어요." + (lifecycleView?.transferState?.status === 'pending' ? '\n대기 중인 방장 넘기기도 취소돼요.' : '')}
      onClose={() => setDeletionOpen(false)}
      onConfirm={() => void confirmDeletion()}
    />
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
  transferButton: { minHeight: v3Layout.buttonHeight, borderWidth: 1.5, borderColor: colors.primary, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.surface },
  transferButtonText: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 24, color: colors.primary },
  delete: { minHeight: v3Layout.buttonHeight, borderWidth: 1.5, borderColor: v3FeedbackColors.error, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.surface },
  deleteText: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 24, color: v3FeedbackColors.error },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  hint: { flex: 1, fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.sub },
  disabled: { opacity: 0.4 },
});
