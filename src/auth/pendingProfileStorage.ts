import { Platform } from 'react-native';
import { newConsentRequestId } from '../consents/contracts';

export type DraftMetadataStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
export type SecureDraftStorage = {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  remove(): Promise<void>;
};
export const SECURE_PENDING_PROFILE_KEY = 'mealchat.auth.pending-signup-profile.v2';
// Random validity id only. No account, birth, email, user id or profile JSON here.
export const PENDING_PROFILE_TICKET_KEY = 'mealchat.auth.pending-profile-ticket.v2';
export const PENDING_PROFILE_MAX_BYTES = 2048;
const DISCARDED = 'discarded';
// Load inside the operation so unsupported native binaries fail closed, not at app import.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Catch requireNativeModule failures inside the operation.
const loadSecureStore = (): typeof import('expo-secure-store') => require('expo-secure-store');

const nativeSecureStorage: SecureDraftStorage = {
  async get() {
    const secure = loadSecureStore();
    if (!(await secure.isAvailableAsync())) throw new Error('Secure storage unavailable');
    return secure.getItemAsync(SECURE_PENDING_PROFILE_KEY, { keychainAccessible: secure.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
  async set(value) {
    const secure = loadSecureStore();
    if (!(await secure.isAvailableAsync())) throw new Error('Secure storage unavailable');
    await secure.setItemAsync(SECURE_PENDING_PROFILE_KEY, value, { keychainAccessible: secure.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
  async remove() {
    const secure = loadSecureStore();
    await secure.deleteItemAsync(SECURE_PENDING_PROFILE_KEY, { keychainAccessible: secure.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
};
function byteLength(value: string) {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0)!;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}

/** One serialized slot: logout/deletion cannot be overtaken by an earlier native write. */
export function createPendingProfileStorage({ metadata, legacyKey, valid, onDiscard, project = (raw: string) => raw, platform = Platform.OS, secure = nativeSecureStorage }: {
  metadata: DraftMetadataStorage; legacyKey: string; valid: (raw: string, now: number) => boolean;
  onDiscard: () => void; project?: (raw: string) => string; platform?: string; secure?: SecureDraftStorage;
}) {
  let memory: string | null = null;
  let revoked = false;
  let queue: Promise<unknown> = Promise.resolve();
  const run = <T,>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(operation);
    queue = result.catch(() => undefined);
    return result;
  };
  const erase = async () => {
    memory = null; revoked = true;
    // Revoke before Keychain deletion. A locked/failed delete must not resurrect the slot.
    const results = await Promise.allSettled([metadata.removeItem(legacyKey), metadata.removeItem(PENDING_PROFILE_TICKET_KEY)]);
    if (platform !== 'web') await secure.remove().catch(() => undefined);
    if (results.some(result => result.status === 'rejected')) throw new Error('Pending profile cleanup unavailable');
  };
  const discard = async () => {
    await erase().catch(() => undefined);
    if (platform !== 'web') await metadata.setItem(PENDING_PROFILE_TICKET_KEY, DISCARDED).catch(() => undefined);
    onDiscard();
  };
  const write = async (raw: string) => {
    if (platform === 'web') { memory = raw; revoked = false; return; }
    await metadata.removeItem(PENDING_PROFILE_TICKET_KEY);
    const ticket = newConsentRequestId();
    const envelope = JSON.stringify({ ticket, value: raw });
    if (byteLength(envelope) > PENDING_PROFILE_MAX_BYTES) throw new Error('Pending profile too large');
    await secure.set(envelope);
    // Publish only after the secure write succeeds; ticket has no private profile data.
    await metadata.setItem(PENDING_PROFILE_TICKET_KEY, ticket);
    revoked = false;
  };
  return {
    read: (now: number): Promise<string | null> => run(async () => {
      let legacy: string | null = null;
      try {
        // Always remove the original before validation or any secure read/write.
        try { legacy = await metadata.getItem(legacyKey); }
        finally { await metadata.removeItem(legacyKey); }
        if (platform === 'web') {
          await metadata.removeItem(PENDING_PROFILE_TICKET_KEY);
          // An old plaintext install is discarded on web, never copied to another disk store.
          if (legacy) onDiscard();
          if (memory && !valid(memory, now)) memory = null;
          return memory;
        }
        const ticket = await metadata.getItem(PENDING_PROFILE_TICKET_KEY);
        // The failed write already notified the user; consume its marker quietly.
        if (ticket === DISCARDED) { await erase().catch(() => undefined); return null; }
        if (ticket && !revoked) {
          let raw: string | null;
          // WHEN_UNLOCKED can fail during background startup. Keep the slot and ticket
          // for a later unlocked read; never fall back to plaintext or apply unread data.
          try { raw = await secure.get(); } catch { return null; }
          // Backup restore can restore only the ticket, without the device-only slot.
          if (!raw) { await erase().catch(() => undefined); return null; }
          if (byteLength(raw) > PENDING_PROFILE_MAX_BYTES) throw new Error('Pending profile too large');
          const envelope = JSON.parse(raw) as { ticket?: unknown; value?: unknown };
          if (envelope.ticket === ticket && typeof envelope.value === 'string' && valid(envelope.value, now)) return project(envelope.value);
          await erase(); onDiscard(); return null;
        }
        if (!revoked && legacy && valid(legacy, now)) { const projected = project(legacy); await write(projected); return projected; }
        // Also removes iOS Keychain leftovers after reinstall (AsyncStorage ticket is gone).
        await erase(); return null;
      } catch { await discard(); return null; }
    }),
    write: (raw: string, now: number): Promise<void> => run(async () => {
      try {
        await erase();
        if (!valid(raw, now)) return;
        await write(raw);
      } catch { await discard(); }
    }),
    clear: (): Promise<void> => run(erase),
  };
}
