/** Run Expo with settingsS3.metro.cjs, EXPO_NO_DOTENV=1 and EXPO_OFFLINE=1 on port 8097. */
import { useFonts } from 'expo-font';
import { useState } from 'react';
import { AppRegistry, Text, View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';

import { SignupDraftProvider } from '../../src/auth/SignupDraftProvider';
import BottomNav from '../../src/components/ui/BottomNav';
import { NavigationProvider } from '../../src/navigation/NavigationContext';
import type { RouteName } from '../../src/navigation/routes';
import ReConsentScreen from '../../src/screens/auth/ReConsentScreen';
import AppInfoScreen from '../../src/screens/settings/AppInfoScreen';
import NotificationPermissionScreen from '../../src/screens/settings/NotificationPermissionScreen';
import PrivacyPolicyScreen from '../../src/screens/settings/PrivacyPolicyScreen';
import ServiceTermsScreen from '../../src/screens/settings/ServiceTermsScreen';
import SettingsScreen from '../../src/screens/settings/SettingsScreen';
import SignupTermsScreen from '../../src/screens/signup/SignupTermsScreen';

const routes: Record<string, RouteName> = { settings: 'Settings', terms: 'ServiceTerms', privacy: 'PrivacyPolicy', info: 'AppInfo', signup: 'SignupTerms' };
function Scene({ scene }: { scene: string }) {
  const [done, setDone] = useState(false);
  if (scene === 'notification') return done ? <Text>Preview permission guide completed</Text> : <NotificationPermissionScreen onDone={() => setDone(true)} />;
  if (scene === 'signup') return <SignupTermsScreen />;
  if (scene === 'reconsent') return <ReConsentScreen onDone={() => undefined} />;
  return <View style={{ flex: 1 }}>
    {scene === 'terms' ? <ServiceTermsScreen /> : scene === 'privacy' ? <PrivacyPolicyScreen /> : scene === 'info' ? <AppInfoScreen /> : <SettingsScreen />}
    <BottomNav active="profile" onChange={() => undefined} />
  </View>;
}
function Preview() {
  const [loaded, error] = useFonts({
    'Dot42Sans-Regular': require('../../assets/fonts/42dotSans-Regular.ttf'),
    'Dot42Sans-Medium': require('../../assets/fonts/42dotSans-Medium.ttf'),
    'Dot42Sans-SemiBold': require('../../assets/fonts/42dotSans-SemiBold.ttf'),
    'Dot42Sans-Bold': require('../../assets/fonts/42dotSans-Bold.ttf'),
    'IosevkaCharon-Bold': require('../../assets/fonts/IosevkaCharon-Bold.ttf'),
  });
  if (!loaded && !error) return null;
  const scene = new URLSearchParams(globalThis.location?.search).get('scene') ?? 'settings';
  const insets = { top: 24, bottom: 0, left: 0, right: 0 };
  return <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 412, height: 892 }, insets }}>
    <SafeAreaInsetsContext.Provider value={insets}><NavigationProvider initialRoute={routes[scene] ?? 'Settings'}>
      <SignupDraftProvider><Scene scene={scene} /></SignupDraftProvider>
    </NavigationProvider></SafeAreaInsetsContext.Provider>
  </SafeAreaProvider>;
}
AppRegistry.registerComponent('SettingsS3Preview', () => Preview);
AppRegistry.runApplication('SettingsS3Preview', { rootTag: document.getElementById('root') });
