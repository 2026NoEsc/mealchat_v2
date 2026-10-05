import { isEmailShaped } from './emailFormat';
import { supabase } from './supabase';

export { isEmailShaped };

export type EmailCheck =
  | { status: 'available' }
  | { status: 'taken' }
  | { status: 'invalid' }
  | { status: 'failed'; message: string };

/**
 * 가입 전에 이메일이 이미 쓰이는지 본다.
 *
 * 실패를 "쓸 수 있다" 로 뭉뚱그리지 않는다. 확인을 못 한 것과 비어 있는 것은
 * 다른 사실이고, 사용자는 끝까지 갔다가 거절당하는 대신 다시 눌러 볼 수 있어야 한다.
 */
export async function checkEmailAvailable(email: string): Promise<EmailCheck> {
  const normalized = email.trim().toLowerCase();
  if (!isEmailShaped(normalized)) return { status: 'invalid' };

  const { data, error } = await supabase.rpc('email_available', { candidate: normalized });

  if (error) return { status: 'failed', message: error.message };
  if (typeof data !== 'boolean') {
    return { status: 'failed', message: '확인 결과를 읽지 못했어요.' };
  }

  return data ? { status: 'available' } : { status: 'taken' };
}
