jest.mock('expo-secure-store', () => require('./fixtures/secureStore')());
jest.mock('../src/lib/confirm', () => ({ notify: jest.fn() }));
import * as SecureStore from 'expo-secure-store';
import { SECURE_PENDING_PROFILE_KEY, PENDING_PROFILE_TICKET_KEY } from '../src/auth/pendingProfileStorage';
import {
  clearPendingSignupProfile,
  isPendingProfileFor,
  parsePendingSignupProfile,
  PENDING_SIGNUP_PROFILE_KEY,
  PENDING_SIGNUP_PROFILE_TTL_MS,
  persistPendingSignupProfile,
  readPendingSignupProfile,
  type PendingSignupProfile,
  type PendingSignupProfileStorage,
} from '../src/auth/pendingSignupProfile';

function createStorage(initialValue: string | null = null) {
  const values = new Map<string, string>();
  if (initialValue !== null) values.set(PENDING_SIGNUP_PROFILE_KEY, initialValue);
  const storage: PendingSignupProfileStorage = {
    getItem: jest.fn(async (key: string) => {
      return values.get(key) ?? null;
    }),
    setItem: jest.fn(async (key: string, next: string) => {
      values.set(key, next);
    }),
    removeItem: jest.fn(async (key: string) => {
      values.delete(key);
    }),
  };
  return { storage, read: () => values.get(PENDING_SIGNUP_PROFILE_KEY) ?? null };
}
beforeEach(() => { (SecureStore as unknown as { reset(): void }).reset(); jest.clearAllMocks(); });

const draft = {
  email: 'Mealchat@Example.com',
  userId: 'signup-user',
  bank: '국민은행',
  account: '1234-56-7890',
  birth: { year: '2003', month: '10', day: '29' },
};

describe('pendingSignupProfile', () => {
  it('migrates the bound legacy slot through the installed SecureStore adapter and removes its original', async () => {
    const { storage, read } = createStorage(JSON.stringify({ ...draft, savedAt: 1000 }));
    expect(await readPendingSignupProfile(storage, 1000)).toEqual({ ...draft, savedAt: 1000 });
    expect(read()).toBeNull(); expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(JSON.stringify((storage.setItem as jest.Mock).mock.calls)).not.toContain(draft.account);
  });
  it('discards fields and gives safe re-entry guidance when native secure storage is unavailable', async () => {
    (SecureStore.isAvailableAsync as jest.Mock).mockResolvedValue(false);
    const { storage } = createStorage(); await persistPendingSignupProfile(storage, draft);
    expect(await readPendingSignupProfile(storage)).toBeNull(); expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(require('../src/lib/confirm').notify).toHaveBeenCalledWith('프로필 입력 필요', expect.stringContaining('프로필에서 계좌와 생년월일을 다시 입력'));
  });
  it('uses the consent TTL and removes expired account and birth data when read', async () => {
    expect(PENDING_SIGNUP_PROFILE_TTL_MS).toBe(require('../src/auth/pendingSignupConsents').PENDING_SIGNUP_CONSENTS_TTL_MS);
    const { storage, read } = createStorage();
    await persistPendingSignupProfile(storage, draft, 1000);
    expect(await readPendingSignupProfile(storage, 1000 + PENDING_SIGNUP_PROFILE_TTL_MS + 1)).toBeNull();
    expect(read()).toBeNull();
  });
  it('맡겼다가 그대로 되찾는다', async () => {
    const { storage } = createStorage();
    await persistPendingSignupProfile(storage, draft, 1000);
    expect(SecureStore.isAvailableAsync).toHaveBeenCalled();
    expect(SecureStore.setItemAsync).toHaveBeenCalled();
    expect(await SecureStore.getItemAsync(SECURE_PENDING_PROFILE_KEY)).not.toBeNull();
    expect(await readPendingSignupProfile(storage, 1000)).toEqual({ ...draft, savedAt: 1000 });
    expect(storage.setItem).toHaveBeenCalledWith(PENDING_PROFILE_TICKET_KEY, expect.any(String));
    expect(storage.setItem).not.toHaveBeenCalledWith(PENDING_SIGNUP_PROFILE_KEY, expect.anything());
    expect(JSON.stringify((storage.setItem as jest.Mock).mock.calls)).not.toContain(draft.account);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(SECURE_PENDING_PROFILE_KEY, expect.stringContaining(draft.account), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  });

  it('지우면 없어진다 — 옮겨 담은 뒤 계좌번호를 기기에 남기지 않는다', async () => {
    const { storage, read } = createStorage();
    await persistPendingSignupProfile(storage, draft);
    await clearPendingSignupProfile(storage);

    expect(read()).toBeNull();
    expect(await readPendingSignupProfile(storage)).toBeNull();
  });

  it('이전 음식·건강 취향 키를 가입 보조 저장소에서 제거한다', async () => {
    const { storage, read } = createStorage();
    await persistPendingSignupProfile(storage, { ...draft, tastes: { korean: true, allergy: true, dietary_restriction: false, unknown: true } } as typeof draft);
    expect(read()).toBeNull();
    expect(JSON.stringify((SecureStore.setItemAsync as jest.Mock).mock.calls)).not.toMatch(/tastes|korean|allergy|dietary_restriction|unknown/);
    expect(await readPendingSignupProfile(storage)).not.toHaveProperty('tastes');
  });

  it('깨진 값은 없는 셈 친다', async () => {
    expect(parsePendingSignupProfile(null)).toBeNull();
    expect(parsePendingSignupProfile('')).toBeNull();
    expect(parsePendingSignupProfile('{')).toBeNull();
    expect(parsePendingSignupProfile('"글자"')).toBeNull();
    /* 이메일이 없으면 누구 것인지 가릴 수 없다 */
    expect(parsePendingSignupProfile('{"account":"1234"}')).toBeNull();
  });

  it('빠진 칸은 빈 값으로 채운다', () => {
    const parsed = parsePendingSignupProfile('{"email":"a@b.com","userId":"signup-user"}');

    expect(parsed).toEqual({
      email: 'a@b.com',
      userId: 'signup-user',
      bank: null,
      account: '',
      birth: { year: '', month: '', day: '' },
      savedAt: 0,
    });
  });

  describe('isPendingProfileFor', () => {
    const pending: PendingSignupProfile = { ...draft, savedAt: 1_000_000 };

    it('대소문자·앞뒤 공백이 달라도 같은 주소로 본다', () => {
      expect(isPendingProfileFor(pending, { id: 'signup-user', email: '  mealchat@example.com ' }, 1_000_000)).toBe(true);
    });

    it('다른 계정으로 로그인하면 옮기지 않는다', () => {
      expect(isPendingProfileFor(pending, { id: 'signup-user', email: 'other@example.com' }, 1_000_000)).toBe(false);
    });

    it('주소를 모르면 옮기지 않는다', () => {
      expect(isPendingProfileFor(pending, { id: 'signup-user', email: null }, 1_000_000)).toBe(false);
      expect(isPendingProfileFor(pending, { id: 'signup-user', email: '' }, 1_000_000)).toBe(false);
    });

    it('맡길 것이 없으면 false', () => {
      expect(isPendingProfileFor(null, { id: 'signup-user', email: 'mealchat@example.com' })).toBe(false);
    });

    it('기한이 지나면 버린다', () => {
      const justInTime = pending.savedAt + PENDING_SIGNUP_PROFILE_TTL_MS;
      expect(isPendingProfileFor(pending, { id: 'signup-user', email: draft.email }, justInTime)).toBe(true);
      expect(isPendingProfileFor(pending, { id: 'signup-user', email: draft.email }, justInTime + 1)).toBe(false);
    });
  });
});

it('removes legacy unbound personal data even when its email matches', async () => {
  const { userId: omitted, ...unbound } = { ...draft, savedAt: Date.now() }; void omitted;
  const { storage, read } = createStorage(JSON.stringify(unbound));
  expect(await readPendingSignupProfile(storage)).toBeNull(); expect(read()).toBeNull();
});
it('requires the exact user id even for an identical email', () => {
  const pending = { ...draft, savedAt: 1000 };
  expect(isPendingProfileFor(pending, { id: 'other', email: draft.email }, 1000)).toBe(false);
  expect(isPendingProfileFor({ ...pending, userId: '' }, { id: 'signup-user', email: draft.email }, 1000)).toBe(false);
});
