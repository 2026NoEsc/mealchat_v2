import { useRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useKeyboardOverlap } from '../theme/keyboard';

/**
 * 키보드가 덮는 만큼 줄어드는 화면 바탕.
 *
 * 안드로이드는 창을 대신 줄여 주지 않는다 (화면 끝까지 그리는 창이라 adjustResize
 * 가 먹지 않는다). KeyboardAvoidingView 도 behavior 를 iOS 에만 주면 아무 일도
 * 하지 않아서, 아래쪽 입력칸이 키보드에 그대로 가렸다.
 *
 * 재는 자리가 화면 루트여야 맞는 값이 나오므로(useKeyboardOverlap 참고), 가리는
 * 만큼을 루트에서 덜어낸다. 안의 ScrollView 는 그만큼 좁아져 키보드 위에 선다.
 */
export default function KeyboardSafeScreen({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const rootRef = useRef<View>(null);
  const { overlap, remeasure } = useKeyboardOverlap(rootRef);

  return (
    <View ref={rootRef} style={[style, { paddingBottom: overlap }]} onLayout={remeasure}>
      {children}
    </View>
  );
}
