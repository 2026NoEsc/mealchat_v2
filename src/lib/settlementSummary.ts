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


/* ------------------------------------------------ 방에서 지금 볼 정산 고르기 */

/**
 * 정산 하나를 고를 때 필요한 최소한의 모양.
 *
 * 홈이 쓰는 SettlementSummary 와 채팅방 시트가 쓰는 Settlement 이 서로 다른 타입이라
 * 구조만 요구한다.
 */
export type PickableSettlement = {
  members: { profileId: string | null; isCompleted: boolean }[];
};

/** 명단이 있고 전원이 보냈을 때만 끝난 것으로 본다 */
export function isSettled(settlement: PickableSettlement): boolean {
  return (
    settlement.members.length > 0 && settlement.members.every((member) => member.isCompleted)
  );
}

/**
 * 방에 정산이 여러 건일 때 시트에 띄울 하나를 고른다.
 *
 * 예전에는 `created_at` 최신 한 건만 읽었다. 그러면 끝난 정산이 더 최근일 때
 * 아직 돈을 안 보낸 정산에 UI 로 갈 방법이 없다 — 홈은 "정산 1건 진행 중" 이라고
 * 세는데 눌러 들어가면 끝난 정산이 보인다.
 *
 * 우선순위는 사용자가 지금 해야 할 일 순서다.
 *   1. 내가 아직 보내야 하는 정산
 *   2. 누군가 아직 안 보낸 정산
 *   3. 그것도 없으면 가장 최근 정산 (전부 끝난 상태를 보여 준다)
 *
 * 목록은 최신순으로 들어온다고 본다. 같은 순위 안에서는 그 순서를 지킨다.
 */
export function pickActiveSettlement<T extends PickableSettlement>(
  settlements: T[],
  userId: string | null,
): T | null {
  if (settlements.length === 0) return null;

  const mine = settlements.find((settlement) =>
    settlement.members.some(
      (member) => member.profileId === userId && !member.isCompleted && userId !== null,
    ),
  );
  if (mine) return mine;

  const open = settlements.find((settlement) => !isSettled(settlement));
  if (open) return open;

  return settlements[0];
}
