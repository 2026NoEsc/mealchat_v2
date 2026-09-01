import { supabase } from './supabase';
import type { TasteCounts } from './tasteKeywords';

/**
 * 나와 고른 메이트의 중간 지점.
 *
 * 좌표 자체는 `profile_private` 에 잠겨 있고 본인만 읽는다. 여기서는
 * `meeting_midpoint` RPC 가 서버에서 평균 낸 한 점과 취향 인원수만 받는다 —
 * 누가 어디 사는지는 client 로 내려오지 않는다.
 */
export type MeetingMidpoint = {
  lat: number;
  lng: number;
  /** 좌표를 실제로 보탠 사람 수. 출발지를 저장하지 않은 메이트는 빠진다. */
  contributorCount: number;
  tasteCounts: TasteCounts;
};

type MidpointRow = {
  latitude: number | null;
  longitude: number | null;
  contributor_count: number | null;
  taste_counts: Record<string, number> | null;
};

/**
 * `self` 를 넘기면 저장된 사는 곳 대신 그 좌표를 내 위치로 쓴다.
 * 이번 약속에만 적용되고 프로필은 그대로 둔다.
 */
export async function fetchMeetingMidpoint(
  profileIds: string[],
  self?: { lat: number; lng: number } | null,
): Promise<{
  data: MeetingMidpoint | null;
  error: Error | null;
}> {
  const { data, error } = await supabase.rpc('meeting_midpoint', {
    target_profiles: profileIds,
    self_latitude: self?.lat ?? null,
    self_longitude: self?.lng ?? null,
  });

  if (error) return { data: null, error };

  /*
   * returns table(...) 이라 PostgREST 는 배열로 준다. 생성된 DB 타입이 없어
   * rpc 의 반환이 단일 값으로 추론되므로 여기서 배열로 맞춘다.
   */
  const rows = (data ?? []) as MidpointRow[];

  /* 아무도 출발지를 저장하지 않았으면 행이 없다 — 오류가 아니라 "추천 못 함" 이다 */
  const row = rows[0];
  if (!row || row.latitude === null || row.longitude === null) {
    return { data: null, error: null };
  }

  return {
    data: {
      lat: row.latitude,
      lng: row.longitude,
      contributorCount: row.contributor_count ?? 0,
      tasteCounts: row.taste_counts ?? {},
    },
    error: null,
  };
}
