import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Dimensions, Keyboard, Platform, StatusBar, type View } from 'react-native';

/** 화면(기기 전체) 높이. 키보드가 떠도 변하지 않는 기준점이다. */
const SCREEN_HEIGHT = Dimensions.get('screen').height;

/**
 * 이 화면의 아랫변이 '화면' 좌표로 어디인지.
 *
 * measureInWindow 는 '창' 기준 좌표를 주는데 키보드의 screenY 는 '화면' 기준이라,
 * 그대로 빼면 어긋난다. 안드로이드의 measureInWindow 는 상태바 높이를 빼고 주므로
 * (실측 SM-G991N: 화면 전체를 덮는 루트인데 아랫변이 773.33 = 800 - 26.67),
 * 창 좌표를 그대로 믿으면 딱 상태바만큼 덜 올려 입력칸 아래가 잘린다.
 *
 * 그래서 아랫변을 창이 아니라 화면 기준으로 다시 세운다. 루트는 제 창을 가득
 * 채우므로, 윗변은 화면 맨 위(전체를 덮는 창) 아니면 상태바 아래(그만큼 비켜난 창)
 * 둘 중 하나다. 두 경우 모두 '상태바 + 루트 높이' 를 화면 높이로 자르면 맞는다.
 *
 *   루트 800   (화면 전체)        -> min(800, 26.67+800)    = 800
 *   루트 773.33(상태바만 비켜남)  -> min(800, 26.67+773.33) = 800
 *   루트 725.33(위아래 다 비켜남) -> min(800, 26.67+725.33) = 752
 *
 * @param rootHeight 화면 루트의 높이. 루트가 아닌 일부 View 를 넘기면 맞지 않는다.
 */
function bottomOnScreen(box: { bottom: number; height: number }): number {
  if (Platform.OS !== 'android') return box.bottom;
  return Math.min(SCREEN_HEIGHT, (StatusBar.currentHeight ?? 0) + box.height);
}

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
  /* 이 화면의 아랫변과 높이 (둘 다 창 기준) */
  const [box, setBox] = useState<{ bottom: number; height: number } | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const remeasure = useCallback(() => {
    ref.current?.measureInWindow((_x, y, _width, height) => {
      if (Number.isFinite(y) && Number.isFinite(height)) setBox({ bottom: y + height, height });
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

  if (keyboardTop === null || box === null) return { overlap: 0, remeasure };

  /* 잰 값은 창 기준이라 화면 기준으로 옮긴 뒤 키보드 윗변과 견준다 */
  const covered = bottomOnScreen(box) - keyboardTop;
  /* 1 미만은 반올림 오차로 본다 */
  return { overlap: covered > 1 ? covered : 0, remeasure };
}
