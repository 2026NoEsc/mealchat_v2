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
export function remainingLabel(expiresAt: string, now: Date = new Date()): string | null {
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
export function roomTimerLabel(expiresAt: string, now: Date = new Date()): string {
  const expires = new Date(expiresAt);
  if (Number.isNaN(expires.getTime())) return '';

  const ms = expires.getTime() - now.getTime();
  if (ms <= 0) return '이미 종료된 밥약이에요';

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
  now: Date = new Date(),
): string {
  const remaining = remainingLabel(expiresAt, now);
  const people = `${participantCount}명`;
  return remaining ? `${people} · ${remaining}` : people;
}
