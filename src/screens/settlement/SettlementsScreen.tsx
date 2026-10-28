import { AlertCircle, ChevronLeft, MoreVertical } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTopInset } from '../../theme/insets';

import { useAuth } from '../../auth/AuthProvider';
import FailureCard from '../../components/ui/FailureCard';
import { TextButton } from '../../components/ui/Button';
import SettleMember from '../../components/ui/SettleMember';
import TransferConfirmationSheet from '../../components/ui/TransferConfirmationSheet';
import SettlementMoreSheet from '../../components/ui/SettlementMoreSheet';
import { formatAmount } from '../../lib/format';
import { notify } from '../../lib/confirm';
import {
  fetchMySettlementsDetailed,
  setSettlementCompleted,
  type Settlement,
  type SettlementMember,
} from '../../lib/settlements';
import { isSettled } from '../../lib/settlementSummary';
import { settlementCompletionError } from '../../lib/settlementAccess';
import SettlementPaymentAccount from './SettlementPaymentAccount';
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

  const { resetTo, navigate } = useNavigation();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const currentOwner = useRef(userId); currentOwner.current = userId;
  const mounted = useRef(true), loadVersion = useRef(0);
  const invalidateLoad = useCallback(() => { loadVersion.current++; }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; invalidateLoad(); }; }, [invalidateLoad]);
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);
  const completing = useRef(false);
  const [pending, setPending] = useState<{ settlementId: string; memberId: string } | null>(null);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all');
  const [moreId, setMoreId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null | undefined>(undefined);
  useEffect(() => { setPending(null); setMoreId(null); setConfirmationError(null); setFilter('all'); }, [userId]);

  const load = useCallback(async () => {
    const owner = currentOwner.current, ticket = ++loadVersion.current;
    setStatus('loading');
    try {
      const { data, error } = await fetchMySettlementsDetailed();
      if (!mounted.current || currentOwner.current !== owner || ticket !== loadVersion.current) return;
      if (error) { setStatus('error'); return; }
      setSettlements(data ?? []);
      setExpandedId(current => current === undefined ? data?.find(item => !isSettled(item))?.id ?? null : current && data?.some(item => item.id === current) ? current : null);
      setOwnerId(owner);
      setStatus('ready');
    } catch { if (mounted.current && currentOwner.current === owner && ticket === loadVersion.current) setStatus('error'); }
  }, []);

  useEffect(() => {
    setSettlements([]); setOwnerId(null); setExpandedId(undefined);
    if (!userId) return;
    void load();
  }, [userId, load]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'active' && currentOwner.current) void load(); });
    return () => listener.remove();
  }, [load]);

  /* 내 몫만 누를 수 있다. 남의 몫을 대신 표시하는 것은 정산 시트에 있다 */
  const toggleMine = async (member: SettlementMember) => {
    if (status !== 'ready' || completing.current || member.profileId !== userId) return;
    completing.current = true; setBusy(true); setConfirmationError(null);
    try {
      const error = await setSettlementCompleted(member.id, !member.isCompleted);
      if (!mounted.current || currentOwner.current !== userId) return;
      if (error) {
        const message = settlementCompletionError(error);
        if (pending) setConfirmationError(message); else notify('변경 실패', message);
        return;
      }
      setPending(null); await load();
    } catch {
      if (!mounted.current || currentOwner.current !== userId) return;
      if (pending) setConfirmationError(settlementCompletionError(null));
      else notify('변경 실패', settlementCompletionError(null));
    } finally { completing.current = false; if (mounted.current) setBusy(false); }
  };
  const chooseMember = (settlement: Settlement, member: SettlementMember) => {
    if (status !== 'ready' || busy || member.profileId !== userId || isSettled(settlement)) return;
    if (!member.isCompleted && settlement.creatorId !== userId) {
      setConfirmationError(null); setPending({ settlementId: settlement.id, memberId: member.id });
    } else void toggleMine(member);
  };
  const pendingSettlement = ownerId === userId && status === 'ready' ? settlements.find(item => item.id === pending?.settlementId) : undefined;
  const pendingMember = pendingSettlement?.members.find(member => member.id === pending?.memberId && member.profileId === userId && !member.isCompleted);
  const pendingRecipient = pendingSettlement?.members.find(member => member.profileId !== null && member.profileId === pendingSettlement.creatorId)?.name ?? null;
  const pendingAmount = pendingSettlement ? pendingSettlement.splitCount > 0 ? Math.ceil(pendingSettlement.totalAmount / pendingSettlement.splitCount) : pendingSettlement.totalAmount : 0;
  const moreSettlement = ownerId === userId && status === 'ready' ? settlements.find(item => item.id === moreId) ?? null : null;

  const ownedSettlements = ownerId === userId ? settlements : [];
  const open = ownedSettlements.filter((settlement) => !isSettled(settlement));
  const done = ownedSettlements.filter((settlement) => isSettled(settlement));
  return <View style={styles.screen}>
    <View style={{ height: topInset }} />
    {/* [결정] Figma E0396은 정산 목록(521:1575)의 뒤로가기를 홈(521:1248)으로 연결하므로 Home으로 복귀한다. */}
    <View style={styles.header}><Pressable onPress={() => resetTo('Home')} style={styles.back} accessibilityRole="button" accessibilityLabel="뒤로"><ChevronLeft size={24} color={colors.ink} /></Pressable><Text style={styles.headerTitle}>정산</Text></View>
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <Text style={styles.summary}>{status === 'loading' ? '불러오는 중...' : status === 'error' ? '정산을 불러오지 못했어요' : settlements.length === 0 ? '아직 정산이 없어요' : '진행 중 ' + open.length + '건 · 완료 ' + done.length + '건'}</Text>
      <View style={styles.filters}>{([['all', '전체'], ['open', '진행 중'], ['done', '완료']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`정산 ${label}`} accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.filterSelected]}><Text style={[styles.filterText, filter === value && styles.filterSelectedText]}>{label}</Text></Pressable>)}</View>
      {status === 'ready' && ownedSettlements.length > 0 && !(filter === 'open' ? open : filter === 'done' ? done : ownedSettlements).length ? <Text style={styles.summary}>선택한 상태의 정산이 없어요</Text> : null}
      {status === 'error' ? <FailureCard title="정산을 불러오지 못했어요" reason="정산 정보를 확인하지 못했어요. 다시 불러와 주세요." icon={<AlertCircle size={26} color={colors.sub} />} onRetry={() => void load()} /> : null}
      {status === 'error' && settlements.length > 0 ? <Text style={styles.small}>이전에 불러온 정산이에요</Text> : null}
      <View style={[styles.cards, status === 'error' && styles.stale]} pointerEvents={status === 'error' ? 'none' : 'auto'} accessibilityElementsHidden={status === 'error'} importantForAccessibility={status === 'error' ? 'no-hide-descendants' : 'auto'}>
      {(filter === 'open' ? open : filter === 'done' ? done : [...open, ...done]).map((settlement) => {
        const settled = isSettled(settlement);
        const each = settlement.splitCount > 0 ? Math.ceil(settlement.totalAmount / settlement.splitCount) : settlement.totalAmount;
        return <View key={settlement.id} style={[styles.card, !settled && styles.cardOpen]}>
          <View style={styles.cardHead}>
            <View style={styles.left}>
              <View style={styles.titleRow}><Text style={styles.title} numberOfLines={1}>{settlement.title}</Text><View style={[styles.status, settled && styles.statusDone]}><Text style={[styles.statusText, settled && styles.statusTextDone]}>{settled ? '완료' : '진행 중'}</Text></View></View>
              <Text style={styles.meta}>{dayLabel(settlement.createdAt)} · {settlement.roomTitle ?? '사라진 밥약'}</Text>
            </View>
            <View style={styles.amountBox}><Text style={styles.small}>1인당</Text><Text style={styles.each}>{formatAmount(each)}</Text><Text style={styles.small}>총 {formatAmount(settlement.totalAmount)}</Text></View>
          </View>
          <TextButton label="정산 상세 보기" accessibilityLabel={settlement.title + ' 정산 상세 보기'} onPress={() => navigate('SettlementDetail', { billId: settlement.id, entry: 'Settlements' })} />
          <Pressable accessibilityRole="button" accessibilityLabel={settlement.title + ' 정산 더보기'} disabled={status !== 'ready' || busy} onPress={() => setMoreId(settlement.id)} style={styles.more}><MoreVertical size={22} color={colors.ink} /></Pressable>
          {!settled ? <TextButton label={expandedId === settlement.id ? '정산 계좌 접기' : '정산 계좌 보기'} accessibilityLabel={settlement.title + (expandedId === settlement.id ? ' 정산 계좌 접기' : ' 정산 계좌 보기')} onPress={() => setExpandedId(expandedId === settlement.id ? null : settlement.id)} /> : null}
          {settled || expandedId === settlement.id ? <SettlementPaymentAccount billId={settlement.id} amount={each} recipient={settlement.members.find(member => member.profileId !== null && member.profileId === settlement.creatorId)?.name} canSend={mineToPay(settlement, userId)} disabled={status !== 'ready' || busy} completed={settled} /> : null}
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
  filters: { flexDirection: 'row', gap: 8 }, filter: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, filterSelected: { borderColor: colors.primary, backgroundColor: colors.selectedBg }, filterText: { fontFamily: fontFamily.medium, fontSize: 14, color: colors.ink }, filterSelectedText: { color: colors.selectedText },
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
