/**
 * 화면 표시용 순수 변환들. supabase 클라이언트를 import 하지 않는다 —
 * 네이티브 모듈 없이 테스트할 수 있어야 한다.
 */

/** 계좌번호는 화면에 전부 드러내지 않는다. 뒤 네 자리만 남긴다. */
export function maskAccountNumber(account: string | null | undefined): string | null {
  const digits = (account ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length <= 4) return digits;
  return `••••${digits.slice(-4)}`;
}

/** `2002-12-20` 을 `2002년 12월 20일` 로 */
export function formatBirthDate(value: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value ?? '').trim());
  if (!match) return null;
  return `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일`;
}

/** 은행과 계좌번호를 한 줄로. 둘 중 하나만 있어도 보여준다. */
export function formatAccount(
  bankName: string | null | undefined,
  account: string | null | undefined,
): string | null {
  const masked = maskAccountNumber(account);
  const bank = bankName?.trim() || null;

  if (bank && masked) return `${bank} ${masked}`;
  return bank ?? masked;
}

/** 취향 게임 결과에서 좋아한다고 고른 개수 */
export function countLikedTastes(tastes: Record<string, boolean> | null | undefined): number {
  if (!tastes) return 0;
  return Object.values(tastes).filter(Boolean).length;
}
