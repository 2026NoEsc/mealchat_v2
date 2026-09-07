import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTopInset } from '../../theme/insets';

import { useAuth } from '../../auth/AuthProvider';
import AppHeader from '../../components/AppHeader';
import Avatar from '../../components/Avatar';
import ScreenHeader from '../../components/ScreenHeader';
import { notify } from '../../lib/confirm';
import { formatAmount } from '../../lib/format';
import {
  fetchMySettlementsDetailed,
  setSettlementCompleted,
  type Settlement,
  type SettlementMember,
} from '../../lib/settlements';
import { isSettled } from '../../lib/settlementSummary';
import { tossTransferUrl } from '../../lib/tossLink';
import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors, radii, shadows } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

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
/** 내가 아직 안 보낸 정산인지 */
function mineToPay(settlement: Settlement, userId: string | null): boolean {
  const mine = settlement.members.find((member) => member.profileId === userId);
  return Boolean(mine && !mine.isCompleted);
}

export default function SettlementsScreen() {
  /* 상태바 높이는 insets.top 만으로는 모자란 기기가 있다 */
  const topInset = useTopInset();

  /*
   * 토스를 열어 준다. 실제 송금은 토스 안에서 사용자가 확인하고 누른다 —
   * 앱이 대신 돈을 보내지 않는다.
   *
   * 스킴이 토스 공식 규격이 아니라 언제든 깨질 수 있다. 열리지 않으면
   * 계좌번호를 그대로 안내해서, 손으로 보내는 길이 막히지 않게 한다.
   */
  const sendWithToss = async (settlement: Settlement) => {
    const each =
      settlement.splitCount > 0
        ? Math.ceil(settlement.totalAmount / settlement.splitCount)
        : settlement.totalAmount;

    const url = tossTransferUrl({
      bankName: settlement.bankName,
      accountNumber: settlement.accountNumber,
      amount: each,
    });

    const account = `${settlement.bankName} ${settlement.accountNumber}`;

    if (!url) {
      notify('토스로 열 수 없어요', `${account}

계좌번호로 직접 보내 주세요.`);
      return;
    }

    /*
     * canOpenURL 로 미리 거르지 않는다. 스킴이 선언되지 않은 환경 — Expo Go,
     * 안드로이드 11+ 에서 매니페스트 queries 가 없는 빌드 — 에서는 토스가
     * 깔려 있어도 false 를 준다. 그 말을 믿고 막으면 멀쩡한 링크를 열어 보지도
     * 못한다. 어차피 열어 볼 것이라면 물어볼 이유가 없다.
     *
     * openURL 은 열 앱이 없으면 양쪽 OS 모두 거부하므로 catch 에서 걸린다.
     */
    try {
      await Linking.openURL(url);
    } catch {
      notify('토스를 열지 못했어요', `${account}

토스가 없다면 계좌번호로 직접 보내 주세요.`);
    }
  };
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
      {/* 상태바 자리. 배경을 칠하지 않아 화면 배경이 그대로 비친다 —
          헤더와 같은 색으로 칠하면 둘이 한 덩어리로 보여서 헤더가
          어디서 시작하는지 알 수 없다 */}
      <View style={{ height: topInset }} />
      <AppHeader />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* AppHeader 아래라 위 여백을 줄인다 */}
        <ScreenHeader title="정산" onBack={goBack} compact />

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
                  {/* 큰 숫자가 1인당인지 총액인지 헷갈리지 않게 이름을 붙인다 */}
                  <Text style={styles.eachLabel}>1인당</Text>
                  <Text style={styles.each}>{formatAmount(each)}</Text>
                  <Text style={styles.total}>총 {formatAmount(settlement.totalAmount)}</Text>
                </View>
              </View>

              {settlement.bankName && settlement.accountNumber ? (
                <>
                  {/*
                   * 계좌를 한 덩어리로 묶는다. 예전에는 송금 버튼과 한 줄에 놓여
                   * 서로 자리를 뺏었고, 계좌번호가 길면 잘렸다.
                   * 링크가 안 열릴 때 손으로 옮겨 적어야 하므로 늘 그대로 보인다.
                   */}
                  <View style={styles.accountBox}>
                    <Text style={styles.accountLabel}>보낼 곳</Text>
                    <Text style={styles.account} selectable>
                      {settlement.bankName} {settlement.accountNumber}
                    </Text>
                    {settlement.accountHolder ? (
                      <Text style={styles.accountHolder}>예금주 {settlement.accountHolder}</Text>
                    ) : null}
                  </View>

                  {/* 내가 보낼 차례일 때만 송금 버튼을 띄운다 */}
                  {mineToPay(settlement, userId) ? (
                    <Pressable
                      style={styles.tossButton}
                      onPress={() => void sendWithToss(settlement)}>
                      <Text style={styles.tossLabel}>토스로 보내기</Text>
                    </Pressable>
                  ) : null}
                </>
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
                        /* 전원이 보낸 뒤에는 되돌릴 수 없다 — 방이 이미 사라지는 중이다 */
                        disabled={!mine || busy || settled}
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
    marginTop: s(6),
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
    fontFamily: fontFamily.bold,
    fontSize: fs(9),
    lineHeight: fs(13),
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
  eachLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fs(6),
    lineHeight: fs(8.1),
    color: colors.textMuted,
  },
  each: {
    fontFamily: fontFamily.extrabold,
    fontSize: fs(11),
    lineHeight: fs(15),
    color: colors.primary,
  },
  total: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  accountBox: {
    marginTop: s(8),
    paddingHorizontal: s(9),
    paddingVertical: s(7),
    borderRadius: s(8),
    backgroundColor: colors.surface,
  },
  accountLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fs(6),
    lineHeight: fs(8.1),
    color: colors.textMuted,
  },
  account: {
    marginTop: s(2),
    fontFamily: fontFamily.bold,
    fontSize: fs(8),
    lineHeight: fs(11),
    color: colors.textPrimary,
  },
  accountHolder: {
    marginTop: s(1),
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textSecondary,
  },
  /* 토스 브랜드 색 — 앱 팔레트가 아니라 저쪽 앱으로 간다는 표시다 */
  tossButton: {
    marginTop: s(6),
    height: s(24),
    borderRadius: s(6),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0064FF',
  },
  tossLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fs(7.5),
    lineHeight: fs(10),
    color: colors.textOnAccent,
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
    fontFamily: fontFamily.bold,
    color: colors.primary,
  },
});
