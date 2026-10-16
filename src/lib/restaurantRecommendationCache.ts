/** In-memory recommendations belong to one signed-in user, including pending requests. */
export type RestaurantRecommendationState = {
  key: string;
  roomId: string | null;
  status: 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'unavailable';
  items: { label: string; fresh?: boolean }[];
  reason?: string;
  receivedMore: boolean;
};
export const RESTAURANT_RECOMMENDATION_TIMEOUT_MS = 25_000;
type Listener = (state: RestaurantRecommendationState) => void;
type Entry = {
  sequence: number;
  state: RestaurantRecommendationState;
  listeners: Set<Listener>;
  timer?: ReturnType<typeof setTimeout>;
};
let currentUserId: string | null = null;
let sessionVersion = 0;
const entries = new Map<string, Entry>();

/** Auth events also clear this cache while no chat screen is mounted. */
export function setRestaurantRecommendationUser(userId: string | null) {
  if (currentUserId === userId) return;
  currentUserId = userId;
  sessionVersion += 1;
  for (const entry of entries.values()) { clearTimeout(entry.timer); entry.listeners.clear(); }
  entries.clear();
}

/** Explicit request intent cannot survive logout and a new session for the same id. */
export function getRestaurantRecommendationSession() {
  return sessionVersion;
}

export function getRestaurantRecommendation(userId: string, key: string) {
  return currentUserId === userId ? entries.get(key) : undefined;
}

export function createRestaurantRecommendation(userId: string, key: string, sequence: number, state: RestaurantRecommendationState) {
  const entry: Entry = { sequence, state, listeners: new Set() };
  if (currentUserId === userId) {
    clearTimeout(entries.get(key)?.timer);
    entries.set(key, entry);
    if (state.status === 'loading') entry.timer = setTimeout(() => {
      updateRestaurantRecommendation(userId, key, entry, {
        ...state, status: 'error', receivedMore: false,
        reason: '추천 시간이 오래 걸리고 있어요. 다시 시도해 주세요.',
      });
    }, RESTAURANT_RECOMMENDATION_TIMEOUT_MS);
  }
  return entry;
}

export function isRestaurantRecommendationCurrent(userId: string, key: string, entry: Entry) {
  return currentUserId === userId && entries.get(key) === entry;
}

export function updateRestaurantRecommendation(userId: string, key: string, entry: Entry, state: RestaurantRecommendationState) {
  // An old account's in-flight response must never repopulate a cleared session.
  if (!isRestaurantRecommendationCurrent(userId, key, entry) || entry.state.status !== 'loading') return;
  clearTimeout(entry.timer);
  entry.state = state;
  for (const listener of entry.listeners) listener(state);
}

export function subscribeRestaurantRecommendation(entry: Entry, listener: Listener) {
  entry.listeners.add(listener);
  listener(entry.state);
  return () => { entry.listeners.delete(listener); };
}

export function removeRestaurantRecommendation(userId: string, key: string) {
  if (currentUserId !== userId) return;
  clearTimeout(entries.get(key)?.timer);
  entries.get(key)?.listeners.clear();
  entries.delete(key);
}
