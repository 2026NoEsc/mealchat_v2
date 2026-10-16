import { AlertCircle, ChevronLeft, MoreVertical } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTopInset } from '../../theme/insets';

import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import CopyButton from '../../components/ui/CopyButton';
import FailureCard from '../../components/ui/FailureCard';
import SettleMember from '../../components/ui/SettleMember';
import TransferConfirmationSheet, { settlementUiError } from '../../components/ui/TransferConfirmationSheet';
import SettlementMoreSheet from '../../components/ui/SettlementMoreSheet';
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
import { v3Layout } from '../../theme/scale';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

type Status = 'loading' | 'ready' | 'error';

/** Settlement date comes from the existing bill creation timestamp. */
function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return (date.getMonth() + 1) + '월 ' + date.getDate() + '일 (' + ['일','월','화','수','목','금','토'][date.getDay()] + ')';
}

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
    if (status !== 'ready') return;
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
  const { goBack, navigate } = useNavigation();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);
  const completing = useRef(false);
  const [pending, setPending] = useState<{ settlementId: string; memberId: string } | null>(null);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [moreId, setMoreId] = useState<string | null>(null);
  useEffect(() => { setPending(null); setMoreId(null); setConfirmationError(null); }, [userId]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const { data, error } = await fetchMySettlementsDetailed();
      if (error) { setStatus('error'); return; }
      setSettlements(data ?? []);
      setStatus('ready');
    } catch { setStatus('error'); }
  }, []);

  useEffect(() => {
    if (!userId) return;
    void load();
  }, [userId, load]);

  /* 내 몫만 누를 수 있다. 남의 몫을 대신 표시하는 것은 정산 시트에 있다 */
  const toggleMine = async (member: SettlementMember) => {
    if (status !== 'ready' || completing.current || member.profileId !== userId) return;
    completing.current = true; setBusy(true); setConfirmationError(null);
    try {
      const error = await setSettlementCompleted(member.id, !member.isCompleted);
      if (error) {
        const message = settlementUiError(error);
        if (pending) setConfirmationError(message); else Alert.alert('변경 실패', message);
        return;
      }
      setPending(null); await load();
    } catch {
      if (pending) setConfirmationError('완료로 표시하지 못했어요. 다시 시도해 주세요.');
      else Alert.alert('변경 실패', '변경하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally { completing.current = false; setBusy(false); }
  };
  const chooseMember = (settlement: Settlement, member: SettlementMember) => {
    if (status !== 'ready' || busy || member.profileId !== userId || isSettled(settlement)) return;
    if (!member.isCompleted && settlement.creatorId !== userId) {
      setConfirmationError(null); setPending({ settlementId: settlement.id, memberId: member.id });
    } else void toggleMine(member);
  };
  const pendingSettlement = status === 'ready' ? settlements.find(item => item.id === pending?.settlementId) : undefined;
  const pendingMember = pendingSettlement?.members.find(member => member.id === pending?.memberId && member.profileId === userId && !member.isCompleted);
  const pendingRecipient = pendingSettlement?.members.find(member => member.profileId !== null && member.profileId === pendingSettlement.creatorId)?.name ?? null;
  const pendingAmount = pendingSettlement ? pendingSettlement.splitCount > 0 ? Math.ceil(pendingSettlement.totalAmount / pendingSettlement.splitCount) : pendingSettlement.totalAmount : 0;
  const moreSettlement = status === 'ready' ? settlements.find(item => item.id === moreId) ?? null : null;

  const open = settlements.filter((settlement) => !isSettled(settlement));
  const done = settlements.filter((settlement) => isSettled(settlement));
  return <View style={styles.screen}>
    <View style={{ height: topInset }} />
    <View style={styles.header}><Pressable onPress={goBack} style={styles.back} accessibilityRole="button" accessibilityLabel="뒤로"><ChevronLeft size={24} color={colors.ink} /></Pressable><Text style={styles.headerTitle}>정산</Text></View>
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <Text style={styles.summary}>{status === 'loading' ? '불러오는 중...' : status === 'error' ? '정산을 불러오지 못했어요' : settlements.length === 0 ? '아직 정산이 없어요' : '진행 중 ' + open.length + '건 · 완료 ' + done.length + '건'}</Text>
      {status === 'error' ? <FailureCard title="정산을 불러오지 못했어요" reason="정산 정보를 확인하지 못했어요. 다시 불러와 주세요." icon={<AlertCircle size={26} color={colors.sub} />} onRetry={() => void load()} /> : null}
      {status === 'error' && settlements.length > 0 ? <Text style={styles.small}>이전에 불러온 정산이에요</Text> : null}
      <View style={[styles.cards, status === 'error' && styles.stale]} pointerEvents={status === 'error' ? 'none' : 'auto'} accessibilityElementsHidden={status === 'error'} importantForAccessibility={status === 'error' ? 'no-hide-descendants' : 'auto'}>
      {[...open, ...done].map((settlement) => {
        const settled = isSettled(settlement);
        const each = settlement.splitCount > 0 ? Math.ceil(settlement.totalAmount / settlement.splitCount) : settlement.totalAmount;
        const recipient = settlement.members.find((member) => member.profileId !== null && member.profileId === settlement.creatorId)?.name;
        const destination = ['보낼 곳', recipient, settlement.accountHolder ? '예금주 ' + settlement.accountHolder : null].filter(Boolean).join(' · ');
        // TODO(서버 단계): 예금주나 정산자 이름이 없는 기록에는 추측한 이름을 표시하지 않는다.
        return <View key={settlement.id} style={[styles.card, !settled && styles.cardOpen]}>
          <View style={styles.cardHead}>
            <View style={styles.left}>
              <View style={styles.titleRow}><Text style={styles.title} numberOfLines={1}>{settlement.title}</Text><View style={[styles.status, settled && styles.statusDone]}><Text style={[styles.statusText, settled && styles.statusTextDone]}>{settled ? '완료' : '진행 중'}</Text></View></View>
              <Text style={styles.meta}>{dayLabel(settlement.createdAt)} · {settlement.roomTitle ?? '사라진 밥약'}</Text>
            </View>
            <View style={styles.amountBox}><Text style={styles.small}>1인당</Text><Text style={styles.each}>{formatAmount(each)}</Text><Text style={styles.small}>총 {formatAmount(settlement.totalAmount)}</Text></View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={settlement.title + ' 정산 더보기'} disabled={status !== 'ready' || busy} onPress={() => setMoreId(settlement.id)} style={styles.more}><MoreVertical size={22} color={colors.ink} /></Pressable>
          {!settled && settlement.bankName && settlement.accountNumber ? <>
            <View style={styles.accountBox}><View style={styles.left}><Text style={styles.small}>{destination}</Text><Text selectable style={styles.account}>{settlement.bankName} {settlement.accountNumber}</Text></View><CopyButton compact text={settlement.bankName + ' ' + settlement.accountNumber} accessibilityLabel="계좌 복사" failureHint="계좌번호를 길게 눌러 직접 복사해 주세요" /></View>
            {mineToPay(settlement, userId) ? <Button label="토스로 보내기" disabled={status !== 'ready'} onPress={() => void sendWithToss(settlement)} /> : null}
          </> : null}
          {settlement.members.length === 0 ? <Text style={styles.meta}>참가자를 불러오지 못했어요</Text> : <View>{settlement.members.map((member) => {
            const mine = member.profileId !== null && member.profileId === userId;
            return <SettleMember key={member.id} layout="row" name={member.name} seed={member.profileId ?? member.id} completed={member.isCompleted} mine={mine} disabled={!mine || busy || settled || status !== 'ready'} onPress={mine ? () => chooseMember(settlement, member) : undefined} />;
          })}</View>}
        </View>;
      })}
      </View>
    </ScrollView>
    <TransferConfirmationSheet visible={Boolean(pendingMember)} recipient={pendingRecipient} amount={pendingAmount} busy={busy} error={confirmationError} onClose={() => setPending(null)} onConfirm={() => { if (pendingMember) void toggleMine(pendingMember); }} />
    <SettlementMoreSheet settlement={moreSettlement} requester={Boolean(userId && moreSettlement?.creatorId === userId)} onClose={() => setMoreId(null)} onOpenChat={() => { if (moreSettlement?.roomId) { setMoreId(null); navigate('ChatRoom', { roomId: moreSettlement.roomId, title: moreSettlement.roomTitle ?? undefined }); } }} />
  </View>;
}
const styles = StyleSheet.create({
  more: { minWidth: 44, minHeight: 44, alignSelf: 'flex-end', marginVertical: -10, alignItems: 'center', justifyContent: 'center' },
  cards: { gap: 16 }, stale: { opacity: 0.45 },
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { minHeight: v3Layout.headerHeight, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 4 },
  back: { width: v3Layout.minTouchTarget, height: v3Layout.minTouchTarget, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 25, color: colors.ink },
  body: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40, gap: 14 },
  summary: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: colors.sub },
  card: { padding: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 16, gap: 14 },
  cardOpen: { borderColor: colors.primary, borderWidth: 1.5 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  left: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 24, color: colors.ink, flexShrink: 1 },
  status: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: colors.selectedBg },
  statusDone: { backgroundColor: colors.safeBg },
  statusText: { fontFamily: fontFamily.bold, fontSize: 12, lineHeight: 18, color: colors.selectedText },
  statusTextDone: { color: colors.safeText },
  meta: { marginTop: 4, fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.sub },
  amountBox: { alignItems: 'flex-end' },
  small: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 18, color: colors.sub },
  each: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 29, color: colors.ink },
  accountBox: { backgroundColor: colors.mutedBg, paddingLeft: 14, paddingRight: 8, paddingVertical: 10, borderRadius: 12, gap: 10, flexDirection: 'row', alignItems: 'center' },
  account: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22, color: colors.ink },
});
