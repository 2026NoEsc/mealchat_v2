import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { SignupDraftProvider } from './src/auth/SignupDraftProvider';
import { NotificationsProvider } from './src/components/NotificationsProvider';
import AppNavigator from './src/navigation/AppNavigator';
import { NavigationProvider } from './src/navigation/NavigationContext';
import NewPasswordScreen from './src/screens/auth/NewPasswordScreen';
import { colors } from './src/theme/tokens';

export default function App() {
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

  return (
    <SignupDraftProvider>
      <NavigationProvider key={session ? 'authenticated' : 'anonymous'} initialRoute={session ? 'Home' : 'Login'}>
        {/* 알림 패널이 하단 탭까지 덮어야 하므로 네비게이터 바깥에 둔다 */}
        <NotificationsProvider>
          <StatusBar style="dark" />
          <AppNavigator />
        </NotificationsProvider>
      </NavigationProvider>
    </SignupDraftProvider>
  );
}
