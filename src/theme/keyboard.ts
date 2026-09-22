import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Keyboard, Platform, type View } from 'react-native';

/**
 * 키보드가 이 화면을 실제로 가리는 높이.
 *
 * 안드로이드는 키보드가 뜰 때 창을 줄여 주기도 하고(그러면 더 올릴 필요가 없다)
 * 그대로 두기도 한다(그러면 키보드가 덮는다). 기기·설정마다 갈린다.
 *
 * "키보드 뜨기 전 높이와 비교" 로는 판별할 수 없다. 시트처럼 열자마자 키보드가
 * 같이 뜨는 화면은 비교할 '전' 이 없어서, 줄어든 창을 원래 크기로 착각하고
 * 이중으로 올려 버린다 (실측: 시트가 화면 위로 밀려 올라가 잘렸다).
 *
 * 그래서 추측하지 않고 절대 좌표로 잰다 — 이 화면의 아랫변이 키보드 윗변보다
 * 얼마나 더 내려가 있는지가 곧 가려지는 높이다. 창이 이미 줄었으면 0 이 나온다.
 *
 * @param ref 화면 루트 View. onLayout 에서 remeasure 를 불러 줘야 한다.
 */
export function useKeyboardOverlap(ref: RefObject<View | null>): {
  overlap: number;
  remeasure: () => void;
} {
  /* 키보드 윗변의 화면 좌표. 닫혀 있으면 null */
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  /* 이 화면 아랫변의 화면 좌표 */
  const [bottom, setBottom] = useState<number | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const remeasure = useCallback(() => {
    ref.current?.measureInWindow((_x, y, _width, height) => {
      if (Number.isFinite(y) && Number.isFinite(height)) setBottom(y + height);
    });
  }, [ref]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (event) => {
      const end = event.endCoordinates;
      if (end) setKeyboardTop(end.screenY);
      /*
       * 창이 줄어드는 기기는 이 이벤트 직후에 줄어든다. 한 박자 뒤에 한 번 더
       * 재야 줄어든 뒤의 위치가 잡힌다 (onLayout 이 먼저 올 때도 있어 양쪽을 다 쓴다).
       */
      remeasure();
      if (pending.current) clearTimeout(pending.current);
      pending.current = setTimeout(remeasure, 120);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardTop(null));

    return () => {
      show.remove();
      hide.remove();
      if (pending.current) clearTimeout(pending.current);
    };
  }, [remeasure]);

  if (keyboardTop === null || bottom === null) return { overlap: 0, remeasure };

  const covered = bottom - keyboardTop;
  /* 1 미만은 반올림 오차로 본다 */
  return { overlap: covered > 1 ? covered : 0, remeasure };
}
