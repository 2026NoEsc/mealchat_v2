import type { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { supabase } from '../lib/supabase';
import {
  authRedirectErrorMessage,
  classifyAuthRedirect,
  createAuthRedirectGuard,
} from './authRedirect';
import {
  clearPasswordResetPending,
  persistPasswordResetPending,
  readPasswordResetPending,
} from './passwordResetState';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [passwordResetPending, setPasswordResetPending] = useState(false);

  useEffect(() => {
    let active = true;
    const redirectGuard = createAuthRedirectGuard();

    const showRedirectError = (message: string) => {
      if (!active) return;
      Alert.alert('인증 링크를 열 수 없어요', message);
    };

    const handleUrl = async (url: string) => {
      const redirect = classifyAuthRedirect(url);
      if (!redirect.kind || !redirectGuard.claim(url)) return;

      if (!redirect.code) {
        showRedirectError(authRedirectErrorMessage(redirect, 'missing-code'));
        return;
      }

      try {
        // exchangeCodeForSession은 복구 세션도 일반 세션처럼 영속화한다. 교환보다
        // 먼저 표식을 저장해야 교환 직후 프로세스가 종료돼도 앱 본문으로 우회하지 않는다.
        if (redirect.kind === 'reset') {
          await persistPasswordResetPending(AsyncStorage);
          if (!active) return;
          setPasswordResetPending(true);
        }

        const { error } = await supabase.auth.exchangeCodeForSession(redirect.code);
        if (!active) return;

        if (error) {
          if (redirect.kind === 'reset') {
            await clearPasswordResetPending(AsyncStorage).catch(() => undefined);
            if (active) setPasswordResetPending(false);
          }
          showRedirectError(authRedirectErrorMessage(redirect, 'exchange-failed'));
          return;
        }

        if (redirect.kind === 'callback') {
          await clearPasswordResetPending(AsyncStorage);
          if (active) setPasswordResetPending(false);
        }
      } catch {
        if (!active) return;
        showRedirectError(authRedirectErrorMessage(redirect, 'exchange-failed'));
      }
    };

    const initialize = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        await handleUrl(initialUrl);
      }

      const {
        data: { session: restoredSession },
      } = await supabase.auth.getSession();

      let restoredResetPending = false;
      try {
        restoredResetPending = await readPasswordResetPending(AsyncStorage);
      } catch {
        // 저장소를 읽지 못한 세션을 정상 로그인으로 추정하면 복구 세션이 본문으로
        // 들어갈 수 있다. 세션이 있으면 fail closed로 새 비밀번호 화면에 머문다.
        restoredResetPending = Boolean(restoredSession);
      }

      if (active) {
        setSession(restoredSession);
        setPasswordResetPending(restoredResetPending);
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
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordResetPending(true);
        void persistPasswordResetPending(AsyncStorage).catch(() => {
          // 표식을 영속화하지 못하면 재시작 시 복구 세션을 일반 세션으로 오인한다.
          // 세션을 유지하지 않는 쪽으로 닫는다.
          void supabase.auth.signOut();
        });
      }
      if (event === 'SIGNED_OUT') {
        setPasswordResetPending(false);
        void clearPasswordResetPending(AsyncStorage).catch(() => undefined);
      }
    });

    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      void handleUrl(url);
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

    if (!error) {
      try {
        await clearPasswordResetPending(AsyncStorage);
        setPasswordResetPending(false);
      } catch (storageError) {
        return storageError instanceof Error
          ? storageError
          : new Error('비밀번호 재설정 상태를 정리하지 못했습니다.');
      }
    }

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
      if (error) return error;

      try {
        await clearPasswordResetPending(AsyncStorage);
        setPasswordResetPending(false);
        return null;
      } catch (storageError) {
        return storageError instanceof Error
          ? storageError
          : new Error('비밀번호 재설정 상태를 정리하지 못했습니다.');
      }
    },
    [updatePassword],
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) return error;

    try {
      await clearPasswordResetPending(AsyncStorage);
      setPasswordResetPending(false);
      return null;
    } catch (storageError) {
      return storageError instanceof Error
        ? storageError
        : new Error('비밀번호 재설정 상태를 정리하지 못했습니다.');
    }
  }, []);

  /** 새 비밀번호를 정하지 않고 빠져나가면 링크로 얻은 세션을 그대로 두지 않는다 */
  const cancelPasswordReset = useCallback(async () => {
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
