import {
  buildScheduleRecommendResponse,
  callGeminiWithRetry,
  parseGeminiRecommendationText,
  validateUserClaims,
  validateModelResult,
  validateRequest,
  type CandidateFact,
} from './pipeline.ts';

function assert(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T, message = 'values differ') {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  assert(actualJson === expectedJson, `${message}\nactual: ${actualJson}\nexpected: ${expectedJson}`);
}

const rawRequest = {
  meetingName: '  주말 점심  ',
  roomId: '5b3819f0-0bb6-4e5f-9b0f-4e2b85e9d6a1',
  placeCandidates: [
    { id: 'poi-a', name: '  한식당  ', address: '부산 A', category: '한식' },
    { id: 'poi-b', name: '양식당', address: '부산 B', category: '양식' },
  ],
};

const candidateFacts: CandidateFact[] = [
  {
    slotId: 'slot-a',
    date: '2026-08-30',
    startTime: '12:00',
    endTime: '13:00',
    label: '일요일 점심',
    availableCount: 2,
    totalCount: 2,
    attendanceRate: 1,
  },
  {
    slotId: 'slot-b',
    date: '2026-08-30',
    startTime: '18:00',
    endTime: '19:00',
    label: '일요일 저녁',
    availableCount: 1,
    totalCount: 2,
    attendanceRate: 0.5,
  },
];

const modelPayload = {
  slotRecommendations: [
    { slotId: 'slot-b', rank: 2, score: 71.6, reason: '저녁도 가능합니다.' },
    { slotId: 'slot-a', rank: 1, score: 92.4, reason: '모두 참석할 수 있습니다.' },
  ],
  placeRecommendations: [
    { placeId: 'poi-b', rank: 2, score: 72.4, reason: '다른 선택지입니다.' },
    { placeId: 'poi-a', rank: 1, score: 89.6, reason: '한식 선호에 맞습니다.' },
  ],
};

const NOW = 1_800_000_000;
const SUPABASE_URL = 'https://akrfaiwgqoxtpgdbgads.supabase.co';
const validClaims = {
  sub: '5b3819f0-0bb6-4e5f-9b0f-4e2b85e9d6a1',
  exp: NOW + 60,
  iss: `${SUPABASE_URL}/auth/v1`,
  aud: 'authenticated',
  role: 'authenticated',
  is_anonymous: false,
};

function generateContent(data: unknown, finishReason = 'STOP') {
  return {
    candidates: [
      {
        finishReason,
        content: { parts: [{ text: JSON.stringify(data) }] },
      },
    ],
    modelVersion: 'fixture-gemini',
    usageMetadata: { totalTokenCount: 42 },
  };
}

Deno.test('request validation -> retrying provider -> parse -> server correction is deterministic', async () => {
  const request = validateRequest(rawRequest);
  assert(request.ok, request.ok ? undefined : request.error);

  let calls = 0;
  const sleeps: number[] = [];
  const provider = await callGeminiWithRetry(
    'https://example.test/generateContent',
    { method: 'POST' },
    {
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) {
          return Response.json({ error: { status: 'UNAVAILABLE' } }, { status: 503 });
        }
        return Response.json(generateContent(modelPayload));
      },
      sleep: async (milliseconds) => {
        sleeps.push(milliseconds);
      },
    },
  );

  assertEquals(calls, 2, 'retryable 503 must make one retry');
  assertEquals(sleeps, [400], 'retry backoff must stay bounded');
  assert(provider.response.ok, 'second provider response must succeed');

  const parsed = parseGeminiRecommendationText(provider.data);
  assert(parsed.ok, parsed.ok ? undefined : parsed.error);
  const model = validateModelResult(
    parsed.data,
    candidateFacts,
    request.data.placeCandidates,
    2,
    2,
  );
  assert(model.ok, model.ok ? undefined : model.error);

  const response = buildScheduleRecommendResponse(
    model.data,
    candidateFacts,
    request.data.placeCandidates,
    provider.data,
  );
  assertEquals(response.slotRecommendations, [
    {
      slot: {
        id: 'slot-a',
        date: '2026-08-30',
        startTime: '12:00',
        endTime: '13:00',
        label: '일요일 점심',
      },
      rainChance: null,
      rank: 1,
      score: 92,
      reason: '모두 참석할 수 있습니다.',
      availableCount: 2,
      totalCount: 2,
      attendanceRate: 1,
    },
    {
      slot: {
        id: 'slot-b',
        date: '2026-08-30',
        startTime: '18:00',
        endTime: '19:00',
        label: '일요일 저녁',
      },
      rainChance: null,
      rank: 2,
      score: 72,
      reason: '저녁도 가능합니다.',
      availableCount: 1,
      totalCount: 2,
      attendanceRate: 0.5,
    },
  ]);
  assertEquals(response.placeRecommendations.map((recommendation) => recommendation.place.id), [
    'poi-a',
    'poi-b',
  ]);
});

Deno.test('invalid request and invalid provider JSON fail before a screen model can be built', () => {
  const invalidRequest = validateRequest({ ...rawRequest, placeCandidates: [rawRequest.placeCandidates[0], rawRequest.placeCandidates[0]] });
  assert(!invalidRequest.ok && invalidRequest.error === 'placeCandidates contains a duplicated id');

  const invalidJson = parseGeminiRecommendationText({
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{not json' }] } }],
  });
  assert(!invalidJson.ok && invalidJson.error === 'Gemini returned invalid JSON');

  const truncated = parseGeminiRecommendationText(generateContent(modelPayload, 'MAX_TOKENS'));
  assert(!truncated.ok && truncated.error === 'Gemini response was truncated');
});

Deno.test('unknown ids and duplicate ranks are rejected instead of being passed to the client', () => {
  const request = validateRequest(rawRequest);
  assert(request.ok, request.ok ? undefined : request.error);

  const unknownSlot = validateModelResult(
    {
      ...modelPayload,
      slotRecommendations: [
        { ...modelPayload.slotRecommendations[0], slotId: 'invented-slot' },
        modelPayload.slotRecommendations[1],
      ],
    },
    candidateFacts,
    request.data.placeCandidates,
    2,
    2,
  );
  assert(!unknownSlot.ok && unknownSlot.error === 'Invalid or duplicated slotId');

  const duplicateSlotId = validateModelResult(
    {
      ...modelPayload,
      slotRecommendations: [
        { ...modelPayload.slotRecommendations[0], slotId: 'slot-a', rank: 1 },
        { ...modelPayload.slotRecommendations[1], slotId: 'slot-a', rank: 2 },
      ],
    },
    candidateFacts,
    request.data.placeCandidates,
    2,
    2,
  );
  assert(!duplicateSlotId.ok && duplicateSlotId.error === 'Invalid or duplicated slotId');

  const duplicatePlaceRank = validateModelResult(
    {
      ...modelPayload,
      placeRecommendations: [
        { ...modelPayload.placeRecommendations[0], rank: 1 },
        { ...modelPayload.placeRecommendations[1], rank: 1 },
      ],
    },
    candidateFacts,
    request.data.placeCandidates,
    2,
    2,
  );
  assert(!duplicatePlaceRank.ok && duplicatePlaceRank.error === 'Invalid or duplicated placeId rank');
});

Deno.test('terminal provider 4xx is not retried', async () => {
  let calls = 0;
  const result = await callGeminiWithRetry(
    'https://example.test/generateContent',
    { method: 'POST' },
    {
      fetchImpl: async () => {
        calls += 1;
        return Response.json({ error: { status: 'INVALID_ARGUMENT' } }, { status: 400 });
      },
      sleep: async () => {
        throw new Error('terminal errors must not sleep');
      },
    },
  );
  assertEquals(calls, 1);
  assertEquals(result.response.status, 400);
});

Deno.test('only a non-anonymous authenticated Supabase user claim is accepted', () => {
  const valid = validateUserClaims(validClaims, SUPABASE_URL, NOW);
  assert(valid.ok, valid.ok ? undefined : valid.error);
  assertEquals(valid.data.userId, validClaims.sub);

  const arrayAudience = validateUserClaims(
    { ...validClaims, aud: ['other', 'authenticated'] },
    SUPABASE_URL,
    NOW,
  );
  assert(arrayAudience.ok, arrayAudience.ok ? undefined : arrayAudience.error);
});

Deno.test('user claim validation fails closed for issuer, audience, role, expiry, anonymous, and server configuration', () => {
  const rejected = [
    { claims: { ...validClaims, sub: 'not-a-uuid' }, error: 'Authenticated user claim is invalid' },
    { claims: { ...validClaims, iss: 'https://other.supabase.co/auth/v1' }, error: 'Authentication token issuer is invalid' },
    { claims: { ...validClaims, aud: 'anon' }, error: 'Authentication token audience is invalid' },
    { claims: { ...validClaims, role: 'service_role' }, error: 'Authentication token role is invalid' },
    { claims: { ...validClaims, exp: undefined }, error: 'Authentication token is expired or invalid' },
    { claims: { ...validClaims, exp: NOW }, error: 'Authentication token is expired or invalid' },
    { claims: { ...validClaims, is_anonymous: true }, error: 'Anonymous users cannot request recommendations' },
  ];

  for (const { claims, error } of rejected) {
    const result = validateUserClaims(claims, SUPABASE_URL, NOW);
    assert(!result.ok && result.status === 401 && result.error === error, error);
  }

  const missingUrl = validateUserClaims(validClaims, undefined, NOW);
  assert(
    !missingUrl.ok &&
      missingUrl.status === 500 &&
      missingUrl.error === 'Supabase URL is not configured',
  );
});
