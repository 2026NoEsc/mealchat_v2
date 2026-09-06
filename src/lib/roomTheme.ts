/**
 * 방마다 다른 테마 색.
 *
 * 목록에서 방을 구분하는 표식이다 — 왼쪽 막대와 캐릭터 칩 배경에 쓴다.
 * 시안에 나온 두 색(주황 2154:707, 청록 2154:661)을 포함해 여섯 개를 쓴다.
 *
 * 저장된 색이 있으면 그것을 따른다. 다만 createRoom 이 오랫동안 색을 안 받고
 * '#FF9900' 만 넣어 와서, 그렇게 만들어진 방은 전부 주황이다. 그 경우에만
 * id 로 색을 골라 준다 — 같은 방은 언제 봐도 같은 색이 나온다.
 *
 * supabase 를 import 하지 않는다 — 네이티브 모듈 없이 테스트할 수 있어야 한다.
 */

export const ROOM_COLORS = [
  '#FF9900',
  '#04CDA3',
  '#4A90D9',
  '#F5A623',
  '#E8618C',
  '#8B7BE8',
] as const;

/** createRoom 이 색을 안 받던 시절의 값 */
const LEGACY_DEFAULT = '#FF9900';

function pick(seed: string): string {
  let sum = 0;
  for (const char of seed) sum += char.charCodeAt(0);
  return ROOM_COLORS[sum % ROOM_COLORS.length];
}

export function roomColor(room: { id: string; color: string }): string {
  const stored = room.color?.trim();
  if (stored && stored.toUpperCase() !== LEGACY_DEFAULT) return stored;
  return pick(room.id);
}

/** 새 방을 만들 때 고를 색 */
export function randomRoomColor(): string {
  return ROOM_COLORS[Math.floor(Math.random() * ROOM_COLORS.length)];
}
