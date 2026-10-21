/**
 * 정산 완료 RPC의 공개 계약. 컬럼 UPDATE 권한은 닫혀 있으므로 호출 이름과 인자
 * 키를 한 곳에 고정해 클라이언트가 우회 경로를 되살리지 않게 한다.
 */
export function settlementCompletionRpcInput(memberId: string, completed: boolean) {
  return {
    functionName: 'set_settlement_completed' as const,
    args: {
      target_member: memberId,
      completed,
    },
  };
}
