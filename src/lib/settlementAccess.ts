type SettlementEditor = { creatorId: string | null } | null;

/** 진행 중 정산은 만든 사람만 내용을 수정할 수 있다. 정산이 없으면 방 멤버가 만든다. */
export function canEditSettlement(settlement: SettlementEditor, userId: string | null): boolean {
  return settlement === null || (userId !== null && settlement.creatorId === userId);
}

/** 권한 거부를 DB 문구 대신 사용자가 이해할 수 있는 안내로 바꾼다. */
export function settlementMutationErrorMessage(error: Error): string {
  const code = (error as Error & { code?: string }).code;
  if (code === '42501') return '정산 내용은 만든 사람만 수정할 수 있어요.';
  return error.message;
}
