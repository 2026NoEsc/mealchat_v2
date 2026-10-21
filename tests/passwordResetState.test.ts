import {
  clearPasswordResetPending,
  PASSWORD_RESET_PENDING_KEY,
  persistPasswordResetPending,
  readPasswordResetPending,
  type PasswordResetStateStorage,
} from '../src/auth/passwordResetState';

function createStorage(initialValue: string | null = null) {
  let value = initialValue;
  const storage: PasswordResetStateStorage = {
    getItem: jest.fn(async (key: string) => {
      expect(key).toBe(PASSWORD_RESET_PENDING_KEY);
      return value;
    }),
    setItem: jest.fn(async (key: string, nextValue: string) => {
      expect(key).toBe(PASSWORD_RESET_PENDING_KEY);
      value = nextValue;
    }),
    removeItem: jest.fn(async (key: string) => {
      expect(key).toBe(PASSWORD_RESET_PENDING_KEY);
      value = null;
    }),
  };

  return storage;
}

describe('password reset state', () => {
  it('복구 링크 교환 전에 pending을 저장하고 앱 재시작 뒤 복원한다', async () => {
    const storage = createStorage();

    await persistPasswordResetPending(storage);

    await expect(readPasswordResetPending(storage)).resolves.toBe(true);
  });

  it('비밀번호 변경이나 로그아웃이 끝난 뒤 pending을 제거한다', async () => {
    const storage = createStorage('1');

    await clearPasswordResetPending(storage);

    await expect(readPasswordResetPending(storage)).resolves.toBe(false);
  });
});
