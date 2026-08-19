import { Paperclip, Plus } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AdCarousel from '../components/AdCarousel';
import AppHeader from '../components/AppHeader';
import { CompleteButton } from '../components/ui/Button';
import { meetingLine, roomStatus, upcomingBadge } from '../lib/roomFormat';
import type { RoomSummary } from '../lib/rooms';
import { useNavigation } from '../navigation/NavigationContext';
import { useMyProfile } from '../profile/useMyProfile';
import { useMyRooms, useMySettlements } from '../rooms/useMyRooms';
import { fs, s } from '../theme/scale';
import { colors, radii } from '../theme/tokens';
import { fontFamily, weight } from '../theme/typography';

const banner = require('../../assets/ad/banner-1.png');

/**
 * Figma 홈/메인 (309:1064) — 220 x 483
 * 좌표: 헤더 y30 / 인사 y82 / 서브 y98 / 광고카드 y113 h109 /
 * 다가올일정 y230 h108 / 정산넛지 y346 h34 / CTA y397 h28 / 하단탭 y445
 */
export default function HomeScreen() {
  const { navigate } = useNavigation();
  const insets = useSafeAreaInsets();
  const { bundle } = useMyProfile();
  const { rooms, status } = useMyRooms();
  const settlements = useMySettlements();

  const name = bundle?.profile.name;
  /* 아직 끝나지 않은 밥약만 센다 */
  const activeRooms = rooms.filter((room) => roomStatus(room) !== 'expired');
  const upcoming = selectUpcoming(rooms);

  /* 전원이 송금을 끝낸 정산은 넛지에서 뺀다 */
  const openSettlements = settlements.filter((settlement) => !settlement.settled);
  const myTurn = openSettlements.filter((settlement) => settlement.waitingOnMe);
  const pendingPeople = openSettlements.reduce(
    (total, settlement) => total + settlement.pendingCount,
    0,
  );

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />
      <AppHeader />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.greeting}>
          {name ? `안녕하세요, ${name}님!` : '안녕하세요!'}
        </Text>
        {/*
          * 불러오는 중이거나 실패했을 때 "밥약이 없다" 고 단정하지 않는다.
          * 목록을 못 받은 것과 정말 없는 것은 다른 사실이고, 처음 들어온 사람에게는
          * 그 차이가 앱이 고장 난 것처럼 보이는지 아닌지를 가른다.
          */}
        <Text style={styles.greetingSub}>
          {status === 'loading'
            ? '밥약을 불러오는 중이에요'
            : status === 'error'
              ? '밥약을 불러오지 못했어요. 잠시 후 다시 열어 주세요'
              : activeRooms.length === 0 && openSettlements.length === 0
                ? '아직 잡힌 밥약이 없어요. 하나 만들어 볼까요?'
                : `현재 밥약 ${activeRooms.length}건, 정산 ${openSettlements.length}건이 기다리고 있어요~`}
        </Text>

        <View style={styles.banner}>
          <AdCarousel images={[banner]} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.clip}>
              <Paperclip size={s(13)} color={colors.textPrimary} strokeWidth={2} />
            </View>
            <Text style={styles.cardTitle}>다가올 일정</Text>
            <Pressable
              style={styles.addButton}
              hitSlop={s(6)}
              onPress={() => navigate('ScheduleDetail')}>
              <Plus size={s(9)} color={colors.textOnAccent} strokeWidth={3} />
            </Pressable>
          </View>

          {status === 'loading' ? (
            <Text style={styles.emptyItem}>불러오는 중...</Text>
          ) : status === 'error' ? (
            <Text style={styles.emptyItem}>밥약을 불러오지 못했어요</Text>
          ) : upcoming.length === 0 ? (
            <Text style={styles.emptyItem}>다가올 밥약이 없어요</Text>
          ) : (
            upcoming.map((room, i) => {
              const badge = upcomingBadge(room.meetingDate);
              return (
                <Pressable
                  key={room.id}
                  style={i > 0 ? styles.itemDivided : styles.item}
                  onPress={() => navigate('ChatRoom', { roomId: room.id, title: room.title, color: room.color })}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.itemTitle}>{room.title}</Text>
                    {badge ? (
                      <View
                        style={[
                          styles.badge,
                          badge.tone === 'today' ? styles.badgeToday : styles.badgeCountdown,
                        ]}>
                        <Text
                          style={[
                            styles.badgeText,
                            badge.tone === 'today'
                              ? styles.badgeTextToday
                              : styles.badgeTextCountdown,
                          ]}>
                          {badge.label}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.itemDate}>
                    {meetingLine(room.meetingDate, room.locationName)}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>

        {/*
          * 정산 목록 화면으로 보낸다. 예전에는 해당 방의 채팅을 열면서 시트를 펼쳤는데,
          * 방이 사라진 정산은 그 경로로 갈 수 없어 넛지가 통째로 죽었다.
          */}
        {openSettlements.length > 0 ? (
          <Pressable style={styles.payNudge} onPress={() => navigate('Settlements')}>
            <View style={styles.flex}>
              {/* 내가 보낼 차례인지부터 알려 준다 — 그게 지금 할 일이다 */}
              <Text style={styles.payTitle}>
                {myTurn.length > 0
                  ? `보낼 정산 ${myTurn.length}건`
                  : `정산 ${openSettlements.length}건 진행 중`}
              </Text>
              {/*
                * pendingPeople 이 0 인데 여기까지 왔다는 것은 참가자 명단을 못 읽었다는
                * 뜻이다 (정책에 막혔거나 RPC 이전에 만들어진 정산). "0명이 아직 안
                * 보냈어요" 는 말이 되지 않으므로 인원을 아는 경우에만 인원을 적는다.
                */}
              <Text style={styles.paySub}>
                {myTurn.length > 0
                  ? '아직 송금하지 않았어요'
                  : pendingPeople > 0
                    ? `${pendingPeople}명이 아직 안 보냈어요`
                    : '방이 사라져도 정산 내역은 남아 있어요'}
              </Text>
            </View>
            <Text style={styles.payLink}>보기 →</Text>
          </Pressable>
        ) : null}

        <CompleteButton
          label="일정잡기"
          style={styles.cta}
          onPress={() => navigate('ScheduleDetail')}
        />
      </ScrollView>
    </View>
  );
}

/** 오늘 이후 일정만, 가까운 순으로 두 건 */
function selectUpcoming(rooms: RoomSummary[]): RoomSummary[] {
  return rooms
    .filter((room) => upcomingBadge(room.meetingDate) !== null)
    .sort((a, b) => a.meetingDate.localeCompare(b.meetingDate))
    .slice(0, 2);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.card,
  },
  flex: {
    flex: 1,
  },
  content: {
    // 카드들이 x11, 폭 197 (= 220 - 11*2)
    paddingHorizontal: s(11),
    paddingTop: s(10),
    paddingBottom: s(20),
  },
  greeting: {
    marginLeft: s(2),
    fontFamily: fontFamily.body,
    fontSize: fs(9),
    lineHeight: fs(15),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  greetingSub: {
    marginLeft: s(2),
    marginTop: s(1),
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  banner: {
    marginTop: s(6),
  },
  card: {
    // y230, 광고카드 하단(y222) 에서 8
    marginTop: s(8),
    backgroundColor: colors.surface,
    borderRadius: s(10),
    paddingHorizontal: s(11),
    paddingTop: s(8),
    paddingBottom: s(8),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clip: {
    // 클립 아이콘은 카드 좌측 경계 밖으로 살짝 나온다 (x6 vs 카드 x11)
    marginLeft: s(-8),
    marginRight: s(1),
  },
  cardTitle: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(9.5),
    lineHeight: fs(14),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  addButton: {
    width: s(16),
    height: s(15),
    borderRadius: s(5),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: {
    // 헤더 하단(y257) → 첫 항목(y262)
    marginTop: s(5),
  },
  itemDivided: {
    // 구분선 y292 (첫 항목 날짜 하단 y289 에서 3)
    marginTop: s(3),
    borderTopWidth: s(1),
    borderTopColor: colors.border,
    paddingTop: s(6),
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bullet: {
    width: s(6),
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    color: colors.textPrimary,
  },
  itemTitle: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(9),
    lineHeight: fs(14),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  itemDate: {
    // x36 → 카드 좌측(x11) 기준 25, 본문 패딩 11 을 뺀 14
    marginLeft: s(14),
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(12),
    color: colors.textMuted,
  },
  badge: {
    width: s(23),
    height: s(13),
    borderRadius: s(radii.badge),
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeToday: {
    backgroundColor: colors.primary,
  },
  badgeCountdown: {
    backgroundColor: colors.surfaceStrong,
  },
  badgeText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    fontWeight: weight.bold,
  },
  badgeTextToday: {
    color: colors.textOnAccent,
  },
  badgeTextCountdown: {
    color: colors.textMuted,
  },
  payNudge: {
    // y346, 카드 하단(y338) 에서 8 / 높이 34
    marginTop: s(8),
    height: s(34),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: s(0.6),
    borderColor: colors.primary,
    borderRadius: s(8),
    paddingHorizontal: s(11),
  },
  payTitle: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(11),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  paySub: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
  payLink: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(9),
    fontWeight: weight.semibold,
    color: colors.primary,
  },
  emptyItem: {
    marginTop: s(12),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    color: colors.textMuted,
  },
  cta: {
    // y397, 정산 넛지 하단(y380) 에서 17
    marginTop: s(17),
    marginHorizontal: s(2),
  },
});
