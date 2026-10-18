import type { Session } from '@supabase/supabase-js';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { SignupDraftProvider } from './src/auth/SignupDraftProvider';
import DialogHost from './src/components/DialogHost';
import { NotificationsProvider } from './src/components/NotificationsProvider';
import StartupLoading from './src/components/ui/StartupLoading';
import Toast, { useToast } from './src/components/ui/Toast';
import { useConsentGate } from './src/consents/useConsentGate';
import { consentErrorMessage } from './src/consents/contracts';
import { AppLifecycleProvider } from './src/lifecycle/AppLifecycleContext';
import AppNavigator from './src/navigation/AppNavigator';
import { NavigationProvider } from './src/navigation/NavigationContext';
import NewPasswordScreen from './src/screens/auth/NewPasswordScreen';
import ReConsentScreen from './src/screens/auth/ReConsentScreen';
import { v3Layout } from './src/theme/scale';
import NotificationPermissionGate from './src/screens/settings/NotificationPermissionGate';
import PrivacyNoticeBanner from './src/screens/settings/PrivacyNoticeBanner';

export default function App() {
  const [slowStartup, setSlowStartup] = useState(false);
  useEffect(() => {
    const timeout = setTimeout(() => setSlowStartup(true), 1000);
    return () => clearTimeout(timeout);
  }, []);
  /*
   * 폰트가 준비되기 전에 화면을 그리면 시스템 폰트로 한 번 그렸다가 바뀌면서
   * 글자가 눈에 띄게 튄다. 1초까지 배경을, 이후에는 로딩 안내를 보여 준다.
   */
  const [fontsLoaded, fontError] = useFonts({
    'Dot42Sans-Light': require('./assets/fonts/42dotSans-Light.ttf'),
    'Dot42Sans-Regular': require('./assets/fonts/42dotSans-Regular.ttf'),
    'Dot42Sans-Medium': require('./assets/fonts/42dotSans-Medium.ttf'),
    'Dot42Sans-SemiBold': require('./assets/fonts/42dotSans-SemiBold.ttf'),
    'Dot42Sans-Bold': require('./assets/fonts/42dotSans-Bold.ttf'),
    'Dot42Sans-ExtraBold': require('./assets/fonts/42dotSans-ExtraBold.ttf'),
    'IosevkaCharon-Bold': require('./assets/fonts/IosevkaCharon-Bold.ttf'),
  });

  // 폰트 로딩 실패 시에도 시스템 폰트로 앱을 열 수 있어야 한다.
  if (!fontsLoaded && !fontError) {
    return <StartupLoading visible={slowStartup} />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppRoot loadingVisible={slowStartup} />
      </AuthProvider>
      {/* 확인·알림 창. 로그인 전 화면에서도 떠야 하므로 인증 바깥에 둔다 */}
      <DialogHost />
    </SafeAreaProvider>
  );
}

function AppRoot({ loadingVisible }: { loadingVisible: boolean }) {
  const { isReady, session, passwordResetPending } = useAuth();
  const [resetCanceled, setResetCanceled] = useState(false);
  const mounted = useRef(true);
  const insets = useSafeAreaInsets();
  const { showToast, toastProps } = useToast();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (session) setResetCanceled(false);
  }, [session, passwordResetPending]);
  // Keep feedback above the navigator so recovery-screen unmounts do not remove it.
  const withFeedback = (content: ReactNode) => <View style={{ flex: 1 }}>
    {content}
    <Toast {...toastProps} bottom={Math.max(16, insets.bottom) + (session && !passwordResetPending ? v3Layout.bottomNavHeight : 0)} />
  </View>;

  if (!isReady) {
    return withFeedback(<StartupLoading visible={loadingVisible} />);
  }

  // 재설정 링크로 얻은 세션은 새 비밀번호를 정할 때까지 앱 본문으로 통과시키지 않는다
  if (session && passwordResetPending) {
    return withFeedback(
      <>
        <StatusBar style="dark" />
        <NewPasswordScreen
          onCancelRequested={() => { if (mounted.current) setResetCanceled(true); }}
          onCancelFailed={() => { if (mounted.current) setResetCanceled(false); }}
          onPasswordChanged={() => { if (mounted.current) showToast({ message: '비밀번호를 바꿨어요' }); }} />
      </>
    );
  }

  if (session) return withFeedback(<ConsentGate loadingVisible={loadingVisible} />);

  return withFeedback(<AppBody session={session} anonymousEntry={resetCanceled ? 'Login' : 'SignupStart'} />);
}

/** No authenticated data providers mount until current required consent is confirmed. */
function ConsentGate({ loadingVisible }: { loadingVisible: boolean }) {
  const { session } = useAuth();
  const { checked, markConsented, state, manifest, status, reload, signupReview, error, legacy } = useConsentGate();

  // 동의 RPC가 아직 끝나지 않았으면 authenticated navigator/provider를 마운트하지
  // 않는다. 이전 계정의 stale 검사 결과로 본문이 보이는 것도 막는다.
  if (!checked) {
    return <StartupLoading visible={loadingVisible} />;
  }

  if (state !== 'accepted') {
    return (
      <>
        <StatusBar style="dark" />
        <ReConsentScreen onDone={markConsented} manifest={manifest} status={status} gateError={state === 'error'} gateErrorMessage={consentErrorMessage(error)} onRetry={reload} signupReview={signupReview} legacy={legacy} />
      </>
    );
  }

  return <NotificationPermissionGate userId={session?.user.id ?? null}><AppBody session={session} /></NotificationPermissionGate>;
}

function AppBody({ session, anonymousEntry = 'SignupStart' }: { session: Session | null; anonymousEntry?: 'SignupStart' | 'Login' }) {
  return (
    <SignupDraftProvider>
      <AppLifecycleProvider>
        <NavigationProvider key={session ? 'authenticated' : 'anonymous'} initialRoute={session ? 'Home' : anonymousEntry}>
          {/* 알림 패널이 하단 탭까지 덮어야 하므로 네비게이터 바깥에 둔다 */}
          <NotificationsProvider>
            <StatusBar style="dark" />
            <View style={{ flex: 1 }}>
              {session ? <PrivacyNoticeBanner key={session.user.id} /> : null}
              <AppNavigator />
            </View>
          </NotificationsProvider>
        </NavigationProvider>
      </AppLifecycleProvider>
    </SignupDraftProvider>
  );
}
