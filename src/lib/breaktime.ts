/**
 * 브레이크타임 경고.
 *
 * 영업시간 데이터가 없어서(Tmap·카카오·네이버 오픈 API 모두 주지 않는다) 실제로
 * 문을 닫았는지는 알 수 없다. 그래서 거르지 않고 알려만 준다 — 확실하지 않은
 * 근거로 후보를 지우면 멀쩡한 가게가 사라지고, 사용자는 왜 없는지도 모른다.
 *
 * 후보 시간대 자체가 11~21 시로 제한돼 있어([lib/scheduleSlots](./scheduleSlots.ts))
 * 심야는 애초에 나올 수 없다. 남는 위험은 점심과 저녁 사이의 휴게시간이다.
 */
const BREAK_START = 15;
const BREAK_END = 17;

/** "18:00" → 18. 형식이 어긋나면 null */
export function hourOf(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;

  const hour = Number(match[1]);
  return hour >= 0 && hour <= 23 ? hour : null;
}

/**
 * 이 시간대가 브레이크타임에 걸릴 수 있는지.
 *
 * 시작이 15~17 시 사이면 걸린다. 14 시에 시작해 16 시에 끝나는 경우도 겹치지만
 * 밥을 먹기 시작하는 시각이 중요하므로 시작만 본다.
 */
export function hasBreaktimeRisk(startTime: string): boolean {
  const hour = hourOf(startTime);
  if (hour === null) return false;
  return hour >= BREAK_START && hour < BREAK_END;
}

export const BREAKTIME_NOTICE = '브레이크타임일 수 있어요. 가기 전에 확인해 주세요';
