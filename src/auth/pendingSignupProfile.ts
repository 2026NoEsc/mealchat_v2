/**
 * 가입 화면에서 받았지만 아직 서버에 못 넣은 값.
 *
 * 계좌·생년월일·취향은 본인만 볼 수 있는 행(profile_private)에 들어가고, 그 쓰기는
 * 로그인된 세션을 요구한다. 그런데 이메일 확인을 켜 두면 가입 직후에는 세션이 없다.
 * 예전에는 그 경우 그냥 버려서, 메일을 확인하고 처음 로그인하면 적어 넣은 값이
 * 하나도 없었다.
 *
 * 그래서 세션이 생길 때까지 기기에 맡겨 두었다가, 로그인하는 순간 옮겨 담는다.
 *
 * 계좌번호가 들어 있으므로 오래 두지 않는다 — 옮겨 담자마자 지우고, 확인 메일을
 * 끝내 열지 않은 경우를 위해 기한도 둔다.
 */
export const PENDING_SIGNUP_PROFILE_KEY = 'mealchat.auth.pending-signup-profile.v1';

/** 이 기간이 지나면 버린다 */
export const PENDING_SIGNUP_PROFILE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export type PendingSignupProfile = {
  /** 이 값이 누구 것인지 가리는 기준. 다른 계정으로 로그인하면 옮기지 않는다 */
  email: string;
  bank: string | null;
  account: string;
  birth: { year: string; month: string; day: string };
  tastes: Record<string, boolean>;
  /** 저장한 때 (Date.now) */
  savedAt: number;
};

export type PendingSignupProfileStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

/**
 * 저장해 둔 글자를 값으로 되돌린다.
 *
 * 앱 판이 바뀌거나 저장이 중간에 끊겨 모양이 깨져 있을 수 있다. 그럴 때는 null 을
 * 돌려 그냥 없는 셈 친다 — 가입 보조 값이라 터뜨릴 이유가 없다.
 */
export function parsePendingSignupProfile(raw: string | null): PendingSignupProfile | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const value = parsed as Record<string, unknown>;
    const email = typeof value.email === 'string' ? value.email : '';
    if (!email.trim()) return null;

    const birth = (value.birth ?? {}) as Record<string, unknown>;
    const tastes = (value.tastes ?? {}) as Record<string, unknown>;

    return {
      email,
      bank: typeof value.bank === 'string' ? value.bank : null,
      account: typeof value.account === 'string' ? value.account : '',
      birth: {
        year: typeof birth.year === 'string' ? birth.year : '',
        month: typeof birth.month === 'string' ? birth.month : '',
        day: typeof birth.day === 'string' ? birth.day : '',
      },
      tastes: Object.fromEntries(
        Object.entries(tastes).filter(([, picked]) => typeof picked === 'boolean'),
      ) as Record<string, boolean>,
      savedAt: typeof value.savedAt === 'number' ? value.savedAt : 0,
    };
  } catch {
    return null;
  }
}

/** 지금 로그인한 사람에게 옮겨 담아도 되는 값인지 */
export function isPendingProfileFor(
  pending: PendingSignupProfile | null,
  email: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!pending) return false;

  const owner = normalizeEmail(pending.email);
  const signedIn = normalizeEmail(email);
  if (!owner || !signedIn || owner !== signedIn) return false;

  return now - pending.savedAt <= PENDING_SIGNUP_PROFILE_TTL_MS;
}

export async function persistPendingSignupProfile(
  storage: PendingSignupProfileStorage,
  value: Omit<PendingSignupProfile, 'savedAt'>,
  now: number = Date.now(),
): Promise<void> {
  await storage.setItem(PENDING_SIGNUP_PROFILE_KEY, JSON.stringify({ ...value, savedAt: now }));
}

export async function readPendingSignupProfile(
  storage: PendingSignupProfileStorage,
): Promise<PendingSignupProfile | null> {
  return parsePendingSignupProfile(await storage.getItem(PENDING_SIGNUP_PROFILE_KEY));
}

export async function clearPendingSignupProfile(
  storage: PendingSignupProfileStorage,
): Promise<void> {
  await storage.removeItem(PENDING_SIGNUP_PROFILE_KEY);
}
