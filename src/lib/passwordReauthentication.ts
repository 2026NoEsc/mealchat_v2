import { createPasswordVerificationAuth, supabase } from './supabase';

function identityError() {
  return Object.assign(new Error('Password verification identity mismatch.'), { code: 'reauth_identity_mismatch' });
}

function warnCleanupFailure() {
  if (typeof __DEV__ !== 'undefined' && __DEV__ === true) {
    // Never log the exception, account identity, URL, or tokens.
    console.warn('Password verification client cleanup could not be completed.');
  }
}

/** 화면 단 재확인(서버 강제 아님). 검증 클라이언트의 세션은 앱 세션으로 채택하지 않는다. */
// TODO(서버 단계): 보안 비밀번호 변경의 서버 강제는 운영 Auth 설정으로 별도 적용·검증한다.
export async function verifyCurrentPassword(expectedUserId: string, password: string): Promise<Error | null> {
  const restored = await supabase.auth.getSession();
  if (restored.error) return restored.error;
  const user = restored.data.session?.user;
  if (!user?.email || user.id !== expectedUserId) return identityError();

  const verifier = createPasswordVerificationAuth();
  try {
    const { data, error } = await verifier.signInWithPassword({ email: user.email, password });
    if (error) return error;
    if (data.user?.id !== expectedUserId) return identityError();
  } finally {
    // Revoke only the temporary verification session, never the application's session.
    try {
      const { error } = await verifier.signOut({ scope: 'local' });
      if (error) warnCleanupFailure();
    } catch {
      warnCleanupFailure();
    } finally {
      try {
        await verifier.dispose();
      } catch {
        warnCleanupFailure();
      }
    }
  }
  // Logout/account changes while verification was pending must block the subsequent write.
  const current = await supabase.auth.getSession();
  if (current.error) return current.error;
  return current.data.session?.user.id === expectedUserId ? null : identityError();
}
