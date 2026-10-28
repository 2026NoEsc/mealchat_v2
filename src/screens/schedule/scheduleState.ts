import { shiftMonth, todayParts } from '../../lib/calendar';
import { weekdayLabel } from '../../lib/scheduleSlots';
import type { CandidateSlot } from './scheduleTypes';

type Month = { year: number; month: number };
/** Missing creation evidence conservatively bounds navigation at the current month. */
export function earliestCalendarMonth(createdAt: string | undefined, now: Date = new Date()): Month {
  const created = createdAt ? new Date(createdAt) : null;
  const date = created && Number.isFinite(created.getTime()) ? created : now;
  const { year, month } = todayParts(date);
  return { year, month };
}
export function canMoveCalendarMonth(current: Month, delta: number, earliest: Month): boolean {
  const next = shiftMonth(current.year, current.month, delta);
  return next.year * 12 + next.month >= earliest.year * 12 + earliest.month;
}
export function recommendationDate(slot: CandidateSlot): string {
  const date = new Date(slot.date + 'T12:00:00');
  if (!Number.isFinite(date.getTime())) return slot.label;
  return date.getMonth() + 1 + '월 ' + date.getDate() + '일 (' + weekdayLabel(date.getDay()) + ') ' + slot.startTime;
}
