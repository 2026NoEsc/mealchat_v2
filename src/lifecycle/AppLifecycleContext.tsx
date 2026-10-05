import { AppState, type AppStateStatus } from 'react-native';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

type AppLifecycleValue = {
  /** background/inactive에서 foreground로 복귀할 때만 증가하는 메모리 전용 token */
  foregroundRefreshToken: number;
};

const AppLifecycleContext = createContext<AppLifecycleValue | null>(null);

/** 최초 부팅은 각 화면의 일반 load가 담당하고, 실제 복귀에서만 refresh한다. */
export function shouldRefreshAfterAppStateChange(
  previous: AppStateStatus | null,
  next: AppStateStatus,
): boolean {
  return previous !== null && previous !== 'active' && next === 'active';
}

export function AppLifecycleProvider({ children }: { children: React.ReactNode }) {
  const previousState = useRef<AppStateStatus | null>(AppState.currentState);
  const [foregroundRefreshToken, setForegroundRefreshToken] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previous = previousState.current;
      previousState.current = nextState;

      if (shouldRefreshAfterAppStateChange(previous, nextState)) {
        setForegroundRefreshToken((token) => token + 1);
      }
    });

    return () => subscription.remove();
  }, []);

  const value = useMemo<AppLifecycleValue>(
    () => ({ foregroundRefreshToken }),
    [foregroundRefreshToken],
  );

  return <AppLifecycleContext.Provider value={value}>{children}</AppLifecycleContext.Provider>;
}

/**
 * 데이터 훅은 이 값을 useEffect 의 dependency에 넣어 foreground 복귀만 재조회한다.
 * React state뿐이며 route/URL/사용자 입력값을 저장하거나 복원하지 않는다.
 */
export function useForegroundRefreshToken(): number {
  const value = useContext(AppLifecycleContext);
  if (!value) {
    throw new Error('useForegroundRefreshToken must be used within AppLifecycleProvider.');
  }
  return value.foregroundRefreshToken;
}
