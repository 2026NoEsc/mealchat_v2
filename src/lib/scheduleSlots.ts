import type { CandidateSlot } from '../screens/schedule/scheduleTypes';

/**
 * 시간대 격자와 후보 슬롯 계산.
 *
 * 화면 파일 안에 있던 것을 옮겼다. react-native 를 import 하지 않아야
 * 네이티브 모듈 없이 테스트할 수 있다.
 */

/** 격자에 그리는 시간대. 11시부터 20시까지 한 시간 단위. */
export const HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

/** 마지막 칸의 끝 시각. 20시 칸은 21시에 끝난다. */
export const END_HOUR = HOURS[HOURS.length - 1] + 1;

export type DayItem = {
  date: string;
  day: number;
  month: number;
  label: string;
};

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

export function weekdayLabel(day: number): string {
  return WEEKDAY[day] ?? '';
}

/**
 * 로컬 시간대 기준 `YYYY-MM-DD`.
 *
 * toISOString 을 쓰면 UTC 로 바뀌어, 한국에서 자정 직후에 전날 날짜가 나온다.
 */
export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function cellKey(date: string, hour: number): string {
  return `${date}-${hour}`;
}

export function hourText(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/** 오늘부터 count 일치. 자정 기준으로 맞춰 시각에 흔들리지 않게 한다. */
export function buildNextDays(count: number, now: Date = new Date()): DayItem[] {
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);

  const result: DayItem[] = [];
  for (let i = 0; i < count; i += 1) {
    const date = new Date(base);
    date.setDate(base.getDate() + i);

    result.push({
      date: toLocalDateKey(date),
      day: date.getDate(),
      month: date.getMonth() + 1,
      label: weekdayLabel(date.getDay()),
    });
  }
  return result;
}

/** 이미 지난 칸은 고를 수 없다 */
export function isPastCell(date: string, hour: number, now: Date = new Date()): boolean {
  const start = new Date(`${date}T${hourText(hour)}:00`);
  if (Number.isNaN(start.getTime())) return false;
  return start.getTime() <= now.getTime();
}

/**
 * 고른 칸들을 이어 붙여 후보 슬롯으로 만든다.
 *
 * 11~13 시를 연달아 고르면 슬롯 하나(11:00~13:00)가 되고, 중간이 비면 끊어서
 * 두 개가 된다. 하루의 마지막 칸도 닫히도록 END_HOUR 까지 훑는다.
 */
export function toSlots(picked: Set<string>, days: DayItem[]): CandidateSlot[] {
  const slots: CandidateSlot[] = [];

  for (const day of days) {
    let start: number | null = null;

    for (const hour of [...HOURS, END_HOUR]) {
      const on = hour !== END_HOUR && picked.has(cellKey(day.date, hour));

      if (on && start === null) start = hour;

      if (!on && start !== null) {
        const startTime = hourText(start);
        const endTime = hourText(hour);

        slots.push({
          id: `${day.date}-${startTime}-${endTime}`,
          date: day.date,
          startTime,
          endTime,
          label: `${day.month}/${day.day}(${day.label}) ${startTime}~${endTime}`,
        });

        start = null;
      }
    }
  }

  return slots;
}

/** `2026년 8월 25일 12:00~13:00` */
export function formatSlotDate(slot: Pick<CandidateSlot, 'date' | 'startTime' | 'endTime'>): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(slot.date.trim());
  const date = match
    ? `${Number(match[1])}년 ${Number(match[2])}월 ${Number(match[3])}일`
    : slot.date;

  return `${date} ${slot.startTime}~${slot.endTime}`;
}
