jest.mock('../src/lib/consents', () => ({ getConsentServerMode: jest.fn(() => 's1'), fetchConsentManifest: jest.fn() }));
import { getConsentServerMode } from '../src/lib/consents';
import { setConsentAccess } from '../src/consents/access';
import { configureRoomDecisions, confirmRoomAppointment, fetchRoomDecisionState, fetchS4Capabilities, invalidateS4Capabilities, isMissingS4Capabilities, parseRoomDecisionState, parseS4Capabilities, previewRoomMeetingTime, roomDecisionErrorMessage, selectRoomMeetingTime, submitRoomAvailability, subscribeRoomDecisions } from '../src/lib/roomDecisions';
import { s4Capabilities, s4ItemId, s4Mutation, s4RoomId, s4State, s4Time } from './fixtures/s4';
const missing = { code: 'PGRST202', message: 'Could not find the function public.get_s4_capabilities without parameters in the schema cache', status: 404 };
it('retries a transient probe failure without requiring an explicit invalidation', async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { code: 'NETWORK' }, status: 503 });
  expect((await fetchS4Capabilities()).mode).toBe('error');
  expect((await fetchS4Capabilities()).mode).toBe('s4'); expect(rpc).toHaveBeenCalledTimes(2);
});
it('joins a fresh same-account probe instead of inventing an account change after invalidation', async () => {
  let finish!: (value: null) => void;
  storage.getItem.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const previous = fetchS4Capabilities(); invalidateS4Capabilities();
  expect((await fetchS4Capabilities()).mode).toBe('s4');
  finish(null); expect(await previous).toEqual({ mode: 's4', error: null });
  expect(rpc).toHaveBeenCalledTimes(1);
});
it.each([false, true])('uses the newer probe when an in-flight RPC settles after invalidation (old failure=%s)', async failed => {
  let finish!: (value: { data: unknown; error: unknown }) => void;
  rpc.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const previous = fetchS4Capabilities();
  for (let turn = 0; turn < 8 && !finish; turn++) await Promise.resolve();
  expect(finish).toBeDefined(); invalidateS4Capabilities();
  expect((await fetchS4Capabilities()).mode).toBe('s4');
  finish(failed ? { data: null, error: { code: 'NETWORK' } } : { data: s4Capabilities, error: null });
  expect(await previous).toEqual({ mode: 's4', error: null }); expect(rpc).toHaveBeenCalledTimes(2);
});
it('explains the request ledger limit without exposing the server message', () => {
  expect(roomDecisionErrorMessage({ code: 'S4011' })).toContain('새 요청을 반복하지 말고');
});
it.each(['settling', 'done'] as const)('parses %s with an unverified settlement instead of assuming a confirmation', stage => {
  const value = s4State({ stage, confirmation_status: 'legacy_settlement_unverified', permissions: { can_submit: false, can_select_time: false, can_confirm: false } });
  expect(parseRoomDecisionState(value).confirmation_status).toBe('legacy_settlement_unverified');
});
let persisted: Map<string, string>;
let rpc: jest.Mock;
let storage: { getItem: jest.Mock; setItem: jest.Mock };
beforeEach(() => {
  jest.useRealTimers(); jest.clearAllMocks();
  (getConsentServerMode as jest.Mock).mockReturnValue('s1');
  setConsentAccess('A', 'accepted'); persisted = new Map();
  storage = { getItem: jest.fn(async key => persisted.get(key) ?? null), setItem: jest.fn(async (key, value) => { persisted.set(key, value); }) };
  rpc = jest.fn(async (name: string) => ({ data: name === 'get_s4_capabilities' ? s4Capabilities : name === 'get_room_s4_state' ? s4State() : s4Mutation(s4State({ revision: '5' })), error: null }));
  configureRoomDecisions({ transport: rpc, storage, backend: 'test-backend-A' });
});
afterEach(() => jest.useRealTimers());
it('accepts only the absent probe signature, not helper failures or generic HTTP 404', () => {
  expect(isMissingS4Capabilities(missing)).toBe(true);
  expect(isMissingS4Capabilities({ code: '42883', status: 400, message: 'function public.get_s4_capabilities() does not exist' })).toBe(true);
  for (const error of [{ code: 'PGRST202', status: 404 }, { code: 'PGRST202', message: 'function private.helper() does not exist', status: 404 }, { ...missing, message: 'function private.helper() is absent inside function public.get_s4_capabilities()' }, { status: 404, message: 'not found' }, { ...missing, status: 503 }, { code: '42883', message: 'function private.helper() does not exist' }]) expect(isMissingS4Capabilities(error)).toBe(false);
});
it('caches exact missing probes per account and reprobes on foreground/retry', async () => {
  rpc.mockResolvedValue({ data: null, error: missing });
  expect((await fetchS4Capabilities()).mode).toBe('legacy'); await fetchS4Capabilities(); expect(rpc).toHaveBeenCalledTimes(1);
  rpc.mockResolvedValue({ data: s4Capabilities, error: null }); invalidateS4Capabilities();
  expect((await fetchS4Capabilities()).mode).toBe('s4'); expect(rpc).toHaveBeenCalledTimes(2);
});
it('uses existing S1 legacy evidence without inventing S4 support', async () => {
  (getConsentServerMode as jest.Mock).mockReturnValue('legacy');
  expect((await fetchS4Capabilities()).mode).toBe('legacy'); expect(rpc).not.toHaveBeenCalled();
  expect((await selectRoomMeetingTime(s4RoomId, s4Time, '4')).error?.code).toBe('S4_UNAVAILABLE');
});
it('never downgrades a confirmed backend across account changes or process restart', async () => {
  expect((await fetchS4Capabilities()).mode).toBe('s4');
  setConsentAccess('B', 'accepted'); rpc.mockResolvedValue({ data: null, error: missing });
  expect((await fetchS4Capabilities()).mode).toBe('error');
  configureRoomDecisions({ transport: rpc, storage, backend: 'test-backend-A' });
  expect((await fetchS4Capabilities()).mode).toBe('error');
  configureRoomDecisions({ transport: rpc, storage, backend: 'test-backend-B' });
  expect((await fetchS4Capabilities()).mode).toBe('legacy');
});
it('keeps the confirmed boundary across equivalent backend URLs', async () => {
  configureRoomDecisions({ transport: rpc, storage, backend: 'https://EXAMPLE.test:443/' }); await fetchS4Capabilities();
  rpc.mockResolvedValue({ data: null, error: missing });
  configureRoomDecisions({ transport: rpc, storage, backend: 'https://example.test' });
  expect((await fetchS4Capabilities()).mode).toBe('error');
});
it('fails closed when confirmed-support persistence is unavailable', async () => {
  storage.getItem.mockRejectedValue(new Error('storage inaccessible'));
  expect((await fetchS4Capabilities()).mode).toBe('error'); expect(rpc).not.toHaveBeenCalled();
});
it.each([{ code: 'NETWORK' }, { code: '42501' }, { code: 'S1001' }, { ...missing, status: 503 }, { status: 404 }])('fails closed for non-capability errors %j', async error => {
  rpc.mockResolvedValue({ data: null, error }); expect((await fetchS4Capabilities()).mode).toBe('error');
});
it('rejects partial capability responses and inconsistent state counts/revisions', async () => {
  for (const field of ['atomic_confirmation', 'structured_meeting_time', 'owner_confirmation', 'availability_stage_guard', 'requires_time_for_confirmation']) expect(() => parseS4Capabilities({ ...s4Capabilities, [field]: false })).toThrow();
  expect(() => parseRoomDecisionState(s4State({ revision: 4 as unknown as string }))).toThrow();
  const state = s4State(); expect(() => parseRoomDecisionState({ ...state, availability: { ...state.availability, eligible_count: 3 } })).toThrow();
  expect(() => parseRoomDecisionState({ ...state, availability: { ...state.availability, all_submitted: false } })).toThrow();
  expect(() => parseRoomDecisionState(state, 'another-room')).toThrow();
});
it('accepts ineligible display rows without counting them as submitted members', async () => {
  const result = await fetchRoomDecisionState(s4RoomId);
  expect(result.data?.availability).toMatchObject({ eligible_count: 2, submitted_count: 2, all_submitted: true });
  expect(result.data?.availability.members[2]).toMatchObject({ eligible: false, submitted: false });
});
it('accepts PostgreSQL UTC server timestamps with microsecond precision', () => {
  expect(parseRoomDecisionState(s4State({ server_time: '2026-10-20T00:00:00.123456+00:00' })).server_time).toBe('2026-10-20T00:00:00.123456+00:00');
});
it('does not fall back when a mutation is absent on an otherwise S4 backend', async () => {
  await fetchS4Capabilities(); rpc.mockResolvedValue({ data: null, error: missing });
  expect((await selectRoomMeetingTime(s4RoomId, s4Time, '4')).error).toBeTruthy();
  expect(rpc.mock.calls.map(call => call[0])).toEqual(['get_s4_capabilities', 'select_room_meeting_time_v1']);
});
it('sends exact mutation fields, normalized intervals and the captured revision', async () => {
  const result = await selectRoomMeetingTime(s4RoomId, s4Time, '4');
  expect(result.error).toBeNull();
  expect(rpc.mock.calls[1][1]).toEqual({ p_room_id: s4RoomId, p_time: s4Time, p_expected_revision: '4', p_request_id: expect.stringMatching(/^[a-f0-9-]{36}$/i) });
  expect((await submitRoomAvailability(s4RoomId, [], '5')).error).toBeNull();
  expect(rpc.mock.calls[2][1].p_slot_keys).toEqual([]);
  await confirmRoomAppointment(s4RoomId, s4ItemId, '5'); expect(rpc.mock.calls[3][0]).toBe('confirm_room_appointment_v1');
});
it('keeps the same id after timeout and accepts a replay with a newer current state', async () => {
  await fetchS4Capabilities(); jest.useFakeTimers();
  rpc.mockImplementationOnce(() => new Promise(() => {}));
  const first = selectRoomMeetingTime(s4RoomId, s4Time, '4'); await jest.advanceTimersByTimeAsync(12001);
  expect((await first).error?.code).toBe('TIMEOUT');
  const replay = s4Mutation(s4State({ revision: '9' }), 'replayed'); replay.applied_revision = '5';
  rpc.mockResolvedValueOnce({ data: replay, error: null });
  expect((await selectRoomMeetingTime(s4RoomId, s4Time, '4')).data?.outcome).toBe('replayed');
  expect(rpc.mock.calls[2][1].p_request_id).toBe(rpc.mock.calls[1][1].p_request_id);
});
it('rejects late responses after an account change without notifying the next account', async () => {
  await fetchS4Capabilities(); let finish!: (value: unknown) => void;
  rpc.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const changed = jest.fn(), unsubscribe = subscribeRoomDecisions(changed);
  const pending = selectRoomMeetingTime(s4RoomId, s4Time, '4');
  for (let i = 0; i < 20 && !finish; i++) await Promise.resolve();
  setConsentAccess('B', 'accepted'); finish({ data: s4Mutation(), error: null });
  expect((await pending).error?.code).toBe('ACCOUNT_CHANGED'); expect(changed).not.toHaveBeenCalled(); unsubscribe();
});
it('rejects invalid or duplicate input without starting a write', async () => {
  expect((await submitRoomAvailability(s4RoomId, ['2026-02-30-18'], '4')).error?.code).toBe('22023');
  expect((await submitRoomAvailability(s4RoomId, ['2026-10-20-18', '2026-10-20-18'], '4')).error?.code).toBe('22023');
  expect((await selectRoomMeetingTime(s4RoomId, { ...s4Time, time_zone: 'UTC' } as never, '4')).error?.code).toBe('22023');
  expect(rpc).not.toHaveBeenCalled();
});
it('rejects a successful-looking mutation whose applied revision precedes the submitted snapshot', async () => {
  expect((await selectRoomMeetingTime(s4RoomId, s4Time, '99')).error?.code).toBe('INVALID_RESPONSE');
});
it('maps candidate errors distinctly without treating legacy 22023 as a limit', () => {
  expect(roomDecisionErrorMessage({ code: 'S4001' })).toContain('30개'); expect(roomDecisionErrorMessage({ code: 'S4002' })).toContain('1~120자');
  expect(roomDecisionErrorMessage({ code: '22023' })).not.toContain('30개');
  expect(roomDecisionErrorMessage({ code: '22P02' })).toBe(roomDecisionErrorMessage({ code: '22023' }));
  expect(roomDecisionErrorMessage({ message: 'private server raw' })).not.toContain('private server raw');
  expect(typeof roomDecisionErrorMessage({ code: '__proto__' })).toBe('string');
});
it.each([
  ['operation=settlement', '약속을 확정한 뒤 정산'],
  ['operation=vote_confirmation', '최다 득표'],
  [undefined, '최다 득표'], ['operation=unknown private raw', '최다 득표'],
])('preserves only recognized S4008 hints through the real mutation path (%s)', async (hint, expected) => {
  await fetchS4Capabilities();
  rpc.mockResolvedValueOnce({ data: null, error: { code: 'S4008', hint, message: 'private raw' } });
  const result = await confirmRoomAppointment(s4RoomId, s4ItemId, '4');
  expect(result.error?.message).toContain(expected); expect(roomDecisionErrorMessage(result.error)).toContain(expected);
  expect(result.error?.message).not.toContain('private raw');
  expect(result.error).toMatchObject({ code: 'S4008' });
  expect((result.error as Error & { hint?: string })?.hint).toBe(hint?.startsWith('operation=unknown') ? undefined : hint);
});
it('accepts repeated identical schedule submissions with applied/current revision and a new request ID', async () => {
  await fetchS4Capabilities(); rpc.mockResolvedValue({ data: s4Mutation(s4State()), error: null });
  const slots = s4State().availability.my_slots;
  for (let count = 0; count < 2; count++) {
    const result = await submitRoomAvailability(s4RoomId, slots, '4');
    expect(result.data).toMatchObject({ outcome: 'applied', applied_revision: '4', state: { revision: '4' } }); expect(result.error).toBeNull();
  }
  expect(rpc.mock.calls[1][1].p_request_id).not.toBe(rpc.mock.calls[2][1].p_request_id);
});
it('explains format/control characters without changing the candidate name', () => {
  expect(roomDecisionErrorMessage({ code: 'S4002' })).toContain('보이지 않는 서식 문자나 제어문자를 빼고');
});
const previewMissing = { code: 'PGRST202', status: 404, message: 'Could not find the function public.preview_room_meeting_time_v1(p_ends_at, p_room_id, p_starts_at, p_time_zone) in the schema cache' };
const previewValue = { eligible_count: 2, available_count: 1, all_available: false, revision: '6' };
it('reads exact interval attendance and its snapshot revision without a request ID or mutation', async () => {
  await fetchS4Capabilities(); rpc.mockResolvedValueOnce({ data: previewValue, error: null });
  expect(await previewRoomMeetingTime(s4RoomId, s4Time)).toEqual({ data: previewValue, unsupported: false, error: null });
  expect(rpc.mock.calls.at(-1)).toEqual(['preview_room_meeting_time_v1', { p_room_id: s4RoomId, p_starts_at: s4Time.starts_at, p_ends_at: s4Time.ends_at, p_time_zone: 'Asia/Seoul' }]);
});
it.each([previewMissing, { code: '42883', status: 404, message: 'function public.preview_room_meeting_time_v1(uuid, text, text, text) does not exist' }])('omits preview only for the exact absent optional RPC %j', async error => {
  await fetchS4Capabilities(); rpc.mockResolvedValueOnce({ data: null, error });
  expect(await previewRoomMeetingTime(s4RoomId, s4Time)).toEqual({ data: null, unsupported: true, error: null });
});
it('omits previews on old servers without calling the new RPC', async () => {
  rpc.mockResolvedValue({ data: null, error: missing });
  expect(await previewRoomMeetingTime(s4RoomId, s4Time)).toEqual({ data: null, unsupported: true, error: null });
  expect(rpc.mock.calls.map(([name]) => name)).toEqual(['get_s4_capabilities']);
});
it.each([{ status: 404 }, { ...previewMissing, status: 503 }, { code: 'PGRST202', message: 'Could not find the function public.private_helper() in the schema cache' }, { code: '42501' }, { code: '22P02' }])('does not hide preview lookup/authorization failures as old-server support %j', async error => {
  await fetchS4Capabilities(); rpc.mockResolvedValueOnce({ data: null, error });
  const result = await previewRoomMeetingTime(s4RoomId, s4Time);
  expect(result.unsupported).toBe(false); expect(result.error).toBeTruthy();
});
it('fails closed if a previously available preview RPC disappears', async () => {
  await fetchS4Capabilities(); rpc.mockResolvedValueOnce({ data: previewValue, error: null }); await previewRoomMeetingTime(s4RoomId, s4Time);
  rpc.mockResolvedValueOnce({ data: null, error: previewMissing });
  expect((await previewRoomMeetingTime(s4RoomId, s4Time)).error?.code).toBe('PGRST202');
});
it.each([
  { ...previewValue, available_count: 3 }, { ...previewValue, all_available: true }, { ...previewValue, revision: 6 },
  { ...previewValue, eligible_count: -1 }, { ...previewValue, available_count: 0.5 },
])('rejects malformed preview counts or revisions %j', async data => {
  await fetchS4Capabilities(); rpc.mockResolvedValueOnce({ data, error: null });
  expect((await previewRoomMeetingTime(s4RoomId, s4Time)).error?.code).toBe('INVALID_RESPONSE');
});
it('accepts zero attendance as a valid preview instead of a fake successful selection', async () => {
  await fetchS4Capabilities(); rpc.mockResolvedValueOnce({ data: { ...previewValue, available_count: 0 }, error: null });
  expect((await previewRoomMeetingTime(s4RoomId, s4Time)).data?.available_count).toBe(0);
});
it('drops a delayed attendance response after the session owner changes', async () => {
  await fetchS4Capabilities(); let finish!: (value: unknown) => void;
  rpc.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = previewRoomMeetingTime(s4RoomId, s4Time);
  for (let turn = 0; turn < 20 && !finish; turn++) await Promise.resolve();
  expect(finish).toBeDefined(); setConsentAccess('B', 'accepted'); finish({ data: previewValue, error: null });
  const result = await pending; expect(result.data).toBeNull(); expect(result.unsupported).toBe(false); expect(result.error?.code).toBe('ACCOUNT_CHANGED');
});
