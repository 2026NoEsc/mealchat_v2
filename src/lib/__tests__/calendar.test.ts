import {
  buildWeeks,
  buildWeeksOf,
  columnOf,
  columnOfIn,
  daysInMonth,
  firstColumnOf,
  formatDate,
  shiftMonth,
  weekdayOf,
} from '../calendar';

describe('August 2026 calendar', () => {
  it('places August 1 on Saturday', () => {
    expect(columnOf(1)).toBe(6);
    expect(weekdayOf(1)).toBe('토');
    expect(formatDate(15)).toBe('8월 15일 (토)');
  });

  it('builds complete seven-day rows with null padding', () => {
    const weeks = buildWeeks();

    expect(weeks).toHaveLength(6);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0]).toEqual([null, null, null, null, null, null, 1]);
    expect(weeks[5]).toEqual([30, 31, null, null, null, null, null]);
  });
});

describe('general calendar calculations', () => {
  it('handles leap years', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
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
