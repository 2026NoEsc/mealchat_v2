import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useTopInset } from '../../theme/insets';

import AppHeader from '../../components/AppHeader';
import { useAuth } from '../../auth/AuthProvider';
import {
  ROOM_STATUS_LABEL,
  participantMeta,
  roomStatus,
  timeLabel,
  type RoomStatus,
} from '../../lib/roomFormat';
import { previewText } from '../../lib/emoticon';
import {
  acceptRoomInvitation,
  declineRoomInvitation,
  fetchMyPendingRoomInvitations,
  joinRoomByCode,
  type RoomInvitation,
  type RoomSummary,
} from '../../lib/rooms';
import { useForegroundRefreshToken } from '../../lifecycle/AppLifecycleContext';
import { useNavigation } from '../../navigation/NavigationContext';
import { useMyRooms } from '../../rooms/useMyRooms';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';


type ChipTone = 'active' | 'done' | 'open';

export default function ChatHomeScreen() {
  /* 상태바 높이는 insets.top 만으로는 모자란 기기가 있다 */
  const topInset = useTopInset();
  const { navigate } = useNavigation();
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [invitations, setInvitations] = useState<RoomInvitation[]>([]);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [invitationBusy, setInvitationBusy] = useState<string | null>(null);
  const { rooms, status, reload } = useMyRooms();
  const userId = user?.id ?? null;
  const foregroundRefreshToken = useForegroundRefreshToken();

  useEffect(() => {
    let active = true;

    if (!userId) {
      setInvitations([]);
      setInvitationError(null);
      return () => {
        active = false;
      };
    }

    void fetchMyPendingRoomInvitations()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setInvitations([]);
          setInvitationError('초대 목록을 불러오지 못했어요.');
          return;
        }
        setInvitations(data ?? []);
        setInvitationError(null);
      })
      .catch(() => {
        if (!active) return;
        setInvitations([]);
        setInvitationError('초대 목록을 불러오지 못했어요.');
      });

    return () => {
      active = false;
    };
  }, [userId, foregroundRefreshToken]);

  const reloadInvitations = async () => {
    try {
      const { data, error } = await fetchMyPendingRoomInvitations();
      if (error) {
        setInvitationError('초대 목록을 불러오지 못했어요.');
        return error;
      }
      setInvitations(data ?? []);
      setInvitationError(null);
      return null;
    } catch {
      const error = new Error('초대 목록을 불러오지 못했어요.');
      setInvitationError(error.message);
      return error;
    }
  };

  const enterRoom = (room: RoomSummary) =>
    navigate('ChatRoom', { roomId: room.id, title: room.title, color: room.color });

  const joinByCode = async () => {
    try {
      setJoining(true);
      const { roomId, error } = await joinRoomByCode(code);

      if (error) {
        // RPC 가 잘못된 코드·만료를 구분해서 던진다
        Alert.alert('입장할 수 없어요', error.message);
        return;
      }

      setCode('');
      reload();
      if (roomId) navigate('ChatRoom', { roomId });
    } catch {
      Alert.alert('입장할 수 없어요', '초대 코드를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setJoining(false);
    }
  };

  const acceptInvitation = async (invitation: RoomInvitation) => {
    try {
      setInvitationBusy(invitation.id);
      const { roomId, error } = await acceptRoomInvitation(invitation.id);

      if (error) {
        Alert.alert('초대를 수락할 수 없어요', error.message);
        return;
      }

      await reloadInvitations();
      if (!roomId) {
        Alert.alert('초대가 만료됐어요', '새 초대를 받아 다시 시도해 주세요.');
        return;
      }

      reload();
      navigate('ChatRoom', { roomId, title: invitation.roomTitle });
    } catch {
      Alert.alert('초대를 수락할 수 없어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setInvitationBusy(null);
    }
  };

  const declineInvitation = async (invitation: RoomInvitation) => {
    try {
      setInvitationBusy(invitation.id);
      const error = await declineRoomInvitation(invitation.id);

      if (error) {
        Alert.alert('초대를 거절할 수 없어요', error.message);
        return;
      }
      await reloadInvitations();
    } catch {
      Alert.alert('초대를 거절할 수 없어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      setInvitationBusy(null);
    }
  };

  return (
    <View style={styles.screen}>
      {/* 상태바 자리. 배경을 칠하지 않아 화면 배경이 그대로 비친다 —
          헤더와 같은 색으로 칠하면 둘이 한 덩어리로 보여서 헤더가
          어디서 시작하는지 알 수 없다 */}
      <View style={{ height: topInset }} />
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

          {invitationError ? (
            <View style={styles.reloadBox}>
              <Text style={styles.emptyText}>{invitationError}</Text>
              <Pressable style={styles.retryButton} onPress={() => void reloadInvitations()}>
                <Text style={styles.retryText}>다시 시도</Text>
              </Pressable>
            </View>
          ) : null}

          {invitations.length > 0 ? (
            <View style={styles.pendingInvitations}>
              <Text style={styles.pendingTitle}>받은 초대</Text>
              {invitations.map((invitation) => {
                const busy = invitationBusy === invitation.id;
                return (
                  <View key={invitation.id} style={styles.pendingInvitationRow}>
                    <Text style={styles.pendingInvitationName} numberOfLines={1}>
                      {invitation.roomTitle}
                    </Text>
                    <Pressable
                      style={[styles.acceptInvitationButton, busy && styles.invitationButtonDisabled]}
                      disabled={busy}
                      onPress={() => void acceptInvitation(invitation)}>
                      <Text style={styles.invitationButtonText}>{busy ? '처리 중' : '수락'}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.declineInvitationButton, busy && styles.invitationButtonDisabled]}
                      disabled={busy}
                      onPress={() => void declineInvitation(invitation)}>
                      <Text style={styles.declineInvitationText}>거절</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : null}

          {status === 'loading' ? (
            <Text style={styles.emptyText}>방 목록을 불러오는 중...</Text>
          ) : status === 'error' ? (
            <View style={styles.reloadBox}>
              <Text style={styles.emptyText}>방 목록을 불러오지 못했어요</Text>
              <Pressable
                style={styles.retryButton}
                onPress={() => {
                  reload();
                  void reloadInvitations();
                }}>
                <Text style={styles.retryText}>다시 시도</Text>
              </Pressable>
            </View>
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
          {room.lastMessage ? previewText(room.lastMessage.text) : '아직 대화가 없어요'}
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
          <Text style={styles.meta}>
            {participantMeta(room.participants.length, room.expiresAt, room.stage === 'done')}
          </Text>
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
    color: colors.primary,
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
  pendingInvitations: {
    marginTop: s(10),
    gap: s(5),
  },
  pendingTitle: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    fontWeight: weight.bold,
    color: colors.textMuted,
  },
  pendingInvitationRow: {
    minHeight: s(27),
    borderRadius: s(8),
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    paddingHorizontal: s(7),
  },
  pendingInvitationName: {
    flex: 1,
    minWidth: 0,
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    fontWeight: weight.semibold,
    color: colors.textPrimary,
  },
  acceptInvitationButton: {
    minWidth: s(25),
    height: s(16),
    borderRadius: s(8),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineInvitationButton: {
    minWidth: s(25),
    height: s(16),
    borderRadius: s(8),
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invitationButtonDisabled: {
    opacity: 0.5,
  },
  invitationButtonText: {
    fontFamily: fontFamily.body,
    fontSize: fs(5.5),
    lineHeight: fs(7),
    fontWeight: weight.bold,
    color: colors.textOnAccent,
  },
  declineInvitationText: {
    fontFamily: fontFamily.body,
    fontSize: fs(5.5),
    lineHeight: fs(7),
    fontWeight: weight.bold,
    color: colors.textMuted,
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
    fontFamily: fontFamily.bold,
    fontSize: fs(7),
    lineHeight: fs(9),
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
    fontFamily: fontFamily.bold,
    // Figma 텍스트 박스 폭 기준: "오늘 점심팟" w37 / "동아리 뒤풀이" w44
    fontSize: fs(7.5),
    lineHeight: fs(11),
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
    fontFamily: fontFamily.bold,
    fontSize: fs(5.5),
    lineHeight: fs(8),
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
    fontFamily: fontFamily.bold,
    fontSize: fs(6.5),
    lineHeight: fs(8),
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
  reloadBox: {
    alignItems: 'center',
  },
  retryButton: {
    marginTop: s(4),
    paddingHorizontal: s(8),
    paddingVertical: s(3),
    borderRadius: s(6),
    backgroundColor: colors.primarySoft,
  },
  retryText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    fontWeight: weight.bold,
    color: colors.primary,
  },
  /* 아바타 업로드 전까지 쓰는 이니셜 원 */
  avatarInitial: {
    fontFamily: fontFamily.bold,
    fontSize: fs(11),
    color: colors.textPrimary,
  },
  stackInitial: {
    fontFamily: fontFamily.bold,
    fontSize: fs(5.5),
    color: colors.textOnAccent,
    textAlign: 'center',
  },
});
