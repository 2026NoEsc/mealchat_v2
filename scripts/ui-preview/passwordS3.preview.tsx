/** Offline render only: profileD.metro.cjs replaces services before bundling. No dotenv. */
import { useFonts } from 'expo-font';
import { AppRegistry, Text, View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';
import BottomNav from '../../src/components/ui/BottomNav';
import { NavigationProvider, useNavigation } from '../../src/navigation/NavigationContext';
import PasswordChangeScreen from '../../src/screens/profile/PasswordChangeScreen';
import ProfileEditScreen from '../../src/screens/profile/ProfileEditScreen';
import { v3Colors } from '../../src/theme/tokens';

function Flow() {
  const { current } = useNavigation();
  return <View style={{ flex: 1, backgroundColor: v3Colors.bg }}>
    <View style={{ flex: 1 }}>{current.name === 'PasswordChange' ? <PasswordChangeScreen /> : <ProfileEditScreen />}</View>
    {current.name === 'ProfileEdit' ? <BottomNav active="profile" onChange={() => {}} /> : null}
  </View>;
}
function Preview() {
  const [loaded, error] = useFonts({
    'Dot42Sans-Regular': require('../../assets/fonts/42dotSans-Regular.ttf'),
    'Dot42Sans-Medium': require('../../assets/fonts/42dotSans-Medium.ttf'),
    'Dot42Sans-Bold': require('../../assets/fonts/42dotSans-Bold.ttf'),
  });
  if (!loaded && !error) return <Text>폰트 불러오는 중</Text>;
  return <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 412, height: 892 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } }}>
    <SafeAreaInsetsContext.Provider value={{ top: 0, bottom: 0, left: 0, right: 0 }}>
      <NavigationProvider initialRoute="ProfileEdit"><Flow /></NavigationProvider>
    </SafeAreaInsetsContext.Provider>
  </SafeAreaProvider>;
}
AppRegistry.registerComponent('PasswordS3Preview', () => Preview);
AppRegistry.runApplication('PasswordS3Preview', { rootTag: document.getElementById('root') });
