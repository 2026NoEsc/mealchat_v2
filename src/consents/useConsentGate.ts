import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { fetchConsentStatus } from '../lib/consents';

/**
 * 현재 약관에 동의했는지 확인한다.
 *
 * 확인에 실패하면 막지 않는다. 네트워크가 흔들렸다는 이유로 앱을 못 쓰게 하는 것이
 * 동의를 하루 늦게 받는 것보다 나쁘다. 동의가 없다는 사실이 확인됐을 때만 막는다.
 */
export function useConsentGate() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [needsConsent, setNeedsConsent] = useState(false);
  const [checked, setChecked] = useState(false);
  const [recheckToken, setRecheckToken] = useState(0);

  const markConsented = useCallback(() => {
    setNeedsConsent(false);
    setRecheckToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (!userId) {
      setNeedsConsent(false);
      setChecked(false);
      return;
    }

    let active = true;

    void fetchConsentStatus()
      .then(({ data, error }) => {
        if (!active) return;
        setNeedsConsent(!error && data ? !data.agreed : false);
        setChecked(true);
      })
      .catch(() => {
        if (!active) return;
        setNeedsConsent(false);
        setChecked(true);
      });

    return () => {
      active = false;
    };
  }, [userId, recheckToken]);

  return { needsConsent, checked, markConsented };
}
