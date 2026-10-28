import { adjustedServerNow, buildKstDays, formatMeetingTime, futureKstSlots, isPastKstCell, kstDateKey, meetingTimeFromSlot, normalizeMeetingTime, recordServerTime, roomCreationDeadline, setServerClockActive } from '../src/lib/meetingTime';
import { s4Time } from './fixtures/s4';
it('advances a server clock monotonically without trusting a changed device wall clock', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-20T00:00:00Z'));
  try {
    const sample = recordServerTime({ server_time: '2026-10-20T08:59:59Z' });
    jest.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    expect(adjustedServerNow(sample).toISOString()).toBe('2026-10-20T08:59:59.000Z');
    jest.advanceTimersByTime(2000); expect(adjustedServerNow(sample).toISOString()).toBe('2026-10-20T09:00:01.000Z');
  } finally { jest.useRealTimers(); }
});

it('normalizes explicit offset-bearing intervals without losing the end time', () => {
  expect(meetingTimeFromSlot({ date: '2026-10-20', startTime: '18:00', endTime: '19:00' })).toEqual(s4Time);
  expect(normalizeMeetingTime({ ...s4Time, starts_at: '2026-10-20T18:00:00+09:00', ends_at: '2026-10-20T19:00:00+09:00' })).toEqual(s4Time);
});
it('accounts for sleep when monotonic time pauses, without double-counting repeated lifecycle events', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-20T00:00:00Z'));
  try {
    const sample = recordServerTime({ server_time: '2026-10-20T08:59:59Z' });
    setServerClockActive(sample, false); jest.setSystemTime(new Date('2026-10-20T02:00:00Z'));
    setServerClockActive(sample, false); setServerClockActive(sample, true); setServerClockActive(sample, true);
    expect(adjustedServerNow(sample).toISOString()).toBe('2026-10-20T10:59:59.000Z');
    const fresh = recordServerTime({ server_time: '2026-10-20T11:00:02Z' });
    expect(adjustedServerNow(fresh).toISOString()).toBe('2026-10-20T11:00:02.000Z');
  } finally { jest.useRealTimers(); }
});
it('does not double-count sleep when both clocks advance, or reverse time after a wall-clock rollback', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-20T00:00:00Z'));
  try {
    const sample = recordServerTime({ server_time: '2026-10-20T08:59:59Z' });
    setServerClockActive(sample, false); jest.advanceTimersByTime(2000); setServerClockActive(sample, true);
    expect(adjustedServerNow(sample).toISOString()).toBe('2026-10-20T09:00:01.000Z');
    setServerClockActive(sample, false); jest.setSystemTime(new Date('2020-01-01T00:00:00Z')); setServerClockActive(sample, true);
    expect(adjustedServerNow(sample).toISOString()).toBe('2026-10-20T09:00:01.000Z');
  } finally { jest.useRealTimers(); }
});
it.each([
  { starts_at: '2026-10-20T18:00:00', ends_at: '2026-10-20T19:00:00' },
  { starts_at: '2026-02-30T18:00:00+09:00', ends_at: '2026-02-30T19:00:00+09:00' },
  { starts_at: '2026-10-20T18:00:00+25:00', ends_at: '2026-10-20T19:00:00+25:00' },
  { starts_at: '2026-10-20T10:00:00+09:00', ends_at: '2026-10-20T11:00:00+09:00' },
  { starts_at: '2026-10-20T20:00:00+09:00', ends_at: '2026-10-20T22:00:00+09:00' },
  { starts_at: '2026-10-20T18:30:00+09:00', ends_at: '2026-10-20T19:00:00+09:00' },
  { starts_at: '2026-10-20T18:00:00.001+09:00', ends_at: '2026-10-20T19:00:00+09:00' },
  { starts_at: '2026-10-20T18:00:00.000001+09:00', ends_at: '2026-10-20T19:00:00+09:00' },
  { starts_at: '2026-10-20T18:00:00+09:00', ends_at: '2026-10-20T18:00:00+09:00' },
  { starts_at: '2026-10-20T18:00:00+09:00', ends_at: '2026-10-21T19:00:00+09:00' },
  { time_zone: 'UTC' }, { extra: true },
])('rejects malformed or unsupported meeting intervals: %j', invalid => {
  expect(() => normalizeMeetingTime({ ...s4Time, ...invalid })).toThrow();
});
it('formats a complete KST interval using fixed Korean labels in every device timezone', () => {
  expect(formatMeetingTime(s4Time, 'place')).toBe('2026년 10월 20일 (화) 18:00–19:00 · 한국 시간');
  expect(formatMeetingTime(null, 'scheduling')).toBe('시간 확정 전');
  expect(formatMeetingTime(null, 'confirmed')).toBe('시간 미정');
  expect(formatMeetingTime(null, 'confirmed', '8/21(금) 18:00~19:00')).toBe('이전 시간 표기: 8/21(금) 18:00~19:00');
  expect(formatMeetingTime(null, 'place', s4Time.starts_at)).toBe('이전 시간 표기: ' + s4Time.starts_at);
});
it('keeps KST midnight/year boundaries and room creation deadlines independent of device time', () => {
  const instant = new Date('2026-12-31T15:05:00Z');
  expect(kstDateKey(instant)).toBe('2027-01-01');
  expect(buildKstDays(2, instant).map(d => d.date)).toEqual(['2027-01-01', '2027-01-02']);
  expect(roomCreationDeadline(instant)).toEqual({ meetingDate: '2027-01-08', expiresAt: '2027-01-08T14:59:59.000Z' });
});
it('filters expired/invalid cells and bounds new submissions by room expiry', () => {
  const now = new Date('2026-10-20T03:00:00Z');
  expect(isPastKstCell('2026-10-20', 12, now)).toBe(true);
  expect(futureKstSlots(['2026-10-20-11', '2026-10-20-12', '2026-10-20-18', '2026-10-20-18', '2026-02-30-18', '2026-10-20-20'], now, '2026-10-20T10:00:00Z')).toEqual(['2026-10-20-18']);
});
