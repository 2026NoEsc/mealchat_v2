import { CalendarDays, ChevronLeft, MoreVertical, Send, Smile, Users, Utensils, Wallet } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
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

import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors, shadows } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';
import { MenuSheet, ScheduleSheet, SettlementSheet } from './ChatRoomSheets';

const ddori = require('../../../assets/brand/ddori.png');
const dudu = require('../../../assets/brand/dudu.png');
const welling = require('../../../assets/brand/welling2.png');

/** Figma 채팅방 색상 — 말풍선 시간 / 날짜 구분선 / 시스템 말풍선 글자 */
const TIME_GRAY = '#B4B2A8';
const DIVIDER = '#D3D1C6';
const SYS_TEXT = '#696969';

type Message =
  | { kind: 'date'; text: string }
  | { kind: 'sys'; text: string }
  | { kind: 'msg'; mine: boolean; name?: string; avatar?: ImageSourcePropType; text: string; time: string }
  | { kind: 'sticker'; name: string; avatar: ImageSourcePropType; sticker: ImageSourcePropType; time: string }
  | { kind: 'confirm'; title: string; date: string };

const INITIAL: Message[] = [
  // 8/15 = 금 기준이므로 8/12 는 화요일 (Figma 는 "수" 로 적혀 있으나 자체 모순)
  { kind: 'date', text: '2026년 8월 12일 (화)' },
  { kind: 'sys', text: '두두님이 초대 코드로 입장했어요' },
  { kind: 'msg', mine: false, name: '또리', avatar: ddori, text: '다들 수요일 점심 괜찮아요?', time: '오전 11:02' },
  { kind: 'msg', mine: true, text: '저는 좋아요! 면 종류면 더 좋고요', time: '오전 11:04' },
  { kind: 'msg', mine: false, name: '두두', avatar: dudu, text: '국밥 어때요 국밥', time: '오전 11:05' },
  { kind: 'sticker', name: '웰링', avatar: welling, sticker: welling, time: '오전 11:06' },
  { kind: 'confirm', title: '일정이 확정됐어요', date: '8월 15일 (금) 18:30' },
];

type SheetKey = 'schedule' | 'menu' | 'settlement' | null;

/**
 * Figma 채팅/채팅방 (315:4324) — 220 x 486
 * roomHeader y30 h44 / 확정 배너 y83 h18 / chatScroll x11.5 y104 w197 /
 * 액션바 y407 h43 / 입력바 y448 h38
 */
export default function ChatRoomScreen() {
  const insets = useSafeAreaInsets();
  const { goBack, current } = useNavigation();
  const params = current.params as { title?: string; avatar?: ImageSourcePropType } | undefined;

  const [messages, setMessages] = useState<Message[]>(INITIAL);
  const [draft, setDraft] = useState('');
  const [sheet, setSheet] = useState<SheetKey>(null);
  const scrollRef = useRef<ScrollView>(null);

  const append = (message: Message) => setMessages((prev) => [...prev, message]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    append({ kind: 'msg', mine: true, text, time: nowLabel() });
    setDraft('');
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

        <View style={styles.headerAvatar}>
          <Image source={params?.avatar ?? ddori} style={styles.headerAvatarImage} resizeMode="contain" />
        </View>

        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {params?.title ?? '오늘 점심팟'}
            </Text>
            <View style={styles.countChip}>
              <Text style={styles.countText}>4</Text>
            </View>
          </View>
          <Text style={styles.timer}>11:47:22 후 방이 사라져요.</Text>
        </View>

        <Pressable hitSlop={s(8)}>
          <MoreVertical size={s(13)} color={SYS_TEXT} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.banner}>
        <Text style={styles.bannerText}>8/15 (금) 18:30 · 조선칼국수 하단점</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
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
        />
      </View>

      <View style={[styles.inputBar, { paddingBottom: insets.bottom }]}>
        <View style={styles.plusButton}>
          <Text style={styles.plusText}>＋</Text>
        </View>

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
          <Smile size={s(10)} color={TIME_GRAY} strokeWidth={2} />
        </View>

        <Pressable style={styles.sendButton} onPress={send}>
          <Send size={s(9)} color={colors.textOnAccent} strokeWidth={2.5} />
        </Pressable>
      </View>

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
          <View style={styles.avatar}>
            <Image source={message.avatar} style={styles.avatarImage} resizeMode="contain" />
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

/** 지금 시각을 "오전 11:04" 형태로 */
function nowLabel() {
  const d = new Date();
  const hours = d.getHours();
  const minutes = `${d.getMinutes()}`.padStart(2, '0');
  return `${hours < 12 ? '오전' : '오후'} ${hours % 12 === 0 ? 12 : hours % 12}:${minutes}`;
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
});
