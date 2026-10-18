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
  let value = initialValue;
  const storage: PendingSignupProfileStorage = {
    getItem: jest.fn(async (key: string) => {
      expect(key).toBe(PENDING_SIGNUP_PROFILE_KEY);
      return value;
    }),
    setItem: jest.fn(async (key: string, next: string) => {
      expect(key).toBe(PENDING_SIGNUP_PROFILE_KEY);
      value = next;
    }),
    removeItem: jest.fn(async (key: string) => {
      expect(key).toBe(PENDING_SIGNUP_PROFILE_KEY);
      value = null;
    }),
  };
  return { storage, read: () => value };
}

const draft = {
  email: 'Mealchat@Example.com',
  userId: 'signup-user',
  bank: '국민은행',
  account: '1234-56-7890',
  birth: { year: '2003', month: '10', day: '29' },
  tastes: { korean: true, seafood: false },
};

describe('pendingSignupProfile', () => {
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

    expect(await readPendingSignupProfile(storage, 1000)).toEqual({ ...draft, savedAt: 1000 });
  });

  it('지우면 없어진다 — 옮겨 담은 뒤 계좌번호를 기기에 남기지 않는다', async () => {
    const { storage, read } = createStorage();
    await persistPendingSignupProfile(storage, draft);
    await clearPendingSignupProfile(storage);

    expect(read()).toBeNull();
    expect(await readPendingSignupProfile(storage)).toBeNull();
  });

  it('건강·식단과 알 수 없는 취향 키는 가입 보조 저장소에 남기지 않는다', async () => {
    const { storage, read } = createStorage();
    await persistPendingSignupProfile(storage, { ...draft, tastes: { korean: true, allergy: true, dietary_restriction: false, unknown: true } });
    expect(read()).not.toMatch(/allergy|dietary_restriction|unknown/);
    expect((await readPendingSignupProfile(storage))?.tastes).toEqual({ korean: true });
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
      tastes: {},
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
