import { readFileSync } from 'node:fs';

import { isEmailShaped } from '../src/lib/emailFormat';

describe('isEmailShaped', () => {
  it('주소 꼴이면 통과한다', () => {
    expect(isEmailShaped('mealchat@example.com')).toBe(true);
    expect(isEmailShaped('  MealChat@Example.COM  ')).toBe(true);
  });

  it('아닌 것은 막는다', () => {
    expect(isEmailShaped('mealchat')).toBe(false);
    expect(isEmailShaped('mealchat@example')).toBe(false);
    expect(isEmailShaped('meal chat@example.com')).toBe(false);
    expect(isEmailShaped('@example.com')).toBe(false);
    expect(isEmailShaped('')).toBe(false);
  });
});

/*
 * 이 함수는 가입 전(로그인 전)에 불리므로 anon 에게 열려 있어야 한다. 권한이
 * 빠지면 중복 확인이 조용히 실패하고, 사용자는 마지막 화면에서야 거절당한다.
 */
describe('email_available 마이그레이션', () => {
  const sql = readFileSync(
    'supabase/migrations/20260921120000_email_availability.sql',
    'utf8',
  );

  it('anon 에게 실행 권한을 준다', () => {
    expect(sql).toMatch(/grant execute on function public\.email_available\(text\) to anon/);
  });

  it('security definer 로 auth.users 를 읽는다', () => {
    expect(sql).toContain('security definer');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('from auth.users');
  });

  it('있다/없다 외에는 내보내지 않는다', () => {
    expect(sql).toMatch(/returns boolean/);
    /* 이름·가입일 같은 컬럼을 고르지 않는다 */
    expect(sql).not.toMatch(/select\s+(email|created_at|raw_user_meta_data)\s+from auth\.users/i);
  });
});
