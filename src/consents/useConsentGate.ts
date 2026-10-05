import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { fetchConsentStatus } from '../lib/consents';

/** 현재 session의 user가 검사 결과를 받았을 때만 앱 본문을 열 수 있다. */
export function isConsentCheckCompleteForUser(
  userId: string | null,
  checkedUserId: string | null,
): boolean {
  return userId !== null && checkedUserId === userId;
}

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
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);

  const markConsented = useCallback(() => {
    setNeedsConsent(false);
    // ReConsentScreen은 서버 저장 성공 뒤에만 이 콜백을 부른다.
    setCheckedUserId(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setNeedsConsent(false);
      setCheckedUserId(null);
      return;
    }

    let active = true;
    // 다른 계정으로 바뀌면 이전 사용자의 성공 결과로 본문이 잠깐 열리지 않는다.
    setCheckedUserId(null);

    void fetchConsentStatus()
      .then(({ data, error }) => {
        if (!active) return;
        setNeedsConsent(!error && data ? !data.agreed : false);
        setCheckedUserId(userId);
      })
      .catch(() => {
        if (!active) return;
        setNeedsConsent(false);
        setCheckedUserId(userId);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  return {
    needsConsent,
    checked: isConsentCheckCompleteForUser(userId, checkedUserId),
    markConsented,
  };
}
