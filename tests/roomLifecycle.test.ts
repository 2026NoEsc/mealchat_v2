import { setConsentAccess } from '../src/consents/access';
import {
  configureRoomLifecycle, fetchS3Capabilities, invalidateS3Capabilities, isMissingS3Capabilities,
  leaveRoomMember, parseInviteOutcome, parseRoomLifecycle, registerRoomLifecycleResources,
  requestRoomLifecycle, roomLifecycleRequestId,
} from '../src/lib/roomLifecycle';
import { createRoomLifecycleController, createRoomSettlementWithSnapshot, prepareRoomSettlement } from '../src/lib/roomLifecycleController';
import { fetchRoom } from '../src/lib/rooms';
import { createRoomSettlement, fetchSettlementDetail } from '../src/lib/settlements';
const room = '33000000-0000-4000-8000-000000000001';
const capabilities = { contract_version: 1, member_leave: true, owner_transfer: true, invite_preview: true, invite_limits: true, bounded_expiry: true, invite_links: false };
const missing = { code: 'PGRST202', message: 'Could not find the function public.get_s3_capabilities without parameters in the schema cache', status: 404 };
const state = () => ({ contract_version: 1, room_id: room, stage: 'confirmed', revision: '9007199254740993', server_time: '2026-10-21T00:00:00Z', expires_at: '2026-10-27T00:00:00Z', can_leave: true, can_close: false, can_transfer: false, reason: null, transfer: null, invite: null });
let rpc: jest.Mock, storage: { getItem: jest.Mock; setItem: jest.Mock };
beforeEach(() => {
  jest.useRealTimers(); setConsentAccess('A', 'accepted');
  const data = new Map(); storage = { getItem: jest.fn(async key => data.get(key) ?? null), setItem: jest.fn(async (key, value) => { data.set(key, value); }) };
  rpc = jest.fn(async name => ({ data: name === 'get_s3_capabilities' ? capabilities : name === 'get_room_lifecycle_v1' ? state() : { contract_version: 1, outcome: 'applied', applied_revision: '9007199254740994' }, error: null }));
  configureRoomLifecycle({ transport: rpc, storage, backend: 's3-test' });
});
afterEach(() => jest.useRealTimers());
it('recognizes only the exact missing S3 probe with a permitted HTTP status', () => {
  expect(isMissingS3Capabilities(missing)).toBe(true);
  expect(isMissingS3Capabilities({ code: '42883', message: 'function public.get_s3_capabilities() does not exist' })).toBe(true);
  for (const value of [{ ...missing, status: 503 }, { code: 'PGRST202', message: 'Could not find the function public.leave_room_member_v1() in the schema cache' }, { status: 404 }, { ...missing, message: 'function private.get_s3_capabilities() does not exist' }]) expect(isMissingS3Capabilities(value)).toBe(false);
});
it('returns legacy only on missing probe and never invokes a new writer', async () => {
  rpc.mockResolvedValue({ data: null, error: missing }); expect((await fetchS3Capabilities()).mode).toBe('legacy');
  expect((await leaveRoomMember(room, '1')).error).toMatchObject({ code: 'S3_UNAVAILABLE' }); expect(rpc).toHaveBeenCalledTimes(1);
});
it.each([{ code: 'NETWORK' }, { code: '42501' }, { code: 'S1001' }, { code: 'S1006' }, { code: 'XX000' }, { ...missing, status: 500 }])('fails closed for %j', async error => {
  rpc.mockResolvedValue({ data: null, error }); expect((await fetchS3Capabilities()).mode).toBe('error');
});
it('rejects an incomplete or malformed capability contract', async () => {
  rpc.mockResolvedValue({ data: { ...capabilities, owner_transfer: false }, error: null }); expect((await fetchS3Capabilities()).mode).toBe('error');
});
it('never downgrades support across account changes or persistent restart', async () => {
  expect((await fetchS3Capabilities()).mode).toBe('s3'); setConsentAccess('B', 'accepted'); rpc.mockResolvedValue({ data: null, error: missing });
  expect((await fetchS3Capabilities()).mode).toBe('error'); configureRoomLifecycle({ transport: rpc, storage, backend: 's3-test' });
  expect((await fetchS3Capabilities()).mode).toBe('error');
});
it('fails closed if capability persistence fails', async () => {
  storage.setItem.mockRejectedValue(new Error('unavailable')); expect((await fetchS3Capabilities()).mode).toBe('error');
});
it('does not fall back after an individual writer disappears', async () => {
  await fetchS3Capabilities(); rpc.mockResolvedValue({ data: null, error: { code: '42883' } });
  expect((await leaveRoomMember(room, '1')).error).toMatchObject({ code: '42883' }); expect(rpc.mock.calls.map(call => call[0])).toEqual(['get_s3_capabilities', 'leave_room_member_v1']);
});
it('does not expose a delayed response after an A to B to A account transition', async () => {
  await fetchS3Capabilities(); let resolve!: (value: unknown) => void;
  rpc.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const result = requestRoomLifecycle('get_room_lifecycle_v1', { p_room_id: room }, v => parseRoomLifecycle(v, room));
  for (let i = 0; i < 10 && !resolve; i++) await Promise.resolve();
  setConsentAccess('B', 'accepted'); setConsentAccess('A', 'accepted'); resolve({ data: state(), error: null });
  expect((await result).error).toMatchObject({ code: 'ACCOUNT_CHANGED' });
});
it('invalidates registered cache and subscription after successful leave', async () => {
  const invalidate = jest.fn(), unsubscribe = jest.fn(); const dispose = registerRoomLifecycleResources(room, { invalidate, unsubscribe });
  expect((await leaveRoomMember(room, '1')).data?.outcome).toBe('applied'); expect(invalidate).toHaveBeenCalledTimes(1); expect(unsubscribe).toHaveBeenCalledTimes(1); dispose();
});
it('retains an exact request ID for retries but never reissues an expired intent', () => {
  jest.useFakeTimers(); const args = { p_room_id: room }; const id = roomLifecycleRequestId('create', args);
  expect(roomLifecycleRequestId('create', args)).toBe(id); jest.advanceTimersByTime(86400000);
  expect(() => roomLifecycleRequestId('create', args)).toThrow(expect.objectContaining({ code: 'REQUEST_EXPIRED' }));
});
it('preserves bigint revisions and rejects numeric revisions or missing permissions', () => {
  expect(parseRoomLifecycle(state(), room).revision).toBe('9007199254740993');
  expect(() => parseRoomLifecycle({ ...state(), revision: 9007199254740993 }, room)).toThrow();
  expect(() => parseRoomLifecycle({ ...state(), can_leave: undefined }, room)).toThrow();
});
it('rejects extra private fields in invite preview responses', () => {
  expect(() => parseInviteOutcome({ contract_version: 1, outcome: 'preview', preview_id: room, title: 'Synthetic', member_count: 2, can_join: true, code_expires_at: '2026-10-22T00:00:00Z', preview_expires_at: '2026-10-21T00:02:00Z', server_time: '2026-10-21T00:00:00Z', room_id: room })).toThrow();
});
it('controller permissions use server flags and successful departure clears state', async () => {
  const controller = createRoomLifecycleController(room), departures = jest.fn();
  controller.subscribe(view => { if (view.departed) departures(); });
  await controller.refresh(); expect(controller.getState().canLeave).toBe(true);
  await controller.leave(); expect(controller.getState()).toMatchObject({ state: null, departed: true, canLeave: false }); expect(departures).toHaveBeenCalledTimes(1); controller.dispose();
});
it('account cleanup disposes resources without emitting a successful leave', async () => {
  const controller = createRoomLifecycleController(room), departures = jest.fn();
  const unregister = registerRoomLifecycleResources(room, { invalidate: jest.fn(), unsubscribe: jest.fn() });
  controller.subscribe(view => { if (view.departed) departures(); }); await controller.refresh();
  setConsentAccess('B', 'accepted'); expect(departures).not.toHaveBeenCalled(); expect(controller.getState().state).toBeNull(); unregister(); controller.dispose();
});
it('reprobes after explicit invalidation', async () => {
  await fetchS3Capabilities(); invalidateS3Capabilities(); await fetchS3Capabilities(); expect(rpc).toHaveBeenCalledTimes(2);
});
jest.mock('../src/lib/rooms', () => ({ fetchRoom: jest.fn() }));
jest.mock('../src/lib/settlements', () => ({ createRoomSettlement: jest.fn(), fetchSettlementDetail: jest.fn() }));
it('prepares only actual non-NULL current recipients and binds their displayed revision', async () => {
  (fetchRoom as jest.Mock).mockResolvedValue({ data: { id: room, stage: 'confirmed', appointmentConfirmedAt: '2026-10-21T00:00:00Z', decisionRevision: state().revision, participants: [{ profileId: 'A', name: 'Synthetic' }, { profileId: null, name: 'Display only' }] }, error: null });
  expect((await prepareRoomSettlement(room)).data?.members).toEqual([{ profileId: 'A', name: 'Synthetic' }]);
});
it('requires fresh recipient confirmation when membership revision changed', async () => {
  const result = await createRoomSettlementWithSnapshot({ roomId: room, title: 'Synthetic', amount: 2000 }, '1');
  expect(result.error).toMatchObject({ code: 'S4005' }); expect(createRoomSettlement).not.toHaveBeenCalled();
});
it('reads the actual bill snapshot after success and never uses a proposed list', async () => {
  (createRoomSettlement as jest.Mock).mockResolvedValue({ billId: 'bill', error: null });
  const actual = { id: 'bill', splitCount: 1, members: [{ id: 'recipient', profileId: 'B', name: 'Actual B', isCompleted: false }] };
  (fetchSettlementDetail as jest.Mock).mockResolvedValue({ data: actual, error: null });
  const result = await createRoomSettlementWithSnapshot({ roomId: room, title: 'Synthetic', amount: 2000 }, state().revision);
  expect(result.data).toEqual(actual); expect(fetchSettlementDetail).toHaveBeenCalledWith('bill');
});
