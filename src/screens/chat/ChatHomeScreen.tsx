import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
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

import AppHeader from '../../components/AppHeader';
import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

const moa = require('../../../assets/brand/moa.png');
const ddori = require('../../../assets/brand/ddori.png');
const dudu = require('../../../assets/brand/dudu.png');
const welling = require('../../../assets/brand/welling2.png');

type ChipTone = 'active' | 'done' | 'open';

type Room = {
  title: string;
  chip: string;
  chipTone: ChipTone;
  preview: string;
  meta: string;
  time: string;
  unread?: number;
  /** 좌측 세로 테마 바 색 */
  theme: string;
  /** 아바타 박스 배경 틴트 */
  tint: string;
  avatar: ImageSourcePropType;
  stack: ImageSourcePropType[];
  highlight?: boolean;
};

const ROOMS: Room[] = [
  {
    title: '오늘 점심팟',
    chip: '진행중',
    chipTone: 'active',
    preview: '아 언제 나옴',
    meta: '+1 · 12시간 남음',
    time: '오전 2:48',
    unread: 3,
    theme: '#FF9900',
    tint: '#FFE7CA',
    avatar: moa,
    stack: [moa, ddori, dudu],
    highlight: true,
  },
  {
    title: '학회 회식',
    chip: '확정',
    chipTone: 'done',
    preview: '양심껏 늦게 오는 사람 술 사라',
    meta: '8월 21일',
    time: '오전 3:04',
    theme: '#04CDA3',
    tint: '#DCF8F2',
    avatar: ddori,
    stack: [ddori, welling, dudu],
  },
  {
    title: '동아리 뒤풀이',
    chip: '모집중',
    chipTone: 'open',
    preview: '다들 어디야?',
    meta: '장소 미정',
    time: '어제',
    unread: 1,
    theme: '#75B6FF',
    tint: '#EBF4FF',
    avatar: welling,
    stack: [welling, moa],
  },
  {
    title: '과 사람들 저녁',
    chip: '확정',
    chipTone: 'done',
    preview: '이번엔 진짜 갈게요',
    meta: '8월 24일',
    time: '2일 전',
    theme: '#A100FF',
    tint: '#F2DBFF',
    avatar: dudu,
    stack: [dudu, moa, ddori],
  },
];

/**
 * Figma 채팅방/홈 (549:3507) — 220 x 486
 * 카드 x13 y89 197×344 / 구분선 y119 / 초대코드 y130 h22 / 방 목록 y160·220·280·340 (h54)
 */
export default function ChatHomeScreen() {
  const insets = useSafeAreaInsets();
  const { navigate } = useNavigation();
  const [code, setCode] = useState('');

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />
      <AppHeader />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>MEALCHATING</Text>
            {/* 새 밥약 만들기 — 일정 추가 플로우로 들어간다 */}
            <Pressable
              style={styles.plusButton}
              hitSlop={s(6)}
              onPress={() => navigate('ScheduleDetail')}>
              <Plus size={s(9)} color={colors.primary} strokeWidth={3} />
            </Pressable>
          </View>

          <LinearGradient
            colors={[...colors.accentGradient]}
            locations={[...colors.accentGradientLocations]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.divider}
          />

          <View style={styles.inviteBox}>
            <TextInput
              style={styles.inviteInput}
              value={code}
              onChangeText={setCode}
              placeholder="초대 코드 6자리 입력"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              maxLength={6}
            />
            <Pressable
              style={[styles.enterButton, code.length < 6 && styles.enterButtonDisabled]}
              disabled={code.length < 6}
              onPress={() => navigate('ChatRoom', { title: '오늘 점심팟', avatar: moa })}>
              <Text style={styles.enterText}>입장</Text>
            </Pressable>
          </View>

          {ROOMS.map((room) => (
            <RoomRow
              key={room.title}
              room={room}
              onPress={() => navigate('ChatRoom', { title: room.title, avatar: room.avatar })}
            />
          ))}

          <Text style={styles.footer}>밥약 방은 정산 후 자동으로 사라져요</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function RoomRow({ room, onPress }: { room: Room; onPress: () => void }) {
  return (
    <Pressable style={[styles.row, room.highlight && styles.rowHighlight]} onPress={onPress}>
      <View style={[styles.themeBar, { backgroundColor: room.theme }]} />

      <View style={[styles.avatarBox, { backgroundColor: room.tint }]}>
        <Image source={room.avatar} style={styles.avatar} resizeMode="contain" />
      </View>

      <View style={styles.rowContent}>
        <View style={styles.titleRow}>
          <Text style={styles.roomTitle} numberOfLines={1}>
            {room.title}
          </Text>
          <View style={[styles.chip, chipStyles[room.chipTone].box]}>
            <Text style={[styles.chipText, chipStyles[room.chipTone].text]}>{room.chip}</Text>
          </View>
        </View>

        <Text style={styles.preview} numberOfLines={1}>
          {room.preview}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.stack}>
            {room.stack.map((src, i) => (
              <View key={i} style={[styles.stackItem, i > 0 && styles.stackOverlap]}>
                <Image source={src} style={styles.stackImage} resizeMode="contain" />
              </View>
            ))}
          </View>
          <Text style={styles.meta}>{room.meta}</Text>
        </View>
      </View>

      <Text style={styles.time}>{room.time}</Text>
      {room.unread ? (
        <View style={styles.unread}>
          <Text style={styles.unreadText}>{room.unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const chipStyles: Record<ChipTone, { box: object; text: object }> = {
  active: { box: { backgroundColor: '#FF8C3B' }, text: { color: colors.textOnAccent } },
  done: { box: { backgroundColor: '#ABABAB' }, text: { color: colors.textOnAccent } },
  open: { box: { backgroundColor: '#DDECFD' }, text: { color: '#4A90D9' } },
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceSunken,
  },
  body: {
    // 카드 x13 w197, 헤더 하단(y72) → 카드(y89)
    paddingHorizontal: s(13),
    paddingTop: s(17),
    paddingBottom: s(16),
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: s(12),
    paddingHorizontal: s(11),
    paddingTop: s(7),
    paddingBottom: s(10),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    flex: 1,
    fontFamily: fontFamily.wordmark,
    fontSize: fs(13),
    lineHeight: fs(19),
    fontWeight: weight.extrabold,
    color: colors.primary,
    letterSpacing: fs(-0.1),
  },
  plusButton: {
    width: s(20),
    height: s(20),
    borderRadius: s(20),
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    // y119 h1.5
    marginTop: s(4),
    height: s(1.5),
    borderRadius: s(1.5),
  },
  inviteBox: {
    // y130 h22
    marginTop: s(9),
    height: s(22),
    borderRadius: s(11),
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: s(9),
    paddingRight: s(3),
  },
  inviteInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    color: colors.textPrimary,
  },
  enterButton: {
    width: s(34),
    height: s(16),
    borderRadius: s(8),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enterButtonDisabled: {
    opacity: 0.4,
  },
  enterText: {
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(9),
    fontWeight: weight.bold,
    color: colors.textOnAccent,
  },
  row: {
    // y160 부터 60 간격, 높이 54
    marginTop: s(8),
    height: s(54),
    borderRadius: s(10),
    backgroundColor: colors.card,
  },
  rowHighlight: {
    backgroundColor: '#FFF5EB',
    borderWidth: s(0.8),
    borderColor: colors.primary,
  },
  themeBar: {
    position: 'absolute',
    left: s(7),
    top: s(9),
    width: s(3),
    height: s(36),
    borderRadius: s(2),
  },
  avatarBox: {
    position: 'absolute',
    left: s(16),
    top: s(10),
    width: s(32),
    height: s(32),
    borderRadius: s(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: s(21),
    height: s(25),
  },
  rowContent: {
    position: 'absolute',
    left: s(54),
    right: s(38),
    top: s(8),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
  },
  roomTitle: {
    flexShrink: 1,
    fontFamily: fontFamily.body,
    // Figma 텍스트 박스 폭 기준: "오늘 점심팟" w37 / "동아리 뒤풀이" w44
    fontSize: fs(7.5),
    lineHeight: fs(11),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  chip: {
    height: s(12),
    paddingHorizontal: s(5),
    borderRadius: s(4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: fontFamily.body,
    fontSize: fs(5.5),
    lineHeight: fs(8),
    fontWeight: weight.bold,
  },
  preview: {
    marginTop: s(2),
    fontFamily: fontFamily.body,
    // "양심껏 늦게 오는 사람 술 사라" 가 한 줄에 들어가야 한다 (Figma w70)
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
  metaRow: {
    marginTop: s(2),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
  },
  stack: {
    flexDirection: 'row',
  },
  stackItem: {
    width: s(13),
    height: s(13),
    borderRadius: s(13),
    backgroundColor: colors.card,
    borderWidth: s(0.8),
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stackOverlap: {
    marginLeft: s(-4),
  },
  stackImage: {
    width: s(9),
    height: s(11),
  },
  meta: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
  time: {
    position: 'absolute',
    right: s(9),
    top: s(9),
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
  unread: {
    position: 'absolute',
    left: s(152),
    top: s(24),
    width: s(13),
    height: s(13),
    borderRadius: s(13),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(8),
    fontWeight: weight.bold,
    color: colors.textOnAccent,
  },
  footer: {
    // y417
    marginTop: s(15),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
});
