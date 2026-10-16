/** EXPO_NO_DOTENV=1 EXPO_OFFLINE=1; override Metro with chatScheduleV3.metro.cjs on port 8103. */
import { useFonts } from 'expo-font';
import { useState } from 'react';
import { AppRegistry, Text, View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';
import ScheduleSheet from '../../src/screens/chat/ScheduleSheet';
import { v3Colors } from '../../src/theme/tokens';

function Preview() {
  const [open, setOpen] = useState(true);
  const [loaded, error] = useFonts({
    'Dot42Sans-Regular': require('../../assets/fonts/42dotSans-Regular.ttf'),
    'Dot42Sans-Medium': require('../../assets/fonts/42dotSans-Medium.ttf'),
    'Dot42Sans-SemiBold': require('../../assets/fonts/42dotSans-SemiBold.ttf'),
    'Dot42Sans-Bold': require('../../assets/fonts/42dotSans-Bold.ttf'),
  });
  if (!loaded && !error) return null;
  const insets = { top: 24, bottom: 0, left: 0, right: 0 };
  const scene = new URLSearchParams(globalThis.location?.search).get('scene');
  return <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 412, height: 892 }, insets }}><SafeAreaInsetsContext.Provider value={insets}>
    <View style={{ flex: 1, backgroundColor: v3Colors.bg }}><Text>Offline schedule sheet preview</Text>
      {open ? <ScheduleSheet visible roomId="preview-room" isOwner={scene !== 'mate'} onClose={() => setOpen(false)} onStateChanged={() => undefined} /> : <Text>Preview returned to chat</Text>}
    </View>
  </SafeAreaInsetsContext.Provider></SafeAreaProvider>;
}
AppRegistry.registerComponent('ChatScheduleV3Preview', () => Preview);
AppRegistry.runApplication('ChatScheduleV3Preview', { rootTag: document.getElementById('root') });
