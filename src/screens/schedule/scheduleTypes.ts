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
  inviteeIds: string[];
  place: SchedulePlace;
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
  recommendations: ScheduleRecommendation[];
  modelVersion?: string | null;
  usage?: unknown;
};

export type RecommendationPick = ScheduleRecommendation & {
  slot: CandidateSlot;
  place: SchedulePlace;
};