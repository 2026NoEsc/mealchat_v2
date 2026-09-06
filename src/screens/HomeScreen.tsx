import { Plus } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AdCarousel from '../components/AdCarousel';
import PageHeader from '../components/PageHeader';
import RoomRow from '../components/RoomRow';
import { roomStatus } from '../lib/roomFormat';
import { useNavigation } from '../navigation/NavigationContext';
import { useMyProfile } from '../profile/useMyProfile';
import { useMyRooms, useMySettlements } from '../rooms/useMyRooms';
import { fs, s } from '../theme/scale';
import { colors, shadows } from '../theme/tokens';
import { fontFamily } from '../theme/typography';

const banner = require('../../assets/ad/banner-1.png');

/**
 * Figma 홈/메인 (2154:655) — 220 x 483
 *
 * 하단 탭이 셋으로 줄면서 채팅방 목록이 홈으로 들어왔다. 그래서 이 화면은
 * 인사 헤더 + 배너 + 정산 넛지 + 밥약 목록 + 새 밥약 버튼으로 구성된다.
 * 예전의 "다가올 일정" 카드와 "일정잡기" 버튼은 시안에서 빠졌다 — 목록이
 * 같은 정보를 담고, 새로 만들기는 우하단 버튼이 맡는다.
 *
 * 좌표: 인사헤더 y30 h42 / 배너 y80 h83 / 정산넛지 y168 h31 /
 *       밥약 y209 부터 h54 (간격 6) / 새 밥약 버튼 y412 / 하단탭 y445
 */
export default function HomeScreen() {
  const { navigate } = useNavigation();
  const insets = useSafeAreaInsets();
  const { bundle } = useMyProfile();
  const { rooms, status, reload } = useMyRooms();
  const settlements = useMySettlements();

  const name = bundle?.profile.name;
  /* 아직 끝나지 않은 밥약만 센다 */
  const activeRooms = rooms.filter((room) => roomStatus(room) !== 'expired');
  /* 전원이 송금을 끝낸 정산은 넛지에서 뺀다 */
  const openSettlements = settlements.filter((settlement) => !settlement.settled);

  const enterRoom = (roomId: string, title: string, color: string) =>
    navigate('ChatRoom', { roomId, title, color });

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />

      {/* 홈에서는 헤더 자리에 인사가 들어간다 — 시안 2154:681 */}
      <PageHeader>
        <Text style={styles.greeting} numberOfLines={1}>
          {name ? `안녕하세요, ${name}님!` : '안녕하세요!'}
        </Text>
        {/*
         * 불러오는 중이거나 실패했을 때 "밥약이 없다" 고 단정하지 않는다.
         * 목록을 못 받은 것과 정말 없는 것은 다른 사실이고, 처음 들어온
         * 사람에게는 그 차이가 앱이 고장 난 것처럼 보이는지를 가른다.
         */}
        <Text style={styles.greetingSub} numberOfLines={1}>
          {status === 'loading'
            ? '밥약을 불러오는 중이에요'
            : status === 'error'
              ? '밥약을 불러오지 못했어요. 다시 시도해 주세요'
              : activeRooms.length === 0 && openSettlements.length === 0
                ? '아직 잡힌 밥약이 없어요. 하나 만들어 볼까요?'
                : `현재 밥약 ${activeRooms.length}건, 정산 ${openSettlements.length}건이 기다리고 있어요~`}
        </Text>
      </PageHeader>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.banner}>
          <AdCarousel images={[banner]} />
        </View>

        {/*
         * 정산 목록 화면으로 보낸다. 예전에는 해당 방의 채팅을 열면서 시트를
         * 펼쳤는데, 방이 사라진 정산은 그 경로로 갈 수 없어 넛지가 통째로 죽었다.
         */}
        {/*
         * 0건일 때도 남겨 둔다. 정산이 없다는 것도 알아야 하는 사실이고,
         * 넛지가 통째로 사라지면 아래 목록이 위로 올라와 화면이 들썩인다.
         */}
        <Pressable style={styles.payNudge} onPress={() => navigate('Settlements')}>
          <Text style={styles.payTitle}>미완료 정산 {openSettlements.length}건</Text>
          <Text style={styles.payAction}>보기 →</Text>
        </Pressable>

        <View style={styles.roomList}>
          {status === 'loading' ? (
            <Text style={styles.empty}>밥약을 불러오는 중...</Text>
          ) : status === 'error' ? (
            <View style={styles.retryBox}>
              <Text style={styles.empty}>밥약을 불러오지 못했어요</Text>
              <Pressable style={styles.retryButton} onPress={reload}>
                <Text style={styles.retryText}>다시 시도</Text>
              </Pressable>
            </View>
          ) : rooms.length === 0 ? (
            <Text style={styles.empty}>아직 참여 중인 밥약이 없어요</Text>
          ) : (
            rooms.map((room, i) => (
              <View key={room.id} style={i > 0 ? styles.roomGap : null}>
                <RoomRow room={room} onPress={() => enterRoom(room.id, room.title, room.color)} />
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* 새 밥약 — 시안 2154:701 (25 x 25, 우하단) */}
      <Pressable
        style={styles.fab}
        hitSlop={s(8)}
        accessibilityRole="button"
        accessibilityLabel="새 밥약 만들기"
        onPress={() => navigate('ScheduleDetail')}>
        <Plus size={s(13)} color={colors.textOnAccent} strokeWidth={3} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  greeting: {
    fontFamily: fontFamily.bold,
    fontSize: fs(10),
    lineHeight: fs(13.5),
    color: colors.textPrimary,
  },
  greetingSub: {
    marginTop: s(1),
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8.1),
    color: colors.textSecondary,
  },
  content: {
    paddingHorizontal: s(14),
    // 헤더 하단(y72) → 배너(y80)
    paddingTop: s(8),
    paddingBottom: s(56),
  },
  /* 높이는 AdCarousel 의 aspectRatio(194/83) 가 정한다 */
  banner: {
    borderRadius: s(10),
    overflow: 'hidden',
  },
  // 정산 넛지 y168 h31 — 배너 하단(y163) 에서 5
  payNudge: {
    marginTop: s(5),
    height: s(31),
    borderRadius: s(10),
    borderWidth: s(1),
    borderColor: colors.primaryBorder,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(11),
    ...shadows.button,
  },
  payTitle: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: fs(8),
    lineHeight: fs(10.8),
    color: colors.textPrimary,
  },
  payAction: {
    fontFamily: fontFamily.semibold,
    fontSize: fs(6.5),
    lineHeight: fs(8.78),
    color: colors.primaryVivid,
  },
  // 첫 밥약 y209 — 넛지 하단(y199) 에서 10
  roomList: {
    marginTop: s(10),
  },
  roomGap: {
    marginTop: s(6),
  },
  empty: {
    marginTop: s(10),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: colors.textMuted,
  },
  fab: {
    position: 'absolute',
    right: s(12),
    bottom: s(8),
    width: s(25),
    height: s(25),
    borderRadius: s(999),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.button,
  },
  retryBox: {
    alignItems: 'center',
  },
  retryButton: {
    marginTop: s(-6),
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
