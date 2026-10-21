import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { completeSignupConsents, fetchConsentManifest, fetchConsentStatus, fetchLegacyConsentStatus, getConsentServerMode, getConsentServerModeSnapshot, subscribeConsentServerMode, invalidateConsentServerMode } from '../lib/consents';
import { completePendingProfile } from '../auth/completePendingProfile';
import { clearPendingSignupConsents, pendingConsentMatches, readPendingSignupConsents } from '../auth/pendingSignupConsents';
import { getConsentAccess, setConsentAccess, subscribeConsentAccess } from './access';
import type { ConsentManifest, ConsentStatus } from './contracts';

/** 현재 session의 user가 검사 결과를 받았을 때만 앱 본문을 열 수 있다. */
export function isConsentCheckCompleteForUser(
  userId: string | null,
  checkedUserId: string | null,
): boolean {
  return userId !== null && checkedUserId === userId;
}

/** Strict gate: unknown, empty, stale-account and failed responses never open the app. */
export function useConsentGate() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const access = useSyncExternalStore(subscribeConsentAccess, getConsentAccess, getConsentAccess);
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<{ userId: string | null; manifest: ConsentManifest | null; status: ConsentStatus | null; signupReview: boolean; error: Error | null }>({ userId: null, manifest: null, status: null, signupReview: false, error: null });
  const reload = useCallback(() => { setConsentAccess(userId, 'loading'); setAttempt(value => value + 1); }, [userId]);

  useEffect(() => {
    if (!userId) {
      setConsentAccess(null, 'loading');
      return;
    }

    let active = true;
    setConsentAccess(userId, 'loading');
    const timeout = setTimeout(() => {
      if (!active) return;
      active = false;
      setView({ userId, manifest: null, status: null, signupReview: false, error: new Error('Consent check timed out.') });
      setConsentAccess(userId, 'error');
    }, 15000);
    void (async () => {
      const manifestResult = await fetchConsentManifest();
      if (!active) return;
      if (manifestResult.error) throw manifestResult.error;
      if (manifestResult.legacy) {
        const legacy = await fetchLegacyConsentStatus();
        if (!active) return;
        if (legacy.error || !legacy.data) throw legacy.error ?? new Error();
        setView({ userId, manifest: null, status: null, signupReview: false, error: null });
        setConsentAccess(userId, legacy.data.agreed ? 'accepted' : 'required');
        // Never replay S1 choices against a pre-S1 server.
        void clearPendingSignupConsents(AsyncStorage).catch(() => undefined);
        if (legacy.data.agreed) void completePendingProfile({ id: userId, email: user?.email }).catch(() => undefined);
        return;
      }
      const statusResult = await fetchConsentStatus();
      if (!active) return;
      const manifest = manifestResult.data;
      let status = statusResult.data;
      if (manifestResult.error || statusResult.error) throw manifestResult.error ?? statusResult.error;
      if (!manifest || !status || status.bundle_version !== manifest.bundle_version) throw new Error();
      const pending = await readPendingSignupConsents(AsyncStorage);
      if (!active) return;
      // Expired/missing pending choices are not a decline: ask both optional choices again.
      let signupReview = status.required.status === 'required' && status.health.revision === '0' && status.marketing.revision === '0';
      if (pending) {
        const ownerMatches = Boolean(pending.userId) && pending.userId === userId && pending.email === user?.email?.trim().toLowerCase();
        if (!ownerMatches || status.required.status === 'accepted') await clearPendingSignupConsents(AsyncStorage);
        else if (pendingConsentMatches(pending, { id: userId, email: user?.email }, manifest)
          && status.health.revision === '0' && status.marketing.revision === '0') {
          if (getConsentAccess().userId !== userId) return;
          const completed = await completeSignupConsents(pending.submission);
          if (!active || getConsentAccess().userId !== userId) return;
          if (completed.error || !completed.data || completed.data.required.status !== 'accepted') {
            if ((completed.error as { code?: string } | null)?.code === 'S1002') {
              await clearPendingSignupConsents(AsyncStorage); signupReview = true;
            } else if ((completed.error as { code?: string } | null)?.code === 'S1004') {
              await clearPendingSignupConsents(AsyncStorage);
              const refreshed = await fetchConsentStatus();
              if (!refreshed.data || refreshed.error) throw new Error();
              status = refreshed.data; signupReview = false;
            } else throw new Error();
          } else { status = completed.data; await clearPendingSignupConsents(AsyncStorage); }
        } else {
          signupReview = status.health.revision === '0' && status.marketing.revision === '0';
          await clearPendingSignupConsents(AsyncStorage);
        }
      }
      // Signup UI and pending replay may finish while the first status read is in flight.
      // Do not overwrite their accepted result with that older required snapshot.
      if (status.required.status === 'required') {
        const latest = await fetchConsentStatus();
        if (!active) return;
        if (latest.error || !latest.data || latest.data.bundle_version !== manifest.bundle_version) throw latest.error ?? new Error();
        status = latest.data;
        signupReview = status.required.status === 'required' && status.health.revision === '0' && status.marketing.revision === '0';
      }
      if (!active) return;
      setView({ userId, manifest, status, signupReview, error: null });
      setConsentAccess(userId, status.required.status);
      if (status.required.status === 'accepted') void completePendingProfile({ id: userId, email: user?.email }).catch(() => undefined);
    })().catch(error => {
      if (!active) return;
      setView({ userId, manifest: null, status: null, signupReview: false, error: error instanceof Error ? error : null });
      setConsentAccess(userId, 'error');
    }).finally(() => clearTimeout(timeout));

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [userId, user?.email, attempt]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') { invalidateConsentServerMode(); reload(); }
    });
    return () => subscription.remove();
  }, [reload]);

  const state = access.userId === userId && view.userId === userId ? access.state : 'loading';

  return {
    legacy: getConsentServerMode() === 'legacy',
    state,
    needsConsent: state === 'required' || state === 'error',
    checked: userId !== null && state !== 'loading',
    manifest: view.userId === userId ? view.manifest : null,
    status: view.userId === userId ? view.status : null,
    signupReview: view.signupReview,
    error: view.error,
    reload, markConsented: reload,
  };
}

/** UI only. Gate/RPC decisions keep using the strict getConsentServerMode(). */
export function useConsentServerMode() {
  return useSyncExternalStore(subscribeConsentServerMode, getConsentServerModeSnapshot, getConsentServerModeSnapshot);
}
