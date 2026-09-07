/**
 * 방·채팅 화면의 표시용 순수 변환. supabase 를 import 하지 않는다 —
 * 네이티브 모듈 없이 테스트할 수 있어야 한다.
 */

export type RoomStatus = 'confirmed' | 'open' | 'expired';

/** 목록 칩에 쓰는 상태. 확정이 만료보다 우선한다. */
export function roomStatus(
  input: { isConfirmed: boolean; expiresAt: string },
  now: Date = new Date(),
): RoomStatus {
  if (input.isConfirmed) return 'confirmed';

  const expires = new Date(input.expiresAt);
  if (Number.isNaN(expires.getTime())) return 'open';
  return expires.getTime() <= now.getTime() ? 'expired' : 'open';
}

export const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  confirmed: '확정',
  open: '진행중',
  expired: '종료',
};

/** 남은 시간을 단위 하나로 줄인다. 하루가 넘으면 일, 한 시간이 넘으면 시간. */
function durationText(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${Math.max(minutes, 1)}분`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간`;

  return `${Math.floor(hours / 24)}일`;
}

/** 목록에 쓰는 짧은 표기 */
/**
 * 방이 사라지기까지 남은 시간.
 *
 * 정산 전에는 세지 않는다. 방을 만들 때 잡아 둔 expires_at 은 임시값이고,
 * 실제 기한은 정산이 끝나야 정해진다(그때 24시간으로 다시 잡힌다).
 * 그 전에 "7일 남음" 이라고 세면 있지도 않은 마감을 알려 주는 셈이다.
 */
export function remainingLabel(
  expiresAt: string,
  settled: boolean,
  now: Date = new Date(),
): string | null {
  if (!settled) return null;

  const expires = new Date(expiresAt);
  if (Number.isNaN(expires.getTime())) return null;

  const ms = expires.getTime() - now.getTime();
  if (ms <= 0) return '종료됨';

  return `${durationText(ms)} 남음`;
}

/**
 * 채팅방 헤더에 쓰는 한 문장.
 * 목록용 표기를 그대로 문장에 넣으면 "종료됨 방이 사라져요" 처럼 어색해진다.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** 시안(2111:16114) 의 `11:47:22` — 두 자리씩 끊어 붙인다 */
function clockText(ms: number): string {
  const total = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
}

/**
 * 방이 사라지기까지 남은 시간.
 *
 * 정산을 마친 방은 24시간만 남으므로, 하루 안쪽이면 시안처럼 초까지 세어 준다.
 * 그보다 많이 남았을 때까지 `168:00:00` 로 보여 주면 읽히지 않아서, 그때는
 * 예전처럼 일·시간 단위로 뭉뚱그린다.
 */
export function roomTimerLabel(
  expiresAt: string,
  settled: boolean,
  now: Date = new Date(),
): string {
  /*
   * 정산 전에는 카운트다운이 아니라 규칙을 알려 준다. 기한은 정산이 끝나야
   * 정해지므로, 그 전에 세는 숫자는 실제 마감과 아무 관계가 없다.
   */
  if (!settled) return '정산 후 24시간 뒤 사라져요';

  const expires = new Date(expiresAt);
  if (Number.isNaN(expires.getTime())) return '';

  const ms = expires.getTime() - now.getTime();
  if (ms <= 0) return '이미 종료된 밥약이에요';

  if (ms < DAY_MS) return `${clockText(ms)} 후 방이 사라져요.`;

  return `${durationText(ms)} 뒤 방이 사라져요`;
}

/** 오전/오후 12시간제. 채팅 말풍선과 목록 시간에 함께 쓴다. */
export function timeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const meridiem = hours < 12 ? '오전' : '오후';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;

  return `${meridiem} ${hour12}:${minutes}`;
}

/** 같은 날짜끼리 묶기 위한 키 (로컬 기준) */
export function dayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/** 목록 부제 — 참가자 수와 남은 시간을 한 줄로 */
export function participantMeta(
  participantCount: number,
  expiresAt: string,
  settled: boolean,
  now: Date = new Date(),
): string {
  const remaining = remainingLabel(expiresAt, settled, now);
  const people = `${participantCount}명`;
  return remaining ? `${people} · ${remaining}` : people;
}

/** `2026-08-13` 이 오늘로부터 며칠 뒤인지. 지난 날짜는 음수. */
export function daysUntil(meetingDate: string, now: Date = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(meetingDate.trim());
  if (!match) return null;

  // 시각을 떼고 날짜끼리만 비교해야 "오늘"이 시간대에 따라 흔들리지 않는다
  const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.round((target - today) / 86400000);
}

export type UpcomingBadge = { label: string; tone: 'today' | 'countdown' };

/** 홈의 다가올 일정 배지 */
export function upcomingBadge(meetingDate: string, now: Date = new Date()): UpcomingBadge | null {
  const days = daysUntil(meetingDate, now);
  if (days === null || days < 0) return null;
  return days === 0 ? { label: '오늘', tone: 'today' } : { label: `D-${days}`, tone: 'countdown' };
}

/** `2026년 8월 13일 · 버거킹 하단점` — 장소가 없으면 날짜만 */
export function meetingLine(meetingDate: string, locationName: string | null): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(meetingDate.trim());
  const date = match ? `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일` : meetingDate;
  const place = locationName?.trim();
  return place ? `${date} · ${place}` : date;
}
