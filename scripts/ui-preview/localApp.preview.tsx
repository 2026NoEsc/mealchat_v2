import { useFonts } from 'expo-font';
import { AppRegistry, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationProvider } from '../../src/navigation/NavigationContext';
import type { RouteName } from '../../src/navigation/routes';
import AppNavigator from '../../src/navigation/AppNavigator';
import DialogHost from '../../src/components/DialogHost';
const allowed: RouteName[] = ['MealHistory', 'LocalMenu', 'AccountDeletion', 'NotificationPreferences', 'Contact', 'InviteLanding', 'ScheduleDetail'];
function App() {
  const [ready] = useFonts({ 'Dot42Sans-Regular': require('../../assets/fonts/42dotSans-Regular.ttf'), 'Dot42Sans-Medium': require('../../assets/fonts/42dotSans-Medium.ttf'), 'Dot42Sans-Bold': require('../../assets/fonts/42dotSans-Bold.ttf') });
  const requested = new URLSearchParams(location.search).get('route') as RouteName;
  if (!ready) return <Text>폰트 불러오는 중</Text>;
  return <SafeAreaProvider><NavigationProvider initialRoute={allowed.includes(requested) ? requested : 'MealHistory'}><AppNavigator /><DialogHost /></NavigationProvider></SafeAreaProvider>;
}
AppRegistry.registerComponent('LocalApp', () => App);
AppRegistry.runApplication('LocalApp', { rootTag: document.getElementById('root') });
