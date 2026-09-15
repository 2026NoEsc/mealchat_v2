import { Alert, Platform } from 'react-native';

/**
 * "정말 할까요?" 를 묻고, 예라고 하면 onConfirm 을 부른다.
 *
 * 네이티브는 Alert.alert 이 잘 동작한다. 웹이 문제다.
 *
 * - Alert.alert 의 버튼 콜백은 react-native-web 에서 불리지 않는다 (빈 함수).
 * - 그래서 한동안 window.confirm 으로 물었는데, 브라우저에 따라 기본 창을 막고
 *   묻지도 않고 false 를 돌려준다. 앱에 붙은 미리보기 브라우저가 그랬다 —
 *   방 없애기를 몇 번을 눌러도 곧바로 "취소" 로 처리돼 요청이 나가지 않았다.
 *
 * 웹에서는 앱 안에 직접 창을 그린다 (DialogHost). 이 파일은 요청만 쌓고,
 * 그리는 일은 DialogHost 가 한다. 창을 그릴 곳이 아직 없으면 (DialogHost 가
 * 마운트되기 전) 기본 창으로 물러난다.
 */

export type DialogRequest = {
  id: number;
  title: string;
  message?: string;
  /** 없으면 알리기만 하는 창이다 — 확인 버튼 하나 */
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm?: () => void;
};

type Listener = (request: DialogRequest) => void;

let listener: Listener | null = null;
let nextId = 1;

/** DialogHost 가 한 곳만 붙는다. 붙어 있는 동안 떼는 함수를 돌려준다. */
export function subscribeDialogs(next: Listener): () => void {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
}

export function confirmAction({
  title,
  message,
  confirmLabel,
  cancelLabel = '취소',
  destructive = false,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel' },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: onConfirm,
      },
    ]);
    return;
  }

  if (listener) {
    listener({ id: nextId++, title, message, confirmLabel, cancelLabel, destructive, onConfirm });
    return;
  }

  if (window.confirm(`${title}\n\n${message}`)) onConfirm();
}

/**
 * 알리기만 하는 창. Alert.alert 이 웹에서 빈 함수라 실패 이유가 통째로
 * 삼켜지던 자리를 메운다.
 */
export function notify(title: string, message?: string): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message);
    return;
  }

  if (listener) {
    listener({ id: nextId++, title, message });
    return;
  }

  window.alert(message ? `${title}\n\n${message}` : title);
}
