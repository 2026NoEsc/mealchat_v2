/**
 * 비밀번호를 쓸 수 있는지 미리 본다.
 *
 * 실제 가입 요청은 마지막 약관 화면에서 일어난다. 그래서 짧은 비밀번호를 적으면
 * 개인정보 → 캘린더 → 취향 → 약관을 다 지나온 뒤에야 서버가 거절했다. 첫 화면에서
 * 같은 기준으로 먼저 걸러, 끝까지 갔다가 되돌아오는 일을 없앤다.
 *
 * 길이를 8 로 잡은 이유: Supabase 기본 최소 길이가 6 이라, 그보다 길게 요구하면
 * 여기를 통과한 값이 서버에서 길이로 거절당할 일이 없다. 반대로 6 으로 맞추면
 * 프로젝트 설정이 더 엄격할 때 이 검사가 헛돈다.
 */
export const MIN_PASSWORD_LENGTH = 8;

/** 못 쓰는 이유. 쓸 수 있으면 null */
export function passwordProblem(password: string): string | null {
  if (!password) return '비밀번호를 입력해 주세요.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `${MIN_PASSWORD_LENGTH}자 이상으로 만들어 주세요.`;
  }
  /* 앞뒤 공백은 사람이 알아채기 어렵고, 다음에 로그인할 때 그대로 치기도 어렵다 */
  if (password !== password.trim()) return '앞뒤 공백은 넣을 수 없어요.';
  return null;
}

/** 재확인이 어긋나는 이유. 맞으면 null */
export function confirmProblem(password: string, confirm: string): string | null {
  if (!confirm) return '한 번 더 입력해 주세요.';
  if (password !== confirm) return '비밀번호가 서로 달라요.';
  return null;
}

const AUTH_ERROR_FALLBACK = '잠시 후 다시 시도해 주세요.';

/** Codes verified against the installed @supabase/auth-js ErrorCode definition. */
const authCodeMessages: Readonly<Record<string, string>> = {
  weak_password: '비밀번호가 보안 기준에 맞지 않아요. 더 길고 추측하기 어려운 비밀번호로 바꿔 주세요.',
  signup_disabled: '현재 회원가입을 받고 있지 않아요. 나중에 다시 시도해 주세요.',
  email_provider_disabled: '현재 이 인증 방법을 이용할 수 없어요. 나중에 다시 시도해 주세요.',
  provider_disabled: '현재 이 인증 방법을 이용할 수 없어요. 나중에 다시 시도해 주세요.',
  email_address_invalid: '이메일 형식을 확인해 주세요.',
  email_address_not_authorized: '이 이메일 주소로는 인증 메일을 보낼 수 없어요. 이메일 주소를 확인하거나 관리자에게 문의해 주세요.',
  user_already_exists: '이미 가입된 이메일이에요. 로그인하거나 다른 이메일 주소를 입력해 주세요.',
  email_exists: '이미 가입된 이메일이에요. 로그인하거나 다른 이메일 주소를 입력해 주세요.',
  over_email_send_rate_limit: '인증 메일 전송 한도에 도달했어요. 메일함을 확인하고 잠시 뒤 다시 시도해 주세요.',
  over_request_rate_limit: '요청이 많아요. 잠시 후 다시 시도해 주세요.',
  validation_failed: '입력한 가입 정보를 다시 확인해 주세요.',
  request_timeout: '응답이 늦어지고 있어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
  email_not_confirmed: '이메일 인증을 먼저 끝내 주세요.',
  invalid_credentials: '이메일이나 비밀번호가 맞지 않아요.',
  same_password: '이전 비밀번호와 다른 비밀번호를 입력해 주세요.',
};

/**
 * 인증 오류 코드를 우선 해석하고 코드가 없을 때만 기존 메시지 매핑을 사용한다.
 * 미등록 코드·메시지의 원문은 노출하지 않는다. 재설정 메일의 계정 열거 방지
 * 응답은 PasswordResetSheet에서 별도로 처리하므로 이 매핑을 사용하지 않는다.
 */
export function authErrorMessage(error: unknown): string {
  const detail = error !== null && typeof error === 'object'
    ? error as { code?: unknown; message?: unknown }
    : null;
  if (detail?.code !== undefined) {
    return typeof detail.code === 'string' && Object.prototype.hasOwnProperty.call(authCodeMessages, detail.code)
      ? authCodeMessages[detail.code]
      : AUTH_ERROR_FALLBACK;
  }
  const message = typeof error === 'string' ? error : typeof detail?.message === 'string' ? detail.message : '';
  const known: Record<string, string> = {
    'Invalid login credentials': '이메일이나 비밀번호가 맞지 않아요.',
    'Email not confirmed': '이메일 인증을 먼저 끝내 주세요.',
    'User already registered': '이미 가입된 이메일이에요.',
    'Password should be at least 6 characters.':
      `비밀번호를 ${MIN_PASSWORD_LENGTH}자 이상으로 만들어 주세요.`,
    'Unable to validate email address: invalid format': '이메일 형식을 확인해 주세요.',
    'Signup requires a valid password': '비밀번호를 입력해 주세요.',
    'New password should be different from the old password.': '이전 비밀번호와 다른 비밀번호를 입력해 주세요.',
  };

  if (Object.prototype.hasOwnProperty.call(known, message)) return known[message];

  /* 길이 안내는 서버 설정에 따라 숫자가 달라져서 통째로 맞추기 어렵다 */
  if (/Password should be at least/i.test(message)) {
    return `비밀번호를 ${MIN_PASSWORD_LENGTH}자 이상으로 만들어 주세요.`;
  }
  if (/rate limit|too many/i.test(message)) {
    return '시도가 많았어요. 잠시 후 다시 해 주세요.';
  }

  return AUTH_ERROR_FALLBACK;
}
