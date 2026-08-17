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

/** `방금 전`, `1시간 전`, `어제`, `8월 13일` */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const ms = now.getTime() - date.getTime();
  if (ms < 0) return '방금 전';

  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;

  const days = Math.floor(hours / 24);
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;

  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/** `12,000원` */
export function formatAmount(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}
