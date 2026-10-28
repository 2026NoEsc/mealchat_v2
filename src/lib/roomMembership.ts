/** S4 closes membership when settlement starts; never infer this from server message text. */
export const membershipClosedMessage = '정산 중이거나 완료된 밥약에는 참여하거나 메이트를 초대할 수 없어요.';
export function isRoomMembershipClosed(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: unknown; hint?: unknown };
  return value.code === 'S4003' && value.hint === 'operation=membership';
}
export function canInviteToRoom(stage: string | null | undefined): boolean {
  return stage === 'scheduling' || stage === 'place' || stage === 'confirmed';
}
