import { useFonts } from 'expo-font';
import { AppRegistry, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import FigmaRemainingGallery from '../../src/screens/preview/FigmaRemainingGallery';

function Preview() {
  const [loaded, error] = useFonts({ 'Dot42Sans-Regular': require('../../assets/fonts/42dotSans-Regular.ttf'), 'Dot42Sans-Medium': require('../../assets/fonts/42dotSans-Medium.ttf'), 'Dot42Sans-Bold': require('../../assets/fonts/42dotSans-Bold.ttf') });
  if (!loaded && !error) return <Text>폰트 불러오는 중</Text>;
  return <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 412, height: 892 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } }}><FigmaRemainingGallery initialScene={new URLSearchParams(globalThis.location?.search).get('scene') ?? undefined} /></SafeAreaProvider>;
}
AppRegistry.registerComponent('FigmaRemainingPreview', () => Preview);
AppRegistry.runApplication('FigmaRemainingPreview', { rootTag: document.getElementById('root') });
