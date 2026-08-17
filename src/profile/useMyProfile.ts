import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { fetchMyProfile, type MyProfileBundle } from '../lib/profile';

type State =
  | { status: 'loading'; bundle: null; error: null }
  | { status: 'ready'; bundle: MyProfileBundle; error: null }
  | { status: 'error'; bundle: null; error: Error };

/**
 * 로그인한 사용자의 프로필을 읽는다.
 *
 * 세션이 바뀌면 다시 읽는다. 로그아웃 직후 이전 사용자의 값이 남아 보이면 안 되고,
 * 새 세션에서는 RLS 가 다른 행을 돌려주기 때문이다.
 */
export function useMyProfile() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [state, setState] = useState<State>({ status: 'loading', bundle: null, error: null });
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    if (!userId) {
      setState({ status: 'loading', bundle: null, error: null });
      return;
    }

    let active = true;
    setState({ status: 'loading', bundle: null, error: null });

    void fetchMyProfile(userId)
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) {
          setState({
            status: 'error',
            bundle: null,
            error: error ?? new Error('프로필을 불러오지 못했어요.'),
          });
          return;
        }
        setState({ status: 'ready', bundle: data, error: null });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setState({
          status: 'error',
          bundle: null,
          error: cause instanceof Error ? cause : new Error('프로필을 불러오지 못했어요.'),
        });
      });

    return () => {
      active = false;
    };
  }, [userId, reloadToken]);

  return { ...state, userId, reload };
}
