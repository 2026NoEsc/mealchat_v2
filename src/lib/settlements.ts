import { supabase } from './supabase';

export type SettlementMember = {
  id: string;
  profileId: string | null;
  name: string;
  isCompleted: boolean;
};

export type Settlement = {
  id: string;
  roomId: string | null;
  /** 방이 사라졌으면 null. 정산은 방보다 오래 남는다 */
  roomTitle: string | null;
  title: string;
  totalAmount: number;
  splitCount: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
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
  title: string;
  total_amount: number;
  split_count: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
  created_at: string;
  rooms: { title: string } | { title: string }[] | null;
  dutch_pay_members: MemberRow[] | null;
};

const SELECT =
  'id, room_id, title, total_amount, split_count, bank_name, account_number, account_holder, ' +
  'created_at, rooms(title), dutch_pay_members(id, profile_id, name, is_completed)';

function toSettlement(row: BillRow): Settlement {
  /* PostgREST 는 관계를 객체로 줄 때도 배열로 줄 때도 있다 */
  const room = Array.isArray(row.rooms) ? row.rooms[0] : row.rooms;

  return {
    id: row.id,
    roomId: row.room_id,
    roomTitle: room?.title ?? null,
    title: row.title,
    totalAmount: row.total_amount,
    splitCount: row.split_count,
    bankName: row.bank_name,
    accountNumber: row.account_number,
    accountHolder: row.account_holder,
    createdAt: row.created_at,
    members: (row.dutch_pay_members ?? []).map((member) => ({
      id: member.id,
      profileId: member.profile_id,
      name: member.name,
      isCompleted: member.is_completed,
    })),
  };
}

/** 방의 정산. 정책이 방 참가자로 제한하므로 room_id 만 걸면 된다. */
/**
 * 방의 정산 전부, 최신순.
 *
 * 예전에는 `.limit(1)` 로 최신 한 건만 읽었다. 그러면 끝난 정산이 더 최근일 때
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
  const { data, error } = await supabase.rpc('create_room_settlement', {
    target_room: input.roomId,
    bill_title: input.title,
    amount: input.amount,
    bank_name: input.bankName ?? '',
    account_number: input.accountNumber ?? '',
    account_holder: input.accountHolder ?? '',
  });

  if (error) return { billId: null, error };
  return { billId: typeof data === 'string' ? data : null, error: null };
}

/** 송금 완료 표시. 본인 행이거나, 정산을 만든 사람이 대신 표시할 수 있다. */
export async function setSettlementCompleted(
  memberId: string,
  completed: boolean,
): Promise<Error | null> {
  const { error } = await supabase
    .from('dutch_pay_members')
    .update({ is_completed: completed })
    .eq('id', memberId);
  return error;
}

export type RoomNotification = {
  id: string;
  roomId: string;
  title: string;
  message: string;
  bankName: string;
  accountNumber: string;
  amount: number;
  createdAt: string;
};

/** 내가 속한 방들의 알림. 정책이 이미 방 참가자로 제한한다. */
export async function fetchMyNotifications(): Promise<{
  data: RoomNotification[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, room_id, title, message, bank_name, account_number, amount, created_at')
    .order('created_at', { ascending: false })
    .limit(30)
    .returns<
      {
        id: string;
        room_id: string;
        title: string;
        message: string;
        bank_name: string;
        account_number: string;
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
      bankName: row.bank_name,
      accountNumber: row.account_number,
      amount: row.amount,
      createdAt: row.created_at,
    })),
    error: null,
  };
}

export async function sendSettlementNotification(input: {
  roomId: string;
  title: string;
  message: string;
  bankName?: string | null;
  accountNumber?: string | null;
  amount: number;
}): Promise<Error | null> {
  const { error } = await supabase.from('notifications').insert({
    room_id: input.roomId,
    title: input.title,
    message: input.message,
    bank_name: input.bankName ?? '',
    account_number: input.accountNumber ?? '',
    amount: input.amount,
  });
  return error;
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
