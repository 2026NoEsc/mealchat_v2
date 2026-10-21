import { v3Colors, v3FeedbackColors } from './tokens';

/** Phone Figma 524:1318, 559:1916, 524:1572/1675/1830; logical 412px units. */
export const scheduleColors = {
  saturday: '#1D4ED8',
  busy: '#D9D4CC',
  recommendationSelected: '#FFFBF5',
  scrim: 'rgba(28,26,23,0.5)',
} as const;
export const scheduleEventColors = [
  { value: scheduleColors.saturday, label: '파랑', check: v3Colors.surface },
  { value: v3Colors.primary, label: '주황', check: v3Colors.onPrimary },
  { value: v3Colors.safeText, label: '초록', check: v3Colors.surface },
  { value: v3FeedbackColors.error, label: '빨강', check: v3Colors.surface },
  { value: v3Colors.sub, label: '회색', check: v3Colors.surface },
] as const;
export const scheduleLayout = {
  pagePadding: 20,
  sectionGap: 16,
  cardPadding: 16,
  cardRadius: 16,
  fieldRadius: 12,
  footerTop: 12,
  footerBottom: 24,
  calendarPadding: 8,
  calendarDay: 48,
  calendarNumber: 32,
  calendarWeekday: 25,
  calendarRowGap: 4,
  dot: 4,
  timeWidth: 56,
  timeHeight: 36,
  timeRadius: 6,
  timeLabel: 36,
  avatarWrap: 56,
  avatar: 48,
  avatarBadge: 20,
  colorDot: 32,
  sheetRadius: 24,
  sheetHandleWidth: 40,
  mapHeight: 160,
} as const;
