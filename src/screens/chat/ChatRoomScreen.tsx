import { CalendarDays, ChevronLeft, MoreVertical, Send, Smile, Users, Utensils, Wallet } from 'lucide-react-native';
import { useRef, useState } from 'react';
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
import { parseEmoticonToken } from '../../lib/emoticon';
import { dayKey, dayLabel, roomTimerLabel, timeLabel } from '../../lib/roomFormat';
import { sendRoomMessage, sendRoomSticker, type RoomMessage } from '../../lib/rooms';
import { useNavigation } from '../../navigation/NavigationContext';
import { useRoom, useRoomMessages } from '../../rooms/useMyRooms';
import { fs, s } from '../../theme/scale';
import { colors, shadows } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';
import { MembersSheet, MenuSheet, ScheduleSheet, SettlementSheet } from './ChatRoomSheets';
import EmoticonPanel, { findSticker } from './EmoticonPanel';

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
  | { kind: 'confirm'; title: string; date: string };

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
  const params = current.params as
    | { roomId?: string; title?: string; color?: string; openSheet?: SheetKey }
    | undefined;

  const roomId = params?.roomId ?? null;

  const room = useRoom(roomId);
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
  const [sheet, setSheet] = useState<SheetKey>(params?.openSheet ?? null);
  const [emoticonOpen, setEmoticonOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  /*
   * 스티커와 시스템 안내는 messages 테이블이 담을 수 없다 (텍스트 컬럼 하나뿐).
   * 스키마가 생기기 전까지는 화면에만 남는 임시 항목으로 두고, 서버 목록 뒤에 붙인다.
   */
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const append = (message: Message) => setLocalMessages((prev) => [...prev, message]);

  /* 서버가 준 목록에 날짜 구분선을 끼워 화면용 배열로 만든다 */
  const messages = [...toDisplayMessages(remoteMessages, user?.id ?? null), ...localMessages];

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
          <Text style={styles.timer}>{room ? roomTimerLabel(room.expiresAt) : ' '}</Text>
        </View>

        <Pressable hitSlop={s(8)} onPress={() => navigate('RoomDetail', { title })}>
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
          <Row key={i} message={message} />
        ))}
      </ScrollView>

      <View style={styles.actionBar}>
        <ActionButton
          icon={<CalendarDays size={s(13)} color={SYS_TEXT} strokeWidth={2} />}
          label="일정 조율"
          onPress={() => setSheet('schedule')}
        />
        <View style={styles.actionDivider} />
        <ActionButton
          icon={<Utensils size={s(13)} color={SYS_TEXT} strokeWidth={2} />}
          label="메뉴 정하기"
          onPress={() => setSheet('menu')}
        />
        <View style={styles.actionDivider} />
        <ActionButton
          icon={<Wallet size={s(13)} color={SYS_TEXT} strokeWidth={2} />}
          label="N빵 정산"
          onPress={() => setSheet('settlement')}
        />
        <View style={styles.actionDivider} />
        <ActionButton
          icon={<Users size={s(13)} color={SYS_TEXT} strokeWidth={2} />}
          label="멤버"
          onPress={() => setSheet('members')}
        />
      </View>

      <View style={[styles.inputBar, { paddingBottom: insets.bottom }]}>
        {/* 대화 중 새 약속 잡기 — 일정 추가 플로우로 보낸다 */}
        <Pressable style={styles.plusButton} onPress={() => navigate('ScheduleDetail')}>
          <Text style={styles.plusText}>＋</Text>
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
        onClose={() => setSheet(null)}
        onConfirm={(text) => append({ kind: 'sys', text })}
      />
      <MenuSheet
        visible={sheet === 'menu'}
        onClose={() => setSheet(null)}
        onConfirm={(text) => append({ kind: 'sys', text })}
      />
      <SettlementSheet
        visible={sheet === 'settlement'}
        onClose={() => setSheet(null)}
        onConfirm={(text) => append({ kind: 'sys', text })}
      />
      <MembersSheet
        visible={sheet === 'members'}
        onClose={() => setSheet(null)}
        onInvite={() => {
          setSheet(null);
          append({ kind: 'sys', text: '초대 코드를 복사했어요 — VF4HLD' });
        }}
      />
    </KeyboardAvoidingView>
  );
}

function Row({ message }: { message: Message }) {
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

    case 'confirm':
      return (
        <View style={styles.confirmRow}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>🎉 {message.title}</Text>
            <Text style={styles.confirmDate}>{message.date}</Text>
            <View style={styles.confirmBadge}>
              <Text style={styles.confirmBadgeText}>캘린더에 저장</Text>
            </View>
          </View>
        </View>
      );
  }
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.action} onPress={onPress}>
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
    fontFamily: fontFamily.body,
    fontSize: fs(9.5),
    lineHeight: fs(13),
    fontWeight: weight.extrabold,
    color: colors.textPrimary,
  },
  countChip: {
    paddingHorizontal: s(4),
    paddingVertical: s(1),
    borderRadius: s(4),
    backgroundColor: colors.surfaceSunken,
  },
  countText: {
    fontFamily: fontFamily.body,
    fontSize: fs(5.8),
    lineHeight: fs(8),
    fontWeight: weight.semibold,
    color: SYS_TEXT,
  },
  timer: {
    marginTop: s(1),
    fontFamily: fontFamily.body,
    fontSize: fs(5.8),
    lineHeight: fs(8),
    fontWeight: weight.semibold,
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
    fontFamily: fontFamily.body,
    fontSize: fs(6.7),
    lineHeight: fs(9),
    fontWeight: weight.semibold,
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
    fontFamily: fontFamily.body,
    fontSize: fs(9),
    fontWeight: weight.bold,
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
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    fontWeight: weight.semibold,
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
  confirmRow: {
    alignItems: 'center',
  },
  confirmCard: {
    width: s(181),
    borderRadius: s(9),
    borderWidth: s(0.8),
    borderColor: colors.primary,
    backgroundColor: colors.card,
    alignItems: 'center',
    paddingVertical: s(7),
    ...shadows.button,
  },
  confirmTitle: {
    fontFamily: fontFamily.body,
    fontSize: fs(7.2),
    lineHeight: fs(10),
    fontWeight: weight.extrabold,
    color: colors.textPrimary,
  },
  confirmDate: {
    marginTop: s(3),
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: SYS_TEXT,
  },
  confirmBadge: {
    marginTop: s(4),
    paddingHorizontal: s(9),
    paddingVertical: s(3),
    borderRadius: s(5),
    backgroundColor: colors.primarySoft,
  },
  confirmBadgeText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    fontWeight: weight.semibold,
    color: '#FF8C3A',
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
    fontFamily: fontFamily.body,
    fontSize: fs(5.6),
    lineHeight: fs(8),
    fontWeight: weight.semibold,
    color: SYS_TEXT,
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
