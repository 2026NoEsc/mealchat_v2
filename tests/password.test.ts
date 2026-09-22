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

  it('모르는 문구는 그대로 둔다 — 원인을 찾을 수 있어야 한다', () => {
    expect(authErrorMessage('Something odd happened')).toBe('Something odd happened');
  });
});
