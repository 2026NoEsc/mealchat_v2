/**
 * 취향 집계를 검색어로 옮긴다.
 *
 * 취향 키는 취향게임 6문항([screens/taste/TasteGameScreen](../screens/taste/TasteGameScreen.tsx))
 * 에서 온다. Tmap 은 카테고리 코드가 아니라 이름으로 찾으므로, 사람들이 실제로
 * 간판에 쓰는 말을 검색어로 둔다.
 */
export const TASTE_KEYWORDS: Record<string, string> = {
  korean: '한식',
  meat: '고기집',
  seafood: '해산물',
  western: '양식',
  chinese: '중식',
  japanese: '일식',
};

/** 취향을 아무도 고르지 않았을 때 쓰는 검색어 */
export const DEFAULT_KEYWORD = '맛집';

export type TasteCounts = Record<string, number>;

/**
 * 가장 많이 겹치는 취향부터 검색어를 고른다.
 *
 * 동점이면 TASTE_KEYWORDS 에 적은 순서를 따른다. 순서가 우연에 좌우되면
 * 같은 멤버 구성인데도 추천이 매번 달라져서, 사용자가 이유를 알 수 없게 된다.
 */
export function keywordsByPopularity(counts: TasteCounts | null | undefined, limit = 3): string[] {
  const order = Object.keys(TASTE_KEYWORDS);

  const ranked = order
    .map((key) => ({ key, count: counts?.[key] ?? 0 }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || order.indexOf(a.key) - order.indexOf(b.key))
    .slice(0, limit)
    .map((entry) => TASTE_KEYWORDS[entry.key]);

  return ranked.length > 0 ? ranked : [DEFAULT_KEYWORD];
}

/**
 * 추천 카드에 적을 이유. "왜 이 집인가" 를 한 줄로 설명한다.
 *
 * 사람 수는 좌표를 실제로 보탠 인원이라, 출발지를 저장하지 않은 메이트는 빠진다.
 * 그 차이를 숨기면 "4명인데 왜 2명 기준이지" 를 설명할 길이 없어진다.
 */
export function describeBasis(contributorCount: number, keyword: string): string {
  if (contributorCount <= 1) return `내 출발지에서 가까운 ${keyword}`;
  return `${contributorCount}명의 중간 지점 근처 ${keyword}`;
}
