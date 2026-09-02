import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import AdCarousel from '../components/AdCarousel';
import AppHeader from '../components/AppHeader';
import { CompleteButton } from '../components/ui/Button';
import { meetingLine, roomStatus, upcomingBadge } from '../lib/roomFormat';
import type { RoomSummary } from '../lib/rooms';
import { useNavigation } from '../navigation/NavigationContext';
import Avatar from '../components/Avatar';
import { useMyProfile } from '../profile/useMyProfile';
import { useMyRooms, useMySettlements } from '../rooms/useMyRooms';
import { fs, s } from '../theme/scale';
import { colors, shadows } from '../theme/tokens';
import { fontFamily } from '../theme/typography';

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
        {/*
          * 인사와 요약을 카드로 묶는다. 배경 위에 글자만 떠 있으면 아래 배너·
          * 카드들과 한 덩어리로 읽혀서, 어디까지가 인사인지 갈리지 않는다.
          */}
        <View style={styles.greetingCard}>
          <View style={styles.greetingBody}>
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
          </View>

          <Avatar
            name={name || '?'}
            color={bundle?.profile.avatarColor ?? colors.primary}
            url={bundle?.profile.avatarUrl}
            size={s(29)}
            radius={s(5)}
          />
        </View>

        <View style={styles.banner}>
          <AdCarousel images={[banner]} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>다가올 일정</Text>

          {/* 시안에서 이 버튼은 제목과 같은 줄이 아니라 카드 오른쪽 위(6, 14)에 얹혀 있다 */}
          <Pressable
            style={styles.addButton}
            hitSlop={s(6)}
            onPress={() => navigate('ScheduleDetail')}>
            <Svg width={s(9)} height={s(9)} viewBox="0 0 9 9">
              <Defs>
                <LinearGradient
                  id="homeAddPlus"
                  x1="0"
                  y1="4.5"
                  x2="9"
                  y2="4.5"
                  gradientUnits="userSpaceOnUse">
                  <Stop offset={colors.accentGradientLocations[0]} stopColor={colors.accentGradient[0]} />
                  <Stop offset={colors.accentGradientLocations[1]} stopColor={colors.accentGradient[1]} />
                </LinearGradient>
              </Defs>
              <Path
                d="M9 5.14286H5.14286V9H3.85714V5.14286H0V3.85714H3.85714V0H5.14286V3.85714H9V5.14286Z"
                fill="url(#homeAddPlus)"
              />
            </Svg>
          </Pressable>

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
                <View key={room.id}>
                  {/* 구분선은 항목 바깥에 둔다 — 항목에 들여쓰기를 주면 불릿까지 밀린다 */}
                  {i > 0 ? <View style={styles.divider} /> : null}
                  <Pressable
                    style={i > 0 ? styles.itemNext : styles.item}
                    onPress={() => navigate('ChatRoom', { roomId: room.id, title: room.title, color: room.color })}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.bullet}>•</Text>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {room.title}
                      </Text>
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
                </View>
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
  greetingCard: {
    // Figma 2111:15320 — x14 y81 w188 h33, radius 5
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    // Figma 2111:15265 — x15 y81 w195 h42, 글자 x28 (카드 기준 13)
    minHeight: s(42),
    paddingHorizontal: s(13),
    paddingVertical: s(5),
    borderRadius: s(5),
    backgroundColor: colors.surface,
  },
  greetingBody: {
    flex: 1,
  },
  greeting: {
    fontFamily: fontFamily.bold,
    fontSize: fs(11),
    lineHeight: fs(14.85),
    color: colors.textPrimary,
  },
  greetingSub: {
    /* 시안은 두 줄이 붙어 있지만 조금 띄우는 편이 읽기 편하다 */
    marginTop: s(2),
    fontFamily: fontFamily.body,
    fontSize: fs(6.3),
    lineHeight: fs(8.5),
    color: colors.textMuted,
  },
  banner: {
    marginTop: s(6),
  },
  /*
   * 시안 2111:15298 — 카드 x15 y244 w197 h108. 아래 값은 전부 카드 왼쪽/위 모서리
   * 기준의 상대 좌표다. 세로는 시안이 글자마다 leading 20 을 주고 박스를 겹쳐
   * 놓아서, 글자 상자 대신 "글자 중심선"을 맞춘 뒤 줄간격은 우리 규칙(폰트×1.35)
   * 으로 되돌렸다.
   */
  card: {
    // y244, 광고카드 하단(y222) 에서 22... 실제로는 배너 높이에 따라 밀린다
    marginTop: s(8),
    backgroundColor: colors.surface,
    borderRadius: s(10),
    // 제목이 카드 왼쪽에서 6 — 항목·구분선은 여기에 5 를 더 들여쓴다
    paddingHorizontal: s(6),
    paddingTop: s(10.75),
    paddingBottom: s(10.8),
  },
  cardTitle: {
    /* 시안은 w58 상자 안에서 가운데 정렬이라, 글자는 카드+6 보다 조금 안쪽에 선다 */
    width: s(58),
    textAlign: 'center',
    fontFamily: fontFamily.semibold,
    fontSize: fs(10),
    lineHeight: fs(13.5),
    color: colors.textPrimary,
  },
  addButton: {
    // x182 y250 w16 h15 — 카드 오른쪽에서 14, 위에서 6
    position: 'absolute',
    top: s(6),
    right: s(14),
    width: s(16),
    height: s(15),
    /* 사각형이 아니라 타원이다 (rx 8 / ry 7.5) */
    borderRadius: s(8),
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.button,
  },
  item: {
    // 제목 중심 y261.5 → 첫 항목 중심 y286
    marginTop: s(11),
  },
  itemNext: {
    // 구분선 y308 → 항목 중심 y325
    marginTop: s(9.2),
  },
  divider: {
    // x26 w174 — 카드 안쪽으로 5 더 들여쓴 자리
    marginTop: s(6.8),
    marginHorizontal: s(5),
    height: s(1),
    backgroundColor: colors.border,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    /* 불릿 칸이 여기서 시작한다 — 카드+11 */
    paddingLeft: s(5),
  },
  bullet: {
    /*
     * 시안은 list-disc + ms-13.5 라, 불릿이 글자 왼쪽 여백에 매달리고 제목은
     * 카드+24.5 에서 시작한다. 아래 날짜(카드+25)와 세로로 맞기 위한 구조다.
     */
    width: s(13.5),
    textAlign: 'right',
    paddingRight: s(2),
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    color: colors.textPrimary,
  },
  itemTitle: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: fs(9),
    lineHeight: fs(12.15),
    color: colors.textPrimary,
  },
  itemDate: {
    // 시안 x40 → 카드+25. 줄이 카드+6 에서 시작하므로 19 를 더한다
    marginTop: s(0.1),
    marginLeft: s(19),
    fontFamily: fontFamily.body,
    fontSize: fs(6.2),
    lineHeight: fs(8.37),
    color: colors.textSecondary,
  },
  badge: {
    /* 시안은 폭을 고정하지 않고 좌우 6 / 상하 2.5 여백으로 글자를 감싼다 */
    marginRight: s(6),
    paddingHorizontal: s(6),
    paddingVertical: s(2.5),
    borderRadius: s(5),
  },
  badgeToday: {
    backgroundColor: colors.primaryVivid,
  },
  badgeCountdown: {
    backgroundColor: colors.border,
  },
  badgeText: {
    fontFamily: fontFamily.semibold,
    fontSize: fs(6),
    lineHeight: fs(8.1),
  },
  badgeTextToday: {
    color: colors.textOnAccent,
  },
  badgeTextCountdown: {
    color: colors.textSecondary,
  },
  payNudge: {
    // y346, 카드 하단(y338) 에서 8 / 높이 34
    marginTop: s(8),
    height: s(34),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: s(0.6),
    borderColor: colors.primaryBorder,
    borderRadius: s(10),
    paddingHorizontal: s(11),
    ...shadows.button,
  },
  payTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fs(8),
    lineHeight: fs(10.8),
    color: colors.textPrimary,
  },
  paySub: {
    fontFamily: fontFamily.body,
    fontSize: fs(5.8),
    lineHeight: fs(7.8),
    color: colors.textMuted,
  },
  payLink: {
    fontFamily: fontFamily.semibold,
    fontSize: fs(6.5),
    lineHeight: fs(8.8),
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
