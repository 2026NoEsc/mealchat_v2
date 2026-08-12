import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppNavigator from './src/navigation/AppNavigator';
import { NavigationProvider } from './src/navigation/NavigationContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationProvider initialRoute="Login">
        <StatusBar style="dark" />
        <AppNavigator />
      </NavigationProvider>
    </SafeAreaProvider>
  );
}
