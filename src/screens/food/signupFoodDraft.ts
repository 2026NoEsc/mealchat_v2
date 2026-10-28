import type { FoodPreferences } from '../../lib/foodProfile';

// No health data, email or credentials. A signup draft is usable only after binding the actual signup id.
let draft: { preferences: FoodPreferences; userId: string | null } | null = null;
export function setSignupFoodDraft(preferences: FoodPreferences | null) { draft = preferences ? { preferences, userId: null } : null; }
export function bindSignupFoodDraft(userId: string | null) { if (!userId) draft = null; else if (draft) draft.userId = userId; }
export function peekSignupFoodDraft(userId: string): FoodPreferences | null { return draft?.userId === userId ? draft.preferences : null; }
export function clearSignupFoodDraft(userId: string) { if (draft?.userId === userId) draft = null; }
export function takeSignupFoodDraft(userId: string): FoodPreferences | null {
  const value = draft?.userId === userId ? draft.preferences : null;
  draft = null;
  return value;
}
