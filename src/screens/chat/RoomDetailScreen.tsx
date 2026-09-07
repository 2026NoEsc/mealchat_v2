import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTopInset } from '../../theme/insets';

import { useAuth } from '../../auth/AuthProvider';
import { DangerButton } from '../../components/ui/Button';
import { meetingLine } from '../../lib/roomFormat';
import { confirmAction } from '../../lib/confirm';
import { leaveRoom } from '../../lib/rooms';
import { useNavigation } from '../../navigation/NavigationContext';
import { useRoom } from '../../rooms/useMyRooms';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

export default function RoomDetailScreen() {
  /* 상태바 높이는 insets.top 만으로는 모자란 기기가 있다 */
  const topInset = useTopInset();
  const { goBack, navigate, resetTo, current } = useNavigation();
  const { user } = useAuth();
  const params = current.params as { roomId?: string; title?: string } | undefined;
  const roomId = params?.roomId ?? null;

  const { room } = useRoom(roomId);
  const title = params?.title ?? room?.title ?? '밥약';

  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const members = room?.participants ?? [];

  /*
   * 나가기는 "방장이 방을 닫는" 행위다. 방장이 나가면 방이 통째로 사라지므로
   * 다른 사람에게는 버튼을 보여 주지 않는다. 서버(leave_room)도 같은 조건으로
   * 막지만, 누를 수 있게 두고 거절하면 왜 안 되는지가 전달되지 않는다.
   */
  const isOwner = Boolean(user?.id && room?.ownerId && user.id === room.ownerId);
  /* 돈이 오가는 중에 방이 사라지면 얼마를 보내야 하는지 확인할 자리가 없어진다 */
  const settling = room?.stage === 'settling';

  /* expo-clipboard 를 아직 넣지 않아 실제 복사는 못 한다. 코드를 그대로 보여준다. */
  const copyCode = () => setCopied(true);

  const leave = () => {
    if (!roomId || !user?.id) return;

    /* 되돌릴 수 없고 남은 사람들에게서도 방이 사라진다 — 한 번 묻는다 */
    confirmAction({
      title: '방을 없앨까요?',
      message: '메이트 모두에게서 방이 사라져요. 정산 내역은 남아 있어요.',
      cancelLabel: '그대로 둘게요',
      confirmLabel: '없애기',
      destructive: true,
      onConfirm: () => {
        void (async () => {
          setLeaving(true);
          const error = await leaveRoom(roomId);
          setLeaving(false);

          if (error) {
            Alert.alert('없애지 못했어요', error.message);
            return;
          }
          /* 목록은 홈으로 합쳤다 */
          resetTo('Home');
        })();
      },
    });
  };

  return (
    <View style={styles.screen}>
      {/* 상태바 자리. 배경을 칠하지 않아 화면 배경이 그대로 비친다 —
          헤더와 같은 색으로 칠하면 둘이 한 덩어리로 보여서 헤더가
          어디서 시작하는지 알 수 없다 */}
      <View style={{ height: topInset }} />

      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={s(8)}>
          <ChevronLeft size={s(14)} color={colors.textPrimary} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>방 상세정보</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>초대 코드</Text>
          <View style={styles.codeRow}>
            <Text style={styles.code}>{room?.code ?? '••••••'}</Text>
            <Pressable
              style={styles.copyButton}
              onPress={copyCode}
              hitSlop={s(6)}>
              <Text style={styles.copyText}>{copied ? '복사됨' : '복사'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, styles.cardSpacing]}>
          <View style={styles.placeHeader}>
            <Text style={styles.placeTitle}>약속 장소</Text>
            <Pressable hitSlop={s(6)} onPress={() => navigate('Origin')}>
              <Text style={styles.changeText}>변경</Text>
            </Pressable>
          </View>
          <Text style={styles.placeName}>{room?.locationName ?? '아직 정하지 않았어요'}</Text>
          <Text style={styles.placeDetail}>
            {room ? meetingLine(room.meetingDate, null) : ' '}
          </Text>
        </View>

        <View style={[styles.card, styles.cardSpacing]}>
          <View style={styles.placeHeader}>
            <Text style={styles.placeTitle}>멤버 {members.length}명</Text>
            <Pressable hitSlop={s(6)} onPress={copyCode}>
              <Text style={styles.changeText}>＋ 초대</Text>
            </Pressable>
          </View>

          {members.map((member) => {
            const mine = member.profileId === user?.id;
            return (
              <View key={member.id} style={styles.memberRow}>
                <View style={[styles.avatarBox, { backgroundColor: member.avatarColor }]}>
                  <Text style={styles.avatarInitial}>
                    {[...member.name.trim()][0] ?? '?'}
                  </Text>
                </View>
                <Text style={styles.memberName}>{member.name}</Text>
                {/* 방장 개념이 없다 — 나와 남만 구분한다 */}
                <Text style={[styles.memberRole, mine && styles.memberRoleOwner]}>
                  {mine ? '나' : '메이트'}
                </Text>
              </View>
            );
          })}
        </View>

        {isOwner ? (
          <>
            <DangerButton
              label={leaving ? '없애는 중' : '방 없애기'}
              style={styles.leave}
              disabled={leaving || settling}
              onPress={leave}
            />
            <Text style={styles.leaveHint}>
              {settling
                ? '정산이 끝나면 없앨 수 있어요.'
                : '없애면 메이트 모두에게서 방이 사라져요.'}
            </Text>
          </>
        ) : (
          <Text style={styles.leaveHint}>방은 방장만 없앨 수 있어요.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceSunken,
  },
  header: {
    height: s(44),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(10),
    gap: s(8),
    backgroundColor: colors.surface,
  },
  headerTitle: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: fs(9),
    lineHeight: fs(13),
    color: colors.textPrimary,
  },
  body: {
    paddingHorizontal: s(12),
    paddingTop: s(12),
    paddingBottom: s(20),
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fs(12),
    lineHeight: fs(16),
    color: colors.textPrimary,
  },
  card: {
    marginTop: s(7),
    backgroundColor: colors.card,
    borderRadius: s(10),
    paddingHorizontal: s(9),
    paddingVertical: s(8),
  },
  cardSpacing: {
    marginTop: s(7),
  },
  cardLabel: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  codeRow: {
    marginTop: s(4),
    flexDirection: 'row',
    alignItems: 'center',
  },
  code: {
    flex: 1,
    fontFamily: fontFamily.extrabold,
    fontSize: fs(11),
    lineHeight: fs(15),
    letterSpacing: fs(1),
    color: colors.primary,
  },
  copyButton: {
    paddingHorizontal: s(7),
    paddingVertical: s(3),
    borderRadius: s(6),
    backgroundColor: colors.primarySoft,
  },
  copyText: {
    fontFamily: fontFamily.bold,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.primary,
  },
  placeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeTitle: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: fs(8),
    lineHeight: fs(11),
    color: colors.textPrimary,
  },
  changeText: {
    fontFamily: fontFamily.semibold,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.primary,
  },
  placeName: {
    marginTop: s(6),
    fontFamily: fontFamily.semibold,
    fontSize: fs(7.5),
    lineHeight: fs(10),
    color: colors.textPrimary,
  },
  placeDetail: {
    marginTop: s(2),
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  memberRow: {
    marginTop: s(7),
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarInitial: {
    fontFamily: fontFamily.bold,
    fontSize: fs(9),
    color: colors.textOnAccent,
  },
  avatarBox: {
    width: s(16),
    height: s(16),
    borderRadius: s(5),
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: s(11),
    height: s(12),
  },
  memberName: {
    flex: 1,
    marginLeft: s(6),
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: colors.textPrimary,
  },
  memberRole: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  memberRoleOwner: {
    fontFamily: fontFamily.bold,
    color: colors.primary,
  },
  leave: {
    marginTop: s(12),
  },
  leaveHint: {
    marginTop: s(6),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
});
