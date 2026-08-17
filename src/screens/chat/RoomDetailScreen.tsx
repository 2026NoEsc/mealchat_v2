import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/AuthProvider';
import { DangerButton } from '../../components/ui/Button';
import { meetingLine } from '../../lib/roomFormat';
import { leaveRoom } from '../../lib/rooms';
import { useNavigation } from '../../navigation/NavigationContext';
import { useRoom } from '../../rooms/useMyRooms';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

export default function RoomDetailScreen() {
  const insets = useSafeAreaInsets();
  const { goBack, navigate, resetTo, current } = useNavigation();
  const { user } = useAuth();
  const params = current.params as { roomId?: string; title?: string } | undefined;
  const roomId = params?.roomId ?? null;

  const room = useRoom(roomId);
  const title = params?.title ?? room?.title ?? '밥약';

  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const members = room?.participants ?? [];

  /* expo-clipboard 를 아직 넣지 않아 실제 복사는 못 한다. 코드를 그대로 보여준다. */
  const copyCode = () => setCopied(true);

  const leave = async () => {
    if (!roomId || !user?.id) return;
    setLeaving(true);
    const error = await leaveRoom(roomId, user.id);
    setLeaving(false);

    if (error) {
      Alert.alert('나가기 실패', error.message);
      return;
    }
    resetTo('Chat');
  };

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />

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
                {/* 방장 여부는 rooms.owner_id 가 알려주는데 목록에는 싣지 않는다 */}
                <Text style={[styles.memberRole, mine && styles.memberRoleOwner]}>
                  {mine ? '나' : '메이트'}
                </Text>
              </View>
            );
          })}
        </View>

        <DangerButton
          label={leaving ? '나가는 중' : '방 나가기'}
          style={styles.leave}
          disabled={leaving}
          onPress={() => void leave()}
        />
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
    fontFamily: fontFamily.body,
    fontSize: fs(9),
    lineHeight: fs(13),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  body: {
    paddingHorizontal: s(12),
    paddingTop: s(12),
    paddingBottom: s(20),
  },
  title: {
    fontFamily: fontFamily.body,
    fontSize: fs(12),
    lineHeight: fs(16),
    fontWeight: weight.bold,
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
    fontFamily: fontFamily.body,
    fontSize: fs(11),
    lineHeight: fs(15),
    fontWeight: weight.extrabold,
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
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    fontWeight: weight.bold,
    color: colors.primary,
  },
  placeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeTitle: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    lineHeight: fs(11),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  changeText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    fontWeight: weight.semibold,
    color: colors.primary,
  },
  placeName: {
    marginTop: s(6),
    fontFamily: fontFamily.body,
    fontSize: fs(7.5),
    lineHeight: fs(10),
    fontWeight: weight.semibold,
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
    fontFamily: fontFamily.body,
    fontSize: fs(9),
    fontWeight: weight.bold,
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
    fontWeight: weight.bold,
    color: colors.primary,
  },
  leave: {
    marginTop: s(12),
  },
});
