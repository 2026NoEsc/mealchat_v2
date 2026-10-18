import { createPendingProfileStorage, PENDING_PROFILE_TICKET_KEY, PENDING_PROFILE_MAX_BYTES, type SecureDraftStorage } from '../src/auth/pendingProfileStorage';
import { parsePendingSignupProfile, PENDING_PROFILE_ACCOUNT_MAX_LENGTH, PENDING_SIGNUP_PROFILE_KEY, PENDING_SIGNUP_PROFILE_TTL_MS } from '../src/auth/pendingSignupProfile';

const now = 1_000_000;
const draft = { userId: 'actual-user', email: 'fixture@example.test', bank: '국민은행', account: '1234-5678', birth: { year: '2000', month: '1', day: '2' }, tastes: { korean: true }, savedAt: now };
function fixture(platform = 'ios') {
  const entries = new Map<string, string>(); let encrypted: string | null = null;
  const metadata = { getItem: jest.fn(async (key: string) => entries.get(key) ?? null), setItem: jest.fn(async (key: string, value: string) => { entries.set(key, value); }), removeItem: jest.fn(async (key: string) => { entries.delete(key); }) };
  const secure: SecureDraftStorage = { get: jest.fn(async () => encrypted), set: jest.fn(async value => { encrypted = value; }), remove: jest.fn(async () => { encrypted = null; }) };
  const onDiscard = jest.fn();
  const make = () => createPendingProfileStorage({ metadata, secure, platform, legacyKey: PENDING_SIGNUP_PROFILE_KEY, onDiscard,
    valid: (raw, clock) => { const value = parsePendingSignupProfile(raw); return Boolean(value && Number.isFinite(value.savedAt) && clock >= value.savedAt && clock - value.savedAt <= PENDING_SIGNUP_PROFILE_TTL_MS); },
    project: raw => JSON.stringify(parsePendingSignupProfile(raw)),
  });
  return { entries, metadata, secure, make, vault: make(), onDiscard, encrypted: () => encrypted };
}
it('migrates a valid bound legacy draft only after deleting the plaintext original', async () => {
  const f = fixture(); f.entries.set(PENDING_SIGNUP_PROFILE_KEY, JSON.stringify({ ...draft, password: 'do-not-copy', unknown: true }));
  const set = (f.secure.set as jest.Mock).getMockImplementation()!;
  (f.secure.set as jest.Mock).mockImplementation(async value => {
    expect(f.entries.has(PENDING_SIGNUP_PROFILE_KEY)).toBe(false);
    expect(value).not.toContain('do-not-copy');
    await set(value);
  });
  const result = await f.vault.read(now);
  expect(JSON.parse(result!)).toEqual(draft); expect(f.encrypted()).toContain(draft.account); expect(f.metadata.setItem).toHaveBeenCalledWith(PENDING_PROFILE_TICKET_KEY, expect.any(String));
  expect(f.metadata.setItem).not.toHaveBeenCalledWith(PENDING_SIGNUP_PROFILE_KEY, expect.anything());
});
it.each(['unbound', 'expired', 'future', 'malformed'])('deletes %s legacy data without a secure write', async kind => {
  const f = fixture();
  const value = { ...draft, ...(kind === 'unbound' ? { userId: null } : kind === 'expired' ? { savedAt: now - PENDING_SIGNUP_PROFILE_TTL_MS - 1 } : kind === 'future' ? { savedAt: now + 1 } : {}) };
  f.entries.set(PENDING_SIGNUP_PROFILE_KEY, kind === 'malformed' ? '{' : JSON.stringify(value));
  expect(await f.vault.read(now)).toBeNull(); expect(f.entries.has(PENDING_SIGNUP_PROFILE_KEY)).toBe(false); expect(f.secure.set).not.toHaveBeenCalled();
});
it('keeps a newer secure slot rather than overwriting it with leftover legacy data', async () => {
  const f = fixture(); await f.vault.write(JSON.stringify(draft), now);
  f.entries.set(PENDING_SIGNUP_PROFILE_KEY, JSON.stringify({ ...draft, userId: 'old-user', savedAt: now - 1 }));
  expect(JSON.parse((await f.vault.read(now))!).userId).toBe(draft.userId);
  expect(f.entries.has(PENDING_SIGNUP_PROFILE_KEY)).toBe(false); expect(f.secure.set).toHaveBeenCalledTimes(1);
});
it('preserves the ticket and native draft when a locked secure read fails, then reads it after unlocking', async () => {
  const f = fixture(); await f.vault.write(JSON.stringify(draft), now);
  const ticket = f.entries.get(PENDING_PROFILE_TICKET_KEY), encrypted = f.encrypted();
  (f.secure.remove as jest.Mock).mockClear();
  (f.secure.get as jest.Mock).mockRejectedValueOnce(Error('Keychain locked'));
  expect(await f.vault.read(now)).toBeNull();
  expect(f.entries.get(PENDING_PROFILE_TICKET_KEY)).toBe(ticket);
  expect(f.encrypted()).toBe(encrypted);
  expect(f.secure.remove).not.toHaveBeenCalled(); expect(f.onDiscard).not.toHaveBeenCalled();
  expect(JSON.parse((await f.make().read(now))!)).toEqual(draft);
  expect(f.metadata.setItem.mock.calls.every(([key]) => key === PENDING_PROFILE_TICKET_KEY)).toBe(true);
});
it.each(['write', 'migration'])('discards a draft on secure %s failure without plaintext fallback or duplicate notices', async failure => {
  const f = fixture();
  (f.secure.set as jest.Mock).mockRejectedValueOnce(Error('private native failure'));
  if (failure === 'migration') f.entries.set(PENDING_SIGNUP_PROFILE_KEY, JSON.stringify(draft));
  if (failure === 'write') await f.vault.write(JSON.stringify(draft), now); else expect(await f.vault.read(now)).toBeNull();
  expect(f.onDiscard).toHaveBeenCalled(); expect(f.encrypted()).toBeNull(); expect(f.entries.has(PENDING_SIGNUP_PROFILE_KEY)).toBe(false);
  expect(JSON.stringify(f.metadata.setItem.mock.calls)).not.toMatch(/1234-5678|birth|fixture@example/);
  expect(await f.make().read(now)).toBeNull();
  expect(f.entries.has(PENDING_PROFILE_TICKET_KEY)).toBe(false);
  expect(f.onDiscard).toHaveBeenCalledTimes(1);
});
it('quietly removes a restored ticket whose device-only secure slot is missing', async () => {
  const f = fixture(); await f.vault.write(JSON.stringify(draft), now);
  await f.secure.remove();
  expect(f.entries.has(PENDING_PROFILE_TICKET_KEY)).toBe(true);
  expect(await f.make().read(now)).toBeNull();
  expect(f.entries.has(PENDING_PROFILE_TICKET_KEY)).toBe(false);
  expect(f.onDiscard).not.toHaveBeenCalled();
});
it.each(['malformed', 'wrong-ticket', 'oversized'])('still deletes a %s secure envelope', async kind => {
  const f = fixture(); await f.vault.write(JSON.stringify(draft), now);
  (f.secure.get as jest.Mock).mockResolvedValueOnce(kind === 'malformed' ? '{'
    : kind === 'wrong-ticket' ? JSON.stringify({ ticket: 'other', value: JSON.stringify(draft) })
      : 'x'.repeat(PENDING_PROFILE_MAX_BYTES + 1));
  expect(await f.vault.read(now)).toBeNull();
  expect(f.encrypted()).toBeNull();
  await f.make().read(now);
  expect(f.entries.has(PENDING_PROFILE_TICKET_KEY)).toBe(false);
  expect(f.onDiscard).toHaveBeenCalledTimes(1);
});
it('fits the maximum account input, full birth and food choices, and a 254-character email in a 2KB envelope', async () => {
  const f = fixture();
  const maximum = { ...draft, userId: '00000000-0000-4000-8000-000000000000',
    email: `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(56)}.test`,
    bank: '한국투자증권', account: '9'.repeat(PENDING_PROFILE_ACCOUNT_MAX_LENGTH),
    birth: { year: '2000', month: '12', day: '31' }, savedAt: 1_790_000_000_000,
    tastes: { korean: true, meat: true, seafood: true, western: true, chinese: true, japanese: true },
  };
  expect(maximum.email).toHaveLength(254);
  await f.vault.write(JSON.stringify(maximum), maximum.savedAt);
  expect(f.secure.set).toHaveBeenCalledTimes(1);
  const envelope = (f.secure.set as jest.Mock).mock.calls[0][0];
  expect(Buffer.byteLength(envelope, 'utf8')).toBeLessThanOrEqual(PENDING_PROFILE_MAX_BYTES);
  expect(JSON.parse((await f.vault.read(maximum.savedAt))!)).toEqual(maximum);
  expect(f.onDiscard).not.toHaveBeenCalled();
});
it('cannot resurrect an encrypted slot after deletion fails and the app restarts', async () => {
  const f = fixture(); await f.vault.write(JSON.stringify(draft), now);
  (f.secure.remove as jest.Mock).mockRejectedValue(Error('Keychain locked'));
  await f.vault.clear(); expect(f.encrypted()).not.toBeNull();
  expect(f.entries.has(PENDING_PROFILE_TICKET_KEY)).toBe(false);
  const reads = (f.secure.get as jest.Mock).mock.calls.length;
  expect(await f.make().read(now)).toBeNull(); expect(f.secure.get).toHaveBeenCalledTimes(reads);
});
it('expires and removes the native slot after three days', async () => {
  const f = fixture(); await f.vault.write(JSON.stringify(draft), now);
  expect(await f.vault.read(now + PENDING_SIGNUP_PROFILE_TTL_MS + 1)).toBeNull();
  expect(f.encrypted()).toBeNull(); expect(f.entries.has(PENDING_PROFILE_TICKET_KEY)).toBe(false);
});
it('rejects a UTF-8 value larger than the native 2KB limit before calling SecureStore', async () => {
  const f = fixture(); await f.vault.write(JSON.stringify({ ...draft, account: '한'.repeat(PENDING_PROFILE_MAX_BYTES) }), now);
  expect(f.secure.set).not.toHaveBeenCalled(); expect(f.onDiscard).toHaveBeenCalled();
  expect(JSON.stringify(f.metadata.setItem.mock.calls)).not.toContain('한');
});
it('serializes logout behind an in-flight native write and deletes the completed write', async () => {
  const f = fixture(); let finish!: () => void;
  (f.secure.set as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const write = f.vault.write(JSON.stringify(draft), now);
  for (let index = 0; index < 50 && !finish; index++) await Promise.resolve();
  const logout = f.vault.clear(); finish(); await write; await logout;
  expect(f.entries.has(PENDING_PROFILE_TICKET_KEY)).toBe(false); expect(await f.vault.read(now)).toBeNull();
});
it('uses memory only on web and loses confirmation-wait profile fields after a reload', async () => {
  const f = fixture('web'); await f.vault.write(JSON.stringify(draft), now);
  expect(JSON.parse((await f.vault.read(now))!)).toEqual(draft);
  expect(f.metadata.setItem).not.toHaveBeenCalled(); expect(f.secure.set).not.toHaveBeenCalled(); expect(f.secure.get).not.toHaveBeenCalled();
  expect(await f.make().read(now)).toBeNull();
  await f.vault.clear(); expect(await f.vault.read(now)).toBeNull();
});
it('removes a web legacy plaintext draft without writing it anywhere else', async () => {
  const f = fixture('web'); f.entries.set(PENDING_SIGNUP_PROFILE_KEY, JSON.stringify(draft));
  expect(await f.vault.read(now)).toBeNull(); expect(f.entries.has(PENDING_SIGNUP_PROFILE_KEY)).toBe(false);
  expect(f.metadata.setItem).not.toHaveBeenCalled(); expect(f.secure.set).not.toHaveBeenCalled(); expect(f.onDiscard).toHaveBeenCalled();
});
