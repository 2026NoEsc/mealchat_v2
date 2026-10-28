import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { fetchConsentManifest, invalidateConsentServerMode } from '../lib/consents';
import { getConsentAccess } from './access';
import type { ConsentManifest } from './contracts';

export function useConsentManifest(initial?: ConsentManifest | null) {
  const [manifest, setManifest] = useState<ConsentManifest | null>(initial ?? null);
  const [legacy, setLegacy] = useState(false);
  const [loading, setLoading] = useState(!initial);
  const [attempt, setAttempt] = useState(0);
  // Prop changes must not expose an old manifest until the effect runs.
  const supplied = useRef(initial);
  const initialChanged = supplied.current !== initial;
  useEffect(() => {
    const changed = supplied.current !== initial;
    supplied.current = initial;
    if (initial && (changed || attempt === 0)) { setManifest(initial); setLegacy(false); setLoading(false); return; }
    let active = true;
    setLoading(true); setManifest(null); setLegacy(false);
    void fetchConsentManifest().then(result => { if (active) { setManifest(result.data); setLegacy(result.legacy === true); setLoading(false); } })
      .catch(() => { if (active) { setManifest(null); setLegacy(false); setLoading(false); } });
    return () => { active = false; };
  }, [initial, attempt]);
  const reload = useCallback(() => {
    invalidateConsentServerMode(); setLegacy(false); setManifest(null); setLoading(true); setAttempt(value => value + 1);
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      // Authenticated foreground checks belong to useConsentGate; anonymous signup has no gate.
      if (state === 'active' && getConsentAccess().userId === null) reload();
    });
    return () => subscription.remove();
  }, [reload]);
  return { manifest: initialChanged ? initial ?? null : manifest, legacy: initialChanged ? false : legacy, loading: initialChanged ? !initial : loading, reload };
}
