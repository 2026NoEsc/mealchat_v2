import { useFonts } from 'expo-font';
import { AppRegistry, ScrollView, View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';
import { configureRoomDecisions } from '../../src/lib/roomDecisions';
import { setConsentAccess } from '../../src/consents/access';
import ScheduleConfirmedScreen from '../../src/screens/schedule/ScheduleConfirmedScreen';
import ScheduleTimeScreen from '../../src/screens/schedule/ScheduleTimeScreen';
import ScheduleSheet from '../../src/screens/chat/ScheduleSheet';
import VotingSheet from '../../src/screens/chat/VotingSheet';
import RoomDetailScreen from '../../src/screens/chat/RoomDetailScreen';
import RoomRow from '../../src/components/RoomRow';
import MeetingCard from '../../src/components/ui/MeetingCard';
import ActionTray from '../../src/components/ui/ActionTray';
import { SettlementSheet } from '../../src/screens/chat/ChatRoomSheets';
import { v3Colors } from '../../src/theme/tokens';
import { fixtureParticipants, fixtureRoom, s4PreviewTransport } from './s4App.fixtures';
const scene = new URLSearchParams(globalThis.location?.search).get('scene') ?? 'time-manual';
const memory = new Map<string, string>();
setConsentAccess(scene === 'mate' ? 'B' : 'A', 'accepted');
configureRoomDecisions({ transport: s4PreviewTransport, storage: { getItem: async key => memory.get(key) ?? null, setItem: async (key, value) => { memory.set(key, value); } }, backend: 'isolated-s4-preview' });
function Preview() {
  const [loaded] = useFonts({ 'Dot42Sans-Regular': require('../../assets/fonts/42dotSans-Regular.ttf'), 'Dot42Sans-Medium': require('../../assets/fonts/42dotSans-Medium.ttf'), 'Dot42Sans-SemiBold': require('../../assets/fonts/42dotSans-SemiBold.ttf'), 'Dot42Sans-Bold': require('../../assets/fonts/42dotSans-Bold.ttf') });
  if (!loaded) return null;
  const insets = { top: 24, bottom: 0, left: 0, right: 0 };
  const content = scene === 'settlement-locked' ? <SettlementSheet visible roomId={fixtureRoom.id} roomStage={fixtureRoom.stage} participants={fixtureParticipants} onClose={() => undefined} />
    : scene === 'settlement-actions' ? <View style={{ flex: 1, justifyContent: 'flex-end' }}><MeetingCard slot={fixtureRoom.confirmedSlot} meetingTime={fixtureRoom.meetingTime} s4 stage={fixtureRoom.stage} memberCount={2} onChooseRestaurant={() => undefined} /><ActionTray stage={fixtureRoom.stage} onChoose={() => undefined} /></View>
    : scene === 'step2' ? <ScheduleTimeScreen /> : ['voting', 'no-time', 'mate', 'confirmation', 'legacy-voting'].includes(scene)
    ? <VotingSheet visible roomId={fixtureRoom.id} isOwner={scene !== 'mate' && scene !== 'legacy-voting'} kind="menu" title="식당 정하기" subtitle="가고 싶은 식당에 투표해 주세요" placeholder="식당 이름" onClose={() => undefined} onConfirm={() => undefined} onSelectTime={() => undefined} />
    : ['submissions-waiting', 'submissions-ready', 'place-time', 'read-only', 'legacy-settlement-sheet', 'place-unset-edit'].includes(scene) ? <ScheduleSheet visible roomId={fixtureRoom.id} isOwner participants={fixtureParticipants} onClose={() => undefined} onStateChanged={() => undefined} />
    : scene === 'detail' || scene === 'legacy-settlement-detail' ? <RoomDetailScreen /> : scene === 'summary' || scene === 'legacy-settlement' ? <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}><RoomRow room={fixtureRoom} onPress={() => undefined} /><MeetingCard slot={fixtureRoom.confirmedSlot} meetingTime={fixtureRoom.meetingTime} s4 stage={fixtureRoom.stage} isOwner memberCount={2} onChooseRestaurant={() => undefined} /></ScrollView> : <ScheduleConfirmedScreen />;
  return <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 412, height: 892 }, insets }}><SafeAreaInsetsContext.Provider value={insets}><View style={{ flex: 1, backgroundColor: v3Colors.bg }}>{content}</View></SafeAreaInsetsContext.Provider></SafeAreaProvider>;
}
AppRegistry.registerComponent('S4AppPreview', () => Preview);
AppRegistry.runApplication('S4AppPreview', { rootTag: document.getElementById('root') });
