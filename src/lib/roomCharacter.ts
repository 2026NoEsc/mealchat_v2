/**
 * 방 대표 그림.
 *
 * 방 사진을 올리는 기능이 아직 없어서, 브랜드 캐릭터 넷 중 하나를 방마다 고정해
 * 보여 준다 — 시안 2169:806(moa) / 2169:814(ddori).
 *
 * 홈 목록과 방 헤더가 같은 얼굴이어야 같은 방으로 보이므로 여기 한곳에 모아 둔다.
 * id 로 고르니 같은 방은 언제 봐도 같은 캐릭터가 나온다.
 *
 * 사람의 기본 얼굴은 이것과 다르다 — 프로필 캐릭터(defaultCharacterFor)를 쓴다.
 */
/*
 * 원본(assets/brand)은 주위 투명 여백이 넓어 작은 칸에서 그림이 칸의 절반도
 * 안 되게 보인다. 여백을 떼어낸 사본을 쓴다 — 원본은 다른 화면이 그대로 쓴다.
 */
const ROOM_CHARACTERS = [
  require('../../assets/brand/room/moa.png'),
  require('../../assets/brand/room/ddori.png'),
  require('../../assets/brand/room/dudu.png'),
  require('../../assets/brand/room/welling2.png'),
];

export function roomCharacterFor(id: string) {
  let sum = 0;
  for (const char of id) sum += char.charCodeAt(0);
  return ROOM_CHARACTERS[sum % ROOM_CHARACTERS.length];
}
