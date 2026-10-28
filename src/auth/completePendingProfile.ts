import AsyncStorage from '@react-native-async-storage/async-storage';
import { getConsentAccess, hasConsentAccess, subscribeConsentAccess } from '../consents/access';
import { saveMyPrivateProfile } from '../lib/profile';
import { clearPendingSignupProfile, isPendingProfileFor, parsePendingSignupProfile, readPendingSignupProfile, type PendingSignupProfile } from './pendingSignupProfile';

const writes = new Map<string, Promise<void>>();
let immediateProfile: PendingSignupProfile | null = null;
// Immediate-session signups keep account/birth data in memory until the accepted gate can save it.
subscribeConsentAccess(() => {
  if (immediateProfile && immediateProfile.userId !== getConsentAccess().userId) immediateProfile = null;
});
export function rememberImmediateSignupProfile(profile: PendingSignupProfile) {
  const currentUser = getConsentAccess().userId;
  if (currentUser && currentUser !== profile.userId) return;
  immediateProfile = parsePendingSignupProfile(JSON.stringify(profile));
}
export function forgetImmediateSignupProfile() { immediateProfile = null; }

/** Only an accepted, exactly matching user may flush signup personal fields. */
export function completePendingProfile(user: { id: string; email?: string }): Promise<void> {
  const existing = writes.get(user.id);
  if (existing) return existing;
  const write = (async () => {
    const pending = immediateProfile?.userId === user.id ? immediateProfile : await readPendingSignupProfile(AsyncStorage);
    if (!pending || !hasConsentAccess(user.id)) return;
    if (!isPendingProfileFor(pending, user)) {
      if (pending === immediateProfile) immediateProfile = null;
      else await clearPendingSignupProfile(AsyncStorage);
      return;
    }
    if (!hasConsentAccess(user.id)) return;
    const error = await saveMyPrivateProfile(user.id, pending);
    if (error || !hasConsentAccess(user.id)) return;
    if (pending === immediateProfile) { immediateProfile = null; return; }
    // A late response must not remove another account's newer pending draft.
    const current = await readPendingSignupProfile(AsyncStorage);
    if (hasConsentAccess(user.id) && current?.userId === user.id && current.savedAt === pending.savedAt && current.email === pending.email) await clearPendingSignupProfile(AsyncStorage);
  })().finally(() => { writes.delete(user.id); });
  writes.set(user.id, write);
  return write;
}
