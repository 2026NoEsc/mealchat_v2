import { useFonts } from 'expo-font';
import { useState } from 'react';
import { AppRegistry, Text, View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';
import { NotificationsProvider } from '../../src/components/NotificationsProvider';
import BottomNav from '../../src/components/ui/BottomNav';
import CopyButton from '../../src/components/ui/CopyButton';
import SettleMember from '../../src/components/ui/SettleMember';
import { NavigationProvider, useNavigation } from '../../src/navigation/NavigationContext';
import HomeScreen from '../../src/screens/HomeScreen';
import SettlementsScreen from '../../src/screens/settlement/SettlementsScreen';
import { v3Colors } from '../../src/theme/tokens';
const scene = new URLSearchParams(globalThis.location?.search).get('scene') ?? 'main';
function Flow() {
  const { current } = useNavigation();
  return <View style={{ flex: 1, backgroundColor: v3Colors.bg }}>{current.name === 'Home' ? <HomeScreen /> : current.name === 'Settlements' ? <SettlementsScreen /> : <Text>{'이동 대상: ' + current.name + ' ' + JSON.stringify(current.params)}</Text>}{current.name === 'Home' ? <BottomNav active="home" onChange={() => {}} /> : null}</View>;
}
function Components() {
  const [completed, setCompleted] = useState(false);
  return <View style={{ flex: 1, padding: 20, gap: 24, backgroundColor: v3Colors.bg }}><Text>홈 공용 컴포넌트</Text><CopyButton text="복사 검증 문자열" /><View style={{ flexDirection: 'row', gap: 32 }}><SettleMember name="모아" seed="mate" completed={completed} onPress={() => setCompleted(!completed)} /><SettleMember name="또리" seed="ddori" completed onPress={() => {}} /></View></View>;
}
function Preview() {
  const [loaded, error] = useFonts({
    'Dot42Sans-Regular': require('../../assets/fonts/42dotSans-Regular.ttf'), 'Dot42Sans-Medium': require('../../assets/fonts/42dotSans-Medium.ttf'), 'Dot42Sans-SemiBold': require('../../assets/fonts/42dotSans-SemiBold.ttf'), 'Dot42Sans-Bold': require('../../assets/fonts/42dotSans-Bold.ttf'), 'Dot42Sans-ExtraBold': require('../../assets/fonts/42dotSans-ExtraBold.ttf'), 'IosevkaCharon-Bold': require('../../assets/fonts/IosevkaCharon-Bold.ttf'),
  });
  if (!loaded && !error) return <Text>폰트 불러오는 중</Text>;
  return <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 412, height: 892 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } }}><SafeAreaInsetsContext.Provider value={{ top: 0, bottom: 0, left: 0, right: 0 }}><NavigationProvider initialRoute={scene.startsWith('settlement') ? 'Settlements' : 'Home'}><NotificationsProvider>{scene === 'components' ? <Components /> : <Flow />}</NotificationsProvider></NavigationProvider></SafeAreaInsetsContext.Provider></SafeAreaProvider>;
}
AppRegistry.registerComponent('HomeCPreview', () => Preview);
AppRegistry.runApplication('HomeCPreview', { rootTag: document.getElementById('root') });
