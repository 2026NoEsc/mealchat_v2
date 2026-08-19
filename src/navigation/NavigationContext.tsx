import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { Route, RouteName } from './routes';
import { popStack } from './stack';

type NavigationValue = {
  current: Route;
  canGoBack: boolean;
  navigate: (name: RouteName, params?: Record<string, unknown>) => void;
  replace: (name: RouteName, params?: Record<string, unknown>) => void;
  goBack: () => void;
  /**
   * 뒤로 가면서 돌아가는 화면의 params 에 값을 병합한다 (입력값 복원용).
   *
   * goBack 에 인자를 받게 하지 않은 것은, 대부분의 호출부가 `onPress={goBack}` 처럼
   * 넘겨 쓰고 있어서 터치 이벤트 객체가 그대로 params 로 들어가 버리기 때문이다.
   */
  goBackWith: (params: Record<string, unknown>) => void;
  /** 탭 전환 — 스택을 해당 루트로 초기화한다 */
  resetTo: (name: RouteName) => void;
};

const NavigationContext = createContext<NavigationValue | null>(null);

export function NavigationProvider({
  initialRoute,
  children,
}: {
  initialRoute: RouteName;
  children: React.ReactNode;
}) {
  const [stack, setStack] = useState<Route[]>([{ name: initialRoute }]);

  const navigate = useCallback((name: RouteName, params?: Record<string, unknown>) => {
    setStack((prev) => [...prev, { name, params }]);
  }, []);

  const replace = useCallback((name: RouteName, params?: Record<string, unknown>) => {
    setStack((prev) => [...prev.slice(0, -1), { name, params }]);
  }, []);

  const goBack = useCallback(() => {
    setStack((prev) => popStack(prev));
  }, []);

  const goBackWith = useCallback((params: Record<string, unknown>) => {
    setStack((prev) => popStack(prev, params));
  }, []);

  const resetTo = useCallback((name: RouteName) => {
    setStack([{ name }]);
  }, []);

  const value = useMemo<NavigationValue>(
    () => ({
      current: stack[stack.length - 1],
      canGoBack: stack.length > 1,
      navigate,
      replace,
      goBack,
      goBackWith,
      resetTo,
    }),
    [stack, navigate, replace, goBack, goBackWith, resetTo],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error('useNavigation 은 NavigationProvider 안에서만 사용할 수 있습니다.');
  }
  return ctx;
}
