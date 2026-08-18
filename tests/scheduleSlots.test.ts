import {
  buildNextDays,
  cellKey,
  END_HOUR,
  formatSlotDate,
  hourText,
  HOURS,
  isPastCell,
  toLocalDateKey,
  toSlots,
  weekdayLabel,
  type DayItem,
} from '../src/lib/scheduleSlots';

const NOW = new Date('2026-08-18T12:00:00');

const DAY: DayItem = { date: '2026-08-25', day: 25, month: 8, label: '화' };

describe('toLocalDateKey', () => {
  it('로컬 기준 날짜를 만든다', () => {
    expect(toLocalDateKey(new Date('2026-08-25T09:00:00'))).toBe('2026-08-25');
  });

  it('자정 직후에도 그날 날짜다', () => {
    // toISOString 을 썼다면 UTC 로 밀려 전날이 나온다
    expect(toLocalDateKey(new Date('2026-08-25T00:30:00'))).toBe('2026-08-25');
  });
});

describe('buildNextDays', () => {
  it('오늘부터 이어지는 날을 만든다', () => {
    const days = buildNextDays(3, NOW);
    expect(days.map((d) => d.date)).toEqual(['2026-08-18', '2026-08-19', '2026-08-20']);
  });

  it('월을 넘어가도 이어진다', () => {
    const days = buildNextDays(3, new Date('2026-08-30T12:00:00'));
    expect(days.map((d) => d.date)).toEqual(['2026-08-30', '2026-08-31', '2026-09-01']);
  });

  it('요일 표기를 붙인다', () => {
    expect(buildNextDays(1, NOW)[0].label).toBe('화');
  });

  it('기준 시각이 밤이어도 날짜가 밀리지 않는다', () => {
    expect(buildNextDays(1, new Date('2026-08-18T23:59:00'))[0].date).toBe('2026-08-18');
  });
});

describe('weekdayLabel / hourText / cellKey', () => {
  it('요일을 한 글자로', () => {
    expect(weekdayLabel(0)).toBe('일');
    expect(weekdayLabel(6)).toBe('토');
  });

  it('범위를 벗어나면 빈 문자열', () => {
    expect(weekdayLabel(7)).toBe('');
  });

  it('시각은 두 자리로 채운다', () => {
    expect(hourText(9)).toBe('09:00');
    expect(hourText(20)).toBe('20:00');
  });

  it('칸 키는 날짜와 시각을 합친다', () => {
    expect(cellKey('2026-08-25', 12)).toBe('2026-08-25-12');
  });
});

describe('isPastCell', () => {
  it('지난 시각은 고를 수 없다', () => {
    expect(isPastCell('2026-08-18', 11, NOW)).toBe(true);
  });

  it('앞으로 올 시각은 고를 수 있다', () => {
    expect(isPastCell('2026-08-18', 13, NOW)).toBe(false);
    expect(isPastCell('2026-08-19', 11, NOW)).toBe(false);
  });

  it('지금과 같은 시각은 지난 것으로 본다', () => {
    expect(isPastCell('2026-08-18', 12, NOW)).toBe(true);
  });

  it('날짜를 못 읽으면 막지 않는다', () => {
    expect(isPastCell('nope', 12, NOW)).toBe(false);
  });
});

describe('toSlots', () => {
  it('연달아 고른 칸을 하나로 잇는다', () => {
    const picked = new Set(['2026-08-25-11', '2026-08-25-12']);
    const slots = toSlots(picked, [DAY]);

    expect(slots).toHaveLength(1);
    expect(slots[0].startTime).toBe('11:00');
    expect(slots[0].endTime).toBe('13:00');
  });

  it('중간이 비면 끊어서 두 개가 된다', () => {
    const picked = new Set(['2026-08-25-11', '2026-08-25-13']);
    const slots = toSlots(picked, [DAY]);

    expect(slots.map((s) => [s.startTime, s.endTime])).toEqual([
      ['11:00', '12:00'],
      ['13:00', '14:00'],
    ]);
  });

  it('하루의 마지막 칸도 닫힌다', () => {
    // END_HOUR 까지 훑지 않으면 20시 칸이 슬롯으로 안 나온다
    const picked = new Set([cellKey('2026-08-25', HOURS[HOURS.length - 1])]);
    const slots = toSlots(picked, [DAY]);

    expect(slots).toHaveLength(1);
    expect(slots[0].endTime).toBe(hourText(END_HOUR));
  });

  it('고른 칸이 없으면 빈 배열', () => {
    expect(toSlots(new Set(), [DAY])).toEqual([]);
  });

  it('날짜가 다르면 이어 붙이지 않는다', () => {
    const second: DayItem = { date: '2026-08-26', day: 26, month: 8, label: '수' };
    const picked = new Set(['2026-08-25-20', '2026-08-26-11']);
    const slots = toSlots(picked, [DAY, second]);

    expect(slots).toHaveLength(2);
    expect(slots[0].date).toBe('2026-08-25');
    expect(slots[1].date).toBe('2026-08-26');
  });

  it('id 가 슬롯마다 다르다', () => {
    const picked = new Set(['2026-08-25-11', '2026-08-25-13']);
    const ids = toSlots(picked, [DAY]).map((s) => s.id);

    // 서버가 중복 id 를 거부하므로 여기서 겹치면 요청 자체가 실패한다
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('라벨에 날짜와 시간이 함께 들어간다', () => {
    const slots = toSlots(new Set(['2026-08-25-12']), [DAY]);
    expect(slots[0].label).toBe('8/25(화) 12:00~13:00');
  });
});

describe('formatSlotDate', () => {
  it('한국어 표기로 바꾼다', () => {
    expect(
      formatSlotDate({ date: '2026-08-25', startTime: '12:00', endTime: '13:00' }),
    ).toBe('2026년 8월 25일 12:00~13:00');
  });

  it('앞의 0 을 지운다', () => {
    expect(
      formatSlotDate({ date: '2026-01-02', startTime: '09:00', endTime: '10:00' }),
    ).toBe('2026년 1월 2일 09:00~10:00');
  });

  it('형식이 다르면 원본을 그대로 쓴다', () => {
    expect(
      formatSlotDate({ date: '2026/08/25', startTime: '12:00', endTime: '13:00' }),
    ).toBe('2026/08/25 12:00~13:00');
  });
});
