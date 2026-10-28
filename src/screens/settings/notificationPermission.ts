import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { NOTIFICATION_PERMISSION_PROMPT } from '../../config/features';

type GuideState = 'pending' | 'seen' | null;
type Listener = (userId: string) => void;
const listeners = new Set<Listener>();
const queue = new Map<string, Promise<void>>();
const key = (userId: string) => `@mealchat/notification-guide/v1/${userId}`;
const storage = async () => AsyncStorage;

function serialize<T>(userId: string, operation: () => Promise<T>): Promise<T> {
  const task = (queue.get(userId) ?? Promise.resolve()).then(operation);
  const tail = task.then(() => undefined, () => undefined);
  queue.set(userId, tail);
  void tail.then(() => { if (queue.get(userId) === tail) queue.delete(userId); });
  return task;
}

/** Signup only; never infer a new account from a login or a fabricated creation time. */
export function queueNotificationGuide(userId: string): Promise<void> {
  if (!NOTIFICATION_PERMISSION_PROMPT) return Promise.resolve();
  return serialize(userId, async () => {
    const local = await storage();
    const previous = await local.getItem(key(userId));
    if (previous === 'pending' || previous === 'seen') return;
    await local.setItem(key(userId), 'pending');
    listeners.forEach((listener) => listener(userId));
  });
}

export function readNotificationGuide(userId: string): Promise<GuideState> {
  return serialize(userId, async () => {
    const value = await (await storage()).getItem(key(userId));
    return value === 'pending' || value === 'seen' ? value : null;
  });
}

export function markNotificationGuideSeen(userId: string): Promise<void> {
  return serialize(userId, async () => { await (await storage()).setItem(key(userId), 'seen'); });
}

export function subscribeNotificationGuide(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export async function readNotificationPermission() {
  return Notifications.getPermissionsAsync();
}

export async function requestNotificationPermission() {
  if (!NOTIFICATION_PERMISSION_PROMPT) throw new Error('Notification permission prompt is disabled.');
  // Android 13 requires a channel before its permission prompt; create it only after the user taps allow.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: '약속 소식', importance: Notifications.AndroidImportance.DEFAULT });
  }
  // TODO(서버 단계): 기존 푸시 토큰 등록 흐름이 없으므로 권한만 요청하고 토큰 등록 계약은 별도로 추가한다.
  return Notifications.requestPermissionsAsync();
}
