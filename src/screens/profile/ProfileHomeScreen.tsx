import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppHeader from '../../components/AppHeader';
import { useNavigation } from '../../navigation/NavigationContext';
import type { RouteName } from '../../navigation/routes';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

const avatar = require('../../../assets/brand/moa.png');

type InfoRow = { label: string; value: string; danger?: boolean };

const INFO: InfoRow[] = [
  { label: '생년월일', value: '2002년 12월 20일' },
  { label: '성별', value: '남성' },
  { label: '송금 계좌', value: '카카오뱅크 1111' },
  { label: '음식 취향', value: '아직 설정 안됨', danger: true },
];

type Step = { done: boolean; label: string; action: string };

const STEPS: Step[] = [
  { done: true, label: '프로필 이모지 수정', action: '완료됨' },
  { done: false, label: '사는 곳 설정', action: '설정하기' },
  { done: false, label: '음식 취향 매칭', action: '게임 시작' },
];

const LINKS: { label: string; route: RouteName }[] = [
  { label: '일정 입력하기', route: 'Schedule' },
  { label: '내 친구 관리', route: 'Friends' },
  { label: '정보 공개 범위 설정', route: 'Privacy' },
];

/**
 * Figma 프로필/프로필 홈 (159:544) — 220 x 486
 * body x11.5 y82 w197 / 카드 y82 h145, y233 h98, y337 h71.2 / 푸터 y414
 */
export default function ProfileHomeScreen() {
  const insets = useSafeAreaInsets();
  const { navigate, resetTo } = useNavigation();

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />
      <AppHeader />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.avatarBox}>
            <Image source={avatar} style={styles.avatar} resizeMode="contain" />
          </View>
          <Text style={styles.name}>나야나#433</Text>
          <Text style={styles.bio}>&ldquo;오늘도 맛있는 하루&rdquo;</Text>

          <View style={styles.infoList}>
            {INFO.map((row) => (
              <View key={row.label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={[styles.infoValue, row.danger && styles.infoValueDanger]}>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.card, styles.cardSpacing]}>
          <View style={styles.completeHeader}>
            <Text style={styles.completeTitle}>🎉 계정 완성하기</Text>
            <Text style={styles.completeCount}>1 / 3 단계</Text>
          </View>

          <View style={styles.track}>
            {/* fill 60 / track 179 */}
            <View style={styles.fill} />
          </View>

          {STEPS.map((step) => (
            <View key={step.label} style={styles.stepRow}>
              <Text style={[styles.stepMark, step.done && styles.stepMarkDone]}>
                {step.done ? '✓' : '○'}
              </Text>
              <Text style={styles.stepLabel}>{step.label}</Text>
              <View style={[styles.badge, step.done ? styles.badgeDone : styles.badgeAction]}>
                <Text style={[styles.badgeText, step.done ? styles.badgeTextDone : styles.badgeTextAction]}>
                  {step.action}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.card, styles.cardSpacing, styles.linkCard]}>
          {LINKS.map((link, i) => (
            <Pressable
              key={link.label}
              style={[styles.linkRow, i > 0 && styles.linkDivider]}
              onPress={() => navigate(link.route)}>
              <Text style={styles.linkLabel}>{link.label}</Text>
              <Text style={styles.linkArrow}>→</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.footer}>
          <Pressable onPress={() => resetTo('Login')}>
            <Text style={styles.logout}>로그아웃</Text>
          </Pressable>
          <Pressable>
            <Text style={styles.deleteAccount}>계정 삭제</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceSunken,
  },
  body: {
    // body x11.5 w197, 헤더 하단(y73) → 카드(y82)
    paddingHorizontal: s(11.5),
    paddingTop: s(9),
    paddingBottom: s(16),
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: s(10),
    paddingHorizontal: s(9),
    paddingTop: s(8),
    paddingBottom: s(8),
  },
  cardSpacing: {
    marginTop: s(6),
  },
  avatarBox: {
    // ph x9 y8 안의 av x71.5 y2 36×36 → 카드 중앙
    alignSelf: 'center',
    marginTop: s(2),
    width: s(36),
    height: s(36),
    borderRadius: s(8),
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: s(25.92),
    height: s(28.08),
  },
  name: {
    // ph 기준 y40
    marginTop: s(2),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(11),
    lineHeight: fs(14),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  bio: {
    marginTop: s(2),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  infoList: {
    // ph 하단(y77) → 첫 행(y80)
    marginTop: s(11),
    gap: s(3),
  },
  infoRow: {
    height: s(12),
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: colors.textMuted,
  },
  infoValue: {
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  infoValueDanger: {
    color: colors.danger,
  },
  completeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completeTitle: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    lineHeight: fs(11),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  completeCount: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  track: {
    // y23 h4, 폭 179
    marginTop: s(4),
    height: s(4),
    borderRadius: s(4),
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  fill: {
    width: `${(60 / 179) * 100}%`,
    height: '100%',
    borderRadius: s(4),
    backgroundColor: colors.primary,
  },
  stepRow: {
    // y31 부터 21 간격, 높이 17
    marginTop: s(4),
    height: s(17),
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepMark: {
    width: s(11),
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: colors.textMuted,
  },
  stepMarkDone: {
    color: colors.primary,
    fontWeight: weight.bold,
  },
  stepLabel: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(7.5),
    lineHeight: fs(10),
    color: colors.textPrimary,
  },
  badge: {
    height: s(13),
    paddingHorizontal: s(6),
    borderRadius: s(4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDone: {
    backgroundColor: colors.surfaceSunken,
  },
  badgeAction: {
    backgroundColor: colors.primarySoft,
  },
  badgeText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(9),
    fontWeight: weight.bold,
  },
  badgeTextDone: {
    color: colors.textMuted,
  },
  badgeTextAction: {
    color: colors.primary,
  },
  linkCard: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  linkRow: {
    height: s(18),
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkDivider: {
    borderTopWidth: s(0.6),
    borderTopColor: colors.border,
  },
  linkLabel: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(7.5),
    lineHeight: fs(10),
    color: colors.textPrimary,
  },
  linkArrow: {
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  footer: {
    // y414, 카드3 하단(y408) 에서 6
    marginTop: s(6),
    paddingHorizontal: s(6),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logout: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  deleteAccount: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    fontWeight: weight.bold,
    color: colors.danger,
  },
});
