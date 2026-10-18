import { supabase } from './supabase';
import { settlementCompletionRpcInput } from './settlementCompletionContract';
import { fetchConsentManifest, getConsentServerMode, requestS1 } from './consents';
import { getConsentAccess, hasConsentAccess, registerSensitiveConsentClearer, setConsentAccess } from '../consents/access';
import { consentError } from '../consents/contracts';

export { canEditSettlement, settlementMutationErrorMessage } from './settlementAccess';

function closeRequiredConsent(error: unknown, owner: string | null) {
  if ((error as { code?: string } | null)?.code === 'S1001' && getConsentAccess().userId === owner) setConsentAccess(owner, 'required');
}

export type SettlementMember = {
  id: string;
  profileId: string | null;
  name: string;
  isCompleted: boolean;
};

export type Settlement = {
  id: string;
  roomId: string | null;
  creatorId: string | null;
  /** 방이 사라졌으면 null. 정산은 방보다 오래 남는다 */
  roomTitle: string | null;
  title: string;
  totalAmount: number;
  splitCount: number;
  createdAt: string;
  members: SettlementMember[];
};

type MemberRow = {
  id: string;
  profile_id: string | null;
  name: string;
  is_completed: boolean;
};

type BillRow = {
  id: string;
  room_id: string | null;
  creator_id: string | null;
  title: string;
  total_amount: number;
  split_count: number;
  created_at: string;
  rooms: { title: string } | { title: string }[] | null;
  dutch_pay_members: MemberRow[] | null;
};

const SELECT =
  'id, room_id, creator_id, title, total_amount, split_count, ' +
  'created_at, rooms(title), dutch_pay_members(id, profile_id, name, is_completed)';

function toSettlement(row: BillRow): Settlement {
  /* PostgREST 는 관계를 객체로 줄 때도 배열로 줄 때도 있다 */
  const room = Array.isArray(row.rooms) ? row.rooms[0] : row.rooms;

  return {
    id: row.id,
    roomId: row.room_id,
    creatorId: row.creator_id,
    roomTitle: room?.title ?? null,
    title: row.title,
    totalAmount: row.total_amount,
    splitCount: row.split_count,
    createdAt: row.created_at,
    members: (row.dutch_pay_members ?? []).map((member) => ({
      id: member.id,
      profileId: member.profile_id,
      name: member.name,
      isCompleted: member.is_completed,
    })),
  };
}

/**
 * 방의 정산 전부, 최신순.
 *
 * 서버 정책은 creator 또는 생성 시점 수취인 snapshot으로 제한한다. 방에 새로
 * 들어온 사람은 같은 room_id로 읽어도 과거 정산을 받지 못한다. 예전에는 `.limit(1)`
 * 로 최신 한 건만 읽었다. 그러면 끝난 정산이 더 최근일 때
 * 아직 안 끝난 정산에 UI 로 갈 방법이 사라진다. 어느 것을 띄울지는
 * [pickActiveSettlement](./settlementSummary.ts) 가 정한다.
 */
export async function fetchRoomSettlements(roomId: string): Promise<{
  data: Settlement[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('dutch_pay_bills')
    .select(SELECT)
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .returns<BillRow[]>();

  if (error) return { data: null, error };
  return { data: (data ?? []).map(toSettlement), error: null };
}

/**
 * 정산을 만든다. 참가자 명단은 서버가 방에서 옮겨 담으므로 여기서 보내지 않는다 —
 * 이름을 사칭하거나 방에 없는 사람을 끼워 넣을 수 없게 하기 위해서다.
 */
export async function createRoomSettlement(input: {
  roomId: string;
  title: string;
  amount: number;
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
}): Promise<{ billId: string | null; error: Error | null }> {
  const owner = getConsentAccess().userId;
  try {
    const { data, error } = await supabase.rpc('create_room_settlement_v2', {
      target_room: input.roomId,
      bill_title: input.title,
      amount: input.amount,
      // 빈/누락 계좌값은 진행 중 정산의 기존 계좌 정보를 지우지 않는다.
      bank_name: input.bankName ?? null,
      account_number: input.accountNumber ?? null,
      account_holder: input.accountHolder ?? null,
    });
    closeRequiredConsent(error, owner);
    if (error) return { billId: null, error };
    return { billId: typeof data === 'string' ? data : null, error: null };
  } finally { invalidateSettlementPayments(); }
}

/** 송금 완료 표시. 본인 행이거나, 정산을 만든 사람이 대신 표시할 수 있다. */
export async function setSettlementCompleted(
  memberId: string,
  completed: boolean,
): Promise<Error | null> {
  const rpc = settlementCompletionRpcInput(memberId, completed);
  const owner = getConsentAccess().userId;
  try {
    const { error } = await supabase.rpc(rpc.functionName, rpc.args);
    closeRequiredConsent(error, owner);
    return error;
  } finally { invalidateSettlementPayments(); }
}

export type SettlementPayment = {
  billId: string; status: 'open' | 'completed' | 'unavailable';
  details: { bankName: string; accountNumber: string; accountHolder: string } | null;
};
const paymentListeners = new Set<() => void>();
export function invalidateSettlementPayments() { for (const listener of paymentListeners) { try { listener(); } catch { /* One unmounted view cannot keep another account snapshot alive. */ } } }
export function subscribeSettlementPayments(listener: () => void) { paymentListeners.add(listener); return () => { paymentListeners.delete(listener); }; }
registerSensitiveConsentClearer(invalidateSettlementPayments);

/** No bill-list/notification account snapshots. Only an explicitly confirmed legacy server
 * may use the previous SELECT contract; missing detail RPCs on S1 never downgrade it.
 */
export async function fetchSettlementPaymentDetails(billId: string): Promise<{ data: SettlementPayment | null; error: Error | null }> {
  const owner = getConsentAccess().userId;
  if (!hasConsentAccess(owner)) return { data: null, error: consentError('S1001') };
  if (getConsentServerMode() === 'unknown') {
    const manifest = await fetchConsentManifest();
    if (manifest.error) return { data: null, error: manifest.error };
  }
  if (!hasConsentAccess(owner)) return { data: null, error: consentError('S1001') };
  if (getConsentServerMode() === 'legacy') {
    try {
      const { data, error } = await supabase.from('dutch_pay_bills')
        .select('id, bank_name, account_number, account_holder, dutch_pay_members(is_completed)').eq('id', billId)
        .maybeSingle<{ id: string; bank_name: string; account_number: string; account_holder: string; dutch_pay_members: { is_completed: boolean }[] | null }>();
      if (error || !data || data.id !== billId || !hasConsentAccess(owner)) return { data: null, error: consentError('P0002') };
      const members = data.dutch_pay_members ?? [];
      if (members.length && members.every(member => member.is_completed)) return { data: { billId, status: 'completed', details: null }, error: null };
      if (!members.length || !data.bank_name?.trim() || !data.account_number?.trim()) return { data: { billId, status: 'unavailable', details: null }, error: null };
      return { data: { billId, status: 'open', details: { bankName: data.bank_name, accountNumber: data.account_number, accountHolder: data.account_holder ?? '' } }, error: null };
    } catch { return { data: null, error: consentError() }; }
  }
  const result = await requestS1('get_settlement_payment_details', { p_bill_id: billId }, value => {
    const response = value as { bill_id: string; status: string; payment_details: { bank_name: string; account_number: string; account_holder: string } | null; hidden_reason: string | null; server_time: string };
    if (!response || response.bill_id !== billId || !['open', 'completed', 'unavailable'].includes(response.status)
      || typeof response.server_time !== 'string' || !/(Z|\+00:00)$/.test(response.server_time) || !Number.isFinite(Date.parse(response.server_time))) throw consentError();
    const details = response.payment_details;
    if (response.status === 'open') {
      if (response.hidden_reason !== null || !details || ![details.bank_name, details.account_number].every(item => typeof item === 'string' && item.trim()) || typeof details.account_holder !== 'string') throw consentError();
    } else if (details !== null || response.hidden_reason !== response.status) throw consentError();
    return { billId, status: response.status, details: details ? { bankName: details.bank_name, accountNumber: details.account_number, accountHolder: details.account_holder } : null } as SettlementPayment;
  });
  return hasConsentAccess(owner) ? result : { data: null, error: consentError('S1001') };
}

export type RoomNotification = {
  id: string;
  roomId: string | null;
  title: string;
  message: string;
  settlementId?: string | null;
  amount: number;
  createdAt: string;
};

/** 생성 시점 정산 수취인(또는 creator)에게만 보이는 연결 알림. */
export async function fetchMyNotifications(): Promise<{
  data: RoomNotification[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, room_id, settlement_id, title, message, amount, created_at')
    .order('created_at', { ascending: false })
    .limit(30)
    .returns<
      {
        id: string;
        room_id: string | null;
        title: string;
        message: string;
        settlement_id: string | null;
        amount: number;
        created_at: string;
      }[]
    >();

  if (error) return { data: null, error };

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      roomId: row.room_id,
      title: row.title,
      message: row.message,
      settlementId: row.settlement_id,
      amount: row.amount,
      createdAt: row.created_at,
    })),
    error: null,
  };
}

/**
 * 내가 알림을 어디까지 읽었는지.
 *
 * 행이 없으면(가입 트리거 전) null 로 본다 — 아직 아무것도 읽지 않은 것과 같다.
 */
export async function fetchNotificationsReadAt(): Promise<{
  data: string | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('profile_private')
    .select('notifications_read_at')
    .maybeSingle<{ notifications_read_at: string | null }>();

  if (error) return { data: null, error };
  return { data: data?.notifications_read_at ?? null, error: null };
}

/** "모두 읽음". 지금 시각을 적어 두면 그 이후 알림만 안 읽은 것이 된다. */
export async function markNotificationsRead(userId: string): Promise<Error | null> {
  const { error } = await supabase
    .from('profile_private')
    .update({ notifications_read_at: new Date().toISOString() })
    .eq('id', userId);
  return error;
}


/**
 * 내가 볼 수 있는 정산 전부, 최신순.
 *
 * 정책이 이미 "내가 만들었거나 내가 참가한 방" 으로 제한하므로 따로 거르지 않는다.
 * 방이 사라진 정산도 그대로 돌아온다 — 채팅방을 거치지 않는 정산 화면이 필요한
 * 이유가 그것이다.
 */
export async function fetchMySettlementsDetailed(): Promise<{
  data: Settlement[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('dutch_pay_bills')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .returns<BillRow[]>();

  if (error) return { data: null, error };
  return { data: (data ?? []).map(toSettlement), error: null };
}
