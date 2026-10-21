import { Check, Info, Wallet } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import Avatar from '../../components/Avatar';
import BottomSheet from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { chatFeedbackColors } from '../../components/ui/chatTokens';
import FailureCard from '../../components/ui/FailureCard';
import InviteCodeBox from '../../components/ui/InviteCodeBox';
import { MateInviteContent, inviteSubtitle } from '../../components/ui/MateInviteSheet';
import MateProfileSheet from '../../components/ui/MateProfileSheet';
import RoomMemberRow from '../../components/ui/RoomMemberRow';
import SettleMember from '../../components/ui/SettleMember';
import Toast, { useToast } from '../../components/ui/Toast';
import { settlementUiError, TransferConfirmationContent } from '../../components/ui/TransferConfirmationSheet';
import { notify } from '../../lib/confirm';
import { formatAmount } from '../../lib/format';
import { settlementCompletionError } from '../../lib/settlementAccess';
import type { RoomParticipant, RoomStage } from '../../lib/rooms';
import { canStartSettlement, settlementConfirmationRequired, unverifiedSettlementLabel } from '../../lib/roomSettlementPolicy';
import { canEditSettlement, createRoomSettlement, fetchRoomSettlements, setSettlementCompleted, type Settlement, type SettlementMember } from '../../lib/settlements';
import { createRoomSettlementWithSnapshot, prepareRoomSettlement, settlementRecipientNotice } from '../../lib/roomLifecycleController';
import { fetchS3Capabilities } from '../../lib/roomLifecycle';
import { pickActiveSettlement } from '../../lib/settlementSummary';
import { useNavigation } from '../../navigation/NavigationContext';
import { useMyProfile } from '../../profile/useMyProfile';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { useSettlementPayment } from '../settlement/useSettlementPayment';
import { SettlementPaymentAccountView } from '../settlement/SettlementPaymentAccount';
import { SettlementStatusConfirmationContent } from '../settlement/SettlementStatusConfirmationSheet';

type SheetProps = { visible: boolean; onClose: () => void; onStateChanged?: () => void };
/** Phone 527:1747 / 562:1879 / 590:1896. Existing amount and mutation contracts remain unchanged. */
export function SettlementSheet({ visible, roomId, roomStage = null, appointmentConfirmedAt, decisionMode, participants = [], onClose, onStateChanged }: SheetProps & { roomId: string | null; roomStage?: RoomStage | null; appointmentConfirmedAt?: string | null; decisionMode?: 'legacy' | 's4'; participants?: RoomParticipant[] }) {
  const { user } = useAuth(); const { bundle, status: profileStatus, reload: reloadProfile } = useMyProfile(); const { navigate, replace, current } = useNavigation();
  const params = current?.params as { settlementAmountText?: string; awaitingSettlementAccount?: boolean } | undefined;
  const [storedSettlement, setSettlement] = useState<Settlement | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const sheetKey = `${roomId ?? ''}:${user?.id ?? ''}`;
  const settlement = loadedKey === sheetKey ? storedSettlement : null;
  const [amountText, setAmountText] = useState(params?.settlementAmountText ?? '');
  const [busy, setBusy] = useState(false); const operation = useRef(false);
  const mounted = useRef(true), currentRoom = useRef(roomId), currentUser = useRef(user?.id);
  currentRoom.current = roomId; currentUser.current = user?.id;
  const currentStage = useRef(roomStage); currentStage.current = roomStage;
  const currentOwnerConfirmed = useRef(Boolean(appointmentConfirmedAt)); currentOwnerConfirmed.current = Boolean(appointmentConfirmedAt);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [pendingMember, setPendingMember] = useState<SettlementMember | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  useEffect(() => { setPendingMember(null); setCompletionError(null); }, [visible, roomId, user?.id]);
  const [reloadToken, setReloadToken] = useState(0); const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const { height } = useWindowDimensions();
  const { showToast, toastProps } = useToast(); const accountToastShown = useRef(false);
  useEffect(() => { if (visible) reloadProfile?.(); }, [visible, reloadProfile]);
  useEffect(() => {
    if (!visible || !roomId) { setSettlement(null); return; }
    let active = true; setLoadStatus('loading');
    void fetchRoomSettlements(roomId).then(({ data, error }) => {
      if (!active) return;
      if (error) { setLoadStatus('error'); return; }
      const picked = pickActiveSettlement(data ?? [], user?.id ?? null);
      // Once a bill exists, its server total takes precedence over a returned creation draft.
      setSettlement(picked); setLoadedKey(sheetKey); if (picked) setAmountText(String(picked.totalAmount)); setLoadStatus('ready');
    }).catch(() => { if (active) setLoadStatus('error'); });
    return () => { active = false; };
  }, [visible, roomId, reloadToken, user?.id, params?.settlementAmountText, sheetKey]);
  const amount = Number(amountText.replace(/[^0-9]/g, '')) || 0;
  const members = settlement?.members ?? [];
  const finished = members.length > 0 && members.every(member => member.isCompleted);
  const payment = useSettlementPayment(settlement?.id ?? null, visible && loadStatus === 'ready' && !finished);
  const disclosureClosed = payment.data?.status === 'completed';
  const canCreate = canStartSettlement(roomStage, Boolean(appointmentConfirmedAt));
  const editable = !settlement && canEditSettlement(settlement, user?.id ?? null) && canCreate;
  const unverifiedLabel = roomStage ? unverifiedSettlementLabel(roomStage, Boolean(appointmentConfirmedAt), decisionMode === 's4') : null;
  const settlementParticipants = participants.filter(participant => participant.profileId !== null);
  const splitCount = settlement?.splitCount ?? members.length ?? 1;
  const each = splitCount > 0 ? Math.ceil(amount / splitCount) : amount;
  // Match the settlement list: completion always confirms the loaded bill, never an input draft.
  const confirmationAmount = settlement ? settlement.splitCount > 0 ? Math.ceil(settlement.totalAmount / settlement.splitCount) : settlement.totalAmount : 0;
  const bankName = bundle?.privateProfile.bankName ?? null;
  const accountNumber = bundle?.privateProfile.accountNumber ?? null;
  const hasAccount = Boolean(bankName && accountNumber);
  // Display only the final four digits; keep the original account in the mutation payload.
  const accountDigits = accountNumber?.replace(/\D/g, '') ?? '';
  const accountTail = accountDigits.length >= 4 ? accountDigits.slice(-4) : '';
  const maskedAccount = accountTail ? '•••• ' + accountTail : '계좌 등록됨';
  const accountAccessibilityLabel = accountTail ? '계좌 끝자리 ' + accountTail : '계좌 등록됨';
  useEffect(() => {
    if (visible && params?.awaitingSettlementAccount && hasAccount && editable && loadStatus === 'ready' && !accountToastShown.current) {
      accountToastShown.current = true; showToast({ message: '계좌를 등록했어요. 이제 정산 요청을 보낼 수 있어요.' });
    }
  }, [visible, params?.awaitingSettlementAccount, hasAccount, editable, loadStatus, showToast]);
  const request = async () => {
    if (settlement || !roomId || amount <= 0 || !editable || !hasAccount || operation.current || loadStatus !== 'ready') return;
    operation.current = true; setBusy(true);
    try {
      if (!mounted.current || currentRoom.current !== roomId || currentUser.current !== user?.id) return;
      if (!settlement && !canStartSettlement(currentStage.current, currentOwnerConfirmed.current)) return;
      const payload = { roomId, title: '식사 정산', amount, bankName, accountNumber, accountHolder: bundle?.profile.name ?? null };
      let billId: string | null = null;
      let error: Error | null = null;
      const support = await fetchS3Capabilities();
      if (support.mode === 's3') {
        const prep = await prepareRoomSettlement(roomId);
        if (prep.error || !prep.data) {
          error = prep.error ?? new Error('정산 대상을 확인하지 못했어요.');
        } else {
          const res = await createRoomSettlementWithSnapshot(payload, prep.data.revision);
          billId = res.data?.id ?? null;
          error = res.error;
        }
      } else {
        const res = await createRoomSettlement(payload);
        billId = res.billId;
        error = res.error;
      }
      if (currentRoom.current !== roomId || currentUser.current !== user?.id) return;
      if (error) { if (mounted.current) {
        notify('정산 요청 실패', settlementUiError(error));
        if ((error as Error & { code?: string }).code === 'S4008') onStateChanged?.();
        if ((error as Error & { code?: string }).code === '42501' && error.message === 'SETTLEMENT_LOCKED_AFTER_PAYMENT') setReloadToken(token => token + 1);
      } return; }
      onStateChanged?.(); if (mounted.current) {
        onClose();
        if (billId) {
          replace('ChatRoom', { ...current.params, roomId, openSheet: undefined, awaitingSettlementAccount: undefined, settlementAmountText: undefined });
          navigate('SettlementDetail', { billId, entry: 'ChatRoom' });
        }
        else notify('정산 요청 확인 필요', '정산 번호를 확인하지 못했어요. 정산 목록에서 다시 확인해 주세요.');
      }
    } catch { if (mounted.current) notify('정산 요청 실패', '요청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    finally { operation.current = false; if (mounted.current) setBusy(false); }
  };
  const toggleMine = async (member: SettlementMember, confirmed = false) => {
    if (operation.current || finished || disclosureClosed || member.profileId !== user?.id || loadStatus !== 'ready') return;
    // Both undo and sender completion require confirmation in this same modal.
    if (!confirmed && (member.isCompleted || settlement?.creatorId !== user?.id)) {
      setCompletionError(null); setPendingMember(member); return;
    }
    operation.current = true; setBusy(true); setCompletionError(null);
    try {
      const error = await setSettlementCompleted(member.id, !member.isCompleted);
      if (currentRoom.current !== roomId || currentUser.current !== user?.id) return;
      if (error) {
        if (!mounted.current) return;
        if (confirmed) setCompletionError(settlementCompletionError(error));
        else notify('변경 실패', settlementCompletionError(error));
        return;
      }
      onStateChanged?.(); if (mounted.current) { setPendingMember(null); setReloadToken(token => token + 1); }
    } catch {
      if (!mounted.current) return;
      if (confirmed) setCompletionError(settlementCompletionError(null));
      else notify('변경 실패', settlementCompletionError(null));
    }
    finally { operation.current = false; if (mounted.current) setBusy(false); }
  };
  const registerAccount = () => {
    if (busy) return;
    // ProfileEdit 저장 후 정산 시트로 복귀하며, 서버 정산이 없는 신규 초안의 금액은 유지한다.
    replace('ChatRoom', { ...current.params, roomId, openSheet: 'settlement', settlementAmountText: amountText, awaitingSettlementAccount: true });
    navigate('ProfileEdit');
  };
  const closeConfirmation = () => { if (!busy) { setPendingMember(null); setCompletionError(null); } };
  // Change content in one modal instead of stacking iOS sheet presentations.
  return <BottomSheet visible={visible} title={pendingMember?.isCompleted ? '송금 완료 표시를 되돌릴까요?' : pendingMember ? '' : 'N빵 정산'} subtitle={pendingMember ? undefined : '결제 금액을 넣으면 참여한 사람 수로 나눠요.'} onClose={() => { if (!busy) { if (pendingMember) closeConfirmation(); else onClose(); } }}>
    {pendingMember ? pendingMember.isCompleted ? <SettlementStatusConfirmationContent kind="undo" busy={busy} error={completionError} onClose={closeConfirmation} onConfirm={() => void toggleMine(pendingMember, true)} /> : <TransferConfirmationContent recipient={members.find(member => member.profileId === settlement?.creatorId)?.name || null} amount={confirmationAmount} busy={busy} error={completionError} onClose={closeConfirmation} onConfirm={() => void toggleMine(pendingMember, true)} /> : <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {loadStatus === 'error' ? <FailureCard title="정산을 불러오지 못했어요" reason="이전 정산을 확인한 뒤 요청할 수 있어요." onRetry={() => setReloadToken(n => n + 1)} /> : null}
      {unverifiedLabel ? <Text style={styles.note}>{unverifiedLabel} · 이전 정산의 약속 확정 여부는 확인할 수 없어요.</Text> : null}
      {!settlement && !canCreate ? <Text style={styles.note}>{roomStage ? settlementConfirmationRequired : '방의 약속 확정 상태를 확인한 뒤 정산을 시작할 수 있어요.'}</Text> : null}
      {/* [결정] S6 금액 수정 UI는 숨긴다. 기존 정산은 금액을 읽기 전용으로 보여 준다. */}
      <View style={styles.amountField}><Text style={styles.label}>총 결제금액</Text><View style={styles.amountBox}>{settlement ? <Text style={styles.amountInput}>{formatAmount(settlement.totalAmount)}</Text> : <><TextInput accessibilityLabel="총 결제금액" value={amountText.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')} onChangeText={setAmountText} editable={editable && !busy && loadStatus === 'ready'} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.sub} style={styles.amountInput} /><Text style={styles.unit}>원</Text></>}</View></View>
      {/* TODO(서버 단계): 영수증 인식 기능이 없어 촬영/자동 입력 버튼을 표시하지 않는다. */}
      {/* [결정] S3 SD01 / S3-design.md:75: 정산 대상 안내 문구 */}
      {!settlement && editable ? (
        <View style={styles.account}>
          <Info size={16} color={colors.sub} />
          <Text style={styles.note}>{settlementRecipientNotice}</Text>
        </View>
      ) : null}
      <View><Text style={styles.sectionTitle}>{settlement ? '정산 현황' : `참여 멤버 ${settlementParticipants.length}명`}</Text>
        {settlement ? members.map(member => <SettleMember key={member.id} layout="row" name={member.name} seed={member.profileId ?? member.id} completed={member.isCompleted} mine={member.profileId === user?.id} disabled={busy || finished || (disclosureClosed && member.isCompleted) || loadStatus !== 'ready' || member.profileId !== user?.id} onPress={member.profileId === user?.id ? () => void toggleMine(member) : undefined} />)
          : settlementParticipants.length ? settlementParticipants.map(member => <View key={member.id} style={styles.member} accessible accessibilityLabel={member.name + ', 정산 참여 · 선택 변경 불가'}><Avatar name={member.name} seed={member.profileId ?? member.id} url={member.avatarUrl} size={32} /><Text style={styles.memberName}>{member.name}{member.profileId === user?.id ? ' (나)' : ''}</Text><View style={styles.checkArea}><View style={styles.check}><Check size={16} color={colors.ink} /></View></View></View>)
            : <Text style={styles.note}>요청을 보내면 서버에서 참여 멤버를 확인해요.</Text>}
      </View>
      {/* TODO(서버 단계): 참가자 선택·제외는 서버 계약 없이 조작하지 않는다. 신규 정산의 분모는 생성 응답 전 추정하지 않는다. */}
      <View style={styles.eachBox}><Text style={styles.eachLabel}>1인당</Text><Text style={styles.each}>{settlement ? formatAmount(each) : '요청 후 표시'}</Text></View>
      {settlement ? <SettlementPaymentAccountView payment={payment} amount={confirmationAmount} canSend={members.some(member => member.profileId === user?.id && !member.isCompleted)} disabled={busy || loadStatus !== 'ready'} completed={finished} /> : null}
      {editable ? !bundle ? <View><Text style={styles.note}>{profileStatus === 'error' ? '받을 계좌를 확인하지 못했어요. 프로필을 다시 불러와 주세요.' : '받을 계좌를 확인하고 있어요'}</Text>{profileStatus === 'error' ? <Button variant="secondary" label="계좌 다시 확인" onPress={() => reloadProfile?.()} /> : null}</View> : hasAccount ? <View style={styles.account}><Info size={16} color={colors.sub} /><Text accessibilityLabel={accountAccessibilityLabel} style={styles.note}>받을 계좌: {bankName} {maskedAccount} (프로필에 등록된 내 계좌)</Text></View>
        : <View style={styles.warning}><View style={styles.account}><Wallet size={18} color={v3FeedbackColors.error} /><View style={styles.grow}><Text style={styles.warningTitle}>받을 계좌가 아직 없어요</Text><Text style={styles.warningNote}>계좌를 등록해야 메이트가 바로 보낼 수 있어요.</Text></View></View><Button variant="secondary" style={styles.register} label="계좌 등록하기" disabled={busy} onPress={registerAccount} /></View> : null}
      {finished ? <Text style={styles.note}>정산이 끝났어요. 되돌릴 수 없어요.</Text> : null}
      {(finished || disclosureClosed) && canCreate ? <Button variant="secondary" label="새 정산 요청하기" disabled={busy || loadStatus !== 'ready'} onPress={() => { setSettlement(null); setAmountText(''); }} /> : null}
      {editable ? <Text style={styles.note}>정산을 요청하면 이 계좌를 정산이 끝날 때까지 정산 참여자와 생성자에게 공개해요. 프로필의 계좌 공개 설정과는 별개예요.</Text> : null}
      {settlement ? <Button label="정산 상세 보기" disabled={busy || loadStatus !== 'ready'} onPress={() => {
        onClose(); replace('ChatRoom', { ...current.params, roomId, openSheet: undefined, awaitingSettlementAccount: undefined, settlementAmountText: undefined });
        navigate('SettlementDetail', { billId: settlement.id, entry: 'ChatRoom' });
      }} /> : null}
      {editable ? <Button label={!bundle ? '계좌 확인 중' : !hasAccount ? '계좌를 먼저 등록해 주세요' : '정산 요청 보내기'} loading={busy} disabled={!hasAccount || amount <= 0 || !roomId || loadStatus !== 'ready'} onPress={() => void request()} /> : null}
    </ScrollView>}<Toast {...toastProps} bottom={Math.max(16, height - 164)} />
  </BottomSheet>;
}
export function MembersSheet({ visible, participants, code, myId, ownerId = null, canInvite = true, onClose }: {
  visible: boolean; participants: RoomParticipant[]; code: string | null; myId: string | null; ownerId?: string | null; canInvite?: boolean; onClose: () => void;
}) {
  const [inviting, setInviting] = useState(false);
  const { navigate, current } = useNavigation();
  const roomId = typeof current.params?.roomId === 'string' ? current.params.roomId : null;
  const contextKey = `${myId ?? ''}:${roomId ?? ''}`;
  const [selection, setSelection] = useState<{ context: string; id: string } | null>(null);
  const selected = visible && selection?.context === contextKey ? participants.find(participant => participant.id === selection.id) : undefined;
  useEffect(() => { if (!visible || !canInvite) setInviting(false); }, [visible, canInvite]);
  useEffect(() => { setSelection(null); }, [visible, contextKey]);
  const selectMember = (participant: RoomParticipant) => {
    // [결정] E0479: 본인은 프로필 홈, E0480~E0482: 타인은 같은 모달의 메이트 프로필.
    if (myId && participant.profileId === myId) { onClose(); navigate('Profile'); }
    else setSelection({ context: contextKey, id: participant.id });
  };
  // One modal changes its contents, avoiding overlapping iOS sheet presentations.
  return <BottomSheet visible={visible} title={selected ? '' : inviting && canInvite ? '메이트 초대' : '멤버 ' + participants.length + '명'} subtitle={selected ? undefined : canInvite ? inviteSubtitle : '정산이 시작되어 메이트를 더 초대할 수 없어요.'} onClose={() => selected ? setSelection(null) : inviting ? setInviting(false) : onClose()}>
    {selected ? <MateProfileSheet key={`${contextKey}:${selected.id}:${selected.profileId ?? ''}`} visible embedded profileId={selected.profileId} roomId={roomId} myId={myId} name={selected.name} avatarUrl={selected.avatarUrl} onClose={() => setSelection(null)} /> : inviting && canInvite && code ? <MateInviteContent code={code} roomId={roomId ?? undefined} /> : <>{canInvite ? <InviteCodeBox code={code} /> : null}<ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      {participants.length === 0 ? <Text style={styles.note}>참여 멤버를 불러오지 못했어요</Text> : participants.map(participant => <RoomMemberRow key={participant.id} participant={participant} myId={myId} ownerId={ownerId} onPress={() => selectMember(participant)} />)}
    </ScrollView>{canInvite && code ? <Button variant="secondary" label="＋ 메이트 초대" onPress={() => setInviting(true)} /> : null}</>}
  </BottomSheet>;
}
const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 1 }, body: { gap: 16 }, grow: { flex: 1 },
  label: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 19, color: colors.sub }, amountField: { gap: 6 },
  amountBox: { minHeight: 56, borderWidth: 2, borderColor: colors.primary, borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  amountInput: { minHeight: 52, minWidth: 44, flex: 1, padding: 0, fontFamily: fontFamily.bold, fontSize: 22, color: colors.ink }, unit: { fontFamily: fontFamily.medium, fontSize: 16, color: colors.sub },
  sectionTitle: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22, color: colors.ink },
  member: { minHeight: 56, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 10 }, memberName: { flex: 1, fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 22, color: colors.ink },
  checkArea: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, check: { width: 22, height: 22, borderRadius: 6, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  eachBox: { backgroundColor: colors.selectedBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, eachLabel: { flex: 1, fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: colors.selectedText }, each: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 29, color: colors.selectedText },
  account: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, note: { flex: 1, fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.sub },
  warning: { backgroundColor: chatFeedbackColors.alertBackground, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 10 }, warningTitle: { fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 20, color: v3FeedbackColors.error }, warningNote: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: v3FeedbackColors.error }, register: { minHeight: 44, height: 44, paddingVertical: 0 },
});
