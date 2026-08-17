import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '../lib/supabase';

type SignUpResult = {
  confirmationRequired: boolean;
  /** 세션이 바로 생긴 경우에만 비공개 프로필을 쓸 수 있어서 호출자에게 넘긴다 */
  userId: string | null;
  error: Error | null;
};

type AuthValue = {
  isReady: boolean;
  session: Session | null;
  user: User | null;
  /** 재설정 링크로 들어와 아직 새 비밀번호를 정하지 않은 상태 */
  passwordResetPending: boolean;
  signInWithEmail: (email: string, password: string) => Promise<Error | null>;
  signUpWithEmail: (input: {
    email: string;
    password: string;
    displayName: string;
    /** 선택 동의. 필수 동의는 계정 생성 자체가 증거이므로 서버가 기록한다 */
    marketingOptIn: boolean;
  }) => Promise<SignUpResult>;
  sendPasswordReset: (email: string) => Promise<Error | null>;
  updatePassword: (password: string) => Promise<Error | null>;
  completePasswordReset: (password: string) => Promise<Error | null>;
  cancelPasswordReset: () => Promise<Error | null>;
  signOut: () => Promise<Error | null>;
};

const AuthContext = createContext<AuthValue | null>(null);

/*
 * 가입 확인과 비밀번호 재설정을 서로 다른 경로로 돌려받는다.
 * PKCE 교환 결과는 두 경우 모두 SIGNED_IN 이벤트라서 링크 종류를 이벤트로는 구분할 수 없다.
 * 두 URL 모두 Supabase Dashboard 의 Auth Redirect URLs 에 등록해야 한다.
 */
const CALLBACK_PATH = 'auth/callback';
const RESET_PATH = 'auth/reset';

function redirectUrl(path: string) {
  return Linking.createURL(path);
}

/** Expo Go 는 `exp://…/--/auth/reset`, 스탠드얼론은 `mealchat://auth/reset` 로 들어온다 */
function isPasswordResetLink(url: string) {
  return url.includes(RESET_PATH);
}

function codeFrom(url: string) {
  try {
    return new URL(url).searchParams.get('code');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [passwordResetPending, setPasswordResetPending] = useState(false);

  useEffect(() => {
    let active = true;

    const handleUrl = async (url: string) => {
      const code = codeFrom(url);
      if (!code) return;

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !active) return;

      if (isPasswordResetLink(url)) setPasswordResetPending(true);
    };

    const initialize = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        await handleUrl(initialUrl).catch(() => undefined);
      }

      const {
        data: { session: restoredSession },
      } = await supabase.auth.getSession();

      if (active) {
        setSession(restoredSession);
        setIsReady(true);
      }
    };

    void initialize().catch(() => {
      if (active) setIsReady(true);
    });

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      // 웹은 URL 조각이 아니라 이벤트로 복구 흐름을 알려준다
      if (event === 'PASSWORD_RECOVERY') setPasswordResetPending(true);
      if (event === 'SIGNED_OUT') setPasswordResetPending(false);
    });

    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      void handleUrl(url).catch(() => undefined);
    });

    return () => {
      active = false;
      authSubscription.unsubscribe();
      linkSubscription.remove();
    };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    return error;
  }, []);

  const signUpWithEmail = useCallback(
    async ({
      email,
      password,
      displayName,
      marketingOptIn,
    }: {
      email: string;
      password: string;
      displayName: string;
      marketingOptIn: boolean;
    }) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          /*
           * private.handle_new_user 트리거가 읽는 값이다.
           * 약관 버전과 동의 시각은 서버가 정하므로 여기서 보내지 않는다.
           */
          data: { name: displayName.trim(), marketing_opt_in: marketingOptIn },
          emailRedirectTo: redirectUrl(CALLBACK_PATH),
        },
      });

      return {
        confirmationRequired: !data.session,
        userId: data.user?.id ?? null,
        error,
      };
    },
    [],
  );

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: redirectUrl(RESET_PATH),
    });
    return error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return error;
  }, []);

  const completePasswordReset = useCallback(
    async (password: string) => {
      const error = await updatePassword(password);
      if (!error) setPasswordResetPending(false);
      return error;
    },
    [updatePassword],
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) setPasswordResetPending(false);
    return error;
  }, []);

  /** 새 비밀번호를 정하지 않고 빠져나가면 링크로 얻은 세션을 그대로 두지 않는다 */
  const cancelPasswordReset = useCallback(async () => {
    setPasswordResetPending(false);
    return signOut();
  }, [signOut]);

  const value = useMemo<AuthValue>(
    () => ({
      isReady,
      session,
      user: session?.user ?? null,
      passwordResetPending,
      signInWithEmail,
      signUpWithEmail,
      sendPasswordReset,
      updatePassword,
      completePasswordReset,
      cancelPasswordReset,
      signOut,
    }),
    [
      isReady,
      session,
      passwordResetPending,
      signInWithEmail,
      signUpWithEmail,
      sendPasswordReset,
      updatePassword,
      completePasswordReset,
      cancelPasswordReset,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
