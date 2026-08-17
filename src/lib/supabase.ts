import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import { createClient, processLock } from '@supabase/supabase-js';

import { getSupabaseConfig } from './supabaseConfig';

/*
 * babel-preset-expo 는 `process.env.EXPO_PUBLIC_*` 형태의 정적 접근만 번들에 인라인한다.
 * `process.env` 를 객체째로 넘기면 개발 서버에서는 동작하지만 (Metro 가 dev 에서만
 * process.env 를 채운다) 릴리스 빌드에서는 값이 사라져 이 모듈이 throw 하고
 * 앱이 시작조차 못 한다. 키마다 정적으로 읽어야 한다.
 */
const { url, publishableKey } = getSupabaseConfig({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});

export const supabase = createClient(url, publishableKey, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    /*
     * 이메일 확인·비밀번호 재설정 링크가 `?code=` 를 붙여 돌아오게 만든다.
     * auth-js 기본값은 implicit 이고, 그 경우 signUp/resetPasswordForEmail 이
     * code_challenge 를 보내지 않아 exchangeCodeForSession 이 영원히 실패한다.
     */
    flowType: 'pkce',
    lock: processLock,
  },
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
