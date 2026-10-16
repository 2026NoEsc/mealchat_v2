import { fetchMeetingMidpoint, type MeetingMidpoint } from './meetingPoint';
import type { MyLocation } from './myLocation';
import { keywordsByPopularity } from './tasteKeywords';
import { dedupeById, searchPlacesAround, type Place } from './tmap';

/**
 * AI 에게 넘길 식당 후보.
 *
 * Gemini 가 식당을 지어내지 못하게 하는 것이 요점이다. 후보는 전부 Tmap 이
 * 실제로 돌려준 곳이고, AI 는 그 중에서 고르고 순위와 이유만 붙인다.
 */
export type PlaceCandidate = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: string;
};

const toCandidate = (place: Place): PlaceCandidate => ({
  id: place.id,
  name: place.name,
  address: place.address,
  latitude: place.lat,
  longitude: place.lng,
  category: place.category,
});

export type CandidateBundle = {
  midpoint: MeetingMidpoint;
  /** 취향에서 뽑은 검색어 — 화면에서 근거를 밝히는 데 쓴다 */
  keywords: string[];
  candidates: PlaceCandidate[];
};

/**
 * 중간 지점을 구하고 그 둘레에서 취향에 맞는 식당을 모은다.
 *
 * 중간 지점을 못 구하면(아무도 출발지를 저장하지 않았다) null 을 돌려준다 —
 * 오류가 아니라 "추천할 근거가 없다" 는 정상적인 결과다.
 */
export async function buildPlaceCandidates(
  invitees: string[],
  origin: MyLocation,
  { radiusKm = 2, perKeyword = 5, limit = 12 } = {},
): Promise<CandidateBundle | null> {
  const { data: midpoint, error } = await fetchMeetingMidpoint(invitees, {
    lat: origin.lat,
    lng: origin.lng,
  });

  if (error) throw error;
  if (!midpoint) return null;

  const keywords = keywordsByPopularity(midpoint.tasteCounts);

  /*
   * 검색어별로 따로 부른 뒤 합친다. 한 번에 부르면 가장 흔한 취향이 결과를
   * 다 차지해서, 두 번째 취향이 후보에 아예 못 들어간다.
   */
  const found = await Promise.all(
    keywords.map((keyword) =>
      searchPlacesAround(midpoint, keyword, { radiusKm, count: perKeyword }).catch(() => []),
    ),
  );

  return {
    midpoint,
    keywords,
    candidates: dedupeById(found.flat()).slice(0, limit).map(toCandidate),
  };
}
