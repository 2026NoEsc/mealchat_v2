import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NotificationsProvider } from './src/components/NotificationsProvider';
import AppNavigator from './src/navigation/AppNavigator';
import { NavigationProvider } from './src/navigation/NavigationContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationProvider initialRoute="Login">
        {/* 알림 패널이 하단 탭까지 덮어야 하므로 네비게이터 바깥에 둔다 */}
        <NotificationsProvider>
          <StatusBar style="dark" />
          <AppNavigator />
        </NotificationsProvider>
      </NavigationProvider>
    </SafeAreaProvider>
  );
}
