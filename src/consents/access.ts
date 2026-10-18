import { setRestaurantRecommendationUser } from '../lib/restaurantRecommendationCache';
export type ConsentGateState = 'loading' | 'accepted' | 'required' | 'error';
let access: { userId: string | null; state: ConsentGateState } = { userId: null, state: 'loading' };
const listeners = new Set<() => void>();
const sensitiveClearers = new Set<() => void>();
export function setConsentAccess(userId: string | null, state: ConsentGateState) {
  access = { userId, state };
  setRestaurantRecommendationUser(state === 'accepted' ? userId : null);
  if (state !== 'accepted') for (const clear of sensitiveClearers) { try { clear(); } catch { /* Clearing one cache must never prevent the gate from closing. */ } }
  for (const listen of listeners) listen();
}
export const getConsentAccess = () => access;
export const hasConsentAccess = (userId: string | null) => Boolean(userId && access.userId === userId && access.state === 'accepted');
export function subscribeConsentAccess(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
/** Phase 4 consumers can register transient account/health caches; no stored health payload in S1. */
export function registerSensitiveConsentClearer(clear: () => void) { sensitiveClearers.add(clear); return () => { sensitiveClearers.delete(clear); }; }
export function clearOptionalConsentData() { for (const clear of sensitiveClearers) { try { clear(); } catch { /* Never expose cached data in diagnostics. */ } } }
