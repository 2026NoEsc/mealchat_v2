export type SchedulePlace = {
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
};

export type CandidateSlot = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  label: string;
};

export type ScheduleRecommendRequest = {
  meetingName: string;
  /** 후보 시간대는 서버가 이 방의 제출을 겹쳐서 만든다 */
  roomId: string;
  /** Tmap 에서 받아 온 실재하는 식당들. AI 는 이 안에서만 고를 수 있다. */
  placeCandidates: {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    category: string;
  }[];
};

/**
 * 시간 추천 한 건.
 *
 * 후보 시간대는 서버가 참가자들의 제출을 교차해 만든다. 그래서 slotId 만
 * 오면 앱이 되짚을 방법이 없어, 날짜·시각을 함께 실어 보낸다.
 */
export type SlotRecommendation = {
  slot: CandidateSlot;
  /** 강수확률(%). 예보를 못 받았으면 null */
  rainChance: number | null;
  rank: number;
  score: number;
  reason: string;

  availableCount: number;
  totalCount: number;
  attendanceRate: number;
};

/** 식당 추천 한 건 — 시간과 무관하게 따로 고른다 */
export type PlaceRecommendation = {
  place: SchedulePlace;
  rank: number;
  score: number;
  reason: string;

  averageTravelMinutes: number | null;
};

export type ScheduleRecommendResponse = {
  slotRecommendations: SlotRecommendation[];
  placeRecommendations: PlaceRecommendation[];
  modelVersion?: string | null;
  usage?: unknown;
};

export type SlotPick = SlotRecommendation;

export type PlacePick = PlaceRecommendation;
