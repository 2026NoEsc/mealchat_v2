import { CalendarDays, ChevronLeft, MoreVertical, Send, Smile, Users, Utensils, Wallet } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/AuthProvider';
import { buildPlaceCandidates } from '../../lib/placeCandidates';
import { supabase } from '../../lib/supabase';
import { useMyProfile } from '../../profile/useMyProfile';
import type { ScheduleRecommendResponse } from '../schedule/scheduleTypes';
import { parseEmoticonToken } from '../../lib/emoticon';
import { parseRoomNotice, toRoomNoticeToken, type RoomNotice } from '../../lib/roomNotice';
import { dayKey, dayLabel, roomTimerLabel, timeLabel } from '../../lib/roomFormat';
import {
  advanceRoomStage,
  postRoomSystemMessage,
  setRoomLocation,
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
  | { kind: 'msg'; mine: boolean; name?: string; color?: string; text: string; time: string }
  | {
      kind: 'sticker';
      mine?: boolean;
      name?: string;
      avatar?: ImageSourcePropType;
      sticker: ImageSourcePropType;
      time: string;
    }
  | { kind: 'notice'; notice: RoomNotice };

/** 서버 메시지를 화면용 배열로 바꾼다. 날짜가 바뀌는 지점에 구분선을 넣는다. */
function toDisplayMessages(rows: RoomMessage[], myId: string | null): Message[] {
  const out: Message[] = [];
  let lastDay = '';

  for (const row of rows) {
    const day = dayKey(row.createdAt);
    if (day && day !== lastDay) {
      out.push({ kind: 'date', text: dayLabel(row.createdAt) });
      lastDay = day;
    }

    if (row.kind === 'system') {
      /* 토큰이 붙은 것만 카드로 세운다. 예전 평문 안내는 그대로 회색 알약이다. */
      const notice = parseRoomNotice(row.text);
      out.push(notice ? { kind: 'notice', notice } : { kind: 'sys', text: row.text });
      continue;
    }

    const mine = Boolean(myId) && row.senderId === myId;
    // 내 말풍선에는 이름을 붙이지 않는다
    const name = mine ? undefined : row.senderName;
    const time = timeLabel(row.createdAt);
    const emoticon = parseEmoticonToken(row.text);

    if (emoticon) {
      const sticker = findSticker(emoticon);
      if (sticker) {
        out.push({ kind: 'sticker', mine, name, sticker: sticker.source, time });
      } else {
        // 앱에 없는 이모티콘 — 토큰을 그대로 보여주느니 사람이 읽을 말로 바꾼다
        out.push({ kind: 'msg', mine, name, color: row.senderColor, text: '(이모티콘)', time });
      }
      continue;
    }

    out.push({
      kind: 'msg',
      mine,
      name,
      color: row.senderColor,
      text: row.text,
      time,
    });
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
  const roomColor = params?.color ?? room?.color ?? colors.primary;
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
   * 방에서 일어난 일은 messages 에 kind='system' 으로 남는다. 예전에는 화면에만
   * 붙였다가 새로고침하면 사라져서, 무슨 일이 있었는지가 남지 않았다.
   */
  /*
   * 식당 결정을 마치고 약속을 확정한다. 방장만 누를 수 있고, 되돌릴 수 없어서
   * 한 번 묻는다 — 확정하면 식당을 다시 고를 수 없다.
   */
  const confirmPlan = async () => {
    if (!roomId) return;

    Alert.alert('약속을 확정할까요?', '확정하면 식당을 다시 고를 수 없어요.', [
      { text: '더 볼게요', style: 'cancel' },
      {
        text: '확정',
        onPress: () => {
          void (async () => {
            const { error } = await advanceRoomStage(roomId, 'confirmed');
            if (error) {
              Alert.alert('확정하지 못했어요', error.message);
              return;
            }
            /* 확정된 시각을 카드 두 번째 줄에 싣는다 — 시안 2111:16087 */
            await notice(toRoomNoticeToken('schedule', room?.confirmedSlot ?? ''));
          })();
        },
      },
    ]);
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
    Alert.alert('아직 준비 중이에요', '캘린더 저장은 곧 붙일게요.');
  };

  /*
   * 식당 투표를 마무리한다. 채팅 문구만 남기던 걸 방에도 적는다 — 그래야
   * 방 상세정보와 홈 "다가올 일정" 에 장소가 뜬다.
   *
   * rooms 업데이트는 방장만 통과한다(rooms_update_owner). 메이트가 마무리한
   * 경우에는 채팅에만 남고, 방장이 "약속 확정" 을 누를 때까지 장소는 비어 있다.
   */
  const decidePlace = async (text: string, label: string) => {
    if (roomId && isOwner) {
      const error = await setRoomLocation(roomId, label);
      if (error) Alert.alert('장소를 저장하지 못했어요', error.message);
    }
    await notice(text);
  };

  const notice = async (text: string) => {
    if (!roomId) return;
    const error = await postRoomSystemMessage(roomId, text);
    if (error) {
      Alert.alert('안내를 남기지 못했어요', error.message);
      return;
    }
    reload();
    /* 단계가 바뀌는 안내(확정·식당 결정)가 있어서 방도 다시 읽는다 */
    void reloadRoom();
  };

  /* 서버가 준 목록에 날짜 구분선을 끼워 화면용 배열로 만든다 */
  const messages = toDisplayMessages(remoteMessages, user?.id ?? null);

  const send = async () => {
    const text = draft.trim();
    if (!text || !roomId) return;

    setSending(true);
    const error = await sendRoomMessage(roomId, text);
    setSending(false);

    if (error) {
      Alert.alert('전송 실패', error.message);
      return;
    }

    setDraft('');
    reload();
  };

  const sendSticker = async (stickerId: string) => {
    if (!roomId) return;
    const error = await sendRoomSticker(roomId, stickerId);
    if (error) {
      Alert.alert('전송 실패', error.message);
      return;
    }
    reload();
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />

      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={s(8)}>
          <ChevronLeft size={s(14)} color={SYS_TEXT} strokeWidth={2.5} />
        </Pressable>

        <View style={[styles.headerAvatar, { backgroundColor: roomColor }]} />

        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.countChip}>
              <Text style={styles.countText}>{room ? room.participants.length : '-'}</Text>
            </View>
          </View>
          {room ? <RoomTimer expiresAt={room.expiresAt} /> : <Text style={styles.timer}> </Text>}
        </View>

        <Pressable hitSlop={s(8)} onPress={() => navigate('RoomDetail', { roomId, title })}>
          <MoreVertical size={s(13)} color={SYS_TEXT} strokeWidth={2} />
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
          <Text style={styles.listNotice}>메시지를 불러오지 못했어요</Text>
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
      */}
      <View style={[styles.inputBar, { paddingBottom: s(7) + insets.bottom }]}>
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
        onSubmitted={(text) => void notice(text)}
      />

      <VotingSheet
        visible={sheet === 'menu'}
        roomId={roomId}
        kind="menu"
        title="식당 정하기"
        subtitle="가고 싶은 식당에 투표해 주세요"
        placeholder="예: 조선칼국수 하단점"
        confirmMessage={(label) => toRoomNoticeToken('place', label)}
        suggestionTitle="AI 추천 식당"
        suggestions={suggestions}
        onClose={() => setSheet(null)}
        onConfirm={(text, label) => void decidePlace(text, label)}
        onVoted={() => void reloadRoom()}
      />
      <SettlementSheet
        roomId={roomId}
        visible={sheet === 'settlement'}
        onClose={() => setSheet(null)}
        onConfirm={(text) => void notice(text)}
      />
      <MembersSheet
        visible={sheet === 'members'}
        participants={room?.participants ?? []}
        code={room?.code ?? null}
        myId={user?.id ?? null}
        onClose={() => setSheet(null)}
        onInvite={(code) => {
          setSheet(null);
          /*
           * 복사하지 않고 코드를 채팅에 남긴다. 클립보드 모듈이 없는데 "복사했어요"
           * 라고 말하면 붙여넣기가 되는 줄 안다. 방에 남겨 두면 나중에 다시 찾을 수도 있다.
           */
          void notice(`초대 코드 ${code} 를 메이트에게 알려 주세요`);
        }}
      />
    </KeyboardAvoidingView>
  );
}

/*
 * 헤더 타이머. 정산을 마친 방은 24시간만 남아 초까지 세는데, 화면 전체를 1초마다
 * 다시 그리면 채팅 목록까지 딸려 들어간다. 그래서 이 줄만 따로 떼어 낸다.
 */
function RoomTimer({ expiresAt }: { expiresAt: string }) {
  const [label, setLabel] = useState(() => roomTimerLabel(expiresAt));

  useEffect(() => {
    setLabel(roomTimerLabel(expiresAt));
    const id = setInterval(() => setLabel(roomTimerLabel(expiresAt)), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

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
          <View style={styles.mineRow}>
            <Text style={styles.time}>{message.time}</Text>
            <View style={[styles.bubble, styles.bubbleMine]}>
              <Text style={styles.bubbleTextMine}>{message.text}</Text>
            </View>
          </View>
        );
      }
      return (
        <View style={styles.otherRow}>
          {/* 아바타 업로드 전까지는 sender_color 원에 이름 첫 글자를 넣는다 */}
          <View style={[styles.avatar, { backgroundColor: message.color ?? colors.primary }]}>
            <Text style={styles.avatarInitial}>
              {[...(message.name ?? '?').trim()][0] ?? '?'}
            </Text>
          </View>
          <View style={styles.otherCol}>
            <Text style={styles.name}>{message.name}</Text>
            <View style={styles.otherLine}>
              <View style={[styles.bubble, styles.bubbleOther]}>
                <Text style={styles.bubbleText}>{message.text}</Text>
              </View>
              <Text style={styles.time}>{message.time}</Text>
            </View>
          </View>
        </View>
      );

    case 'sticker':
      if (message.mine) {
        return (
          <View style={styles.mineRow}>
            <Text style={styles.time}>{message.time}</Text>
            <View style={styles.sticker}>
              <Image source={message.sticker} style={styles.stickerImage} resizeMode="contain" />
            </View>
          </View>
        );
      }
      return (
        <View style={styles.otherRow}>
          <View style={styles.avatar}>
            <Image source={message.avatar} style={styles.avatarImage} resizeMode="contain" />
          </View>
          <View style={styles.otherCol}>
            <Text style={styles.name}>{message.name}</Text>
            <View style={styles.otherLine}>
              <View style={styles.sticker}>
                <Image source={message.sticker} style={styles.stickerImage} resizeMode="contain" />
              </View>
              <Text style={styles.time}>{message.time}</Text>
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
    backgroundColor: colors.surfaceSunken,
  },

  // roomHeader y30 h44
  header: {
    height: s(44),
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(10),
    gap: s(7),
    ...shadows.bar,
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
  headerAvatarImage: {
    width: s(16.8),
    height: s(18.24),
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

  // chatScroll x11.5 gap8
  list: {
    paddingHorizontal: s(11.5),
    paddingTop: s(14),
    paddingBottom: s(10),
    gap: s(8),
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
  avatar: {
    width: s(20),
    height: s(20),
    borderRadius: s(5),
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fontFamily.bold,
    fontSize: fs(9),
    color: colors.textOnAccent,
  },
  avatarImage: {
    width: s(14),
    height: s(15.2),
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
});
