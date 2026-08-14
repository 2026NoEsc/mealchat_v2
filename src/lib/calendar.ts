/**
 * 앱 전체가 공유하는 기준 달 — 2026년 8월.
 *
 * 요일은 **실제 달력** 을 따른다 (2026-08-01 = 토요일).
 *
 * Figma 원본은 같은 파일 안에서도 요일 표기가 세 갈래로 갈려 있었다.
 *   - 채팅 날짜 구분선 `8/12 (수)`, 일정 화면 헤더 `8/13 (목)` → 실제 달력과 일치
 *   - 확정 카드·AI 추천 `8/15 (금)`, STEP 2 그리드 `13수` → 하루 빠름
 *   - 일정 조율 캘린더에서 1일을 수요일 열에 배치 → 사흘 빠름
 * 셋 중 실제 달력과 맞는 첫 번째를 기준으로 삼고 나머지를 여기서 파생시킨다.
 */
export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export const YEAR = 2026;
export const MONTH = 8;
export const DAYS_IN_MONTH = 31;

/** 2026년 8월 1일이 놓이는 요일 열 (0=일) — 토요일 */
export const FIRST_COLUMN = 6;

/** 날짜 → 요일 열 인덱스 (0=일 … 6=토) */
export const columnOf = (day: number) => (day - 1 + FIRST_COLUMN) % 7;

/** 날짜 → 요일 한 글자 */
export const weekdayOf = (day: number): Weekday => WEEKDAYS[columnOf(day)];

/** `8월 15일 (토)` 형태 */
export const formatDate = (day: number) => `${MONTH}월 ${day}일 (${weekdayOf(day)})`;

/** 달력 그리드 — 앞뒤 빈 칸을 채워 7칸씩 끊는다 */
export const buildWeeks = (): (number | null)[][] => {
  const cells: (number | null)[] = Array<number | null>(FIRST_COLUMN).fill(null);
  for (let day = 1; day <= DAYS_IN_MONTH; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
};
