import { CalendarPlus, Plus, Ticket } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTopInset } from '../theme/insets';

import AdCarousel from '../components/AdCarousel';
import JoinCodeSheet from '../components/JoinCodeSheet';
import PageHeader from '../components/PageHeader';
import RoomRow from '../components/RoomRow';
import { roomStatus } from '../lib/roomFormat';
import { useNavigation } from '../navigation/NavigationContext';
import { useMyProfile } from '../profile/useMyProfile';
import { useMyRooms, useMySettlements } from '../rooms/useMyRooms';
import { fs412, s412 } from '../theme/scale';
import { colors, shadows } from '../theme/tokens';
import { fontFamily } from '../theme/typography';

const banner = require('../../assets/ad/banner-1.png');

/*
 * 밥약이 하나도 없을 때 띄우는 그림 — 시안 2174:923 ~ 2174:926 (기본이미지 1~4).
 *
 * 넷 중 하나를 무작위로 고른다. 캐릭터도 말도 다 달라서, 늘 같은 그림이 뜨면
 * 비어 있는 화면이 더 비어 보인다.
 *
 * 크기는 시안이 그림마다 다르게 잡아 두었다. 한 값으로 묶으면 어떤 그림은
 * 커지고 어떤 그림은 작아져서 캐릭터 크기가 제각각으로 보인다.
 */
const EMPTY_ARTS = [
  { source: require('../../assets/brand/empty-rooms-1.png'), width: 307, height: 223 },
  { source: require('../../assets/brand/empty-rooms-2.png'), width: 292, height: 194 },
  { source: require('../../assets/brand/empty-rooms-3.png'), width: 294, height: 220 },
  { source: require('../../assets/brand/empty-rooms-4.png'), width: 300, height: 175 },
];

/**
 * Figma 홈/메인 (2169:782) — 412 x 892
 *
 * 인사 헤더 + 배너 + 정산 넛지 + 밥약 목록 + 새 밥약 버튼.
 *
 * 좌표: 헤더 y46 h80 / 배너 y126 h197 (좌우 여백 없음) /
 *       정산넛지 y317 h50 / 밥약 y392 h100 / 새 밥약 버튼 y752 45x45 /
 *       하단탭 y806
 */
export default function HomeScreen() {
  const { navigate } = useNavigation();
  /* 상태바 높이는 insets.top 만으로는 모자란 기기가 있다 */
  const topInset = useTopInset();
  const { bundle } = useMyProfile();
  const { rooms, status, reload } = useMyRooms();
  const settlements = useMySettlements();

  /*
   * 화면에 들어올 때 한 번만 고른다. 그릴 때마다 고르면 목록을 새로 읽거나
   * 글자가 바뀔 때마다 그림이 갈아끼워져 깜빡인다.
   */
  const emptyArt = useMemo(() => EMPTY_ARTS[Math.floor(Math.random() * EMPTY_ARTS.length)], []);

  /*
   * + 버튼을 누르면 위로 두 갈래가 펼쳐진다 — 새 밥약을 만들거나, 받은 초대
   * 코드로 들어가거나. 닫는 동안에도 버블이 남아 있어야 사라지는 모습이 보이므로
   * 펼침 상태(menuOpen)와 그림 여부(menuShown)를 따로 둔다.
   */
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuShown, setMenuShown] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const menu = useRef(new Animated.Value(0)).current;

  const toggleMenu = (next: boolean) => {
    setMenuOpen(next);
    if (next) setMenuShown(true);
    Animated.timing(menu, {
      toValue: next ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !next) setMenuShown(false);
    });
  };

  const pick = (action: () => void) => {
    toggleMenu(false);
    action();
  };

  /* + 가 × 로 돈다 */
  const fabRotate = menu.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });
  const bubbleStyle = {
    opacity: menu,
    transform: [{ translateY: menu.interpolate({ inputRange: [0, 1], outputRange: [s412(10), 0] }) }],
  };

  const name = bundle?.profile.name;
  /* 아직 끝나지 않은 밥약만 센다 */
  const activeRooms = rooms.filter((room) => roomStatus(room) !== 'expired');
  /* 전원이 송금을 끝낸 정산은 넛지에서 뺀다 */
  const openSettlements = settlements.filter((settlement) => !settlement.settled);

  const enterRoom = (roomId: string, title: string, color: string) =>
    navigate('ChatRoom', { roomId, title, color });

  return (
    <View style={styles.screen}>
      {/* 상태바 자리. 배경을 칠하지 않아 화면 배경이 그대로 비친다 —
          헤더와 같은 색으로 칠하면 둘이 한 덩어리로 보여서 헤더가
          어디서 시작하는지 알 수 없다 */}
      <View style={{ height: topInset }} />

      {/* 홈에서는 헤더 자리에 인사가 들어간다 — 시안 2169:785 */}
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
                ? '아직 잡힌 밥약이 없어요.'
                : `현재 밥약 ${activeRooms.length}건, 정산 ${openSettlements.length}건이 기다리고 있어요~`}
        </Text>
      </PageHeader>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 시안 2169:821 — 화면 폭을 꽉 채운다. 여백은 그림에 그려져 있다 */}
        <AdCarousel images={[banner]} />

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
          <View style={styles.emptyWrap}>
            <Image
              source={emptyArt.source}
              style={{ width: s412(emptyArt.width), height: s412(emptyArt.height) }}
              resizeMode="contain"
            />
          </View>
        ) : (
          <View style={styles.roomList}>
            {rooms.map((room, i) => (
              <View key={room.id} style={i > 0 ? styles.roomGap : null}>
                <RoomRow room={room} onPress={() => enterRoom(room.id, room.title, room.color)} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {menuShown ? (
        <>
          {/* 바깥을 누르면 접힌다 */}
          <Animated.View style={[styles.menuBackdrop, { opacity: menu }]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => toggleMenu(false)}
              accessibilityLabel="메뉴 닫기"
            />
          </Animated.View>

          <Animated.View style={[styles.menu, bubbleStyle]} pointerEvents={menuOpen ? 'auto' : 'none'}>
            <Pressable
              style={({ pressed }) => [styles.bubble, pressed && styles.bubblePressed]}
              onPress={() => pick(() => setJoinOpen(true))}
              accessibilityRole="button">
              <Text style={styles.bubbleText}>초대 코드 입력</Text>
              <View style={styles.bubbleIcon}>
                <Ticket size={s412(18)} color={colors.primary} strokeWidth={2.4} />
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.bubble, styles.bubbleGap, pressed && styles.bubblePressed]}
              onPress={() => pick(() => navigate('ScheduleDetail'))}
              accessibilityRole="button">
              <Text style={styles.bubbleText}>밥약 만들기</Text>
              <View style={styles.bubbleIcon}>
                <CalendarPlus size={s412(18)} color={colors.primary} strokeWidth={2.4} />
              </View>
            </Pressable>
          </Animated.View>
        </>
      ) : null}

      {/* 새 밥약 — 시안 2169:839 (45 x 45, 우하단). 누르면 두 갈래 버블이 펼쳐진다 */}
      <Pressable
        style={styles.fab}
        hitSlop={s412(10)}
        accessibilityRole="button"
        accessibilityLabel={menuOpen ? '메뉴 닫기' : '새 밥약 또는 초대 코드'}
        accessibilityState={{ expanded: menuOpen }}
        onPress={() => toggleMenu(!menuOpen)}>
        <Animated.View style={{ transform: [{ rotate: fabRotate }] }}>
          <Plus size={s412(24)} color={colors.textOnAccent} strokeWidth={3} />
        </Animated.View>
      </Pressable>

      <JoinCodeSheet
        visible={joinOpen}
        onClose={() => setJoinOpen(false)}
        onJoined={(roomId) => navigate('ChatRoom', { roomId })}
      />
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
    fontSize: fs412(20),
    lineHeight: fs412(27),
    color: colors.textPrimary,
  },
  greetingSub: {
    marginTop: s412(4),
    fontFamily: fontFamily.body,
    fontSize: fs412(10),
    lineHeight: fs412(13.5),
    color: colors.iconMuted,
  },
  content: {
    /* 빈 상태에서 일러스트를 아래로 밀어붙이려면 내용이 화면을 채워야 한다 */
    flexGrow: 1,
    // 헤더 하단(y126) 에 배너가 바로 붙는다
    paddingTop: 0,
    paddingBottom: s412(70),
  },
  /*
   * 정산 넛지 y317. 배너 하단은 y323 이지만 그림 아래쪽에 여백이 그려져
   * 있어 시안이 6 만큼 끌어올려 두었다.
   */
  payNudge: {
    marginTop: s412(-6),
    marginHorizontal: s412(11),
    height: s412(50),
    borderRadius: s412(10),
    borderWidth: s412(1),
    borderColor: colors.primaryBorder,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    /* 왼쪽을 오른쪽 여백(17.37) 과 맞춰 글이 테두리에 붙어 보이지 않게 한다 */
    paddingLeft: s412(18),
    paddingRight: s412(17.37),
    ...shadows.button,
  },
  /* 시안은 12 인데 넛지 높이(50) 에 비해 글이 작아 보여 한 단계 키웠다 */
  payTitle: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: fs412(14),
    lineHeight: fs412(18.9),
    color: colors.textPrimary,
  },
  payAction: {
    fontFamily: fontFamily.semibold,
    fontSize: fs412(14),
    lineHeight: fs412(18.9),
    color: colors.primaryVivid,
  },
  // 첫 밥약 y392 — 넛지 하단(y367) 에서 25
  roomList: {
    marginTop: s412(25),
    marginHorizontal: s412(11),
  },
  roomGap: {
    marginTop: s412(11),
  },
  empty: {
    marginTop: s412(19),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs412(13),
    lineHeight: fs412(19),
    color: colors.textMuted,
  },
  /* 남는 공간을 다 밀어내고 아래쪽에 붙인다 */
  emptyWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  /* + 버튼 바로 위, 오른쪽 끝을 버튼과 맞춘다 (버튼 하단 21 + 높이 45 + 간격 12) */
  menu: {
    position: 'absolute',
    right: s412(23),
    bottom: s412(21 + 45 + 12),
    alignItems: 'flex-end',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    height: s412(44),
    paddingLeft: s412(18),
    paddingRight: s412(5),
    borderRadius: s412(999),
    backgroundColor: colors.card,
    ...shadows.button,
  },
  bubbleGap: {
    marginTop: s412(10),
  },
  bubblePressed: {
    opacity: 0.85,
  },
  bubbleText: {
    fontFamily: fontFamily.bold,
    fontSize: fs412(14),
    lineHeight: fs412(19),
    color: colors.textPrimary,
  },
  bubbleIcon: {
    marginLeft: s412(10),
    width: s412(34),
    height: s412(34),
    borderRadius: s412(999),
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: s412(23),
    /* 시안은 하단탭에서 9 인데 탭에 붙어 보여 조금 띄웠다 */
    bottom: s412(21),
    width: s412(45),
    height: s412(45),
    borderRadius: s412(999),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.button,
  },
  retryBox: {
    alignItems: 'center',
  },
  retryButton: {
    marginTop: s412(-11),
    paddingHorizontal: s412(15),
    paddingVertical: s412(6),
    borderRadius: s412(11),
    backgroundColor: colors.primarySoft,
  },
  retryText: {
    fontFamily: fontFamily.bold,
    fontSize: fs412(11),
    lineHeight: fs412(15),
    color: colors.primary,
  },
});
