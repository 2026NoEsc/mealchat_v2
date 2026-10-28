/** EXPO_NO_DOTENV=1 EXPO_OFFLINE=1; profileD.metro.cjs on port 8098. */
import { useFonts } from 'expo-font';
import { AppRegistry, Text, View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';
import BottomNav from '../../src/components/ui/BottomNav';
import { NavigationProvider, useNavigation } from '../../src/navigation/NavigationContext';
import type { RouteName } from '../../src/navigation/routes';
import ProfileHomeScreen from '../../src/screens/profile/ProfileHomeScreen';
import ProfileEditScreen from '../../src/screens/profile/ProfileEditScreen';
import FriendsScreen from '../../src/screens/profile/FriendsScreen';
import PrivacyScreen from '../../src/screens/profile/PrivacyScreen';
import OriginScreen from '../../src/screens/profile/OriginScreen';
import { v3Colors as colors } from '../../src/theme/tokens';

const scene = new URLSearchParams(globalThis.location?.search).get('scene') ?? 'home';
const routes: Record<string, RouteName> = { home: 'Profile', edit: 'ProfileEdit', friends: 'Friends', privacy: 'Privacy', origin: 'Origin' };
const screens = { Profile: ProfileHomeScreen, ProfileEdit: ProfileEditScreen, Friends: FriendsScreen, Privacy: PrivacyScreen, Origin: OriginScreen };
function Flow() {
  const { current, resetTo } = useNavigation();
  const Screen = screens[current.name as keyof typeof screens];
  return <View style={{ flex: 1, backgroundColor: colors.bg }}><View style={{ flex: 1 }}>{Screen ? <Screen /> : <Text>오프라인 흐름 종료</Text>}</View><BottomNav active="profile" onChange={() => resetTo('Profile')} /></View>;
}
function Preview() {
  const [loaded, error] = useFonts({
    'Dot42Sans-Regular': require('../../assets/fonts/42dotSans-Regular.ttf'), 'Dot42Sans-Medium': require('../../assets/fonts/42dotSans-Medium.ttf'),
    'Dot42Sans-SemiBold': require('../../assets/fonts/42dotSans-SemiBold.ttf'), 'Dot42Sans-Bold': require('../../assets/fonts/42dotSans-Bold.ttf'),
    'Dot42Sans-ExtraBold': require('../../assets/fonts/42dotSans-ExtraBold.ttf'), 'IosevkaCharon-Bold': require('../../assets/fonts/IosevkaCharon-Bold.ttf'),
  });
  if (!loaded && !error) return <Text>폰트 불러오는 중</Text>;
  return <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 412, height: 892 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } }}>
    <SafeAreaInsetsContext.Provider value={{ top: 0, bottom: 0, left: 0, right: 0 }}><NavigationProvider initialRoute={routes[scene] ?? 'Profile'}><Flow /></NavigationProvider></SafeAreaInsetsContext.Provider>
  </SafeAreaProvider>;
}
AppRegistry.registerComponent('ProfileDPreview', () => Preview);
AppRegistry.runApplication('ProfileDPreview', { rootTag: document.getElementById('root') });
