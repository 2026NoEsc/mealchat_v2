import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/AuthProvider';
import AppHeader from '../../components/AppHeader';
import Avatar from '../../components/Avatar';
import ScreenHeader from '../../components/ScreenHeader';
import { formatAmount } from '../../lib/format';
import {
  fetchMySettlementsDetailed,
  setSettlementCompleted,
  type Settlement,
  type SettlementMember,
} from '../../lib/settlements';
import { isSettled } from '../../lib/settlementSummary';
import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors, radii, shadows } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

type Status = 'loading' | 'ready' | 'error';

/** `2026-08-19T16:26:38Z` → `8월 19일` */
function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * 정산 목록.
 *
 * 지금까지 정산을 볼 수 있는 곳은 채팅방의 N빵 시트뿐이었다. 정산은 방보다 오래
 * 남는데 (dutch_pay_bills.room_id 는 on delete set null) 방이 사라지면 그 시트로
 * 갈 방법이 없어서, 돈을 주고받아야 하는 기록이 통째로 잠겼다.
 *
 * Figma 에 대응하는 화면이 없어 앱의 다른 화면 규칙을 따랐다 — ScreenHeader 뒤로가기,
 * 흰 카드에 radii.card, 강조는 primary, 금액은 오른쪽 정렬.
 */
export default function SettlementsScreen() {
  const insets = useSafeAreaInsets();
  const { goBack } = useNavigation();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await fetchMySettlementsDetailed();
    if (error) {
      setStatus('error');
      return;
    }
    setSettlements(data ?? []);
    setStatus('ready');
  }, []);

  useEffect(() => {
    if (!userId) return;
    void load();
  }, [userId, load]);

  /* 내 몫만 누를 수 있다. 남의 몫을 대신 표시하는 것은 정산 시트에 있다 */
  const toggleMine = async (member: SettlementMember) => {
    setBusy(true);
    const error = await setSettlementCompleted(member.id, !member.isCompleted);
    setBusy(false);

    if (error) {
      Alert.alert('변경 실패', error.message);
      return;
    }
    await load();
  };

  const open = settlements.filter((settlement) => !isSettled(settlement));
  const done = settlements.filter((settlement) => isSettled(settlement));
  const myTurn = open.filter((settlement) =>
    settlement.members.some((member) => member.profileId === userId && !member.isCompleted),
  );

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />
      <AppHeader />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="정산" onBack={goBack} />

        <Text style={styles.summary}>
          {status === 'loading'
            ? '불러오는 중...'
            : status === 'error'
              ? '정산을 불러오지 못했어요'
              : settlements.length === 0
                ? '아직 정산이 없어요'
                : myTurn.length > 0
                  ? `보낼 정산 ${myTurn.length}건 · 진행 중 ${open.length}건`
                  : `진행 중 ${open.length}건 · 끝난 정산 ${done.length}건`}
        </Text>

        {/* 아직 돈이 오갈 것이 남은 정산을 위에 둔다 */}
        {[...open, ...done].map((settlement) => {
          const settled = isSettled(settlement);
          const each =
            settlement.splitCount > 0
              ? Math.ceil(settlement.totalAmount / settlement.splitCount)
              : settlement.totalAmount;

          return (
            <View
              key={settlement.id}
              style={[styles.card, settled ? styles.cardDone : styles.cardOpen]}>
              <View style={styles.cardHead}>
                <View style={styles.flex}>
                  <Text style={styles.title} numberOfLines={1}>
                    {settlement.title}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {/* 방이 사라져도 정산은 남는다. 그 사실을 감추지 않는다 */}
                    {settlement.roomTitle ?? '사라진 밥약'} · {dayLabel(settlement.createdAt)}
                  </Text>
                </View>

                <View style={styles.amountBox}>
                  <Text style={styles.each}>{formatAmount(each)}</Text>
                  <Text style={styles.total}>총 {formatAmount(settlement.totalAmount)}</Text>
                </View>
              </View>

              {settlement.bankName && settlement.accountNumber ? (
                <Text style={styles.account} numberOfLines={1}>
                  {settlement.bankName} {settlement.accountNumber}
                  {settlement.accountHolder ? ` · ${settlement.accountHolder}` : ''}
                </Text>
              ) : null}

              {settlement.members.length === 0 ? (
                <Text style={styles.memberEmpty}>참가자를 불러오지 못했어요</Text>
              ) : (
                <View style={styles.members}>
                  {settlement.members.map((member) => {
                    const mine = member.profileId !== null && member.profileId === userId;
                    return (
                      <Pressable
                        key={member.id}
                        style={[styles.member, member.isCompleted && styles.memberDone]}
                        disabled={!mine || busy}
                        onPress={() => void toggleMine(member)}>
                        <Avatar
                          name={member.name}
                          color={member.isCompleted ? colors.primary : colors.surfaceStrong}
                          size={s(16)}
                        />
                        <Text style={styles.memberName} numberOfLines={1}>
                          {member.name}
                          {mine ? ' (나)' : ''}
                        </Text>
                        <Text
                          style={[
                            styles.memberState,
                            member.isCompleted && styles.memberStateDone,
                          ]}>
                          {member.isCompleted ? '완료' : mine ? '눌러서 완료' : '대기'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
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
    paddingBottom: s(16),
  },
  flex: {
    flex: 1,
  },
  summary: {
    marginTop: s(10),
    marginHorizontal: s(18),
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: colors.textMuted,
  },
  card: {
    marginTop: s(8),
    marginHorizontal: s(11.5),
    padding: s(11),
    borderRadius: s(radii.card),
    backgroundColor: colors.card,
    ...shadows.card,
  },
  /* 아직 남은 정산만 테두리로 끌어올린다 */
  cardOpen: {
    borderWidth: s(0.6),
    borderColor: colors.primary,
  },
  cardDone: {
    borderWidth: s(0.6),
    borderColor: colors.border,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(8),
  },
  title: {
    fontFamily: fontFamily.body,
    fontSize: fs(9),
    lineHeight: fs(13),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  meta: {
    marginTop: s(2),
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  amountBox: {
    alignItems: 'flex-end',
  },
  each: {
    fontFamily: fontFamily.body,
    fontSize: fs(11),
    lineHeight: fs(15),
    fontWeight: weight.extrabold,
    color: colors.primary,
  },
  total: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  account: {
    marginTop: s(6),
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textPrimary,
  },
  memberEmpty: {
    marginTop: s(8),
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  members: {
    marginTop: s(8),
    gap: s(4),
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    height: s(24),
    paddingHorizontal: s(7),
    borderRadius: s(6),
    backgroundColor: colors.surface,
  },
  memberDone: {
    backgroundColor: colors.primarySoft,
  },
  memberName: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: colors.textPrimary,
  },
  memberState: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  memberStateDone: {
    fontWeight: weight.bold,
    color: colors.primary,
  },
});
