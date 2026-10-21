export type AuthRedirect =
  | {
      kind: 'reset' | 'callback';
      code: string | null;
    }
  | {
      kind: null;
      code: null;
    };

/** 허용한 스탠드얼론 scheme 또는 Expo Go 경로에서만 Auth redirect를 처리한다. */
export function classifyAuthRedirect(url: string): AuthRedirect {
  try {
    const parsed = new URL(url);
    const standalone =
      parsed.protocol === 'mealchat:' &&
      parsed.host === 'auth';
    const expoGo =
      (parsed.protocol === 'exp:' || parsed.protocol === 'exps:') &&
      parsed.pathname.startsWith('/--/');
    const resetPath = standalone
      ? parsed.pathname === '/reset'
      : expoGo && parsed.pathname === '/--/auth/reset';
    const callbackPath = standalone
      ? parsed.pathname === '/callback'
      : expoGo && parsed.pathname === '/--/auth/callback';

    if (!resetPath && !callbackPath) return { kind: null, code: null };

    const code = parsed.searchParams.get('code')?.trim() || null;
    return { kind: resetPath ? 'reset' : 'callback', code };
  } catch {
    return { kind: null, code: null };
  }
}

/** 서버 오류·code를 노출하지 않고, 사용자가 다음 행동을 알 수 있는 안내만 준다. */
export function authRedirectErrorMessage(
  redirect: AuthRedirect,
  reason: 'missing-code' | 'exchange-failed',
) {
  if (redirect.kind === 'reset') {
    return reason === 'missing-code'
      ? '비밀번호 재설정 링크에 필요한 정보가 없습니다. 앱에서 새 재설정 메일을 요청해 주세요.'
      : '비밀번호 재설정 링크가 만료되었거나 이미 사용되었습니다. 앱에서 새 재설정 메일을 요청해 주세요.';
  }

  return reason === 'missing-code'
    ? '인증 링크에 필요한 정보가 없습니다. 앱에서 새 메일을 요청해 주세요.'
    : '인증 링크를 처리하지 못했습니다. 링크가 만료되었거나 이미 사용되었을 수 있습니다. 앱에서 새 메일을 요청해 주세요.';
}

/**
 * Auth code는 일회용이다. 초기 URL과 Linking 이벤트가 같은 URL을 연속 전달해도
 * 한 Provider 수명 안에서 교환을 한 번만 시도한다. 원문 URL/code는 저장하지 않고,
 * 길이와 FNV-1a fingerprint만 보관한다. 이는 인증용 해시가 아니므로 충돌 시 Provider
 * 수명 동안 다른 링크가 중복으로 억제될 수 있으며, 그 경우 새 메일을 요청하면 된다.
 */
export function createAuthRedirectGuard() {
  const handledFingerprints = new Set<string>();

  return {
    claim(url: string) {
      const fingerprint = authRedirectFingerprint(url);
      if (handledFingerprints.has(fingerprint)) return false;
      handledFingerprints.add(fingerprint);
      return true;
    },
  };
}

/** FNV-1a는 중복 UI 이벤트 억제용이며 비밀값 검증·보호 수단이 아니다. */
function authRedirectFingerprint(value: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `${value.length}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
