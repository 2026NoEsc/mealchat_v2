import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MyLocation } from './myLocation';

export type OriginSource = 'profile' | 'gps' | 'search';
export type ScheduleDraft = { name: string; invitees: string[]; origin: MyLocation | null; originSource: OriginSource };
const key = (userId: string) => '@mealchat/schedule-settings-draft/v1/' + userId;
const MAX_AGE_MS = 30 * 60 * 1000;

/** Saved only before opening OS settings; scoped to the account, expires after 30 minutes. */
export async function saveSettingsDraft(userId: string, draft: ScheduleDraft): Promise<void> {
  await AsyncStorage.setItem(key(userId), JSON.stringify({ expiresAt: Date.now() + MAX_AGE_MS, draft }));
}
export async function clearSettingsDraft(userId: string): Promise<void> { await AsyncStorage.removeItem(key(userId)); }
export async function takeSettingsDraft(userId: string): Promise<ScheduleDraft | null> {
  const raw = await AsyncStorage.getItem(key(userId));
  if (!raw) return null;
  await clearSettingsDraft(userId);
  try {
    const value = JSON.parse(raw);
    const draft = value?.draft;
    if (typeof value?.expiresAt !== 'number' || value.expiresAt <= Date.now() || !draft || typeof draft.name !== 'string' || !Array.isArray(draft.invitees) || draft.invitees.some((id: unknown) => typeof id !== 'string')) return null;
    if (!['profile', 'gps', 'search'].includes(draft.originSource)) return null;
    if (draft.origin !== null) {
      const origin = draft.origin;
      if (!origin || typeof origin.name !== 'string' || typeof origin.address !== 'string' || typeof origin.fromGps !== 'boolean' || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng) || Math.abs(origin.lat) > 90 || Math.abs(origin.lng) > 180) return null;
    }
    return draft;
  } catch { return null; }
}
