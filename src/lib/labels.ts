/**
 * 투표 후보로 올릴 이름을 다듬는다.
 *
 * 별도 파일인 이유는 테스트 때문이다. [lib/voting](./voting.ts) 은 supabase 를
 * 끌어오고, supabase 는 AsyncStorage 를 끌어와서 Jest 에서 그대로 못 읽는다.
 * 순수한 부분만 떼어 두면 검증할 수 있다.
 */

/** 같은 가게가 여러 시간대에 추천될 수 있어 한 번 거른다. 빈 이름은 버린다. */
export function dedupeLabels(labels: string[]): string[] {
  const seen = new Set<string>();

  return labels.flatMap((label) => {
    const trimmed = label.trim();
    if (!trimmed || seen.has(trimmed)) return [];
    seen.add(trimmed);
    return [trimmed];
  });
}
