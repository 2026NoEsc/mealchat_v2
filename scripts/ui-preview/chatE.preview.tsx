import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { AppRegistry, Text, View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationProvider, useNavigation } from '../../src/navigation/NavigationContext';
import ChatRoomScreen from '../../src/screens/chat/ChatRoomScreen';
import RoomDetailScreen from '../../src/screens/chat/RoomDetailScreen';
import { v3Colors } from '../../src/theme/tokens';
const scene = new URLSearchParams(globalThis.location?.search).get('scene') ?? 'chat';
function Flow() {
  const { current, replace } = useNavigation(); const [ready,setReady]=useState(false);
  useEffect(()=>{replace(scene.startsWith('detail')?'RoomDetail':'ChatRoom',{roomId:'room',...(scene==='members'?{openSheet:'members'}:{})});setReady(true);},[replace]);
  if(!ready)return null;
  return <View style={{flex:1,backgroundColor:v3Colors.bg}}>{current.name==='ChatRoom'?<ChatRoomScreen/>:current.name==='RoomDetail'?<RoomDetailScreen/>:<Text>{'이동 결과: '+current.name+' '+JSON.stringify(current.params)}</Text>}</View>;
}
function Preview() {
  const [loaded,error]=useFonts({'Dot42Sans-Regular':require('../../assets/fonts/42dotSans-Regular.ttf'),'Dot42Sans-Medium':require('../../assets/fonts/42dotSans-Medium.ttf'),'Dot42Sans-Bold':require('../../assets/fonts/42dotSans-Bold.ttf'),'Dot42Sans-SemiBold':require('../../assets/fonts/42dotSans-SemiBold.ttf'),'Dot42Sans-ExtraBold':require('../../assets/fonts/42dotSans-ExtraBold.ttf')});
  if(!loaded&&!error)return <Text>폰트 불러오는 중</Text>;
  return <SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:412,height:892},insets:{top:0,bottom:0,left:0,right:0}}}><SafeAreaInsetsContext.Provider value={{top:0,bottom:0,left:0,right:0}}><NavigationProvider initialRoute="ChatRoom"><Flow/></NavigationProvider></SafeAreaInsetsContext.Provider></SafeAreaProvider>;
}
AppRegistry.registerComponent('ChatEPreview',()=>Preview);AppRegistry.runApplication('ChatEPreview',{rootTag:document.getElementById('root')});
