/** Appointment dates are KST wall times, independent of device locale/timezone. */
export const MEETING_TIME_ZONE = 'Asia/Seoul' as const;
const KST_OFFSET = 9 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n: number) => String(n).padStart(2, '0');
export type MeetingTime = { starts_at: string; ends_at: string; time_zone: typeof MEETING_TIME_ZONE };
const serverClocks = new WeakMap<object, { server: number; received: number; sleep: number; paused?: { wall: number; monotonic: number } }>();
/** Client metadata only; the RPC DTO and canonical meeting time remain unchanged. */
export function recordServerTime<T extends { server_time: string }>(snapshot: T): T {
  if (!serverClocks.has(snapshot)) serverClocks.set(snapshot, { server: Date.parse(snapshot.server_time), received: performance.now(), sleep: 0 });
  return snapshot;
}
export function adjustedServerNow(snapshot?: { server_time: string } | null): Date {
  if (!snapshot) return new Date();
  recordServerTime(snapshot);
  const clock = serverClocks.get(snapshot)!;
  return new Date(clock.server + Math.max(0, performance.now() - clock.received) + clock.sleep);
}
/** Some devices pause performance.now during sleep. Wall time only compensates a recorded suspension,
 * never an active-screen clock adjustment. A fresh foreground RPC snapshot replaces this estimate. */
export function setServerClockActive(snapshot: { server_time: string } | null, active: boolean) {
  if (!snapshot) return;
  recordServerTime(snapshot);
  const clock = serverClocks.get(snapshot)!;
  if (!active) clock.paused ??= { wall: Date.now(), monotonic: performance.now() };
  else if (clock.paused) {
    clock.sleep += Math.max(0, Date.now() - clock.paused.wall - Math.max(0, performance.now() - clock.paused.monotonic));
    clock.paused = undefined;
  }
}

export function kstParts(instant: Date = new Date()) {
  const date = new Date(instant.getTime() + KST_OFFSET);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds(), weekday: date.getUTCDay() };
}
export function kstDateKey(instant: Date = new Date()) {
  const p = kstParts(instant);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}
export function validCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match || Number(match[1]) < 1) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
/** Strict offset-bearing ISO; Date.parse alone silently normalizes invalid calendar dates. */
export function validMeetingInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  return Boolean(m && validCalendarDate(m[1]) && Number(m[2]) < 24 && Number(m[3]) < 60 && Number(m[4]) < 60
    && (m[5] === 'Z' || (Number(m[5].slice(1, 3)) <= 14 && Number(m[5].slice(4)) < 60 && (Number(m[5].slice(1, 3)) < 14 || Number(m[5].slice(4)) === 0)))
    && Number.isFinite(Date.parse(value)));
}
export function normalizeMeetingTime(value: unknown): MeetingTime {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid meeting time');
  const time = value as Record<string, unknown>;
  if (Object.keys(time).sort().join(',') !== 'ends_at,starts_at,time_zone' || time.time_zone !== MEETING_TIME_ZONE
    || !validMeetingInstant(time.starts_at) || !validMeetingInstant(time.ends_at)) throw new Error('Invalid meeting time');
  const start = new Date(time.starts_at), end = new Date(time.ends_at), a = kstParts(start), b = kstParts(end);
  if ([time.starts_at, time.ends_at].some(v => /\.\d*[1-9]\d*(?:Z|[+-])/.test(v))
    || kstDateKey(start) !== kstDateKey(end) || a.hour < 11 || b.hour > 21 || a.minute || b.minute || a.second || b.second
    || start.getUTCMilliseconds() || end.getUTCMilliseconds() || end.getTime() - start.getTime() < 3600000) throw new Error('Invalid meeting time');
  return { starts_at: start.toISOString(), ends_at: end.toISOString(), time_zone: MEETING_TIME_ZONE };
}
export function meetingTimeFromSlot(slot: { date: string; startTime: string; endTime: string }): MeetingTime {
  return normalizeMeetingTime({ starts_at: `${slot.date}T${slot.startTime}:00+09:00`, ends_at: `${slot.date}T${slot.endTime}:00+09:00`, time_zone: MEETING_TIME_ZONE });
}
export function formatMeetingTime(time: MeetingTime | null | undefined, stage: string = 'scheduling', legacy?: string | null): string {
  if (time) {
    try {
      const value = normalizeMeetingTime(time), a = kstParts(new Date(value.starts_at)), b = kstParts(new Date(value.ends_at));
      return `${a.year}년 ${a.month}월 ${a.day}일 (${WEEKDAYS[a.weekday]}) ${pad(a.hour)}:${pad(a.minute)}–${pad(b.hour)}:${pad(b.minute)} · 한국 시간`;
    } catch { /* Invalid structured data must never turn into a guessed appointment. */ }
  }
  return legacy?.trim() ? `이전 시간 표기: ${legacy.trim()}` : stage === 'scheduling' ? '시간 확정 전' : '시간 미정';
}
export function validKstSlot(key: string): boolean {
  const m = /^(\d{4}-\d{2}-\d{2})-(1[1-9]|20)$/.exec(key);
  return Boolean(m && validCalendarDate(m[1]));
}
export function isPastKstCell(date: string, hour: number, now: Date = new Date()) {
  return !validKstSlot(`${date}-${hour}`) || Date.parse(`${date}T${pad(hour)}:00:00+09:00`) <= now.getTime();
}
export function futureKstSlots(keys: string[], now: Date = new Date(), expiresAt?: string) {
  return [...new Set(keys)].filter(key => {
    if (!validKstSlot(key)) return false;
    const date = key.slice(0, 10), hour = Number(key.slice(11));
    return !isPastKstCell(date, hour, now) && (!expiresAt || Date.parse(`${date}T${pad(hour + 1)}:00:00+09:00`) <= Date.parse(expiresAt));
  }).sort();
}
export function buildKstDays(count: number, now: Date = new Date()) {
  const start = new Date(`${kstDateKey(now)}T00:00:00+09:00`).getTime();
  return Array.from({ length: count }, (_, i) => {
    const instant = new Date(start + i * DAY), p = kstParts(instant);
    return { date: kstDateKey(instant), day: p.day, month: p.month, label: WEEKDAYS[p.weekday] };
  });
}
/** Creation deadline, never an inferred appointment date; preserve the existing seven-day policy. */
export function roomCreationDeadline(now: Date = new Date()) {
  const day = kstDateKey(new Date(now.getTime() + 7 * DAY));
  return { meetingDate: day, expiresAt: new Date(`${day}T23:59:59+09:00`).toISOString() };
}
