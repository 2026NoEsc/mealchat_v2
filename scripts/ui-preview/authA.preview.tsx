/**
 * Supplied Phone handoff, bundle A. PowerShell, repository root:
 * $env:EXPO_NO_DOTENV='1'
 * $env:EXPO_OFFLINE='1'
 * $env:EXPO_OVERRIDE_METRO_CONFIG='scripts/ui-preview/authA.metro.cjs'
 * node node_modules/expo/bin/cli start --localhost --port 8096
 * Second terminal: node scripts/ui-preview/authA.browser.cjs
 * All auth and Supabase access is replaced or blocked by the fixture resolver.
 */
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { AppRegistry, View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';

import { SignupDraftProvider, useSignupDraft } from '../../src/auth/SignupDraftProvider';
import StartupLoading from '../../src/components/ui/StartupLoading';
import { NavigationProvider } from '../../src/navigation/NavigationContext';
import type { RouteName } from '../../src/navigation/routes';
import LoginScreen from '../../src/screens/LoginScreen';
import NewPasswordScreen from '../../src/screens/auth/NewPasswordScreen';
import PasswordResetSheet from '../../src/screens/auth/PasswordResetSheet';
import ReConsentScreen from '../../src/screens/auth/ReConsentScreen';
import SignupPersonalScreen from '../../src/screens/signup/SignupPersonalScreen';
import SignupStartScreen from '../../src/screens/signup/SignupStartScreen';
import SignupTermsScreen from '../../src/screens/signup/SignupTermsScreen';

const routes: Record<string, RouteName> = { start: 'SignupStart', login: 'Login', personal: 'SignupPersonal', terms: 'SignupTerms' };

function Scene({ scene }: { scene: string }) {
  const { updateDraft } = useSignupDraft();
  useEffect(() => {
    if (scene === 'terms') updateDraft({ nickname: '밀챗', email: 'mealchat@example.test', password: 'fixture-password' });
  }, [scene, updateDraft]);
  if (scene === 'start') return <SignupStartScreen />;
  if (scene.startsWith('personal')) return <SignupPersonalScreen />;
  if (scene === 'terms') return <SignupTermsScreen />;
  if (scene === 'new-password') return <NewPasswordScreen />;
  if (scene === 'reconsent') return <ReConsentScreen onDone={() => undefined} />;
  if (scene === 'loading') return <StartupLoading visible />;
  return <View style={{ flex: 1 }}><LoginScreen />{scene.startsWith('reset') ? <PasswordResetSheet initialEmail="mealchat@example.test" onClose={() => undefined} /> : null}</View>;
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
  const scene = new URLSearchParams(globalThis.location?.search).get('scene') ?? 'start';
  const insets = { top: 24, bottom: 0, left: 0, right: 0 };
  return <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 412, height: 892 }, insets }}>
    <SafeAreaInsetsContext.Provider value={insets}>
      <NavigationProvider initialRoute={routes[scene] ?? 'Login'}>
        <SignupDraftProvider><Scene scene={scene} /></SignupDraftProvider>
      </NavigationProvider>
    </SafeAreaInsetsContext.Provider>
  </SafeAreaProvider>;
}

AppRegistry.registerComponent('AuthAPreview', () => Preview);
AppRegistry.runApplication('AuthAPreview', { rootTag: document.getElementById('root') });
