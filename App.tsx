import type { Session } from '@supabase/supabase-js';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { SignupDraftProvider } from './src/auth/SignupDraftProvider';
import { NotificationsProvider } from './src/components/NotificationsProvider';
import { useConsentGate } from './src/consents/useConsentGate';
import { AppLifecycleProvider } from './src/lifecycle/AppLifecycleContext';
import AppNavigator from './src/navigation/AppNavigator';
import { NavigationProvider } from './src/navigation/NavigationContext';
import NewPasswordScreen from './src/screens/auth/NewPasswordScreen';
import ReConsentScreen from './src/screens/auth/ReConsentScreen';
import { colors } from './src/theme/tokens';

export default function App() {
  /*
   * 폰트가 준비되기 전에 화면을 그리면 시스템 폰트로 한 번 그렸다가 바뀌면서
   * 글자가 눈에 띄게 튄다. 로딩이 끝날 때까지 배경만 보여 준다.
   */
  const [fontsLoaded] = useFonts({
    'Dot42Sans-Light': require('./assets/fonts/42dotSans-Light.ttf'),
    'Dot42Sans-Regular': require('./assets/fonts/42dotSans-Regular.ttf'),
    'Dot42Sans-Medium': require('./assets/fonts/42dotSans-Medium.ttf'),
    'Dot42Sans-SemiBold': require('./assets/fonts/42dotSans-SemiBold.ttf'),
    'Dot42Sans-Bold': require('./assets/fonts/42dotSans-Bold.ttf'),
    'Dot42Sans-ExtraBold': require('./assets/fonts/42dotSans-ExtraBold.ttf'),
    'IosevkaCharon-Bold': require('./assets/fonts/IosevkaCharon-Bold.ttf'),
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.surface }} />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppRoot />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function AppRoot() {
  const { isReady, session, passwordResetPending } = useAuth();

  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: colors.surface }} />;
  }

  // 재설정 링크로 얻은 세션은 새 비밀번호를 정할 때까지 앱 본문으로 통과시키지 않는다
  if (session && passwordResetPending) {
    return (
      <>
        <StatusBar style="dark" />
        <NewPasswordScreen />
      </>
    );
  }

  if (session) return <ConsentGate />;

  return <AppBody session={session} />;
}

/**
 * 동의 기록이 생기기 전에 가입한 사용자에게 현재 약관 동의를 받는다.
 * 확인에 실패하면 막지 않는다 — 자세한 이유는 useConsentGate 에 적혀 있다.
 */
function ConsentGate() {
  const { session } = useAuth();
  const { needsConsent, checked, markConsented } = useConsentGate();

  // 동의 RPC가 아직 끝나지 않았으면 authenticated navigator/provider를 마운트하지
  // 않는다. 이전 계정의 stale 검사 결과로 본문이 보이는 것도 막는다.
  if (!checked) {
    return <View style={{ flex: 1, backgroundColor: colors.surface }} />;
  }

  if (needsConsent) {
    return (
      <>
        <StatusBar style="dark" />
        <ReConsentScreen onDone={markConsented} />
      </>
    );
  }

  return <AppBody session={session} />;
}

function AppBody({ session }: { session: Session | null }) {
  return (
    <SignupDraftProvider>
      <AppLifecycleProvider>
        <NavigationProvider key={session ? 'authenticated' : 'anonymous'} initialRoute={session ? 'Home' : 'Login'}>
          {/* 알림 패널이 하단 탭까지 덮어야 하므로 네비게이터 바깥에 둔다 */}
          <NotificationsProvider>
            <StatusBar style="dark" />
            <AppNavigator />
          </NotificationsProvider>
        </NavigationProvider>
      </AppLifecycleProvider>
    </SignupDraftProvider>
  );
}
