import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppHeader from '../../components/AppHeader';
import {
  ROOM_STATUS_LABEL,
  participantMeta,
  roomStatus,
  timeLabel,
  type RoomStatus,
} from '../../lib/roomFormat';
import { joinRoomByCode, type RoomSummary } from '../../lib/rooms';
import { useNavigation } from '../../navigation/NavigationContext';
import { useMyRooms } from '../../rooms/useMyRooms';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';


type ChipTone = 'active' | 'done' | 'open';

export default function ChatHomeScreen() {
  const insets = useSafeAreaInsets();
  const { navigate } = useNavigation();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const { rooms, status, reload } = useMyRooms();

  const enterRoom = (room: RoomSummary) =>
    navigate('ChatRoom', { roomId: room.id, title: room.title, color: room.color });

  const joinByCode = async () => {
    setJoining(true);
    const { roomId, error } = await joinRoomByCode(code);
    setJoining(false);

    if (error) {
      // RPC 가 잘못된 코드·만료를 구분해서 던진다
      Alert.alert('입장할 수 없어요', error.message);
      return;
    }

    setCode('');
    reload();
    if (roomId) navigate('ChatRoom', { roomId });
  };

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
              /* 저장된 코드가 대문자라 입력도 맞춰 올린다 — RPC 는 정확히 일치해야 찾는다 */
              onChangeText={(text) => setCode(text.toUpperCase())}
              placeholder="초대 코드 6자리 입력"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
            />
            <Pressable
              style={[
                styles.enterButton,
                (code.length < 6 || joining) && styles.enterButtonDisabled,
              ]}
              disabled={code.length < 6 || joining}
              onPress={() => void joinByCode()}>
              <Text style={styles.enterText}>{joining ? '입장 중' : '입장'}</Text>
            </Pressable>
          </View>

          {status === 'loading' ? (
            <Text style={styles.emptyText}>방 목록을 불러오는 중...</Text>
          ) : status === 'error' ? (
            <Text style={styles.emptyText}>방 목록을 불러오지 못했어요</Text>
          ) : rooms.length === 0 ? (
            <Text style={styles.emptyText}>아직 참여 중인 밥약이 없어요</Text>
          ) : (
            rooms.map((room) => (
              <RoomRow key={room.id} room={room} onPress={() => enterRoom(room)} />
            ))
          )}

          <Text style={styles.footer}>밥약 방은 정산 후 자동으로 사라져요</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function RoomRow({ room, onPress }: { room: RoomSummary; onPress: () => void }) {
  const status = roomStatus(room);
  const tone = STATUS_TONE[status];

  return (
    <Pressable style={[styles.row, status === 'open' && styles.rowHighlight]} onPress={onPress}>
      <View style={[styles.themeBar, { backgroundColor: room.color }]} />

      {/*
       * 아바타 이미지 업로드가 아직 없어서 (Storage 버킷 0개) 참가자의
       * avatar_color 로 원을 그리고 이름 첫 글자를 넣는다.
       */}
      <View style={[styles.avatarBox, { backgroundColor: `${room.color}33` }]}>
        <Text style={styles.avatarInitial}>{initialOf(room.participants[0]?.name ?? room.title)}</Text>
      </View>

      <View style={styles.rowContent}>
        <View style={styles.titleRow}>
          <Text style={styles.roomTitle} numberOfLines={1}>
            {room.title}
          </Text>
          <View style={[styles.chip, chipStyles[tone].box]}>
            <Text style={[styles.chipText, chipStyles[tone].text]}>
              {ROOM_STATUS_LABEL[status]}
            </Text>
          </View>
        </View>

        <Text style={styles.preview} numberOfLines={1}>
          {room.lastMessage?.text ?? '아직 대화가 없어요'}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.stack}>
            {room.participants.slice(0, 3).map((participant, i) => (
              <View
                key={participant.id}
                style={[
                  styles.stackItem,
                  i > 0 && styles.stackOverlap,
                  { backgroundColor: participant.avatarColor },
                ]}>
                <Text style={styles.stackInitial}>{initialOf(participant.name)}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.meta}>{participantMeta(room.participants.length, room.expiresAt)}</Text>
        </View>
      </View>

      <Text style={styles.time}>
        {room.lastMessage ? timeLabel(room.lastMessage.createdAt) : ''}
      </Text>
    </Pressable>
  );
}

/** 아바타 자리에 쓸 첫 글자. 이모지·한글 모두 한 글자로 잘리게 배열로 자른다. */
function initialOf(name: string): string {
  return [...name.trim()][0] ?? '?';
}

const STATUS_TONE: Record<RoomStatus, ChipTone> = {
  open: 'active',
  confirmed: 'done',
  expired: 'open',
};

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
  emptyText: {
    marginTop: s(20),
    marginBottom: s(6),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: colors.textMuted,
  },
  /* 아바타 업로드 전까지 쓰는 이니셜 원 */
  avatarInitial: {
    fontFamily: fontFamily.body,
    fontSize: fs(11),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  stackInitial: {
    fontFamily: fontFamily.body,
    fontSize: fs(5.5),
    fontWeight: weight.bold,
    color: colors.textOnAccent,
    textAlign: 'center',
  },
});
