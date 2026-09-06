export type RoomInvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

/** pending 초대라도 만료 시각이 지나면 수락 UI에 보이지 않는다. */
export function effectiveInvitationStatus(
  status: string,
  expiresAt: string,
  now = Date.now(),
): RoomInvitationStatus {
  const expiresAtMs = new Date(expiresAt).getTime();
  if (status === 'pending' && Number.isFinite(expiresAtMs) && expiresAtMs <= now) {
    return 'expired';
  }
  return status === 'accepted' || status === 'declined' || status === 'expired' ? status : 'pending';
}
