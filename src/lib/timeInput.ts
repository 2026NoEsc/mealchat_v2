/**
 * 시간 입력칸(HH:MM)을 사람이 치는 대로 받아 정리한다.
 *
 * 예전에는 입력칸이 아무 글자나 받았다. "아무때나" 같은 값이 그대로 저장돼서,
 * 시간으로 읽는 쪽(hourOf 등)이 조용히 실패했다.
 *
 * 숫자만 남기고 콜론은 자동으로 넣는다. 사람이 콜론 위치를 맞출 필요가 없고,
 * 숫자 키패드만으로 칠 수 있다.
 */

/** 완성된 시각인지. "09:30" 처럼 네 자리가 다 찼을 때만 참이다. */
export function isCompleteTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/**
 * 입력 중인 값을 HH:MM 꼴로 다듬는다.
 *
 * 지우는 중에도 자연스럽게 줄어야 해서, 콜론을 지웠을 때 숫자까지 같이 날리지
 * 않는다 — 숫자만 세어 다시 조립한다.
 */
export function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length === 0) return '';

  /* 시는 23 을 넘을 수 없다 */
  let hour = digits.slice(0, 2);
  if (hour.length === 2 && Number(hour) > 23) hour = '23';

  if (digits.length <= 2) return hour;

  /* 분은 59 를 넘을 수 없다. 두 자리가 다 찼을 때만 막는다 */
  let minute = digits.slice(2);
  if (minute.length === 2 && Number(minute) > 59) minute = '59';

  return `${hour}:${minute}`;
}
