import type {
  CandidateSlot,
  SchedulePlace,
  ScheduleRecommendation,
  ScheduleRecommendRequest,
} from './scheduleTypes';

type BuildRequestInput = {
  meetingName: string;
  inviteeIds: string[];
  place: SchedulePlace;
  candidateSlots: CandidateSlot[];
};

/**
 * 운영 version 7과 아직 저장소에 남은 레거시 함수가 서로 다른 장소 필드를 읽는다.
 * 두 필드를 함께 보내면 어느 버전에서도 같은 한 건의 선택 장소를 사용한다.
 */
export function buildScheduleRecommendRequest({
  meetingName,
  inviteeIds,
  place,
  candidateSlots,
}: BuildRequestInput): ScheduleRecommendRequest {
  const candidateId = place.id?.trim().slice(0, 64) || 'selected-place';

  return {
    meetingName,
    inviteeIds,
    place,
    placeCandidates: [
      {
        id: candidateId,
        name: place.name.trim(),
        address: place.address?.trim() ?? '',
        category: place.category?.trim() ?? '',
      },
    ],
    candidateSlots,
  };
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeRecommendation(value: unknown): ScheduleRecommendation | null {
  if (!value || typeof value !== 'object') return null;

  const item = value as Record<string, unknown>;

  if (
    typeof item.slotId !== 'string' ||
    item.slotId.trim().length === 0 ||
    !finiteNumber(item.rank) ||
    !finiteNumber(item.score) ||
    typeof item.reason !== 'string' ||
    !finiteNumber(item.availableCount) ||
    !finiteNumber(item.totalCount) ||
    !finiteNumber(item.attendanceRate)
  ) {
    return null;
  }

  const travel = item.averageTravelMinutes;
  if (travel !== null && travel !== undefined && !finiteNumber(travel)) return null;

  return {
    slotId: item.slotId,
    rank: item.rank,
    score: item.score,
    reason: item.reason,
    availableCount: item.availableCount,
    totalCount: item.totalCount,
    attendanceRate: item.attendanceRate,
    averageTravelMinutes: travel ?? null,
  };
}

/** 운영 v7의 slotRecommendations와 레거시 recommendations를 같은 화면 모델로 바꾼다. */
export function parseScheduleRecommendations(value: unknown): ScheduleRecommendation[] | null {
  if (!value || typeof value !== 'object') return null;

  const response = value as Record<string, unknown>;
  const source = Array.isArray(response.slotRecommendations)
    ? response.slotRecommendations
    : Array.isArray(response.recommendations)
      ? response.recommendations
      : null;

  if (!source) return null;

  const recommendations = source.map(normalizeRecommendation);
  return recommendations.every(
    (recommendation): recommendation is ScheduleRecommendation => recommendation !== null,
  )
    ? recommendations
    : null;
}
