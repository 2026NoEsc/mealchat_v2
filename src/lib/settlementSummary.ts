/**
 * 정산 한 건의 진행 상태 계산.
 *
 * supabase 를 import 하지 않는다 — 네이티브 모듈 없이 테스트할 수 있어야 한다.
 */

export type SettlementMemberRow = {
  profile_id: string | null;
  is_completed: boolean;
};

export type SettlementBillRow = {
  id: string;
  room_id: string | null;
  title: string;
  total_amount: number;
  dutch_pay_members: SettlementMemberRow[] | null;
};

export type SettlementSummary = {
  id: string;
  roomId: string | null;
  title: string;
  totalAmount: number;
  /** 아직 송금하지 않은 인원 */
  pendingCount: number;
  /** 내 몫이 아직 남아 있는지. 참가자 명단에 내가 없으면 false */
  waitingOnMe: boolean;
  /** 명단이 있고 전원이 보냈을 때만 true. 명단을 못 읽으면 단정하지 않는다 */
  settled: boolean;
};

/**
 * 참가자 행은 `create_room_settlement` 가 방 참가자 명단에서 채우고,
 * 돈을 받는 정산 생성자는 처음부터 완료로 들어간다.
 */
export function toSettlementSummary(
  row: SettlementBillRow,
  userId: string | null,
): SettlementSummary {
  const members = row.dutch_pay_members ?? [];
  const pending = members.filter((member) => !member.is_completed);

  return {
    id: row.id,
    roomId: row.room_id,
    title: row.title,
    totalAmount: row.total_amount,
    pendingCount: pending.length,
    waitingOnMe: userId !== null && pending.some((member) => member.profile_id === userId),
    /*
     * 명단이 비어 있으면 정책에 막혔거나 RPC 이전에 만들어진 정산이다.
     * 모르는 것을 끝난 것으로 처리하면 정산이 조용히 사라지므로 false 로 둔다.
     */
    settled: members.length > 0 && pending.length === 0,
  };
}
