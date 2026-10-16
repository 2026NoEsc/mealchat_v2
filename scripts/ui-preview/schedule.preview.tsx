/** Run without dotenv: EXPO_NO_DOTENV=1 EXPO_OFFLINE=1, schedule.metro.config.cjs, port 8097. */
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { AppRegistry, Text, View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from '../../src/screens/HomeScreen';
import RoomDetailScreen from '../../src/screens/chat/RoomDetailScreen';
import ChatRoomScreen from '../../src/screens/chat/ChatRoomScreen';
import BottomNav from '../../src/components/ui/BottomNav';
import TimeCell from '../../src/components/ui/TimeCell';
import MateToggle from '../../src/components/ui/MateToggle';
import ColorDot from '../../src/components/ui/ColorDot';
import { NavigationProvider, useNavigation } from '../../src/navigation/NavigationContext';
import type { RouteName } from '../../src/navigation/routes';
import ScheduleHomeScreen from '../../src/screens/schedule/ScheduleHomeScreen';
import ScheduleDetailScreen from '../../src/screens/schedule/ScheduleDetailScreen';
import ScheduleTimeScreen from '../../src/screens/schedule/ScheduleTimeScreen';
import ScheduleConfirmedScreen from '../../src/screens/schedule/ScheduleConfirmedScreen';
import ScheduleOriginSearchScreen from '../../src/screens/schedule/ScheduleOriginSearchScreen';
import { v3Colors } from '../../src/theme/tokens';
import { fixtureOrigin } from './schedule-fixtures';

const params = new URLSearchParams(globalThis.location?.search);
const scene = params.get('scene') ?? 'calendar';
const scenes: Record<string, RouteName> = { detail: 'ScheduleDetail', 'detail-denied': 'ScheduleDetail', 'detail-requestable': 'ScheduleDetail', 'detail-profile': 'ScheduleDetail', 'owner-delete': 'RoomDetail', 'chat-pending': 'ChatRoom', time: 'ScheduleTime', confirmed: 'ScheduleConfirmed', failure: 'ScheduleConfirmed', search: 'ScheduleOriginSearch' };
function Flow() {
  const { current, replace, resetTo } = useNavigation();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    replace(scenes[scene] ?? (scene.startsWith('prereq-') ? 'ScheduleConfirmed' : 'Schedule'), { name: '오늘 저녁팟', roomId: 'fixture-room', invitees: ['fixture-0', 'fixture-1', 'fixture-2'], origin: scene === 'detail-profile' ? undefined : fixtureOrigin });
    setReady(true);
  }, [replace]);
  if (!ready) return null;
  const screens = { Home: HomeScreen, RoomDetail: RoomDetailScreen, ChatRoom: ChatRoomScreen, Schedule: ScheduleHomeScreen, ScheduleDetail: ScheduleDetailScreen, ScheduleTime: ScheduleTimeScreen, ScheduleConfirmed: ScheduleConfirmedScreen, ScheduleOriginSearch: ScheduleOriginSearchScreen };
  const Screen = screens[current.name as keyof typeof screens];
  return <View style={{ flex: 1, backgroundColor: v3Colors.bg }}>{Screen ? <Screen /> : <Text>{'오프라인 흐름 종료 · ' + current.name}</Text>}{(current.name === 'Schedule' || current.name === 'Home') ? <BottomNav active={current.name === 'Home' ? 'home' : 'schedule'} onChange={() => resetTo('Schedule')} /> : null}</View>;
}
function Components() {
  const [selected, setSelected] = useState(true);
  return <View style={{ padding: 20, gap: 16, backgroundColor: v3Colors.bg, flex: 1 }}><Text>일정 공용 컴포넌트</Text><View style={{ flexDirection: 'row', gap: 8 }}><TimeCell label="내가 가능" state="mine" onPress={() => setSelected(!selected)} /><TimeCell label="비어 있음" state="free" onPress={() => setSelected(!selected)} /><TimeCell label="바쁜 시간" state="busy" onPress={() => setSelected(!selected)} /></View><MateToggle name="모아" seed="fixture-0" selected={selected} onChange={setSelected} /><ColorDot color="#1D4ED8" label="파랑" selected={selected} onSelect={() => setSelected(!selected)} /></View>;
}
function Preview() {
  const [loaded, error] = useFonts({
    'Dot42Sans-Regular': require('../../assets/fonts/42dotSans-Regular.ttf'), 'Dot42Sans-Medium': require('../../assets/fonts/42dotSans-Medium.ttf'),
    'Dot42Sans-SemiBold': require('../../assets/fonts/42dotSans-SemiBold.ttf'), 'Dot42Sans-Bold': require('../../assets/fonts/42dotSans-Bold.ttf'),
    'Dot42Sans-ExtraBold': require('../../assets/fonts/42dotSans-ExtraBold.ttf'), 'IosevkaCharon-Bold': require('../../assets/fonts/IosevkaCharon-Bold.ttf'),
  });
  if (!loaded && !error) return <Text>폰트 불러오는 중</Text>;
  return <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 412, height: 892 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } }}><SafeAreaInsetsContext.Provider value={{ top: 0, bottom: 0, left: 0, right: 0 }}><NavigationProvider initialRoute="Schedule">{scene === 'components' ? <Components /> : <Flow />}</NavigationProvider></SafeAreaInsetsContext.Provider></SafeAreaProvider>;
}
AppRegistry.registerComponent('SchedulePreview', () => Preview);
AppRegistry.runApplication('SchedulePreview', { rootTag: document.getElementById('root') });
