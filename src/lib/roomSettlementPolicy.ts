import type { RoomStage } from './rooms';

export const settlementConfirmationRequired = '약속을 확정한 뒤 정산을 시작할 수 있어요.';

/** Only fixed server hints override the caller's fallback on older servers. */
export function s4008Message(error: unknown, fallback: 'settlement' | 'vote_confirmation'): string {
  const hint = (error as { hint?: unknown } | null)?.hint;
  const operation = hint === 'operation=settlement' ? 'settlement'
    : hint === 'operation=vote_confirmation' ? 'vote_confirmation' : fallback;
  return operation === 'settlement' ? settlementConfirmationRequired : '과반의 표를 받은 최다 득표 식당을 다시 확인해 주세요.';
}

/** Existing bills remain readable/editable. This policy only gates starting a new bill. */
export function canStartSettlement(stage: RoomStage | null | undefined, ownerConfirmed = false): boolean {
  return stage === 'confirmed' || (ownerConfirmed && (stage === 'settling' || stage === 'done'));
}

/** A settlement stage alone is not evidence that the appointment was confirmed. */
export function unverifiedSettlementLabel(stage: RoomStage, ownerConfirmed: boolean, s4 = false): string | null {
  if (!s4 || ownerConfirmed) return null;
  if (stage === 'settling') return '확정 미확인 · 정산 중';
  if (stage === 'done') return '확정 미확인 · 정산 완료';
  return null;
}
