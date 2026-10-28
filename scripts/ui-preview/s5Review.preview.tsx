import { useEffect, useState } from 'react';
import { AppRegistry, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';
import { setConsentAccess } from '../../src/consents/access';
import { NavigationProvider, useNavigation } from '../../src/navigation/NavigationContext';
import FoodProfileScreen from '../../src/screens/food/FoodProfileScreen';
import ScheduleConfirmedScreen from '../../src/screens/schedule/ScheduleConfirmedScreen';
import PublicMeetingAreaControls from '../../src/screens/chat/PublicMeetingAreaControls';
import { useRestaurantRecommendations } from '../../src/screens/chat/useRestaurantRecommendations';
import { v3Colors } from '../../src/theme/tokens';
import { authStyles } from '../../src/components/ui/AuthLayout';
import AppInfoScreen from '../../src/screens/settings/AppInfoScreen';
import VotingSheet from '../../src/screens/chat/VotingSheet';

const scene = new URLSearchParams(globalThis.location?.search).get('scene') ?? 'health-unanswered';
const userId = '00000000-0000-4000-8000-000000000001';
setConsentAccess(userId, 'accepted');
function Restaurant() {
  const r = useRestaurantRecommendations({ roomId: 'fixture-room', userId, enabled: true, members: userId });
  return <View style={[authStyles.screen, { padding: 20, gap: 16 }]}><Text style={authStyles.title}>식당 정하기</Text><PublicMeetingAreaControls recommendation={r} isOwner />{r.suggestions.map(item=><Text key={item.label} style={authStyles.subtitle}>{item.label} · 기본 추천</Text>)}<Text style={authStyles.helper}>{r.reason}</Text></View>;
}
function VoteScene() {
  return <VotingSheet visible roomId="fixture-room" kind="menu" title="식당 정하기" subtitle="가고 싶은 식당에 투표해 주세요" placeholder="식당 이름" isOwner stage="place" participantCount={2} onClose={()=>undefined} onConfirm={()=>undefined}
    suggestionStatus={scene==='rules-loading'?'loading':'ready'} suggestionTitle="추천 식당" suggestions={scene==='rules-loading'?[]:[{label:'시각 검증용 식당',source:'rules'}]} />;
}
function Flow() {
  const { replace } = useNavigation(); const [ready, setReady] = useState(false);
  useEffect(() => {
    replace(scene.startsWith('time-') ? 'ScheduleConfirmed' : 'FoodProfile', { roomId: 'fixture-room', name: '시각 검증용 밥약', ...(scene.startsWith('health-') ? { onboarding: true, resumeHealth: true } : {}) });
    setReady(true);
  }, [replace]);
  return ready ? scene.startsWith('restaurant') ? <Restaurant /> : scene==='app-info'?<AppInfoScreen/>:scene.startsWith('rules')?<VoteScene/>:scene.startsWith('time-') ? <ScheduleConfirmedScreen /> : <FoodProfileScreen /> : null;
}
function Preview() {
  const [loaded, error] = useFonts({ 'Dot42Sans-Regular': require('../../assets/fonts/42dotSans-Regular.ttf'), 'Dot42Sans-Medium': require('../../assets/fonts/42dotSans-Medium.ttf'), 'Dot42Sans-Bold': require('../../assets/fonts/42dotSans-Bold.ttf'), 'Dot42Sans-SemiBold': require('../../assets/fonts/42dotSans-SemiBold.ttf') });
  if (!loaded && !error) return <Text>폰트 불러오는 중</Text>;
  return <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 412, height: 892 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } }}><SafeAreaInsetsContext.Provider value={{ top: 0, bottom: 0, left: 0, right: 0 }}><NavigationProvider initialRoute="Home"><View style={{ flex: 1, backgroundColor: v3Colors.bg }}><Flow /></View></NavigationProvider></SafeAreaInsetsContext.Provider></SafeAreaProvider>;
}
AppRegistry.registerComponent('S5Review', () => Preview);
AppRegistry.runApplication('S5Review', { rootTag: document.getElementById('root') });
