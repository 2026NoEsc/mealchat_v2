export const PASSWORD_RESET_PENDING_KEY = 'mealchat.auth.password-reset-pending.v1';

export type PasswordResetStateStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export async function readPasswordResetPending(storage: PasswordResetStateStorage) {
  return (await storage.getItem(PASSWORD_RESET_PENDING_KEY)) === '1';
}

export async function persistPasswordResetPending(storage: PasswordResetStateStorage) {
  await storage.setItem(PASSWORD_RESET_PENDING_KEY, '1');
}

export async function clearPasswordResetPending(storage: PasswordResetStateStorage) {
  await storage.removeItem(PASSWORD_RESET_PENDING_KEY);
}
