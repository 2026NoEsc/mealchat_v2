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

/**
 * 로그인·가입에서 서버가 돌려주는 영어 문구를 사람 말로 바꾼다.
 * 모르는 문구는 원문을 그대로 둔다 — 뭉뚱그린 안내보다 원인을 찾기 쉽다.
 */
export function authErrorMessage(message: string): string {
  const known: Record<string, string> = {
    'Invalid login credentials': '이메일이나 비밀번호가 맞지 않아요.',
    'Email not confirmed': '이메일 인증을 먼저 끝내 주세요.',
    'User already registered': '이미 가입된 이메일이에요.',
    'Password should be at least 6 characters.':
      `비밀번호를 ${MIN_PASSWORD_LENGTH}자 이상으로 만들어 주세요.`,
    'Unable to validate email address: invalid format': '이메일 형식을 확인해 주세요.',
    'Signup requires a valid password': '비밀번호를 입력해 주세요.',
  };

  if (known[message]) return known[message];

  /* 길이 안내는 서버 설정에 따라 숫자가 달라져서 통째로 맞추기 어렵다 */
  if (/Password should be at least/i.test(message)) {
    return `비밀번호를 ${MIN_PASSWORD_LENGTH}자 이상으로 만들어 주세요.`;
  }
  if (/rate limit|too many/i.test(message)) {
    return '시도가 많았어요. 잠시 후 다시 해 주세요.';
  }

  return message;
}
