import { Alert, Platform } from 'react-native';

/**
 * "정말 할까요?" 를 묻고, 예라고 하면 onConfirm 을 부른다.
 *
 * Alert.alert 의 버튼 콜백은 react-native-web 에서 불리지 않는다. 그래서
 * 되돌릴 수 없는 동작(방 없애기, 약속 확정)을 Alert 으로만 묻던 버튼들은
 * 웹에서 눌러도 아무 일이 없었다 — 확인 창도 안 뜨고 콜백도 안 돌았다.
 *
 * 웹에서는 window.confirm 으로 묻는다. 생김새는 브라우저 기본 창이지만,
 * 안 물어보고 지우거나 아무 반응이 없는 것보다 낫다.
 */
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
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    {
      text: confirmLabel,
      style: destructive ? 'destructive' : 'default',
      onPress: onConfirm,
    },
  ]);
}

/**
 * 알리기만 하는 창. Alert.alert 이 웹에서 빈 함수라 실패 이유가 통째로
 * 삼켜지던 자리를 메운다.
 */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}

${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
