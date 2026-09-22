import { CalendarDays, Send, Smile, Users, Utensils, Wallet } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardOverlap } from '../../theme/keyboard';

import { useAuth } from '../../auth/AuthProvider';
import Avatar from '../../components/Avatar';
import { MenuBarsIcon, RoomBackIcon } from '../../components/icons';
import { buildPlaceCandidates } from '../../lib/placeCandidates';
import { supabase } from '../../lib/supabase';
import { useMyProfile } from '../../profile/useMyProfile';
import type { ScheduleRecommendResponse } from '../schedule/scheduleTypes';
import { parseEmoticonToken } from '../../lib/emoticon';
import { confirmAction, notify } from '../../lib/confirm';
import { roomCharacterFor } from '../../lib/roomCharacter';
import { roomNoticeOf, type RoomNotice } from '../../lib/roomNotice';
import { roomColor } from '../../lib/roomTheme';
import { dayKey, dayLabel, roomTimerLabel, timeLabel } from '../../lib/roomFormat';
import {
  advanceRoomStage,
  sendRoomMessage,
  sendRoomSticker,
  type RoomMessage,
} from '../../lib/rooms';
import { useNavigation } from '../../navigation/NavigationContext';
import { useRoom, useRoomMessages } from '../../rooms/useMyRooms';
import { fs, s } from '../../theme/scale';
import { colors, shadows } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { MembersSheet, SettlementSheet } from './ChatRoomSheets';
import EmoticonPanel, { findSticker } from './EmoticonPanel';
import ScheduleSheet from './ScheduleSheet';
import VotingSheet from './VotingSheet';

/** Figma 채팅방 색상 — 말풍선 시간 / 날짜 구분선 / 시스템 말풍선 글자 */
const TIME_GRAY = '#B4B2A8';
const DIVIDER = '#D3D1C6';
const SYS_TEXT = '#696969';

type Message =
  | { kind: 'date'; text: string }
  | { kind: 'sys'; text: string }
  | ({ kind: 'msg'; mine: boolean; text: string } & Bubble)
  | ({ kind: 'sticker'; mine?: boolean; sticker: ImageSourcePropType } & Bubble)
  | { kind: 'notice'; notice: RoomNotice };

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
      size={s(20)}
      radius={s(5)}
      /* 시안의 옅은 주황 칸 — 기본 캐릭터에도 깔려야 해서 style 로 넘긴다 */
      style={styles.msgAvatar}
    />
  );
}

/** 서버 메시지를 화면용 배열로 바꾼다. 날짜가 바뀌는 지점에 구분선을 넣는다. */
function toDisplayMessages(
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
      out.push({ kind: 'date', text: dayLabel(row.createdAt) });
      lastDay = day;
    }

    if (row.kind === 'system') {
      /* 카드로 세울 수 있는 것만 세운다. 알아보지 못한 안내는 회색 알약이다. */
      const notice = roomNoticeOf(row.text);
      out.push(notice ? { kind: 'notice', notice } : { kind: 'sys', text: row.text });
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
        out.push({ kind: 'sticker', mine, sticker: sticker.source, time, showTime: true, ...sender });
      } else {
        // 앱에 없는 이모티콘 — 토큰을 그대로 보여주느니 사람이 읽을 말로 바꾼다
        out.push({ kind: 'msg', mine, text: '(이모티콘)', time, showTime: true, ...sender });
      }
      continue;
    }

    out.push({ kind: 'msg', mine, text: row.text, time, showTime: true, ...sender });
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
  const { bundle } = useMyProfile();
  const params = current.params as
    | { roomId?: string; title?: string; color?: string; openSheet?: SheetKey }
    | undefined;

  const roomId = params?.roomId ?? null;

  const { room, reload: reloadRoom } = useRoom(roomId);
  /*
   * 목록에서 들어오면 파라미터에 제목이 실려 있어 곧바로 보여줄 수 있고,
   * 홈의 정산 링크처럼 roomId 만 들고 들어오는 경로도 있어 불러온 값으로 채운다.
   */
  const title = params?.title ?? room?.title ?? '밥약';
  /*
   * 방 테마 색 — 목록과 같은 값이어야 같은 방으로 보인다. 예전에 만든 방은
   * 색을 전부 '#FF9900' 로 저장해서 roomColor() 가 id 로 골라 준다. 방을 아직
   * 못 불러왔으면 목록에서 실어 보낸 색으로 버틴다.
   */
  const theme = room ? roomColor(room) : params?.color ?? colors.primary;
  const { messages: remoteMessages, status, reload } = useRoomMessages(roomId);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  // 홈의 "미완료 정산 보기" 처럼 특정 시트를 펼친 채로 들어오는 경로가 있다
  const stage = room?.stage ?? 'scheduling';

  /*
   * 식당 결정 단계에서 AI 추천을 미리 받아 둔다. 시트를 열 때마다 부르면
   * 열 때마다 몇 초씩 기다려야 하고, Gemini 호출도 그만큼 늘어난다.
   */
  const [suggestions, setSuggestions] = useState<
    { label: string; matchPercent: number }[]
  >([]);

  useEffect(() => {
    /* 식당을 고르는 단계에서만, 그리고 한 번만 부른다 */
    if (stage !== 'place' || !roomId || suggestions.length > 0) return;

    const profile = bundle?.privateProfile;
    if (!profile?.startLat || !profile?.startLng) return;

    let active = true;

    void (async () => {
      try {
        const memberIds = (room?.participants ?? [])
          .map((participant) => participant.profileId)
          .filter((id): id is string => Boolean(id));

        const candidates = await buildPlaceCandidates(memberIds, {
          name: profile.startLocationName?.trim() || '사는 곳',
          address: '',
          lat: profile.startLat!,
          lng: profile.startLng!,
          fromGps: false,
        });

        if (!active || !candidates || candidates.candidates.length === 0) return;

        const { data, error } = await supabase.functions.invoke('schedule-recommend', {
          body: { meetingName: title, roomId, placeCandidates: candidates.candidates },
        });

        if (!active || error) return;

        const response = data as ScheduleRecommendResponse;
        if (!Array.isArray(response?.placeRecommendations)) return;

        setSuggestions(
          [...response.placeRecommendations]
            .sort((a, b) => a.rank - b.rank)
            .map((pick) => ({
              label: pick.place.name,
              matchPercent: Math.round(pick.score),
            })),
        );
      } catch (error) {
        /* 추천이 없어도 직접 후보를 올릴 수 있다 — 화면을 막지 않는다 */
        console.warn('place suggestion failed:', error);
      }
    })();

    return () => {
      active = false;
    };
  }, [stage, roomId, room, bundle, title, suggestions.length]);

  const isOwner = Boolean(user?.id && room?.ownerId && user.id === room.ownerId);

  const [sheet, setSheet] = useState<SheetKey>(params?.openSheet ?? null);
  const [emoticonOpen, setEmoticonOpen] = useState(false);
  /* 입력창의 ＋ 로 여닫는다. 기본은 펴진 상태 — 방에 들어오면 뭘 할 수 있는지 보여야 한다 */
  const [actionsOpen, setActionsOpen] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  /*
   * 키보드가 열리면 목록 칸이 그만큼 줄어든다. 그대로 두면 보고 있던 마지막
   * 메시지가 입력바 뒤로 밀려 사라진다.
   */
  useEffect(() => {
    if (keyboard > 0) scrollRef.current?.scrollToEnd({ animated: true });
  }, [keyboard]);

  /*
   * 식당 결정을 마치고 약속을 확정한다. 방장만 누를 수 있고, 되돌릴 수 없어서
   * 한 번 묻는다 — 확정하면 식당을 다시 고를 수 없다.
   */
  const confirmPlan = async () => {
    if (!roomId) return;

    /* Alert.alert 의 버튼 콜백은 react-native-web 에서 불리지 않는다 */
    confirmAction({
      title: '약속을 확정할까요?',
      message: '확정하면 식당을 다시 고를 수 없어요.',
      cancelLabel: '더 볼게요',
      confirmLabel: '확정',
      onConfirm: () => {
        void (async () => {
          const { error } = await advanceRoomStage(roomId, 'confirmed');
          if (error) {
            notify('확정하지 못했어요', error.message);
            return;
          }
          reload();
          void reloadRoom();
        })();
      },
    });
  };

  /*
   * 알림 카드의 배지. 방 안에서 할 수 있는 일로 이어 준다.
   * 일정 카드의 "캘린더에 저장" 은 아직 붙일 곳이 없어 안내만 남긴다.
   */
  const onNoticeAction = (kind: RoomNotice['kind']) => {
    if (kind === 'place') {
      setSheet('menu');
      return;
    }
    if (kind === 'settlement') {
      setSheet('settlement');
      return;
    }
    notify('아직 준비 중이에요', '캘린더 저장은 곧 붙일게요.');
  };

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
    () => toDisplayMessages(remoteMessages, user?.id ?? null, avatarBySender),
    [remoteMessages, user?.id, avatarBySender],
  );

  const send = async () => {
    const text = draft.trim();
    if (!text || !roomId) return;

    try {
      setSending(true);
      const error = await sendRoomMessage(roomId, text);

      if (error) {
        notify('전송 실패', error.message);
        return;
      }

      setDraft('');
      reload();
    } catch {
      notify('전송 실패', '메시지를 보내지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSending(false);
    }
  };

  const sendSticker = async (stickerId: string) => {
    if (!roomId) return;
    try {
      const error = await sendRoomSticker(roomId, stickerId);
      if (error) {
        notify('전송 실패', error.message);
        return;
      }
      reload();
    } catch {
      notify('전송 실패', '이모티콘을 보내지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  /** 초대 코드는 시스템 문장이 아니라 사용자가 보낸 일반 메시지로 남긴다. */
  const shareInviteCode = async (code: string) => {
    if (!roomId) return;
    try {
      const error = await sendRoomMessage(roomId, `초대 코드 ${code}를 메이트에게 알려 주세요.`);
      if (error) {
        notify('초대 코드를 보내지 못했어요', error.message);
        return;
      }
      reload();
    } catch {
      notify('초대 코드를 보내지 못했어요', '잠시 후 다시 시도해 주세요.');
    }
  };

  return (
    /*
     * 키보드가 가리는 만큼 화면 전체를 줄인다. 입력바에만 marginBottom 을 주면
     * 위의 목록이 줄어드는 것과 겹쳐 두 배로 밀려 올라간다 (실측 690 → 169).
     */
    <View ref={screenRef} style={[styles.screen, { paddingBottom: keyboard }]} onLayout={remeasure}>
      <View style={{ height: insets.top, backgroundColor: colors.screen }} />

      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={s(8)}>
          <RoomBackIcon size={s(24)} />
        </Pressable>

        {/*
          * 방 대표 그림 — 목록 카드와 같은 캐릭터다. 색을 꽉 채우면 그림이 묻혀서
          * 테마 색을 옅게(24 = 14%) 깔고 그 위에 올린다.
          */}
        <View style={[styles.headerAvatar, { backgroundColor: `${theme}24` }]}>
          {roomId ? (
            <Image
              source={roomCharacterFor(roomId)}
              style={styles.headerAvatarImage}
              resizeMode="contain"
            />
          ) : null}
        </View>

        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.countChip}>
              <Text style={styles.countText}>{room ? room.participants.length : '-'}</Text>
            </View>
          </View>
          {room ? (
            <RoomTimer expiresAt={room.expiresAt} settled={room.stage === 'done'} />
          ) : (
            <Text style={styles.timer}> </Text>
          )}
        </View>

        <Pressable hitSlop={s(8)} onPress={() => navigate('RoomDetail', { roomId, title })}>
          <MenuBarsIcon size={s(24)} />
        </Pressable>
      </View>

      {room?.isConfirmed && room.confirmedSlot ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{room.confirmedSlot}</Text>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {status === 'loading' ? (
          <Text style={styles.listNotice}>메시지를 불러오는 중...</Text>
        ) : status === 'error' ? (
          <View style={styles.retryBox}>
            <Text style={styles.listNotice}>메시지를 불러오지 못했어요</Text>
            <Pressable style={styles.retryButton} onPress={reload}>
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : messages.length === 0 ? (
          <Text style={styles.listNotice}>아직 대화가 없어요. 먼저 인사해 보세요!</Text>
        ) : null}
        {messages.map((message, i) => (
          <Row key={i} message={message} onAction={onNoticeAction} />
        ))}
      </ScrollView>

      {/*
        약속 단계에 따라 열 수 있는 것이 다르다. 정산까지 간 방에서 식당을 다시
        고르거나, 식당도 안 정한 방에서 정산을 시작할 수는 없다.
      */}
      {actionsOpen ? (
      <View style={styles.actionBar}>
        <ActionButton
          icon={<CalendarDays size={s(13)} color={SYS_TEXT} strokeWidth={2} />}
          label="일정 조율"
          disabled={stage !== 'scheduling'}
          onPress={() => setSheet('schedule')}
        />
        <View style={styles.actionDivider} />
        <ActionButton
          icon={<Utensils size={s(13)} color={SYS_TEXT} strokeWidth={2} />}
          label="식당 정하기"
          disabled={stage !== 'place'}
          onPress={() => setSheet('menu')}
        />
        <View style={styles.actionDivider} />
        <ActionButton
          icon={<Wallet size={s(13)} color={SYS_TEXT} strokeWidth={2} />}
          /* 식당을 정하는 중이면 확정으로, 확정된 뒤에는 정산으로 */
          label={stage === 'place' ? '약속 확정' : 'N빵 정산'}
          disabled={
            stage === 'scheduling' || (stage === 'place' && !isOwner)
          }
          onPress={() => (stage === 'place' ? void confirmPlan() : setSheet('settlement'))}
        />
        <View style={styles.actionDivider} />
        <ActionButton
          icon={<Users size={s(13)} color={SYS_TEXT} strokeWidth={2} />}
          label="멤버"
          onPress={() => setSheet('members')}
        />
      </View>
      ) : null}

      {/*
        인셋을 더한다. 예전엔 paddingBottom 을 insets.bottom 으로 덮어써서, 인셋이
        0 인 웹·구형 안드로이드에서는 스타일의 아래 여백까지 같이 사라졌다.

        키보드가 올라오면 그 높이만큼 통째로 띄운다. 이때 제스처바 인셋은 빼야
        한다 — 키보드가 이미 그 자리를 덮고 있어서, 그대로 두면 입력바가 키보드
        위에 한 칸 떠 보인다.
      */}
      <View
        style={[
          styles.inputBar,
          /* 키보드가 제스처바까지 덮으므로 그때는 인셋을 더하지 않는다 */
          { paddingBottom: s(7) + (keyboard > 0 ? 0 : insets.bottom) },
        ]}>
        {/*
          위 액션 행을 여닫는다. 예전에는 ScheduleDetail 로 보냈는데, 그 화면은
          createRoom 으로 새 방을 만드는 곳이라 대화 중에 누르면 지금 방을 두고
          엉뚱한 방이 생겼다.
        */}
        <Pressable
          style={styles.plusButton}
          hitSlop={s(6)}
          accessibilityRole="button"
          accessibilityLabel={actionsOpen ? '메뉴 접기' : '메뉴 펼치기'}
          onPress={() => setActionsOpen((v) => !v)}>
          <Text style={[styles.plusText, actionsOpen && styles.plusTextOpen]}>＋</Text>
        </Pressable>

        <View style={styles.input}>
          <TextInput
            style={styles.inputText}
            value={draft}
            onChangeText={setDraft}
            placeholder="메시지를 입력해 주세요..."
            placeholderTextColor={TIME_GRAY}
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <Pressable onPress={() => setEmoticonOpen((v) => !v)} hitSlop={s(6)}>
            <Smile size={s(10)} color={emoticonOpen ? colors.primary : TIME_GRAY} strokeWidth={2} />
          </Pressable>
        </View>

        <Pressable
          style={[styles.sendButton, (sending || !roomId) && styles.sendButtonDisabled]}
          disabled={sending || !roomId}
          onPress={() => void send()}>
          <Send size={s(9)} color={colors.textOnAccent} strokeWidth={2.5} />
        </Pressable>
      </View>

      {emoticonOpen ? (
        <EmoticonPanel
          onPick={(sticker) => {
            setEmoticonOpen(false);
            void sendSticker(sticker.id);
          }}
        />
      ) : null}

      <ScheduleSheet
        visible={sheet === 'schedule'}
        roomId={roomId}
        isOwner={isOwner}
        onClose={() => setSheet(null)}
        onStateChanged={() => {
          reload();
          void reloadRoom();
        }}
      />

      <VotingSheet
        visible={sheet === 'menu'}
        roomId={roomId}
        kind="menu"
        title="식당 정하기"
        subtitle="가고 싶은 식당에 투표해 주세요"
        placeholder="예: 조선칼국수 하단점"
        suggestionTitle="AI 추천 식당"
        suggestions={suggestions}
        onClose={() => setSheet(null)}
        onConfirm={() => {
          reload();
          void reloadRoom();
        }}
        onVoted={() => void reloadRoom()}
      />
      <SettlementSheet
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
        myId={user?.id ?? null}
        onClose={() => setSheet(null)}
        onInvite={(code) => {
          setSheet(null);
          void shareInviteCode(code);
        }}
      />
    </View>
  );
}

/*
 * 헤더 타이머. 정산을 마친 방은 24시간만 남아 초까지 세는데, 화면 전체를 1초마다
 * 다시 그리면 채팅 목록까지 딸려 들어간다. 그래서 이 줄만 따로 떼어 낸다.
 */
function RoomTimer({ expiresAt, settled }: { expiresAt: string; settled: boolean }) {
  const [label, setLabel] = useState(() => roomTimerLabel(expiresAt, settled));

  useEffect(() => {
    setLabel(roomTimerLabel(expiresAt, settled));
    /* 정산 전에는 문구가 고정이라 셀 것이 없다 */
    if (!settled) return;

    const id = setInterval(() => setLabel(roomTimerLabel(expiresAt, settled)), 1000);
    return () => clearInterval(id);
  }, [expiresAt, settled]);

  return <Text style={styles.timer}>{label}</Text>;
}

function Row({
  message,
  onAction,
}: {
  message: Message;
  onAction: (kind: RoomNotice['kind']) => void;
}) {
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
          <View style={styles.sysPill}>
            <Text style={styles.sysText}>{message.text}</Text>
          </View>
        </View>
      );

    case 'msg':
      if (message.mine) {
        return (
          <View style={[styles.mineRow, message.grouped && styles.grouped]}>
            {message.showTime ? <Text style={styles.time}>{message.time}</Text> : null}
            <View style={[styles.bubble, styles.bubbleMine]}>
              <Text style={styles.bubbleTextMine}>{message.text}</Text>
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
              <View style={[styles.bubble, styles.bubbleOther]}>
                <Text style={styles.bubbleText}>{message.text}</Text>
              </View>
              {message.showTime ? <Text style={styles.time}>{message.time}</Text> : null}
            </View>
          </View>
        </View>
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

    case 'notice': {
      const { title, detail, action } = message.notice;
      return (
        <View style={styles.noticeRow}>
          <View style={styles.noticeCard}>
            {/* 시안은 🎉 를 벡터로 내보냈지만 양옆에 하나씩 두는 그림이다 */}
            <Text style={styles.noticeTitle}>🎉 {title} 🎉</Text>
            {detail ? <Text style={styles.noticeDetail}>{detail}</Text> : null}
            <Pressable
              style={styles.noticeBadge}
              hitSlop={s(4)}
              onPress={() => onAction(message.notice.kind)}>
              <Text style={styles.noticeBadgeText}>{action}</Text>
            </Pressable>
          </View>
        </View>
      );
    }
  }
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.action, disabled && styles.actionOff]}
      disabled={disabled}
      onPress={onPress}>
      {icon}
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    /* 시안 2178:556 주석 "배경 색상 변경" — 화면과 헤더가 같은 #F8F6F2 다 */
    backgroundColor: colors.screen,
  },

  // roomHeader y30 h44
  header: {
    height: s(44),
    backgroundColor: colors.screen,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(10),
    gap: s(7),
    /*
     * 그림자를 뺀다. 본문과 같은 색이 되면서 그림자가 회색 띠처럼 보였고,
     * 시안에도 헤더 아래 구분선이 없다.
     */
    zIndex: 2,
  },
  headerAvatar: {
    width: s(24),
    height: s(24),
    borderRadius: s(5),
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /*
   * 시안 값(16.8 x 18.24)은 여백이 넓은 원본에 맞춰 잰 것이라, 여백을 떼어낸
   * 그림을 넣으면 칸 한가운데 조그맣게 떠 보였다. 칸(24)의 대부분을 쓰게 키운다.
   * contain 이라 가로로 넓은 캐릭터든 세로로 긴 캐릭터든 잘리지 않는다.
   */
  headerAvatarImage: {
    width: s(20),
    height: s(20),
  },
  headerCenter: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
  },
  headerTitle: {
    flexShrink: 1,
    fontFamily: fontFamily.extrabold,
    fontSize: fs(9.5),
    lineHeight: fs(13),
    color: colors.textPrimary,
  },
  countChip: {
    paddingHorizontal: s(4),
    paddingVertical: s(1),
    borderRadius: s(4),
    backgroundColor: colors.surfaceSunken,
  },
  countText: {
    fontFamily: fontFamily.semibold,
    fontSize: fs(5.8),
    lineHeight: fs(8),
    color: SYS_TEXT,
  },
  timer: {
    marginTop: s(1),
    fontFamily: fontFamily.semibold,
    fontSize: fs(5.8),
    lineHeight: fs(8),
    color: colors.danger,
  },

  // 확정 배너 x9 y83 w200 h18
  banner: {
    marginTop: s(11),
    marginHorizontal: s(9),
    height: s(18),
    borderRadius: s(9),
    borderWidth: s(0.8),
    borderColor: colors.primary,
    backgroundColor: '#FFF5EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    fontFamily: fontFamily.semibold,
    fontSize: fs(6.7),
    lineHeight: fs(9),
    color: '#FF8C3A',
  },

  /*
   * chatScroll x11.5 — 시안 줄간격은 8 이지만 말풍선이 띄엄띄엄 떨어져 보여
   * 5 로 좁혔다. 한 사람이 이어 보낸 줄(grouped)은 한 덩어리로 보이게 더 붙인다.
   */
  list: {
    paddingHorizontal: s(11.5),
    paddingTop: s(14),
    paddingBottom: s(10),
    gap: s(5),
  },
  /* 위 줄과 같은 사람·같은 분이면 gap 을 덜어내 붙여 놓는다 */
  grouped: {
    marginTop: s(-2.5),
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    paddingVertical: s(2),
  },
  dateLine: {
    flex: 1,
    height: s(0.6),
    backgroundColor: DIVIDER,
  },
  dateText: {
    fontFamily: fontFamily.body,
    fontSize: fs(5.8),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
  sysRow: {
    alignItems: 'center',
  },
  sysPill: {
    paddingHorizontal: s(8),
    paddingVertical: s(3),
    borderRadius: s(999),
    backgroundColor: colors.surfaceSunken,
  },
  sysText: {
    fontFamily: fontFamily.body,
    fontSize: fs(5.8),
    lineHeight: fs(8),
    color: SYS_TEXT,
  },
  otherRow: {
    flexDirection: 'row',
    gap: s(5),
  },
  msgAvatar: {
    backgroundColor: colors.primarySoft,
  },
  /* 아바타(20)를 안 그리는 줄이 왼쪽으로 밀리지 않게 자리를 지킨다 */
  avatarSpacer: {
    width: s(20),
  },
  otherCol: {
    flexShrink: 1,
    gap: s(2),
  },
  name: {
    fontFamily: fontFamily.semibold,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: SYS_TEXT,
  },
  otherLine: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: s(4),
  },
  mineRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: s(4),
  },
  bubble: {
    flexShrink: 1,
    paddingHorizontal: s(8),
    paddingVertical: s(6),
    ...shadows.card,
  },
  bubbleOther: {
    backgroundColor: colors.card,
    borderTopLeftRadius: s(2),
    borderTopRightRadius: s(9),
    borderBottomLeftRadius: s(9),
    borderBottomRightRadius: s(9),
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderTopLeftRadius: s(9),
    borderTopRightRadius: s(2),
    borderBottomLeftRadius: s(9),
    borderBottomRightRadius: s(9),
  },
  bubbleText: {
    fontFamily: fontFamily.body,
    fontSize: fs(7.2),
    lineHeight: fs(10),
    color: colors.textPrimary,
  },
  bubbleTextMine: {
    fontFamily: fontFamily.body,
    fontSize: fs(7.2),
    lineHeight: fs(10),
    color: colors.textOnAccent,
  },
  time: {
    fontFamily: fontFamily.body,
    fontSize: fs(5.4),
    lineHeight: fs(8),
    color: TIME_GRAY,
  },
  sticker: {
    width: s(52),
    height: s(56),
    borderRadius: s(8),
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  stickerImage: {
    width: s(34),
    height: s(40),
  },
  // 알림 카드 — 시안 2111:16085 (w181 h57)
  noticeRow: {
    alignItems: 'center',
  },
  noticeCard: {
    width: s(181),
    borderRadius: s(9),
    borderWidth: s(1),
    borderColor: colors.primary,
    backgroundColor: colors.card,
    alignItems: 'center',
    paddingTop: s(7),
    paddingBottom: s(7.3),
    ...shadows.button,
  },
  noticeTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fs(7.2),
    lineHeight: fs(9.94),
    color: colors.textPrimary,
  },
  noticeDetail: {
    marginTop: s(4),
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(8.97),
    color: SYS_TEXT,
  },
  noticeBadge: {
    marginTop: s(4),
    paddingHorizontal: s(9),
    paddingVertical: s(3),
    borderRadius: s(5),
    backgroundColor: colors.primarySoft,
  },
  noticeBadgeText: {
    fontFamily: fontFamily.semibold,
    fontSize: fs(6),
    lineHeight: fs(8.28),
    color: colors.primaryVivid,
  },

  // 액션바 y407 h43
  actionBar: {
    height: s(43),
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: s(0.6),
    borderTopColor: colors.border,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(2),
  },
  actionLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fs(5.6),
    lineHeight: fs(8),
    color: SYS_TEXT,
  },
  /* 아직 열 수 없는 단계는 눌리지 않는 것을 눈으로도 알 수 있게 한다 */
  actionOff: {
    opacity: 0.35,
  },

  actionDivider: {
    width: s(0.6),
    height: s(26),
    backgroundColor: colors.border,
  },

  // 입력바 y448 h38
  inputBar: {
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    paddingHorizontal: s(10),
    paddingVertical: s(7),
  },
  plusButton: {
    width: s(20),
    height: s(20),
    borderRadius: s(999),
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: {
    fontFamily: fontFamily.body,
    fontSize: fs(9),
    lineHeight: fs(11),
    color: SYS_TEXT,
  },
  /* 펴져 있을 때는 ＋ 를 돌려 × 로 보여 준다 — 다시 누르면 접힌다는 뜻 */
  plusTextOpen: {
    transform: [{ rotate: '45deg' }],
  },
  input: {
    flex: 1,
    height: s(24),
    borderRadius: s(999),
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    paddingHorizontal: s(8),
    ...shadows.card,
  },
  inputText: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    color: colors.textPrimary,
  },
  sendButton: {
    width: s(24),
    height: s(24),
    borderRadius: s(999),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.button,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  listNotice: {
    marginVertical: s(16),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: SYS_TEXT,
  },
  retryBox: {
    alignItems: 'center',
  },
  retryButton: {
    marginTop: s(-10),
    paddingHorizontal: s(8),
    paddingVertical: s(3),
    borderRadius: s(6),
    backgroundColor: colors.primarySoft,
  },
  retryText: {
    fontFamily: fontFamily.bold,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.primary,
  },
});
