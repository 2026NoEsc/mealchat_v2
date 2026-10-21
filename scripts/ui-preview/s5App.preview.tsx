import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { AppRegistry, Text, View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../../src/auth/AuthProvider';
import { useConsentGate } from '../../src/consents/useConsentGate';
import { getConsentAccess } from '../../src/consents/access';
import { NotificationsProvider } from '../../src/components/NotificationsProvider';
import { AppLifecycleProvider } from '../../src/lifecycle/AppLifecycleContext';
import { configureS1RpcTransport, fetchConsentManifest } from '../../src/lib/consents';
import ScheduleConfirmedScreen from '../../src/screens/schedule/ScheduleConfirmedScreen';
import { supabase } from '../../src/lib/supabase';
import * as foodApi from '../../src/lib/foodProfile';
import * as areaApi from '../../src/lib/placeCandidates';
import { NavigationProvider, useNavigation } from '../../src/navigation/NavigationContext';
import { useRoom } from '../../src/rooms/useMyRooms';
import FoodProfileScreen from '../../src/screens/food/FoodProfileScreen';
import FoodProfileForm from '../../src/screens/food/FoodProfileForm';
import FoodProfilePrompt from '../../src/screens/food/FoodProfilePrompt';
import { setSignupFoodDraft, bindSignupFoodDraft } from '../../src/screens/food/signupFoodDraft';
import SignupCalendarScreen from '../../src/screens/signup/SignupCalendarScreen';
import ProfileHomeScreen from '../../src/screens/profile/ProfileHomeScreen';
import PublicMeetingAreaControls from '../../src/screens/chat/PublicMeetingAreaControls';
import { useRestaurantRecommendations } from '../../src/screens/chat/useRestaurantRecommendations';
import VotingSheet from '../../src/screens/chat/VotingSheet';
import { v3Colors } from '../../src/theme/tokens';

if (process.env.EXPO_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:54321') throw Error('S5 preview is local-only');
Reflect.set(globalThis, '__s5', {
  foodApi, areaApi, access: getConsentAccess,
  async fixtureLegacyTime() { configureS1RpcTransport(async () => ({ data: null, error: { code: 'PGRST202' } }), { getItem: async () => null, setItem: async () => undefined }); await fetchConsentManifest(); },
  async signIn(email: string, password: string) { const result = await supabase.auth.signInWithPassword({email,password}); return {ok:!result.error}; },
  async signOut() { await supabase.auth.signOut(); },
  // Local-only adapter for the real signup-result binding; no server data is fabricated.
  fixtureSignupInput(userId: string, preferences: foodApi.FoodPreferences) { setSignupFoodDraft(preferences); bindSignupFoodDraft(userId); },
});
function RestaurantScene() {
  const {current}=useNavigation(),{user}=useAuth();const roomId=current.params?.roomId as string;const {room,reload}=useRoom(roomId);
  const recommendation=useRestaurantRecommendations({roomId,userId:user?.id??null,enabled:room?.stage==='place'&&!room.confirmedMenu,members:(room?.participants??[]).map(p=>p.profileId).sort().join(',')});
  return <VotingSheet visible roomId={roomId} kind="menu" title="식당 정하기" subtitle="가고 싶은 식당에 투표해 주세요" placeholder="식당 이름" isOwner={room?.ownerId===user?.id} stage={room?.stage} participants={room?.participants} confirmedRestaurant={room?.confirmedMenu} confirmedSlot={room?.confirmedSlot} participantCount={room?.participants.length} onClose={()=>undefined} onConfirm={()=>void reload()} onVoted={()=>void reload()} suggestions={recommendation.suggestions} suggestionStatus={recommendation.status} suggestionReason={recommendation.reason} onRequestSuggestions={()=>void recommendation.request()} validateSuggestion={recommendation.validateSuggestion} recommendationControls={<PublicMeetingAreaControls recommendation={recommendation} isOwner={room?.ownerId===user?.id}/>} />;
}
function SampleScene() {
  const {current}=useNavigation();const [catalog,setCatalog]=useState<foodApi.FoodCatalog|null>(null);
  const [food,setFood]=useState<foodApi.FoodPreferences>({cuisines:['korean','japanese'],ingredients:['pork','chicken'],forms:['noodles','soup','grilled'],spice:'medium'});
  const [health,setHealth]=useState({allergy_codes:['shrimp'],avoided_food_codes:[] as string[],diet_type_code:null as string|null,additional_avoid_codes:[] as string[]});
  const [expanded,setExpanded]=useState('allergy');
  const expandSample=(code:string)=>{setExpanded(code);if(code==='avoided_food')setHealth(value=>({...value,avoided_food_codes:['raw_fish','offal']}));if(code==='diet_type')setHealth(value=>({...value,diet_type_code:'none'}));};
  useEffect(()=>{void foodApi.fetchFoodCatalog().then(r=>setCatalog(r.data));},[]);
  if(!catalog)return <Text>시안 비교 데이터 불러오는 중</Text>;
  return <FoodProfileForm step={current.params?.step===2?2:1} editing={current.params?.editing===true} catalog={catalog} food={food} health={health} onFood={setFood} onHealth={setHealth} expanded={expanded} onExpand={expandSample} onBack={()=>undefined} onSkip={()=>undefined} onNext={()=>undefined}/>;
}
function Flow() {
 const nav=useNavigation();
 useEffect(()=>{Reflect.set(globalThis,'__s5Go',nav.navigate);},[nav.navigate]);
 return <View style={{flex:1,backgroundColor:v3Colors.bg}}>{nav.current.name==='ScheduleConfirmed'?<ScheduleConfirmedScreen/>:nav.current.name==='FoodProfile'?<FoodProfileScreen/>:nav.current.name==='Profile'?<ProfileHomeScreen/>:nav.current.name==='SignupTaste'?<SampleScene/>:nav.current.name==='SignupCalendar'?<SignupCalendarScreen/>:nav.current.name==='ChatRoom'?<RestaurantScene/>:<Text>저장 후 돌아왔어요</Text>}<FoodProfilePrompt/></View>;
}
function Gate(){const {user}=useAuth();const gate=useConsentGate();return user&&gate.checked&&gate.state==='accepted'?<NavigationProvider initialRoute="Home"><NotificationsProvider><Flow/></NotificationsProvider></NavigationProvider>:<Text>로컬 로그인 대기</Text>;}
function Preview(){const[loaded,error]=useFonts({'Dot42Sans-Regular':require('../../assets/fonts/42dotSans-Regular.ttf'),'Dot42Sans-Medium':require('../../assets/fonts/42dotSans-Medium.ttf'),'Dot42Sans-Bold':require('../../assets/fonts/42dotSans-Bold.ttf'),'Dot42Sans-SemiBold':require('../../assets/fonts/42dotSans-SemiBold.ttf'),'Dot42Sans-ExtraBold':require('../../assets/fonts/42dotSans-ExtraBold.ttf')});if(!loaded&&!error)return <Text>폰트 불러오는 중</Text>;return <SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:412,height:892},insets:{top:0,bottom:0,left:0,right:0}}}><SafeAreaInsetsContext.Provider value={{top:0,bottom:0,left:0,right:0}}><AuthProvider><AppLifecycleProvider><Gate/></AppLifecycleProvider></AuthProvider></SafeAreaInsetsContext.Provider></SafeAreaProvider>;}
AppRegistry.registerComponent('S5AppPreview',()=>Preview);AppRegistry.runApplication('S5AppPreview',{rootTag:document.getElementById('root')});
