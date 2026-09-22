/**
 * 사진을 안 올린 사람에게 줄 기본 캐릭터를 고른다.
 *
 * "랜덤" 이지만 매번 다시 뽑지 않는다. 그릴 때마다 뽑으면 화면을 다시 그릴 때마다
 * 얼굴이 바뀌어서, 같은 사람인지 알 수 없다. 그래서 사람마다 한 번 정해지고
 * 계속 같은 캐릭터가 나오게 씨앗(id·이름)에서 골라낸다.
 *
 * 이미지를 import 하지 않는다 — 네이티브 모듈 없이 테스트할 수 있어야 한다.
 * 그림 목록은 쓰는 쪽(Avatar)이 들고 있고, 여기서는 몇 번째를 쓸지만 정한다.
 */
export function characterIndexOf(seed: string, count: number): number {
  if (count <= 0) return 0;

  /* 짧은 씨앗도 골고루 퍼지게 자리마다 다른 무게를 준다 */
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100003;
  }

  return hash % count;
}
