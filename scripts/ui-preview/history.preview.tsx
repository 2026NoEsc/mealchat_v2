/** Isolated presentation preview; no Auth provider or production data service. */
import { useState } from 'react';
import { useFonts } from 'expo-font';
import { AppRegistry, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BottomNav from '../../src/components/ui/BottomNav';
import DialogHost from '../../src/components/DialogHost';
import { NavigationProvider, useNavigation } from '../../src/navigation/NavigationContext';
import MealHistoryScreen, { type MealRecord } from '../../src/screens/history/MealHistoryScreen';
import MealReceiptScreen from '../../src/screens/history/MealReceiptScreen';
import ContactScreen from '../../src/screens/settings/ContactScreen';
import { records } from './history.fixtures';
const scene = new URLSearchParams(globalThis.location?.search).get('scene') ?? 'history';
function Flow() {
  const { current, navigate, resetTo } = useNavigation();
  const [record, setRecord] = useState<MealRecord | undefined>(scene === 'receipt' ? records[0] : undefined);
  return <View style={{ flex: 1 }}>
    {current.name === 'Contact' ? <ContactScreen /> : current.name === 'MealReceipt' ? <MealReceiptScreen record={record} /> : <MealHistoryScreen records={scene === 'empty' ? [] : records} onOpen={item => { setRecord(item); navigate('MealReceipt'); }} />}
    {current.name === 'MealHistory' ? <BottomNav active="profile" onChange={() => resetTo('MealHistory')} /> : null}
    <DialogHost />
  </View>;
}
function Preview() {
  const [loaded, error] = useFonts({ 'Dot42Sans-Regular': require('../../assets/fonts/42dotSans-Regular.ttf'), 'Dot42Sans-Medium': require('../../assets/fonts/42dotSans-Medium.ttf'), 'Dot42Sans-Bold': require('../../assets/fonts/42dotSans-Bold.ttf') });
  if (!loaded && !error) return <Text>폰트 불러오는 중</Text>;
  return <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 412, height: 892 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } }}><NavigationProvider initialRoute={scene === 'contact' ? 'Contact' : scene === 'receipt' ? 'MealReceipt' : 'MealHistory'}><Flow /></NavigationProvider></SafeAreaProvider>;
}
AppRegistry.registerComponent('HistoryPreview', () => Preview);
AppRegistry.runApplication('HistoryPreview', { rootTag: document.getElementById('root') });
