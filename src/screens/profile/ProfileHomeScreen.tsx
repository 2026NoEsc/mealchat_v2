import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/AuthProvider';
import AppHeader from '../../components/AppHeader';
import Avatar from '../../components/Avatar';
import {
  countLikedTastes,
  formatAccount,
  formatBirthDate,
  formatGender,
} from '../../lib/format';
import { useNavigation } from '../../navigation/NavigationContext';
import type { RouteName } from '../../navigation/routes';
import { useMyProfile } from '../../profile/useMyProfile';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';


type InfoRow = { label: string; value: string; danger?: boolean };

type Step = { done: boolean; label: string; action: string; route?: RouteName };

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
  const { navigate } = useNavigation();
  const { signOut } = useAuth();
  const { status, bundle } = useMyProfile();

  const privateProfile = bundle?.privateProfile;
  const likedTastes = countLikedTastes(privateProfile?.tastes);
  const account = formatAccount(privateProfile?.bankName, privateProfile?.accountNumber);
  const birth = formatBirthDate(privateProfile?.birthDate);
  const gender = formatGender(privateProfile?.personalData.gender);

  /* 값이 없으면 채워야 할 곳으로 보이게 danger 로 표시한다 */
  const info: InfoRow[] = [
    { label: '생년월일', value: birth ?? '아직 설정 안됨', danger: !birth },
    { label: '성별', value: gender ?? '아직 설정 안됨', danger: !gender },
    { label: '송금 계좌', value: account ?? '아직 설정 안됨', danger: !account },
    {
      label: '음식 취향',
      value: likedTastes > 0 ? `${likedTastes}개 선택함` : '아직 설정 안됨',
      danger: likedTastes === 0,
    },
  ];

  const steps: Step[] = [
    { done: Boolean(account), label: '송금 계좌 등록', action: '설정하기', route: 'ProfileEdit' },
    { done: false, label: '사는 곳 설정', action: '설정하기', route: 'Origin' },
    { done: likedTastes > 0, label: '음식 취향 매칭', action: '게임 시작', route: 'TasteGame' },
  ];
  const doneCount = steps.filter((step) => step.done).length;

  const confirmDelete = () =>
    Alert.alert('계정 삭제 준비 중', '본인 재인증과 기록 보존 정책이 준비된 뒤 제공됩니다.', [
      { text: '확인' },
    ]);

  const handleSignOut = async () => {
    const error = await signOut();
    if (error) Alert.alert('로그아웃 실패', error.message);
  };

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />
      <AppHeader />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {/* 아바타·이름을 누르면 프로필 수정 (309:1086) 으로 들어간다 */}
          <Pressable style={styles.identity} onPress={() => navigate('ProfileEdit')}>
            <Avatar
              name={bundle?.profile.name ?? '?'}
              color={bundle?.profile.avatarColor ?? colors.primary}
              url={bundle?.profile.avatarUrl}
              size={s(46)}
              radius={s(12)}
            />
            <Text style={styles.name}>
              {status === 'ready' && bundle ? bundle.profile.name : '불러오는 중'}
            </Text>
            <Text style={styles.bio}>
              {status === 'ready' && bundle ? `@${bundle.profile.tag}` : ' '}
            </Text>
          </Pressable>

          <View style={styles.infoList}>
            {info.map((row) => (
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
            <Text style={styles.completeCount}>
              {doneCount} / {steps.length} 단계
            </Text>
          </View>

          <View style={styles.track}>
            {/* 진행 막대는 실제 완료 개수를 따른다 */}
            <View style={[styles.fill, { flex: doneCount, minWidth: 0 }]} />
            <View style={{ flex: steps.length - doneCount }} />
          </View>

          {steps.map((step) => (
            <View key={step.label} style={styles.stepRow}>
              <Text style={[styles.stepMark, step.done && styles.stepMarkDone]}>
                {step.done ? '✓' : '○'}
              </Text>
              <Text style={styles.stepLabel}>{step.label}</Text>
              <Pressable
                style={[styles.badge, step.done ? styles.badgeDone : styles.badgeAction]}
                disabled={!step.route}
                onPress={() => step.route && navigate(step.route)}>
                <Text style={[styles.badgeText, step.done ? styles.badgeTextDone : styles.badgeTextAction]}>
                  {step.done ? '완료됨' : step.action}
                </Text>
              </Pressable>
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
          <Pressable onPress={() => void handleSignOut()}>
            <Text style={styles.logout}>로그아웃</Text>
          </Pressable>
          <Pressable onPress={confirmDelete}>
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
  identity: {
    alignItems: 'center',
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
