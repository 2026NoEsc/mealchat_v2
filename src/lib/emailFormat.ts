/**
 * 이메일 형식 판별.
 *
 * supabase 를 import 하지 않는다 — 네이티브 모듈 없이 테스트할 수 있어야 한다.
 * 실제 조회는 email.ts 가 맡는다.
 *
 * 서버(email_available)와 같은 기준을 쓴다. 여기서 통과한 값이 서버에서 형식
 * 때문에 "쓸 수 없다" 로 나오면 사용자는 이유를 알 수 없다.
 */
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function isEmailShaped(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim().toLowerCase());
}
