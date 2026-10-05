export const MAX_PLACE_CANDIDATES = 20;
export const SLOT_RECOMMENDATION_COUNT = 3;
export const PLACE_RECOMMENDATION_COUNT = 4;

export type ValidPlace = {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  category: string;
};

export type CandidateSlot = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  label: string;
};

export type RequestBody = {
  meetingName: string;
  /** 후보 시간은 이 방의 participants.schedule에서 서버가 계산한다. */
  roomId: string;
  placeCandidates: ValidPlace[];
};

export type CalendarNoteRow = {
  profile_id: string;
  date: string | null;
  time: string | null;
  end_time: string | null;
  start_date: string | null;
  end_date: string | null;
};

export type CandidateFact = {
  slotId: string;
  date: string;
  startTime: string;
  endTime: string;
  label: string;
  availableCount: number;
  totalCount: number;
  attendanceRate: number;
};

export type ModelSlotPick = {
  slotId: string;
  rank: number;
  score: number;
  reason: string;
};

export type ModelPlacePick = {
  placeId: string;
  rank: number;
  score: number;
  reason: string;
};

type RankedItem = {
  id: string;
  rank: number;
  score: number;
  reason: string;
};

type Validation<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type UserClaimsValidation =
  | { ok: true; data: { userId: string } }
  | { ok: false; status: 401 | 500; error: string };

/**
 * `withSupabase({ auth: 'user' })`가 검증한 claim이라도 함수 안에서 기대하는
 * 사용자 토큰 형태를 다시 확인한다. 이 검사는 서명 검증을 대체하지 않는다.
 */
export function validateUserClaims(
  value: unknown,
  supabaseUrl: string | undefined,
  nowUnixSeconds = Date.now() / 1000,
): UserClaimsValidation {
  const normalizedUrl = supabaseUrl?.trim().replace(/\/+$/, '');
  if (!normalizedUrl) {
    return {
      ok: false,
      status: 500,
      error: 'Supabase URL is not configured',
    };
  }

  if (!value || typeof value !== 'object') {
    return { ok: false, status: 401, error: 'Authenticated user not found' };
  }

  const claims = value as Record<string, unknown>;
  if (typeof claims.sub !== 'string' || !isUuid(claims.sub)) {
    return { ok: false, status: 401, error: 'Authenticated user claim is invalid' };
  }
  if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp <= nowUnixSeconds) {
    return { ok: false, status: 401, error: 'Authentication token is expired or invalid' };
  }
  if (claims.iss !== `${normalizedUrl}/auth/v1`) {
    return { ok: false, status: 401, error: 'Authentication token issuer is invalid' };
  }

  const audience = claims.aud;
  const hasAuthenticatedAudience = audience === 'authenticated' ||
    (Array.isArray(audience) && audience.some((item) => item === 'authenticated'));
  if (!hasAuthenticatedAudience) {
    return { ok: false, status: 401, error: 'Authentication token audience is invalid' };
  }
  if (claims.role !== 'authenticated') {
    return { ok: false, status: 401, error: 'Authentication token role is invalid' };
  }
  if (claims.is_anonymous === true) {
    return { ok: false, status: 401, error: 'Anonymous users cannot request recommendations' };
  }

  return { ok: true, data: { userId: claims.sub } };
}

export function rankedArraySchema(idField: string, count: number) {
  return {
    type: 'array',
    minItems: count,
    maxItems: count,
    items: {
      type: 'object',
      properties: {
        [idField]: { type: 'string' },
        rank: { type: 'integer', minimum: 1, maximum: count },
        score: { type: 'number', minimum: 0, maximum: 100 },
        reason: { type: 'string' },
      },
      required: [idField, 'rank', 'score', 'reason'],
      additionalProperties: false,
    },
  };
}

export function validateRequest(value: unknown): Validation<RequestBody> {
  if (!value || typeof value !== 'object') {
    return { ok: false, error: 'Request body must be an object' };
  }

  const body = value as Record<string, unknown>;
  if (
    typeof body.meetingName !== 'string' ||
    body.meetingName.trim().length === 0 ||
    body.meetingName.trim().length > 100
  ) {
    return { ok: false, error: 'meetingName must be 1-100 characters' };
  }

  if (typeof body.roomId !== 'string' || !isUuid(body.roomId)) {
    return { ok: false, error: 'roomId is required' };
  }

  if (!Array.isArray(body.placeCandidates) || body.placeCandidates.length === 0) {
    return { ok: false, error: 'placeCandidates is required' };
  }
  if (body.placeCandidates.length > MAX_PLACE_CANDIDATES) {
    return {
      ok: false,
      error: `placeCandidates must be at most ${MAX_PLACE_CANDIDATES}`,
    };
  }

  const places: ValidPlace[] = [];
  const seenPlaceIds = new Set<string>();
  for (const raw of body.placeCandidates) {
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: 'placeCandidates contains an invalid entry' };
    }
    const candidate = raw as Record<string, unknown>;
    if (
      typeof candidate.id !== 'string' ||
      candidate.id.trim().length === 0 ||
      candidate.id.length > 64
    ) {
      return { ok: false, error: 'placeCandidates[].id is invalid' };
    }
    if (seenPlaceIds.has(candidate.id)) {
      return { ok: false, error: 'placeCandidates contains a duplicated id' };
    }
    seenPlaceIds.add(candidate.id);
    if (
      typeof candidate.name !== 'string' ||
      candidate.name.trim().length === 0 ||
      candidate.name.trim().length > 120
    ) {
      return {
        ok: false,
        error: 'placeCandidates[].name must be 1-120 characters',
      };
    }
    if (
      candidate.address !== undefined &&
      (typeof candidate.address !== 'string' || candidate.address.length > 240)
    ) {
      return { ok: false, error: 'placeCandidates[].address is invalid' };
    }
    if (
      candidate.category !== undefined &&
      (typeof candidate.category !== 'string' || candidate.category.length > 60)
    ) {
      return { ok: false, error: 'placeCandidates[].category is invalid' };
    }
    const latitude = candidate.latitude;
    const longitude = candidate.longitude;
    if (
      (latitude !== undefined &&
        (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
      (longitude !== undefined &&
        (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180)) ||
      (latitude === undefined) !== (longitude === undefined)
    ) {
      return { ok: false, error: 'placeCandidates coordinates are invalid' };
    }
    places.push({
      id: candidate.id,
      name: candidate.name.trim(),
      address:
        typeof candidate.address === 'string'
          ? candidate.address.trim().slice(0, 240)
          : '',
      category:
        typeof candidate.category === 'string'
          ? candidate.category.trim().slice(0, 60)
          : '',
      ...(typeof latitude === 'number' && typeof longitude === 'number'
        ? { latitude, longitude }
        : {}),
    });
  }

  return {
    ok: true,
    data: {
      meetingName: body.meetingName.trim(),
      roomId: body.roomId,
      placeCandidates: places,
    },
  };
}

const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 20_000;

export type GeminiFetch = (
  input: string,
  init: RequestInit,
) => Promise<Response>;

export type GeminiRetryOptions = {
  fetchImpl?: GeminiFetch;
  sleep?: (milliseconds: number) => Promise<void>;
};

/** 일시적인 제공자 오류만 재시도하고, 테스트에서는 fetch/sleep을 주입할 수 있다. */
export async function callGeminiWithRetry(
  url: string,
  init: RequestInit,
  options: GeminiRetryOptions = {},
): Promise<{ response: Response; data: unknown }> {
  const fetchImpl: GeminiFetch = options.fetchImpl ?? ((input, requestInit) => fetch(input, requestInit));
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        ...init,
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });
      const data: unknown = await response.json();
      if (response.ok || !RETRY_STATUSES.has(response.status) || attempt === MAX_ATTEMPTS) {
        return { response, data };
      }
      console.warn(`Gemini ${response.status}, retrying (${attempt}/${MAX_ATTEMPTS})`);
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS) throw error;
      console.warn(`Gemini fetch failed, retrying (${attempt}/${MAX_ATTEMPTS})`);
    }
    await sleep(400 * attempt);
  }

  throw lastError ?? new Error('Gemini request failed');
}

export function parseGeminiRecommendationText(data: unknown): Validation<unknown> {
  const response = data as {
    candidates?: Array<{
      finishReason?: unknown;
      content?: { parts?: Array<{ text?: unknown }> };
    }>;
  } | null;
  const candidate = response?.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') {
    return { ok: false, error: 'Gemini response was truncated' };
  }
  const parts = candidate?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.map((part) => typeof part?.text === 'string' ? part.text : '').join('\n').trim()
    : '';
  if (!text) return { ok: false, error: 'Gemini returned no text' };
  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: 'Gemini returned invalid JSON' };
  }
}

export function validateRankedList(
  value: unknown,
  idField: string,
  validIds: Set<string>,
  expectedCount: number,
): Validation<RankedItem[]> {
  if (!Array.isArray(value) || value.length !== expectedCount) {
    return { ok: false, error: `Unexpected ${idField} recommendation count` };
  }
  const seenIds = new Set<string>();
  const seenRanks = new Set<number>();
  const items: RankedItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: `Invalid ${idField} recommendation item` };
    }
    const item = raw as Record<string, unknown>;
    const id = item[idField];
    if (typeof id !== 'string' || !validIds.has(id) || seenIds.has(id)) {
      return { ok: false, error: `Invalid or duplicated ${idField}` };
    }
    if (
      typeof item.rank !== 'number' ||
      !Number.isInteger(item.rank) ||
      item.rank < 1 ||
      item.rank > expectedCount ||
      seenRanks.has(item.rank)
    ) {
      return { ok: false, error: `Invalid or duplicated ${idField} rank` };
    }
    if (
      typeof item.score !== 'number' ||
      !Number.isFinite(item.score) ||
      item.score < 0 ||
      item.score > 100
    ) {
      return { ok: false, error: `Invalid ${idField} score` };
    }
    if (typeof item.reason !== 'string' || item.reason.trim().length === 0) {
      return { ok: false, error: `Invalid ${idField} reason` };
    }
    seenIds.add(id);
    seenRanks.add(item.rank);
    items.push({ id, rank: item.rank, score: item.score, reason: item.reason });
  }
  return { ok: true, data: items };
}

export function validateModelResult(
  value: unknown,
  candidates: CandidateFact[],
  places: ValidPlace[],
  slotCount: number,
  placeCount: number,
): Validation<{ slots: ModelSlotPick[]; places: ModelPlacePick[] }> {
  if (!value || typeof value !== 'object') {
    return { ok: false, error: 'Model result is not an object' };
  }
  const object = value as Record<string, unknown>;
  const slotResult = validateRankedList(
    object.slotRecommendations,
    'slotId',
    new Set(candidates.map((candidate) => candidate.slotId)),
    slotCount,
  );
  if (!slotResult.ok) return slotResult;
  const placeResult = validateRankedList(
    object.placeRecommendations,
    'placeId',
    new Set(places.map((place) => place.id)),
    placeCount,
  );
  if (!placeResult.ok) return placeResult;
  return {
    ok: true,
    data: {
      slots: slotResult.data.map((item) => ({
        slotId: item.id,
        rank: item.rank,
        score: item.score,
        reason: item.reason,
      })),
      places: placeResult.data.map((item) => ({
        placeId: item.id,
        rank: item.rank,
        score: item.score,
        reason: item.reason,
      })),
    },
  };
}

export function buildScheduleRecommendResponse(
  model: { slots: ModelSlotPick[]; places: ModelPlacePick[] },
  candidates: CandidateFact[],
  places: ValidPlace[],
  providerData: unknown,
  weather: Record<string, number | null> = {},
) {
  const factMap = new Map(candidates.map((fact) => [fact.slotId, fact]));
  const placeMap = new Map(places.map((place) => [place.id, place]));
  const byRank = (a: { rank: number }, b: { rank: number }) => a.rank - b.rank;
  const trimReason = (reason: string) => reason.trim().slice(0, 160);
  const metadata = providerData as { modelVersion?: unknown; usageMetadata?: unknown } | null;

  return {
    slotRecommendations: [...model.slots].sort(byRank).map((pick) => {
      const fact = factMap.get(pick.slotId)!;
      return {
        slot: {
          id: fact.slotId,
          date: fact.date,
          startTime: fact.startTime,
          endTime: fact.endTime,
          label: fact.label,
        },
        rainChance: weather[pick.slotId] ?? null,
        rank: pick.rank,
        score: Math.round(pick.score),
        reason: trimReason(pick.reason),
        availableCount: fact.availableCount,
        totalCount: fact.totalCount,
        attendanceRate: fact.attendanceRate,
      };
    }),
    placeRecommendations: [...model.places].sort(byRank).map((pick) => ({
      place: placeMap.get(pick.placeId)!,
      rank: pick.rank,
      score: Math.round(pick.score),
      reason: trimReason(pick.reason),
      averageTravelMinutes: null,
    })),
    modelVersion: typeof metadata?.modelVersion === 'string' ? metadata.modelVersion : null,
    usage: metadata?.usageMetadata ?? null,
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

function isTimeString(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function timeToMinutes(value: string) {
  const normalized = value.trim().slice(0, 5);
  if (!isTimeString(normalized)) return null;
  const [hours, minutes] = normalized.split(':').map(Number);
  return hours * 60 + minutes;
}
