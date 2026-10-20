type SettlementEditor = { creatorId: string | null } | null;

/** Mirrors set_settlement_completed: self or creator, never an unrelated member. */
export function canToggleSettlementMember(creatorId: string | null, profileId: string | null, userId: string | null): boolean {
  return userId !== null && (creatorId === userId || profileId === userId);
}

/** Completion failures describe a state change, independently from editing/account lookup. */
export function settlementCompletionError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (code === 'P0002') return '정산을 찾을 수 없어요. 정산 목록에서 다시 확인해 주세요.';
  if (code === '42501') return '이 상태는 바꿀 수 없어요. 정산을 다시 확인해 주세요.';
  if (code === 'S1005' || code === 'SETTLEMENT_DISCLOSURE_CLOSED') return '끝난 정산은 되돌릴 수 없어요. 새 정산을 요청해 주세요.';
  if (code === 'S1001') return '현재 약관에 동의한 뒤 다시 이용해 주세요.';
  return '정산 상태를 바꾸지 못했어요. 연결을 확인하고 다시 시도해 주세요.';
}

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
