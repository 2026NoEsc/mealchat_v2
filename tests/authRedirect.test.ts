import {
  authRedirectErrorMessage,
  classifyAuthRedirect,
  createAuthRedirectGuard,
} from '../src/auth/authRedirect';

describe('classifyAuthRedirect', () => {
  it('분리된 reset/callback URL에서 PKCE code를 읽는다', () => {
    expect(classifyAuthRedirect('mealchat://auth/reset?code=reset-code')).toEqual({
      kind: 'reset',
      code: 'reset-code',
    });
    expect(classifyAuthRedirect('mealchat://auth/callback?code=signup-code')).toEqual({
      kind: 'callback',
      code: 'signup-code',
    });
    expect(classifyAuthRedirect('exp://127.0.0.1:8081/--/auth/reset?code=expo-code')).toEqual({
      kind: 'reset',
      code: 'expo-code',
    });
    expect(classifyAuthRedirect('exps://127.0.0.1:8081/--/auth/callback?code=expo-callback')).toEqual({
      kind: 'callback',
      code: 'expo-callback',
    });
  });

  it('code 없는 reset/callback URL은 인증 링크로 분류하되 교환하지 않는다', () => {
    const reset = classifyAuthRedirect('mealchat://auth/reset');
    const callback = classifyAuthRedirect('mealchat://auth/callback?code=');

    expect(reset).toEqual({ kind: 'reset', code: null });
    expect(callback).toEqual({ kind: 'callback', code: null });
    expect(authRedirectErrorMessage(reset, 'missing-code')).toContain('새 재설정 메일');
    expect(authRedirectErrorMessage(callback, 'missing-code')).toContain('새 메일');
  });

  it('관련 없는 URL과 깨진 URL은 Auth 교환 대상이 아니다', () => {
    expect(classifyAuthRedirect('mealchat://profile')).toEqual({ kind: null, code: null });
    expect(classifyAuthRedirect('mealchat://auth/reset/extra?code=not-allowed')).toEqual({
      kind: null,
      code: null,
    });
    expect(classifyAuthRedirect('https://example.com/auth/reset?code=not-allowed')).toEqual({
      kind: null,
      code: null,
    });
    expect(classifyAuthRedirect('exp://127.0.0.1:8081/auth/reset?code=not-allowed')).toEqual({
      kind: null,
      code: null,
    });
    expect(classifyAuthRedirect('not a url')).toEqual({ kind: null, code: null });
  });
});

describe('createAuthRedirectGuard', () => {
  it('초기 URL과 연속 Linking 이벤트의 같은 URL을 한 번만 교환하게 한다', () => {
    const guard = createAuthRedirectGuard();
    const resetUrl = 'mealchat://auth/reset?code=one-time-code';

    expect(guard.claim(resetUrl)).toBe(true);
    expect(guard.claim(resetUrl)).toBe(false);
    expect(guard.claim('mealchat://auth/reset?code=next-code')).toBe(true);
  });
});

describe('authRedirectErrorMessage', () => {
  it('교환 실패를 사용자 행동으로 설명하고 code나 서버 원문을 포함하지 않는다', () => {
    const message = authRedirectErrorMessage(
      { kind: 'reset', code: 'sensitive-code' },
      'exchange-failed',
    );

    expect(message).toContain('만료되었거나 이미 사용');
    expect(message).toContain('새 재설정 메일');
    expect(message).not.toContain('sensitive-code');
  });
});
