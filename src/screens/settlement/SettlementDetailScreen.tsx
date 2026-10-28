import ReceiptCaptureFlow, { type ReceiptDraft } from './ReceiptCaptureFlow';
import { CalendarDays, Check, ChevronLeft, Clock3, MapPin, MoreVertical, Wallet } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, BackHandler, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import FailureCard from '../../components/ui/FailureCard';
import SettlementMoreSheet from '../../components/ui/SettlementMoreSheet';
import TransferConfirmationSheet from '../../components/ui/TransferConfirmationSheet';
import { getConsentAccess, hasConsentAccess, registerSensitiveConsentClearer, subscribeConsentAccess } from '../../consents/access';
import { formatAmount } from '../../lib/format';
import { characterIndexOf } from '../../lib/defaultAvatar';
import { canToggleSettlementMember, settlementCompletionError } from '../../lib/settlementAccess';
import { fetchSettlementDetail, setSettlementCompleted, subscribeSettlementPayments, type Settlement, type SettlementMember } from '../../lib/settlements';
import { isSettled } from '../../lib/settlementSummary';
import { useNavigation } from '../../navigation/NavigationContext';
import { settlementDetailBackRoute } from '../../navigation/routes';
import { useTopInset } from '../../theme/insets';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import SettlementPaymentAccount from './SettlementPaymentAccount';
import SettlementStatusConfirmationSheet from './SettlementStatusConfirmationSheet';

const MEMBER_ARTS = [require('../../../assets/brand/moa.png'), require('../../../assets/brand/ddori.png'), require('../../../assets/brand/dudu.png'), require('../../../assets/brand/welling2.png')];

function dateLabel(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '약속 날짜 확인 불가';
  const day = new Date(value + 'T00:00:00Z');
  return `${day.getUTCMonth() + 1}월 ${day.getUTCDate()}일 (${['일', '월', '화', '수', '목', '금', '토'][day.getUTCDay()]})`;
}

/** Figma 588:2024/2320 and 541:1617/588:1860; IDs determine identity and authority. */
export default function SettlementDetailScreen() {
  const { user } = useAuth();
  const { current, replace, goBack, canGoBack } = useNavigation();
  const billId = typeof current.params?.billId === 'string' ? current.params.billId : null;
  const userId = user?.id ?? null, key = `${userId ?? ''}:${billId ?? ''}`;
  const [view, setView] = useState<{ key: string; status: 'loading' | 'ready' | 'error'; data: Settlement | null }>({ key: '', status: 'loading', data: null });
  const consent = useSyncExternalStore(subscribeConsentAccess, getConsentAccess);
  const allowed = consent.userId === userId && consent.state === 'accepted';
  const [busy, setBusy] = useState(false), [pendingChange, setPendingChange] = useState<{ memberId: string; completed: boolean; kind: 'transfer' | 'finish' | 'undo' | 'requester-undo' } | null>(null);
  const [closedKey, setClosedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null), [more, setMore] = useState(false);
  const active = useRef(key), mounted = useRef(true), generation = useRef(0), operation = useRef(false);
  const invalidate = useCallback(() => { generation.current++; }, []);
  active.current = key;
  const settlement = allowed && view.key === key && view.status === 'ready' && view.data
    ? { ...view.data, paymentDisclosureClosed: view.data.paymentDisclosureClosed || closedKey === key } : null;
  const closed = Boolean(settlement && (settlement.paymentDisclosureClosed || isSettled(settlement)));
  const status = view.key === key ? view.status : 'loading';
  const load = useCallback(async () => {
    const ticket = ++generation.current;
    if (!billId || !userId || !hasConsentAccess(userId)) { setView({ key, status: 'error', data: null }); return; }
    try {
      const result = await fetchSettlementDetail(billId);
      if (!mounted.current || active.current !== key || ticket !== generation.current || !hasConsentAccess(userId)) return;
      setView({ key, status: result.error || !result.data ? 'error' : 'ready', data: result.error ? null : result.data });
    } catch {
      if (mounted.current && active.current === key && ticket === generation.current) setView({ key, status: 'error', data: null });
    }
  }, [billId, userId, key]);
  useEffect(() => {
    mounted.current = true; setPendingChange(null); setMore(false); setError(null); setBusy(false);
    setView({ key, status: 'loading', data: null }); void load();
    return () => { mounted.current = false; invalidate(); };
  }, [key, allowed, load, invalidate]);
  useEffect(() => {
    const app = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    const unsubscribe = subscribeSettlementPayments(() => { void load(); });
    const clear = registerSensitiveConsentClearer(() => {
      generation.current++; setView({ key, status: 'error', data: null }); setPendingChange(null); setMore(false);
    });
    return () => { app.remove(); unsubscribe(); clear(); };
  }, [key, load]);
  const requester = Boolean(userId && settlement?.creatorId === userId);
  const back = () => {
    if (busy) return;
    const destination = settlementDetailBackRoute(requester, settlement?.roomId ?? null);
    if (canGoBack && current.params?.entry === destination.name) goBack();
    else replace(destination.name, destination.params);
  };
  const toggle = async (member: SettlementMember, confirmed = false, completed = !member.isCompleted) => {
    if (active.current !== key || !hasConsentAccess(userId) || !settlement || closed || operation.current || !canToggleSettlementMember(settlement.creatorId, member.profileId, userId)) return;
    if (member.isCompleted === completed) { setPendingChange(null); return; }
    const lastWaiting = completed && settlement.members.filter(item => !item.isCompleted).length === 1;
    const kind = requester ? !completed ? 'requester-undo' : lastWaiting ? 'finish' : null : completed ? 'transfer' : 'undo';
    if (kind && !confirmed) { setError(null); setPendingChange({ memberId: member.id, completed, kind }); return; }
    operation.current = true; setBusy(true); setError(null);
    try {
      const failure = await setSettlementCompleted(member.id, completed);
      if (!mounted.current || active.current !== key || !hasConsentAccess(userId)) return;
      if (failure) {
        if ((failure as Error & { code?: string }).code === 'S1005') { setClosedKey(key); setPendingChange(null); await load(); }
        if (!mounted.current || active.current !== key || !hasConsentAccess(userId)) return;
        setError(settlementCompletionError(failure)); return;
      }
      setPendingChange(null); await load();
    } catch { if (mounted.current && active.current === key && hasConsentAccess(userId)) setError(settlementCompletionError(null)); }
    finally { operation.current = false; if (mounted.current && active.current === key) setBusy(false); }
  };
  const pending = !closed && settlement?.members.find(member => member.id === pendingChange?.memberId && member.isCompleted !== pendingChange.completed);
  const closeConfirmation = () => { if (!busy) { setPendingChange(null); setError(null); } };
  const confirmChange = () => { if (pending && pendingChange) void toggle(pending, true, pendingChange.completed); };
  const recipient = settlement?.members.find(member => member.profileId !== null && member.profileId === settlement.creatorId)?.name ?? null;
  const each = settlement ? settlement.splitCount > 0 ? Math.ceil(settlement.totalAmount / settlement.splitCount) : settlement.totalAmount : 0;
  const openChat = () => {
    if (settlement?.roomId) { setMore(false); replace('ChatRoom', { roomId: settlement.roomId }); }
  };
  return <SettlementDetailView settlement={settlement} userId={userId} status={status} busy={busy} error={pending ? null : error}
    onBack={back} onMore={() => setMore(true)} onOpenChat={openChat} onRetry={() => void load()} onToggle={member => void toggle(member)}>
    <TransferConfirmationSheet visible={Boolean(pending && pendingChange?.kind === 'transfer')} recipient={recipient} amount={each} busy={busy} error={error}
      onClose={closeConfirmation} onConfirm={confirmChange} />
    <SettlementStatusConfirmationSheet kind={pending && pendingChange?.kind !== 'transfer' ? pendingChange?.kind ?? null : null} busy={busy} error={error} onClose={closeConfirmation} onConfirm={confirmChange} />
    <SettlementMoreSheet settlement={more ? settlement : null} requester={requester} onClose={() => setMore(false)} onOpenChat={openChat} onLocalAction={({ action }) => {
      if (!settlement?.roomId) return;
      setMore(false);
      replace('ChatRoom', { roomId: settlement.roomId, localSettlementAction: action === 'cancel' ? 'cancel-prepared' : 'edit-prepared' });
    }} />
  </SettlementDetailView>;
}

export function SettlementDetailView({ settlement, userId, status, busy, error, onBack, onMore, onOpenChat, onRetry, onToggle, children }: {
  settlement: Settlement | null; userId: string | null; status: 'loading' | 'ready' | 'error'; busy: boolean; error: string | null;
  onBack: () => void; onMore: () => void; onOpenChat: () => void; onRetry: () => void; onToggle: (member: SettlementMember) => void; children?: React.ReactNode;
}) {
  const top = useTopInset(), { bottom } = useSafeAreaInsets();
  const [expensesExpanded, setExpensesExpanded] = useState(false);
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [capture, setCapture] = useState(false), [receipt, setReceipt] = useState<ReceiptDraft | null>(null), [reminder, setReminder] = useState('');
  useEffect(() => { setExpensesExpanded(false); setIncompleteOnly(false); setCapture(false); setReceipt(null); setReminder(''); }, [settlement?.id, userId]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => back.remove();
  }, [onBack]);
  const requester = Boolean(userId && settlement?.creatorId === userId), allPaid = Boolean(settlement && isSettled(settlement));
  const done = Boolean(settlement?.paymentDisclosureClosed || allPaid);
  const members = settlement?.members ?? [], completed = members.filter(member => member.isCompleted).length;
  const orderedMembers = [...members].sort((a, b) => Number(b.profileId !== null && b.profileId === userId) - Number(a.profileId !== null && a.profileId === userId));
  const mine = members.find(member => member.profileId !== null && member.profileId === userId);
  const recipient = members.find(member => member.profileId !== null && member.profileId === settlement?.creatorId);
  const each = settlement ? settlement.splitCount > 0 ? Math.ceil(settlement.totalAmount / settlement.splitCount) : settlement.totalAmount : 0;
  if (capture) return <ReceiptCaptureFlow onClose={() => setCapture(false)} onDraft={setReceipt} />;
  return <View style={styles.screen}>
    <View style={{ height: top }} />
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="뒤로" disabled={busy} onPress={onBack} style={styles.iconButton}><ChevronLeft size={24} color={colors.ink} /></Pressable>
      <Text style={styles.heading}>정산</Text>
      {settlement ? <Pressable accessibilityRole="button" accessibilityLabel="정산 더보기" disabled={busy} onPress={onMore} style={styles.iconButton}><MoreVertical size={24} color={colors.ink} /></Pressable> : null}
    </View>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      {status === 'loading' ? <Text style={styles.note}>정산을 불러오고 있어요</Text> : null}
      {status === 'error' ? <FailureCard title="정산을 불러오지 못했어요" reason="볼 수 있는 정산인지 확인하고 다시 불러와 주세요." onRetry={onRetry} /> : null}
      {settlement ? <>
        <View testID="settlement-summary" style={[styles.card, styles.summary]}>
          <View style={styles.titleRow}><Text style={styles.title} numberOfLines={2}>{settlement.roomTitle ?? settlement.title}</Text><View style={[styles.badge, done && styles.safe]}><Text style={[styles.state, done && styles.safeText]}>{done ? '완료' : '진행 중'}</Text></View></View>
          {/* [결정] 약속 시간이 없는 조회 결과에 생성 시각을 약속 시간으로 대신 표시하지 않는다. */}
          <View style={styles.meta}><CalendarDays size={14} color={colors.sub} /><Text style={styles.note}>{dateLabel(settlement.meetingDate)}</Text><MapPin size={14} color={colors.sub} /><Text style={[styles.note, styles.location]} numberOfLines={1}>{settlement.locationName ?? '장소 정보 없음'}</Text></View>
          <View style={styles.amounts}><View style={styles.grow}><Text style={styles.small}>총 금액</Text><Text style={styles.amount}>{formatAmount(settlement.totalAmount)}</Text></View><View style={styles.right}><Text style={styles.small}>1인당 ({settlement.splitCount}명)</Text><Text style={[styles.amount, styles.accent]}>{formatAmount(each)}</Text></View></View>
          <View style={styles.progress}><View style={styles.progressRow}><Text style={styles.note}>정산 현황</Text><Text style={styles.progressText}>{allPaid ? `${members.length}명 모두 완료` : `${members.length}명 중 ${completed}명 완료`}</Text></View><View accessibilityRole="progressbar" accessibilityLabel="정산 완료 현황" accessibilityValue={{ min: 0, max: members.length, now: completed }} style={styles.track}><View style={[styles.fill, { width: `${members.length ? completed / members.length * 100 : 0}%` }]} /></View></View>
        </View>
        <View testID="settlement-expenses-empty" style={[styles.card, styles.empty]}>
          {receipt ? <>
            <Text style={styles.emptyTitle}>지출 내역 · 로컬 초안</Text>
            <Button variant="text" label={expensesExpanded ? '지출 내역 접기' : '지출 내역 펼치기'} onPress={() => setExpensesExpanded(!expensesExpanded)} />
            {expensesExpanded && <View style={{ alignSelf: 'stretch', gap: 6 }}><Text style={styles.emptyTitle}>{receipt.merchant}</Text>{receipt.items?.map((item, i) => <View key={`${item.name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}><Text style={[styles.note, { flex: 1 }]}>{item.name}</Text><Text style={styles.small}>x{item.quantity}</Text><Text style={styles.note}>{item.amount.toLocaleString('ko-KR')}원</Text></View>)}<Text style={styles.note}>합계 {receipt.amount.toLocaleString('ko-KR')}원 · 실제 정산에 반영되지 않았어요</Text></View>}
          </> : <><Image source={require('./assets/receipt-empty.png')} style={styles.receipt} accessible={false} /><Text style={styles.emptyTitle}>지출 내역이 아직 없어요</Text></>}
          <Button variant="secondary" label="영수증 찍어서 올리기" onPress={() => setCapture(true)} />
        </View>
        <View testID="settlement-members" style={[styles.card, styles.members]}>
          <View style={styles.tabs}>
            <Pressable accessibilityRole="tab" accessibilityLabel="전체" accessibilityState={{ selected: !incompleteOnly }} onPress={() => setIncompleteOnly(false)} style={[styles.tab, !incompleteOnly && styles.selected]}><Text style={[styles.tabLabel, !incompleteOnly && styles.selectedText]}>전체</Text></Pressable>
            <Pressable accessibilityRole="tab" accessibilityLabel="미완료" accessibilityState={{ selected: incompleteOnly }} onPress={() => setIncompleteOnly(true)} style={[styles.tab, incompleteOnly && styles.selected]}><Text style={[styles.tabLabel, incompleteOnly && styles.selectedText]}>미완료</Text><View style={styles.count}><Text style={styles.small}>{members.length - completed}</Text></View></Pressable>
          </View>
          <View style={styles.grid}>{orderedMembers.filter(member => !incompleteOnly || !member.isCompleted).map(member => {
            const receiver = member.profileId !== null && member.profileId === settlement.creatorId;
            const actionable = !done && !receiver && canToggleSettlementMember(settlement.creatorId, member.profileId, userId);
            const Icon = receiver ? Wallet : member.isCompleted ? Check : Clock3;
            const label = receiver ? '받는 사람' : member.isCompleted ? '완료' : '대기';
            const content = <><View style={[styles.avatar, receiver ? styles.receiverBorder : member.isCompleted && styles.doneBorder]}><Image source={MEMBER_ARTS[characterIndexOf(member.profileId ?? member.id, MEMBER_ARTS.length)]} style={styles.memberArt} resizeMode="contain" accessible={false} /></View><Text numberOfLines={1} style={styles.memberName}>{member.name}{member.profileId === userId ? ' (나)' : ''}</Text><View style={[styles.badge, receiver ? styles.receiver : member.isCompleted && styles.safe]}><Icon size={12} color={receiver ? colors.sub : member.isCompleted ? colors.safeText : colors.selectedText} /><Text style={[styles.state, receiver ? styles.note : member.isCompleted && styles.safeText]}>{label}</Text></View>{requester && actionable ? <Text style={styles.hint}>{member.isCompleted ? '다시 누르면 대기' : '눌러서 완료'}</Text> : null}</>;
            return actionable ? <Pressable key={member.id} accessibilityRole="button" accessibilityLabel={`${member.name}${member.profileId === userId ? ' (나)' : ''}, ${label}`} accessibilityHint={member.isCompleted ? '누르면 대기로 변경' : '누르면 완료로 변경'} accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => onToggle(member)} style={({ pressed }) => [styles.member, pressed && styles.pressed]}>{content}</Pressable> : <View key={member.id} style={styles.member}>{content}</View>;
          })}</View>
          {!members.length ? <Text style={styles.note}>참여자를 확인하지 못했어요</Text> : incompleteOnly && completed === members.length ? <Text style={styles.note}>모두 완료했어요</Text> : null}
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </> : null}
    </ScrollView>
    {settlement ? <View style={[styles.footer, { paddingBottom: 24 + bottom }]}>
      {/* [결정] S6/S7 계약 없는 재알림·취소·금액/멤버 수정은 버튼 자체를 노출하지 않는다. */}
      {requester && !done ? <><Text style={styles.small}>서버 연결 대기 · 알림은 전송되지 않아요.</Text><Button label="미완료 메이트 모두에게 알리기" onPress={() => setReminder('전체 재알림 요청 준비 · 서버 연결 대기')} />{members.filter(m => !m.isCompleted && m.profileId !== settlement.creatorId).map(m => <Button key={m.id} variant="text" label={`${m.name}에게 알리기`} onPress={() => setReminder(`${m.name} 재알림 요청 준비 · 서버 연결 대기`)} />)}{!!reminder && <Text accessibilityRole="alert" style={styles.small}>{reminder}</Text>}<Text style={styles.small}>보낸 메이트를 누르면 완료로 바꿀 수 있어요.</Text></> : null}
      {/* [결정] 영수증 보존은 S6/S7 대상이므로 완료 상태에서 보존·방 삭제 시각을 약속하지 않는다. */}
      {done ? <><View style={styles.success}><Check size={20} color={colors.safeText} /><View style={styles.grow}><Text style={styles.successTitle}>{allPaid ? '정산이 끝났어요. 모두 정산을 완료했어요.' : '정산이 종료됐어요.'}</Text><Text style={styles.successNote}>정산 계좌 공개가 끝났어요.</Text></View></View>{settlement.roomId ? <Button label="채팅방으로 가기" disabled={busy} onPress={onOpenChat} /> : null}</> : null}
      {!requester && mine?.isCompleted && !done ? <View style={styles.success}><Check size={20} color={colors.safeText} /><View style={styles.grow}><Text style={styles.successTitle}>{recipient?.name ? `${recipient.name}에게 보냈다고 알렸어요` : '보냈다고 알렸어요'}</Text><Text style={styles.successNote}>다른 메이트가 보내면 정산이 끝나요.</Text></View></View> : null}
      {/* [결정] S1 결정 ②: 참여자는 본인 송금 후에도 전체 정산 종료 전까지 계좌를 볼 수 있다. 전체 종료 시 조회·복사·송금을 닫는다. */}
      {!requester && mine && !done ? <SettlementPaymentAccount key={settlement.id + ':' + userId} billId={settlement.id} amount={each} recipient={recipient?.name} canSend={!mine.isCompleted} disabled={busy} presentation="detail" onTransferOpened={() => { if (!mine.isCompleted) onToggle(mine); }} /> : null}
      {/* [결정] 외부 앱의 송금 성공은 추정하지 않는다. 직접 송금한 참여자도 이 버튼으로 확인한다. */}
      {!requester && mine && !mine.isCompleted && !done ? <Button variant="text" label="송금했어요" disabled={busy} onPress={() => onToggle(mine)} /> : null}
    </View> : null}
    {children}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, scroll: { flex: 1 },
  header: { height: 60, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }, iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 25, color: colors.ink },
  body: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20, gap: 12 }, card: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface },
  summary: { padding: 16, gap: 12 }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, title: { flexShrink: 1, fontFamily: fontFamily.bold, fontSize: 18, lineHeight: 26, color: colors.ink },
  badge: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: colors.selectedBg },
  state: { fontFamily: fontFamily.bold, fontSize: 12, lineHeight: 17, color: colors.selectedText }, safe: { backgroundColor: colors.safeBg }, safeText: { color: colors.safeText }, receiver: { backgroundColor: colors.mutedBg },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 }, location: { flex: 1 }, note: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.sub }, small: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17, color: colors.sub },
  amounts: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', backgroundColor: colors.mutedBg }, grow: { flex: 1 }, right: { alignItems: 'flex-end' }, amount: { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 32, color: colors.ink }, accent: { color: colors.selectedText },
  progress: { gap: 6 }, progressRow: { flexDirection: 'row', justifyContent: 'space-between' }, progressText: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 19, color: colors.ink }, track: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.border }, fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary }, fillDone: { backgroundColor: colors.safeText },
  empty: { paddingHorizontal: 16, paddingVertical: 20, alignItems: 'center', gap: 10 }, receipt: { width: 72, height: 72 }, emptyTitle: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22, color: colors.ink },
  members: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 12 }, tabs: { flexDirection: 'row', gap: 4 }, tab: { minWidth: 44, minHeight: 44, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4, borderBottomWidth: 2, borderBottomColor: colors.surface }, selected: { borderBottomColor: colors.ink }, tabLabel: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: colors.sub }, selectedText: { fontFamily: fontFamily.bold, color: colors.ink }, count: { paddingHorizontal: 6, borderRadius: 8, backgroundColor: colors.mutedBg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }, member: { width: '25%', alignItems: 'center', gap: 4, paddingHorizontal: 1 }, avatar: { width: 52, height: 52, borderWidth: 2, borderRadius: 26, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, receiverBorder: { borderColor: colors.border }, doneBorder: { borderColor: colors.safeText },
  memberName: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 19, color: colors.ink }, hint: { fontFamily: fontFamily.body, fontSize: 11, lineHeight: 16, color: colors.sub }, pressed: { opacity: 0.65 },
  memberArt: { width: 48, height: 48 },
  footer: { paddingHorizontal: 20, paddingTop: 12, gap: 8, backgroundColor: colors.bg }, success: { backgroundColor: colors.safeBg, borderRadius: 12, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }, successTitle: { fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 20, color: colors.safeText }, successNote: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.safeText }, error: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: v3FeedbackColors.error },
});
