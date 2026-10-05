import {
  buildWeeksOf,
  columnOfIn,
  daysInMonth,
  firstColumnOf,
  formatDateIn,
  shiftMonth,
  todayParts,
  weekdayIn,
} from '../calendar';

describe('todayParts', () => {
  it('reads the local calendar date, not UTC', () => {
    /* 한국 자정 직후. UTC 로 읽으면 전날인 8월 19일이 나온다 */
    const justAfterMidnight = new Date(2026, 7, 20, 0, 30);

    expect(todayParts(justAfterMidnight)).toEqual({ year: 2026, month: 8, day: 20 });
  });

  it('returns a one-based month', () => {
    expect(todayParts(new Date(2027, 0, 1)).month).toBe(1);
    expect(todayParts(new Date(2027, 11, 31)).month).toBe(12);
  });
});

describe('weekdays', () => {
  it('places August 1 2026 on Saturday', () => {
    expect(columnOfIn(2026, 8, 1)).toBe(6);
    expect(weekdayIn(2026, 8, 1)).toBe('토');
    expect(formatDateIn(2026, 8, 15)).toBe('8월 15일 (토)');
  });

  /* Figma 가 요일을 세 갈래로 틀렸던 자리라 실제 달력으로 못 박아 둔다 */
  it.each([
    [2026, 8, 12, '수'],
    [2026, 8, 13, '목'],
    [2026, 8, 21, '금'],
  ])('reads %i-%i-%i as %s', (year, month, day, weekday) => {
    expect(weekdayIn(year, month, day)).toBe(weekday);
  });

  it('follows the real calendar into other months', () => {
    expect(formatDateIn(2026, 9, 1)).toBe('9월 1일 (화)');
    expect(formatDateIn(2027, 1, 1)).toBe('1월 1일 (금)');
  });
});

describe('general calendar calculations', () => {
  it('handles leap years', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
  });

  it('builds August 2026 with null padding', () => {
    const weeks = buildWeeksOf(2026, 8);

    expect(weeks).toHaveLength(6);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0]).toEqual([null, null, null, null, null, null, 1]);
    expect(weeks[5]).toEqual([30, 31, null, null, null, null, null]);
  });

  it('builds February 2024 from Thursday through Thursday', () => {
    const weeks = buildWeeksOf(2024, 2);

    expect(firstColumnOf(2024, 2)).toBe(4);
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([null, null, null, null, 1, 2, 3]);
    expect(weeks[4]).toEqual([25, 26, 27, 28, 29, null, null]);
    expect(columnOfIn(2024, 2, 29)).toBe(4);
  });

  it.each([
    [2026, 12, 1, { year: 2027, month: 1 }],
    [2026, 1, -1, { year: 2025, month: 12 }],
    [2026, 2, 13, { year: 2027, month: 3 }],
    [2026, 2, -13, { year: 2025, month: 1 }],
  ])(
    'shifts %i-%i by %i months',
    (year, month, delta, expected) => {
      expect(shiftMonth(year, month, delta)).toEqual(expected);
    },
  );
});
