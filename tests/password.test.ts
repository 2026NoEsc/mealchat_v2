import {
  authErrorMessage,
  confirmProblem,
  MIN_PASSWORD_LENGTH,
  passwordProblem,
} from '../src/lib/password';

describe('passwordProblem', () => {
  it('쓸 수 있는 비밀번호는 통과한다', () => {
    expect(passwordProblem('mealchat24')).toBeNull();
  });

  it('짧으면 막는다 — 예전에는 마지막 약관 화면에서야 거절당했다', () => {
    expect(passwordProblem('1234')).toContain(`${MIN_PASSWORD_LENGTH}자 이상`);
    expect(passwordProblem('1234567')).toContain(`${MIN_PASSWORD_LENGTH}자 이상`);
    expect(passwordProblem('12345678')).toBeNull();
  });

  it('비어 있으면 입력을 청한다', () => {
    expect(passwordProblem('')).toBe('비밀번호를 입력해 주세요.');
  });

  it('앞뒤 공백은 막는다', () => {
    expect(passwordProblem(' mealchat24')).toBe('앞뒤 공백은 넣을 수 없어요.');
    expect(passwordProblem('mealchat24 ')).toBe('앞뒤 공백은 넣을 수 없어요.');
    /* 가운데 공백은 본인이 정한 값이라 막지 않는다 */
    expect(passwordProblem('meal chat24')).toBeNull();
  });
});

describe('confirmProblem', () => {
  it('같으면 통과한다', () => {
    expect(confirmProblem('mealchat24', 'mealchat24')).toBeNull();
  });

  it('다르면 알려 준다', () => {
    expect(confirmProblem('mealchat24', 'mealchat25')).toBe('비밀번호가 서로 달라요.');
  });

  it('아직 안 적었으면 재촉만 한다', () => {
    expect(confirmProblem('mealchat24', '')).toBe('한 번 더 입력해 주세요.');
  });
});

describe('authErrorMessage', () => {
  it('서버 영어 문구를 사람 말로 바꾼다', () => {
    expect(authErrorMessage('Invalid login credentials')).toBe(
      '이메일이나 비밀번호가 맞지 않아요.',
    );
    expect(authErrorMessage('Email not confirmed')).toBe('이메일 인증을 먼저 끝내 주세요.');
    expect(authErrorMessage('User already registered')).toBe('이미 가입된 이메일이에요.');
  });

  it('길이 안내는 숫자가 달라도 알아본다', () => {
    expect(authErrorMessage('Password should be at least 10 characters.')).toContain(
      `${MIN_PASSWORD_LENGTH}자 이상`,
    );
  });

  it.each(['Something odd happened', 'fixture private provider detail', '__proto__', 'constructor'])('모르는 문구 %s는 화면에 노출하지 않는다', (message) => {
    expect(authErrorMessage(message)).toBe('잠시 후 다시 시도해 주세요.');
  });

  it('이전 비밀번호와 같은 경우의 알려진 안내를 한국어로 바꾼다', () => {
    expect(authErrorMessage('New password should be different from the old password.')).toBe('이전 비밀번호와 다른 비밀번호를 입력해 주세요.');
  });

  it.each([
    ['weak_password', '비밀번호가 보안 기준에 맞지 않아요. 더 길고 추측하기 어려운 비밀번호로 바꿔 주세요.'],
    ['signup_disabled', '현재 회원가입을 받고 있지 않아요. 나중에 다시 시도해 주세요.'],
    ['email_provider_disabled', '현재 이 인증 방법을 이용할 수 없어요. 나중에 다시 시도해 주세요.'],
    ['provider_disabled', '현재 이 인증 방법을 이용할 수 없어요. 나중에 다시 시도해 주세요.'],
    ['email_address_invalid', '이메일 형식을 확인해 주세요.'],
    ['email_address_not_authorized', '이 이메일 주소로는 인증 메일을 보낼 수 없어요. 이메일 주소를 확인하거나 관리자에게 문의해 주세요.'],
    ['user_already_exists', '이미 가입된 이메일이에요. 로그인하거나 다른 이메일 주소를 입력해 주세요.'],
    ['email_exists', '이미 가입된 이메일이에요. 로그인하거나 다른 이메일 주소를 입력해 주세요.'],
    ['over_email_send_rate_limit', '인증 메일 전송 한도에 도달했어요. 메일함을 확인하고 잠시 뒤 다시 시도해 주세요.'],
    ['over_request_rate_limit', '요청이 많아요. 잠시 후 다시 시도해 주세요.'],
    ['validation_failed', '입력한 가입 정보를 다시 확인해 주세요.'],
    ['request_timeout', '응답이 늦어지고 있어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.'],
    ['email_not_confirmed', '이메일 인증을 먼저 끝내 주세요.'],
    ['invalid_credentials', '이메일이나 비밀번호가 맞지 않아요.'],
    ['same_password', '이전 비밀번호와 다른 비밀번호를 입력해 주세요.'],
  ])('코드 %s를 조치할 수 있는 한국어 안내로 매핑한다', (code, expected) => {
    expect(authErrorMessage(Object.assign(new Error('provider-private-fixture'), { name: 'AuthApiError', code }))).toBe(expected);
  });

  it('코드가 있으면 메시지 원문 비교보다 코드를 우선한다', () => {
    expect(authErrorMessage({ code: 'email_address_invalid', message: 'User already registered' })).toBe('이메일 형식을 확인해 주세요.');
  });

  it.each(['future_error', '__proto__', 'constructor', '', 123, null])('미등록 코드 %s가 있으면 알려진 메시지로도 추측하지 않는다', (code) => {
    expect(authErrorMessage({ code, message: 'User already registered' })).toBe('잠시 후 다시 시도해 주세요.');
  });

  it('코드가 없는 Error 객체에만 메시지 보조 매핑을 적용한다', () => {
    expect(authErrorMessage(new Error('User already registered'))).toBe('이미 가입된 이메일이에요.');
    expect(authErrorMessage(new Error('provider-private-fixture'))).toBe('잠시 후 다시 시도해 주세요.');
  });

  it.each([null, undefined, 500, { code: 123, message: null }, 'provider-private-fixture'])('예상 밖 오류 %s의 원문도 노출하지 않는다', (error) => {
    expect(authErrorMessage(error)).toBe('잠시 후 다시 시도해 주세요.');
  });
});
