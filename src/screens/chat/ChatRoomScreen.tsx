import MessageSafetySheet from './MessageSafetySheet';
import { Button } from '../../components/ui/Button';
import { ChevronLeft, MoreVertical, Plus, Send } from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Keyboard,
  Platform,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardOverlap } from '../../theme/keyboard';

import { useAuth } from '../../auth/AuthProvider';
import Avatar from '../../components/Avatar';
import ActionTray, { type ChatAction } from '../../components/ui/ActionTray';
import FailureCard from '../../components/ui/FailureCard';
import RoomTimer from '../../components/ui/RoomTimer';
import MeetingCard from '../../components/ui/MeetingCard';
import MessageActionsSheet, { type CopyableMessage } from '../../components/ui/MessageActionsSheet';
import Toast, { useToast } from '../../components/ui/Toast';
import PublicMeetingAreaControls from './PublicMeetingAreaControls';
import { useRestaurantRecommendations } from './useRestaurantRecommendations';
import { parseEmoticonToken } from '../../lib/emoticon';
import { notify } from '../../lib/confirm';
import { roomNoticeOf, type RoomNotice } from '../../lib/roomNotice';
import { dayKey, dayLabel, timeLabel } from '../../lib/roomFormat';
import { canInviteToRoom } from '../../lib/roomMembership';
import {
  sendRoomMessage,
  sendRoomSticker,
  type RoomMessage,
} from '../../lib/rooms';
import {
  registerRoomLifecycleResources,
  subscribeRoomLifecycle,
} from '../../lib/roomLifecycle';
import { useNavigation } from '../../navigation/NavigationContext';
import { useRoom, useRoomMessages } from '../../rooms/useMyRooms';
import { v3Layout } from '../../theme/scale';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { MembersSheet, SettlementSheet } from './ChatRoomSheets';
import EmoticonPanel, { findSticker } from './EmoticonPanel';
import ScheduleSheet from './ScheduleSheet';
import VotingSheet from './VotingSheet';

const messageRowPadding = 3;
const messageGap = 14;
const groupedGapReduction = 6;

type Message = { key: string; separatorHeight?: number } & (
  | { kind: 'date'; text: string }
  | { kind: 'sys'; text: string; isTransfer?: boolean }
  | ({ kind: 'msg'; mine: boolean; text: string } & Bubble)
  | ({ kind: 'sticker'; mine?: boolean; sticker: ImageSourcePropType } & Bubble)
  | { kind: 'notice'; notice: RoomNotice }
);

/** 상대 말풍선 옆 아바타를 그리는 데 필요한 것. 내 말풍선에는 아바타가 없다. */
type Sender = { name?: string; senderId?: string | null; avatarUrl?: string | null };

/** 말풍선 한 줄이 보낸 사람과 시각에 대해 들고 가는 것 */
type Bubble = Sender & {
  time: string;
  /** 같은 사람이 같은 분에 이어 보낸 줄이면 false — 시각을 마지막 줄에만 남긴다 */
  showTime: boolean;
  /** 바로 위 줄과 한 묶음이면 true — 위 줄에 붙여 그린다 */
  grouped?: boolean;
};

/**
 * 상대 말풍선 옆 아바타 — 시안 2178:567 (20x20, 라운드 5, 옅은 주황 칸).
 *
 * 사진을 올렸으면 사진, 아니면 기본 캐릭터다. 사람을 가리키는 id 로 캐릭터를 골라
 * 이름이 같은 사람이 둘이어도 얼굴이 섞이지 않는다.
 */
function SenderAvatar({ name, senderId, avatarUrl, grouped }: Sender & { grouped?: boolean }) {
  /*
   * 한 사람이 이어 보낸 줄마다 얼굴을 반복하면 지저분하다. 묶음의 첫 줄에만
   * 그리고, 나머지 줄은 같은 너비의 빈 자리를 둬 말풍선 왼쪽 선을 맞춘다.
   */
  if (grouped) return <View style={styles.avatarSpacer} />;

  return (
    <Avatar
      name={name ?? '?'}
      url={avatarUrl}
      seed={senderId ?? undefined}
      size={36}
      radius={18}
      /* 시안의 옅은 주황 칸 — 기본 캐릭터에도 깔려야 해서 style 로 넘긴다 */
      style={styles.msgAvatar}
    />
  );
}

/** 서버 메시지를 화면용 배열로 바꾼다. 날짜가 바뀌는 지점에 구분선을 넣는다. */
export function toDisplayMessages(
  rows: RoomMessage[],
  myId: string | null,
  /* 보낸 사람 id → 프로필 사진. 방 참가자 목록에서 온다 */
  avatars: Map<string, string | null>,
): Message[] {
  const out: Message[] = [];
  let lastDay = '';

  for (const row of rows) {
    const day = dayKey(row.createdAt);
    if (day && day !== lastDay) {
      out.push({ key: `date:${day}`, kind: 'date', text: dayLabel(row.createdAt) });
      lastDay = day;
    }

    if (row.kind === 'system') {
      let displayText = row.text;
      const isTransfer = Boolean(row.lifecycleEvent && row.lifecycleEvent.type.startsWith('owner_transfer'));
      if (row.lifecycleEvent) {
        const ev = row.lifecycleEvent;
        if (ev.type === 'member_left_confirmed') {
          displayText = `${ev.actorName}님이 방을 나갔어요. 이후 새 정산에 포함되지 않아요.`;
        } else if (ev.type === 'member_left') {
          displayText = `${ev.actorName}님이 방을 나갔어요.`;
        } else if (ev.type === 'owner_transfer_pending') {
          displayText = '방장 넘기기를 요청했어요. 대상 메이트는 방 상세정보에서 확인해 주세요.';
        } else if (ev.type === 'owner_transfer_declined') {
          displayText = '방장 넘기기 요청을 거절했어요.';
        } else if (ev.type === 'owner_transfer_cancelled') {
          displayText = '방장 넘기기 요청을 취소했어요.';
        } else if (ev.type === 'owner_transfer_expired') {
          displayText = '방장 넘기기 요청이 만료됐어요.';
        } else if (ev.type === 'owner_transfer_accepted') {
          displayText = '방장이 바뀌었어요.';
        }
      }
      /* 카드로 세울 수 있는 것만 세운다. 알아보지 못한 안내는 회색 알약이다. */
      const notice = roomNoticeOf(displayText);
      out.push(
        notice
          ? { key: row.id, kind: 'notice', notice }
          : { key: row.id, kind: 'sys', text: displayText, isTransfer },
      );
      continue;
    }

    const mine = Boolean(myId) && row.senderId === myId;
    // 내 말풍선에는 이름도 아바타도 붙이지 않는다
    const sender: Sender = mine
      ? { senderId: row.senderId }
      : {
          name: row.senderName,
          senderId: row.senderId,
          avatarUrl: row.senderId ? avatars.get(row.senderId) ?? null : null,
        };
    const time = timeLabel(row.createdAt);
    const emoticon = parseEmoticonToken(row.text);

    if (emoticon) {
      const sticker = findSticker(emoticon);
      if (sticker) {
        out.push({ key: row.id, kind: 'sticker', mine, sticker: sticker.source, time, showTime: true, ...sender });
      } else {
        // 앱에 없는 이모티콘 — 토큰을 그대로 보여주느니 사람이 읽을 말로 바꾼다
        out.push({ key: row.id, kind: 'msg', mine, text: '(이모티콘)', time, showTime: true, ...sender });
      }
      continue;
    }

    out.push({ key: row.id, kind: 'msg', mine, text: row.text, time, showTime: true, ...sender });
  }

  /*
   * 한 사람이 같은 분에 여러 줄을 보내면 줄마다 같은 시각이 반복돼 눈에 걸린다.
   * 묶음의 마지막 줄에만 남긴다 — 아래에 붙어 있는 시각이 그 묶음이 끝난 때다.
   * 중간에 날짜 구분선이나 안내가 끼면 묶음이 끊긴다 (말풍선끼리만 본다).
   */
  for (let i = 0; i < out.length - 1; i += 1) {
    const line = out[i];
    const next = out[i + 1];
    if (line.kind !== 'msg' && line.kind !== 'sticker') continue;
    if (next.kind !== 'msg' && next.kind !== 'sticker') continue;
    /* id 가 없는(탈퇴한) 사람은 id 로는 가릴 수 없어 이름까지 같아야 한 사람으로 본다 */
    if (line.senderId === next.senderId && line.name === next.name && line.time === next.time) {
      line.showTime = false;
      next.grouped = true;
    }
  }

  return out;
}

type SheetKey = 'schedule' | 'menu' | 'settlement' | 'members' | null;

/**
 * Figma 채팅/채팅방 (315:4324) — 220 x 486
 * roomHeader y30 h44 / 확정 배너 y83 h18 / chatScroll x11.5 y104 w197 /
 * 액션바 y407 h43 / 입력바 y448 h38
 */
export default function ChatRoomScreen() {
  const insets = useSafeAreaInsets();
  /*
   * 키보드가 가리는 만큼만 화면을 줄인다. 안드로이드가 스스로 줄여 주는 양이
   * 기기마다 달라서, 창 크기 API 대신 이 화면을 직접 재서 넘긴다.
   */
  const screenRef = useRef<View>(null);
  const { overlap: keyboard, remeasure } = useKeyboardOverlap(screenRef);
  const { goBack, navigate, current } = useNavigation();
  const { user } = useAuth();
  const params = current.params as
    | { roomId?: string; title?: string; color?: string; openSheet?: SheetKey }
    | undefined;

  const roomId = params?.roomId ?? null;

  const { room, reload: reloadRoom, error: roomError } = useRoom(roomId);
  /*
   * 목록에서 들어오면 파라미터에 제목이 실려 있어 곧바로 보여줄 수 있고,
   * 홈의 정산 링크처럼 roomId 만 들고 들어오는 경로도 있어 불러온 값으로 채운다.
   */
  const title = room?.title ?? params?.title ?? '밥약';
  const { messages: remoteMessages, status, reload } = useRoomMessages(roomId);
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState<CopyableMessage | null>(null), [sendError, setSendError] = useState(false);
  const [safety, setSafety] = useState<{ kind: 'report' | 'block'; message: CopyableMessage } | null>(null);
  const [sending, setSending] = useState(false);
  // state 반영 전 같은 프레임의 연속 제출도 막는다.
  const sendingRef = useRef(false);
  const draftRevision = useRef(0);
  const changeDraft = useCallback((text: string) => {
    draftRevision.current += 1;
    setDraft(text);
  }, []);
  // 홈의 "미완료 정산 보기" 처럼 특정 시트를 펼친 채로 들어오는 경로가 있다
  const stage = room?.stage ?? 'scheduling';

  const isOwner = Boolean(user?.id && room?.ownerId && user.id === room.ownerId);

  const [sheet, setSheet] = useState<SheetKey>(params?.openSheet ?? null);
  const recommendation = useRestaurantRecommendations({ roomId, userId: user?.id ?? null, enabled: sheet === 'menu' && stage === 'place' && (room?.decisionMode === 's4' || !room?.confirmedMenu), members: (room?.participants ?? []).map(p => p.profileId).sort().join(',') });
  useEffect(() => {
    if (room?.decisionMode === 's4' && ['confirmed', 'settling', 'done'].includes(stage) && (sheet === 'schedule' || sheet === 'menu')) setSheet(null);
  }, [room?.decisionMode, stage, sheet]);
  const [emoticonOpen, setEmoticonOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const panelOpen = actionsOpen || emoticonOpen;
  const chooseAction = (action: ChatAction) => {
    Keyboard.dismiss(); setActionsOpen(false);
    if (action === 'emoticons') setEmoticonOpen(true); else { setEmoticonOpen(false); setSheet(action); }
  };
  useEffect(() => {
    if (Platform.OS !== 'android' || !panelOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setActionsOpen(false); setEmoticonOpen(false); return true; });
    return () => subscription.remove();
  }, [panelOpen]);
  const scrollRef = useRef<FlatList<Message>>(null);
  const nearLatest = useRef(true);
  const userScrolling = useRef(false);
  const followLatest = useCallback(() => {
    if (nearLatest.current && !userScrolling.current) {
      scrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, []);

  /*
   * 키보드가 열리거나 닫힐 때 최신 대화를 보던 상태를 유지한다.
   * 목록 자체의 레이아웃 변경은 아래 onLayout에서도 처리한다.
   */
  useEffect(() => {
    followLatest();
  }, [keyboard, followLatest]);

  // [결정] 기존 알림 행동을 유지한다. Figma의 칩 아래에 44px 행동 배지를 복원한다.
  const onNoticeAction = useCallback((kind: RoomNotice['kind']) => {
    if (kind === 'place') {
      if (stage === 'place') setSheet('menu');
      else navigate('RoomDetail', { roomId, title });
      return;
    }
    if (kind === 'settlement') { setSheet('settlement'); return; }
    // TODO(서버 단계): 실제 캘린더 저장 계약 전에는 기존 준비 안내만 유지한다.
    notify('아직 준비 중이에요', '캘린더 저장은 곧 붙일게요.');
  }, [stage, navigate, roomId, title]);

  /* 보낸 사람 id 로 프로필 사진을 찾을 수 있게 참가자 목록을 표로 바꿔 둔다 */
  const avatarBySender = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const participant of room?.participants ?? []) {
      if (participant.profileId) map.set(participant.profileId, participant.avatarUrl);
    }
    return map;
  }, [room?.participants]);

  /* 서버가 준 목록에 날짜 구분선을 끼워 화면용 배열로 만든다 */
  const messages = useMemo(
    // inverted 목록은 최신 줄부터 받는다. 긴 대화도 첫 렌더부터 끝부분을 보여 준다.
    () => {
      const items = toDisplayMessages(remoteMessages, user?.id ?? null, avatarBySender).reverse();
      // Allocate the new touch padding from the surrounding gap, inside each native cell.
      return items.map((item, index) => ({ ...item, separatorHeight: messageGap
        - (item.kind === 'msg' ? messageRowPadding + (item.grouped ? groupedGapReduction : 0) : 0)
        - (items[index + 1]?.kind === 'msg' ? messageRowPadding : 0) }));
    },
    [remoteMessages, user?.id, avatarBySender],
  );
  const noticeActionRef = useRef(onNoticeAction); noticeActionRef.current = onNoticeAction;
  const handleNoticeAction = useCallback((kind: RoomNotice['kind']) => noticeActionRef.current(kind), []);
  const [messageActions, setMessageActions] = useState<CopyableMessage | null>(null);
  const { showToast, toastProps } = useToast();
  const openMessageActions = useCallback((message: CopyableMessage) => {
    Keyboard.dismiss(); setActionsOpen(false); setEmoticonOpen(false); setMessageActions(message);
  }, []);
  useEffect(() => { setMessageActions(null); setReply(null); setSafety(null); setSendError(false); }, [roomId, user?.id]);

  const currentRef = useRef(current);
  currentRef.current = current;

  useEffect(() => {
    if (!roomId) return;
    const unregister = registerRoomLifecycleResources(roomId, {
      invalidate: () => { reload(); void reloadRoom(); },
      unsubscribe: () => {},
    });
    const unsubscribe = subscribeRoomLifecycle(event => {
      if (event.roomId === roomId && (event.reason === 'departed' || event.reason === 'session_ended')) {
        // ChatRoomScreen이 현재 포커스된 화면일 때만 goBack (RoomDetail에서 resetTo와 중복 네비게이션 방지)
        if (currentRef.current.name === 'ChatRoom') {
          goBack();
        }
      }
    });
    return () => {
      unregister();
      unsubscribe();
    };
  }, [roomId, reload, reloadRoom, goBack]);

  const openDetailRef = useRef(() => {});
  openDetailRef.current = () => {
    if (roomId) navigate('RoomDetail', { roomId, title });
  };
  const handleOpenDetail = useCallback(() => {
    openDetailRef.current();
  }, []);

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => <Row message={item} onAction={handleNoticeAction} onMessage={openMessageActions} onOpenDetail={handleOpenDetail} />,
    [handleNoticeAction, openMessageActions, handleOpenDetail],
  );

  const send = async () => {
    const text = draft.trim();
    if (!text || !roomId || sendingRef.current) return;
    if (reply) { setSendError(true); return; }
    setSendError(false);
    sendingRef.current = true;
    const submittedRevision = draftRevision.current;

    try {
      setSending(true);
      const error = await sendRoomMessage(roomId, text);

      if (error) {
        setSendError(true); notify('전송 실패', error.message);
        return;
      }

      // 전송을 기다리는 동안 사용자가 쓴 다음 메시지는 보존한다.
      if (draftRevision.current === submittedRevision) setDraft('');
      reload();
    } catch {
      setSendError(true); notify('전송 실패', '메시지를 보내지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const sendSticker = async (stickerId: string) => {
    if (!roomId || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const error = await sendRoomSticker(roomId, stickerId);
      if (error) {
        notify('전송 실패', error.message);
        return;
      }
      reload();
    } catch {
      notify('전송 실패', '이모티콘을 보내지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };


  return (
    /*
     * 키보드가 가리는 만큼 화면 전체를 줄인다. 입력바에만 marginBottom 을 주면
     * 위의 목록이 줄어드는 것과 겹쳐 두 배로 밀려 올라간다 (실측 690 → 169).
     */
    <View ref={screenRef} style={[styles.screen, { paddingBottom: keyboard }]} onLayout={remeasure}>
      <View style={{ height: insets.top }} />
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="뒤로"><ChevronLeft size={24} color={colors.ink} /></Pressable>
        <View style={styles.headerCenter}><View style={styles.headerTitleRow}><Text style={styles.headerTitle} numberOfLines={1}>{title}</Text><View style={styles.countChip}><Text style={styles.countText}>{room ? room.participants.length : '-'}</Text></View></View>{room && (stage === 'settling' || stage === 'done') ? <RoomTimer expiresAt={room.expiresAt} settled={stage === 'done'} boundedSettlement={room.decisionMode === 's4'} /> : null}</View>
        <Pressable onPress={() => navigate('RoomDetail', { roomId, title })} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="방 상세정보"><MoreVertical size={22} color={colors.ink} /></Pressable>
      </View>
      {roomError ? <FailureCard title={room ? '방 정보를 새로 불러오지 못했어요' : '방 정보를 불러오지 못했어요'} reason={room ? '마지막으로 확인한 내용을 보고 있어요.' : '잠시 후 다시 시도해 주세요.'} onRetry={reloadRoom} /> : null}
      {room ? <View style={styles.pinned}><MeetingCard compact={panelOpen || keyboard > 0} isOwner={isOwner} confirmedRestaurant={room.confirmedMenu} slot={room.confirmedSlot} meetingTime={room.meetingTime} ownerConfirmed={Boolean(room.appointmentConfirmedAt)} s4={room.decisionMode === 's4'} stage={stage} location={room.locationName} memberCount={room.participants.filter(p => p.profileId !== null).length} onChooseRestaurant={() => chooseAction('menu')} /></View> : null}

      {typeof current.params?.localMenuName === 'string' && current.params.localMenuName.trim() !== '' && <View style={styles.pinned}><Text style={styles.name}>로컬 선택 · {current.params.localMenuName} · 서버 연결 대기</Text><Button variant="text" label="로컬 메뉴 변경" onPress={() => navigate('LocalMenu', { roomId })} /></View>}
      {(current.params?.localSettlementAction === 'cancel-prepared' || current.params?.localSettlementAction === 'edit-prepared') && <View style={styles.pinned}><Text accessibilityLiveRegion="polite" style={styles.name}>{current.params.localSettlementAction === 'cancel-prepared' ? '정산 취소 요청 준비 · 실제 정산은 취소되지 않았어요' : '정산 수정 요청 준비 · 실제 정산은 변경되지 않았어요'}</Text></View>}
      <FlatList
        ref={scrollRef}
        testID="chat-message-list"
        style={styles.messageList}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={messageKey}
        inverted
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={7}
        ItemSeparatorComponent={MessageSeparator}
        maintainVisibleContentPosition={visibleContentPosition}
        contentContainerStyle={[styles.list, messages[0]?.kind === 'msg' && styles.paddedMessageList]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScrollBeginDrag={(event) => {
          userScrolling.current = true;
          nearLatest.current = event.nativeEvent.contentOffset.y <= 40;
        }}
        onScroll={(event) => {
          // Native anchor/layout adjustments are not a request to read history.
          if (userScrolling.current) {
            nearLatest.current = event.nativeEvent.contentOffset.y <= 40;
          }
        }}
        onScrollEndDrag={(event) => {
          nearLatest.current = event.nativeEvent.contentOffset.y <= 40;
          userScrolling.current = false;
        }}
        onMomentumScrollBegin={() => { userScrolling.current = true; }}
        onMomentumScrollEnd={(event) => {
          nearLatest.current = event.nativeEvent.contentOffset.y <= 40;
          userScrolling.current = false;
        }}
        onLayout={followLatest}
        onContentSizeChange={followLatest}
        ListFooterComponent={
          status === 'loading' ? (
            <Text style={styles.listNotice}>메시지를 불러오는 중...</Text>
          ) : status === 'error' ? (
            <FailureCard title="메시지를 불러오지 못했어요" onRetry={reload} />
          ) : messages.length === 0 ? (
            <Text style={styles.listNotice}>아직 대화가 없어요. 먼저 인사해 보세요!</Text>
          ) : null
        }
      />

      {reply ? <View style={{ padding: 12 }}><Text style={styles.name}>{reply.name}에게 답장 · 서버 연결 대기</Text><Text numberOfLines={2} style={styles.inputText}>{reply.text}</Text><Button variant="text" label="답장 취소" onPress={() => { setReply(null); setSendError(false); }} /></View> : null}
      {sendError ? <FailureCard title="메시지를 보내지 못했어요" reason={reply ? '답장 서버 연결 대기 · 입력한 내용은 유지했어요.' : '입력한 내용은 유지했어요.'} onRetry={() => void send()} /> : null}
      <View style={[styles.inputBar, { paddingBottom: 20 + (keyboard > 0 || panelOpen ? 0 : insets.bottom) }]}>
        <Pressable style={[styles.plusButton, actionsOpen && styles.plusOpen]} accessibilityRole="button" accessibilityLabel={actionsOpen ? '메뉴 접기' : '메뉴 펼치기'} accessibilityState={{ expanded: actionsOpen }}
          onPress={() => { Keyboard.dismiss(); setEmoticonOpen(false); setActionsOpen(!actionsOpen); }}>
          <Plus size={20} color={colors.ink} />
        </Pressable>
        <View style={styles.input}><TextInput style={styles.inputText} accessibilityLabel="메시지" value={draft} onChangeText={changeDraft}
          placeholder="메시지를 입력해 주세요" placeholderTextColor={colors.sub} onSubmitEditing={send} returnKeyType="send"
          onFocus={() => { setActionsOpen(false); setEmoticonOpen(false); }} /></View>
        <Pressable style={[styles.sendButton, (sending || !roomId) && styles.sendButtonDisabled]} accessibilityRole="button" accessibilityLabel="메시지 보내기"
          accessibilityState={{ disabled: sending || !roomId, busy: sending }} disabled={sending || !roomId} onPress={() => void send()}>
          <Send size={20} color={colors.ink} />
        </Pressable>
      </View>
      {actionsOpen ? <><Button variant="text" label="메뉴 정하기 · 로컬" onPress={() => { setActionsOpen(false); navigate('LocalMenu', { roomId }); }} /><ActionTray stage={stage} canOpenSchedule={stage === 'scheduling' || (room?.decisionMode === 's4' && stage === 'place' && (!room.meetingTime || isOwner))} onChoose={chooseAction} bottomInset={keyboard > 0 ? 0 : insets.bottom} /></> : null}
      {emoticonOpen ? <EmoticonPanel disabled={sending} bottomInset={keyboard > 0 ? 0 : insets.bottom} onClose={() => setEmoticonOpen(false)} onPick={sticker => {
        if (sendingRef.current) return;
        setEmoticonOpen(false); void sendSticker(sticker.id);
      }} /> : null}

      <ScheduleSheet
        roomName={title}
        visible={sheet === 'schedule'}
        roomId={roomId}
        isOwner={isOwner}
        participants={room?.participants}
        onClose={() => setSheet(null)}
        onStateChanged={() => {
          reload();
          void reloadRoom();
        }}
      />

      <VotingSheet
        visible={sheet === 'menu'}
        roomId={roomId}
        isOwner={isOwner}
        stage={stage}
        confirmedSlot={room?.confirmedSlot}
        meetingTime={room?.meetingTime}
        onSelectTime={() => { setSheet(null); navigate('ScheduleConfirmed', { roomId, name: title }); }}
        participantCount={room?.participants.length}
        confirmedRestaurant={room?.confirmedMenu}
        participants={room?.participants}
        kind="menu"
        title="식당 정하기"
        subtitle={typeof current.params?.localMenuName === 'string' && current.params.localMenuName.trim() !== '' ? `로컬 선택 · ${current.params.localMenuName} · 추천에는 아직 반영되지 않아요` : '가고 싶은 식당에 투표해 주세요'}
        placeholder="예: 조선칼국수 하단점"
        suggestionTitle={recommendation.suggestions.length > 0 && recommendation.suggestions.every(item => item.source === 'gemini') ? 'AI 추천 식당' : '추천 식당'}
        suggestions={recommendation.suggestions}
        suggestionStatus={recommendation.status}
        suggestionReason={recommendation.reason}
        receivedMore={false}
        onRequestSuggestions={() => void recommendation.request()}
        validateSuggestion={recommendation.validateSuggestion}
        recommendationControls={<PublicMeetingAreaControls recommendation={recommendation} isOwner={isOwner} />}
        onClose={() => setSheet(null)}
        onConfirm={() => {
          reload();
          void reloadRoom();
        }}
        onVoted={() => void reloadRoom()}
      />
      <SettlementSheet
        roomStage={room?.stage ?? null}
        decisionMode={room?.decisionMode}
        appointmentConfirmedAt={room?.appointmentConfirmedAt}
        participants={room?.participants ?? []}
        roomId={roomId}
        visible={sheet === 'settlement'}
        onClose={() => setSheet(null)}
        onStateChanged={() => {
          reload();
          void reloadRoom();
        }}
      />
      <MembersSheet
        visible={sheet === 'members'}
        participants={room?.participants ?? []}
        code={room?.code ?? null}
        canInvite={canInviteToRoom(room?.stage)}
        myId={user?.id ?? null}
        ownerId={room?.ownerId ?? null}
        onClose={() => setSheet(null)}
      />
      {safety && safety.message.senderId ? <MessageSafetySheet key={safety.kind + safety.message.senderId} kind={safety.kind} targetId={safety.message.senderId} name={safety.message.name} onClose={() => setSafety(null)} /> : null}
      <MessageActionsSheet message={messageActions} onReply={() => { setReply(messageActions); setMessageActions(null); }}
        onReport={messageActions?.senderId && messageActions.senderId !== user?.id ? () => { setSafety({ kind: 'report', message: messageActions }); setMessageActions(null); } : undefined}
        onBlock={messageActions?.senderId && messageActions.senderId !== user?.id ? () => { setSafety({ kind: 'block', message: messageActions }); setMessageActions(null); } : undefined} onClose={() => setMessageActions(null)} onCopied={() => showToast({ message: '메시지를 복사했어요' })} />
      <Toast {...toastProps} bottom={88} />
    </View>
  );
}

const messageKey = (message: Message) => message.key;
const visibleContentPosition = { minIndexForVisible: 0 };

function MessageSeparator({ leadingItem }: { leadingItem?: Message }) {
  return <View style={[styles.messageSeparator, { height: leadingItem?.separatorHeight ?? messageGap }]} />;
}

const Row = memo(function Row({
  message, onAction, onMessage, onOpenDetail,
}: {
  message: Message; onAction: (kind: RoomNotice['kind']) => void; onMessage: (message: CopyableMessage) => void; onOpenDetail?: () => void;
}) {
  const messageMenu = message.kind === 'msg' ? {
    accessible: true,
    accessibilityRole: 'text' as const,
    accessibilityLabel: (message.name ?? (message.mine ? '나' : '메이트')) + ', ' + message.text,
    accessibilityHint: '길게 누르면 복사 메뉴를 열어요.',
    accessibilityActions: [{ name: 'showMenu', label: '복사 메뉴 열기' }],
    onLongPress: () => onMessage({ text: message.text, name: message.name ?? (message.mine ? '나' : '메이트'), senderId: message.senderId, avatarUrl: message.avatarUrl }),
    onAccessibilityAction: (event: { nativeEvent: { actionName: string } }) => {
      if (event.nativeEvent.actionName === 'showMenu') onMessage({ text: message.text, name: message.name ?? (message.mine ? '나' : '메이트'), senderId: message.senderId, avatarUrl: message.avatarUrl });
    },
  } : {};
  switch (message.kind) {
    case 'date':
      return (
        <View style={styles.dateRow}>
          <View style={styles.dateLine} />
          <Text style={styles.dateText}>{message.text}</Text>
          <View style={styles.dateLine} />
        </View>
      );

    case 'sys':
      return (
        <View style={styles.sysRow}>
          <Pressable
            disabled={!message.isTransfer || !onOpenDetail}
            onPress={onOpenDetail}
            accessibilityRole={message.isTransfer ? 'button' : undefined}
            accessibilityLabel={message.isTransfer ? `${message.text}, 방 상세정보 보기` : undefined}
            style={styles.sysPill}
          >
            <Text style={styles.sysText}>{message.text}</Text>
          </Pressable>
        </View>
      );

    case 'msg':
      if (message.mine) {
        return (
          <Pressable {...messageMenu} style={[styles.mineRow, styles.messageRow]}>
            {message.showTime ? <Text style={styles.time}>{message.time}</Text> : null}
            <View style={[styles.bubble, styles.bubbleMine]}>
              <Text style={styles.bubbleTextMine}>{message.text}</Text>
            </View>
          </Pressable>
        );
      }
      return (
        <Pressable {...messageMenu} style={[styles.otherRow, styles.messageRow]}>
          <SenderAvatar
            name={message.name}
            senderId={message.senderId}
            avatarUrl={message.avatarUrl}
            grouped={message.grouped}
          />
          <View style={styles.otherCol}>
            {message.grouped ? null : <Text style={styles.name}>{message.name}</Text>}
            <View style={styles.otherLine}>
              <View style={[styles.bubble, styles.bubbleOther]}>
                <Text style={styles.bubbleText}>{message.text}</Text>
              </View>
              {message.showTime ? <Text style={styles.time}>{message.time}</Text> : null}
            </View>
          </View>
        </Pressable>
      );

    case 'sticker':
      if (message.mine) {
        return (
          <View style={[styles.mineRow, message.grouped && styles.grouped]}>
            {message.showTime ? <Text style={styles.time}>{message.time}</Text> : null}
            <View style={styles.sticker}>
              <Image source={message.sticker} style={styles.stickerImage} resizeMode="contain" />
            </View>
          </View>
        );
      }
      return (
        <View style={[styles.otherRow, message.grouped && styles.grouped]}>
          <SenderAvatar
            name={message.name}
            senderId={message.senderId}
            avatarUrl={message.avatarUrl}
            grouped={message.grouped}
          />
          <View style={styles.otherCol}>
            {message.grouped ? null : <Text style={styles.name}>{message.name}</Text>}
            <View style={styles.otherLine}>
              <View style={styles.sticker}>
                <Image source={message.sticker} style={styles.stickerImage} resizeMode="contain" />
              </View>
              {message.showTime ? <Text style={styles.time}>{message.time}</Text> : null}
            </View>
          </View>
        </View>
      );

    case 'notice':
      // TODO(서버 단계): 독립 메뉴 확정/다음 단계 계약 전에는 실제 서버 안내만 칩으로 표시한다.
      return <View style={styles.sysRow}><View style={styles.sysPill}><Text style={styles.sysText}>{message.notice.title}{message.notice.detail ? ' · ' + message.notice.detail : ''}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={message.notice.action} onPress={() => onAction(message.notice.kind)} style={styles.noticeAction}><Text style={styles.noticeActionText}>{message.notice.action}</Text></Pressable></View>;

  }
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { minHeight: v3Layout.headerHeight, padding: 8, gap: 8, flexDirection: 'row', alignItems: 'center' },
  iconButton: { width: v3Layout.minTouchTarget, height: v3Layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, minWidth: 0 },
  headerTitleRow: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { flexShrink: 1, fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 25, color: colors.ink },
  countChip: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 10, backgroundColor: colors.mutedBg },
  countText: { fontFamily: fontFamily.bold, fontSize: 12, lineHeight: 18, color: colors.sub },
  pinned: { paddingHorizontal: 16, paddingBottom: 8 },
  messageList: { flex: 1 },
  messageSeparator: { height: messageGap },
  list: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  paddedMessageList: { paddingTop: 12 - messageRowPadding },
  grouped: { marginTop: -groupedGapReduction },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  dateLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dateText: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 18, color: colors.sub },
  sysRow: { alignItems: 'center' },
  noticeAction: { minWidth: 44, minHeight: 44, paddingHorizontal: 12, marginTop: 4, borderRadius: 12, backgroundColor: colors.selectedBg, justifyContent: 'center', alignItems: 'center' },
  noticeActionText: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 19, color: colors.selectedText },
  sysPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, backgroundColor: colors.mutedBg },
  sysText: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 18, color: colors.sub, textAlign: 'center' },
  otherRow: { flexDirection: 'row', gap: 8 },
  msgAvatar: { backgroundColor: colors.mutedBg },
  avatarSpacer: { width: 36 },
  otherCol: { flexShrink: 1, minWidth: 0, gap: 4 },
  name: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 18, color: colors.sub },
  otherLine: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  mineRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 6 },
  // Android clips hitSlop at ancestors: the padded row itself owns the full touch target.
  messageRow: { paddingVertical: messageRowPadding, minHeight: v3Layout.minTouchTarget },
  bubble: { minWidth: v3Layout.minTouchTarget, flexShrink: 1, paddingHorizontal: 12, paddingVertical: 9 },
  bubbleOther: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderTopLeftRadius: 4, borderTopRightRadius: 14, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  bubbleMine: { backgroundColor: colors.primary, borderTopLeftRadius: 14, borderTopRightRadius: 4, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  bubbleText: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, color: colors.ink },
  bubbleTextMine: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: colors.ink },
  time: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 18, color: colors.sub },
  sticker: { width: 96, height: 96, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  stickerImage: { width: 96, height: 96 },
  inputBar: { backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 20 },
  plusButton: { width: v3Layout.minTouchTarget, height: v3Layout.minTouchTarget, borderRadius: 22, backgroundColor: colors.mutedBg, alignItems: 'center', justifyContent: 'center' },
  plusOpen: { backgroundColor: colors.primary },
  input: { flex: 1, minWidth: 0, height: 44, borderRadius: 22, backgroundColor: colors.bg, paddingHorizontal: 16, justifyContent: 'center' },
  inputText: { paddingVertical: 0, fontFamily: fontFamily.body, fontSize: 14, color: colors.ink },
  sendButton: { width: v3Layout.minTouchTarget, height: v3Layout.minTouchTarget, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.4 },
  listNotice: { marginVertical: 28, textAlign: 'center', fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, color: colors.sub },
});
