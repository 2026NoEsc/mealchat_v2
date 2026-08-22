export type SchedulePlace = {
  /** Tmap POI 식별자. 이전 화면 params와의 호환 때문에 선택적이다. */
  id?: string;
  name: string;
  address?: string;
  category?: string;
  latitude?: number;
  longitude?: number;
};

export type SchedulePlaceCandidate = {
  id: string;
  name: string;
  address: string;
  category: string;
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
  inviteeIds: string[];
  /** 로컬 레거시 함수가 읽는 필드 */
  place: SchedulePlace;
  /** 운영 version 7이 읽는 필드 */
  placeCandidates: SchedulePlaceCandidate[];
  candidateSlots: CandidateSlot[];
};

export type ScheduleRecommendation = {
  slotId: string;
  rank: number;
  score: number;
  reason: string;

  availableCount: number;
  totalCount: number;
  attendanceRate: number;

  averageTravelMinutes: number | null;
};

export type ScheduleRecommendResponse = {
  /** 로컬 레거시 함수 응답 */
  recommendations?: ScheduleRecommendation[];
  /** 운영 version 7 응답 */
  slotRecommendations?: ScheduleRecommendation[];
  placeRecommendations?: unknown[];
  modelVersion?: string | null;
  usage?: unknown;
};

export type RecommendationPick = ScheduleRecommendation & {
  slot: CandidateSlot;
  place: SchedulePlace;
};
