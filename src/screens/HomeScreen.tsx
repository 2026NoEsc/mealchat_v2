import { Paperclip, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AdCarousel from '../components/AdCarousel';
import AppHeader from '../components/AppHeader';
import NotificationPanel from '../components/NotificationPanel';
import { CompleteButton } from '../components/ui/Button';
import { useNavigation } from '../navigation/NavigationContext';
import { fs, s } from '../theme/scale';
import { colors, radii } from '../theme/tokens';
import { fontFamily, weight } from '../theme/typography';

const banner = require('../../assets/ad/banner-1.png');

type UpcomingItem = {
  title: string;
  date: string;
  badge: string;
  badgeTone: 'today' | 'countdown';
};

const UPCOMING: UpcomingItem[] = [
  {
    title: '오늘 점심팟',
    date: '2026년 8월 13일 · 버거킹 하단점',
    badge: '오늘',
    badgeTone: 'today',
  },
  {
    title: '학회 회식',
    date: '2026년 8월 21일 · 조선칼국수 하단점',
    badge: 'D-8',
    badgeTone: 'countdown',
  },
];

/**
 * Figma 홈/메인 (309:1064) — 220 x 483
 * 좌표: 헤더 y30 / 인사 y82 / 서브 y98 / 광고카드 y113 h109 /
 * 다가올일정 y230 h108 / 정산넛지 y346 h34 / CTA y397 h28 / 하단탭 y445
 */
export default function HomeScreen() {
  const { navigate } = useNavigation();
  const insets = useSafeAreaInsets();
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />
      <AppHeader hasUnread onPressBell={() => setShowNotifications(true)} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.greeting}>안녕하세요, 모아님!</Text>
        <Text style={styles.greetingSub}>현재 밥약 1건, 정산 1건이 기다리고 있어요~</Text>

        <View style={styles.banner}>
          <AdCarousel images={[banner]} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.clip}>
              <Paperclip size={s(13)} color={colors.textPrimary} strokeWidth={2} />
            </View>
            <Text style={styles.cardTitle}>다가올 일정</Text>
            <Pressable style={styles.addButton} hitSlop={s(6)}>
              <Plus size={s(9)} color={colors.textOnAccent} strokeWidth={3} />
            </Pressable>
          </View>

          {UPCOMING.map((item, i) => (
            <View key={item.title} style={i > 0 ? styles.itemDivided : styles.item}>
              <View style={styles.itemHeader}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <View
                  style={[
                    styles.badge,
                    item.badgeTone === 'today' ? styles.badgeToday : styles.badgeCountdown,
                  ]}>
                  <Text
                    style={[
                      styles.badgeText,
                      item.badgeTone === 'today'
                        ? styles.badgeTextToday
                        : styles.badgeTextCountdown,
                    ]}>
                    {item.badge}
                  </Text>
                </View>
              </View>
              <Text style={styles.itemDate}>{item.date}</Text>
            </View>
          ))}
        </View>

        <Pressable style={styles.payNudge}>
          <View style={styles.flex}>
            <Text style={styles.payTitle}>미완료 정산 1건</Text>
            <Text style={styles.paySub}>방이 사라져도 정산 내역은 남아 있어요</Text>
          </View>
          <Text style={styles.payLink}>보기 →</Text>
        </Pressable>

        <CompleteButton
          label="일정잡기"
          style={styles.cta}
          onPress={() => navigate('Schedule')}
        />
      </ScrollView>

      {showNotifications ? (
        <NotificationPanel onClose={() => setShowNotifications(false)} />
      ) : null}
    </View>
  );
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
  cta: {
    // y397, 정산 넛지 하단(y380) 에서 17
    marginTop: s(17),
    marginHorizontal: s(2),
  },
});
