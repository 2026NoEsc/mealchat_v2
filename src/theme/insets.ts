import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * 상태바가 먹는 높이.
 *
 * useSafeAreaInsets().top 만 믿으면 안 된다. 실제 기기(SM-G991N, Android 14)에서
 * 상태바는 80px 인데 insets.top 은 62px 로 와서, 시계·배터리가 앱 헤더 위에
 * 18px 겹쳐 앉았다. 안드로이드에서는 StatusBar.currentHeight 가 실제 값을 주므로
 * 둘 중 큰 값을 쓴다.
 *
 * iOS 에는 StatusBar.currentHeight 가 없다 (undefined). 노치 기기의 인셋은
 * safe-area-context 가 제대로 주므로 그대로 둔다.
 */
export function useTopInset(): number {
  const insets = useSafeAreaInsets();
  if (Platform.OS !== 'android') return insets.top;
  return Math.max(insets.top, StatusBar.currentHeight ?? 0);
}
