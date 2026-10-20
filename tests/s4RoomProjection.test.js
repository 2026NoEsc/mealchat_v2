jest.mock('../src/lib/supabase', () => ({ supabase: { rpc: jest.fn(), from: jest.fn() } }));
jest.mock('../src/lib/consents', () => ({ getConsentServerMode: () => 's1', fetchConsentManifest: jest.fn() }));
const { supabase } = require('../src/lib/supabase');
const { setConsentAccess } = require('../src/consents/access');
const { configureRoomDecisions } = require('../src/lib/roomDecisions');
const { fetchRoom, fetchMyRooms, createRoom } = require('../src/lib/rooms');
const { fetchRoomVoting } = require('../src/lib/voting');
const { s4Capabilities, s4RoomId, s4ItemId, s4Time } = require('./fixtures/s4');
let projection, row, query, probe, memory;
beforeEach(() => {
  jest.clearAllMocks(); setConsentAccess('A', 'accepted');
  memory = new Map();
  probe = jest.fn(async () => ({ data: s4Capabilities, error: null }));
  configureRoomDecisions({ transport: probe, storage: { getItem: async key => memory.get(key) ?? null, setItem: async (key, value) => { memory.set(key, value); } }, backend: 'projection-fixture' });
  row = { id: s4RoomId, stage: 'place', confirmed_slot: 'legacy original', meeting_starts_at: s4Time.starts_at, meeting_ends_at: s4Time.ends_at, meeting_time_zone: 'Asia/Seoul', s4_revision: '9007199254740993', appointment_confirmed_at: null, appointment_confirmed_by: null, participants: [], messages: [], location_name: null, confirmed_menu: null };
  query = { select: jest.fn(value => { projection = value; return query; }), eq: jest.fn(() => query), order: jest.fn(() => query), limit: jest.fn(() => query), maybeSingle: jest.fn(async () => ({ data: row, error: null })), returns: jest.fn(async () => ({ data: [row], error: null })), insert: jest.fn(async () => ({ error: null })) };
  supabase.from.mockReturnValue(query); supabase.rpc.mockResolvedValue({ error: null });
});
it('projects structured columns only after the backend capability is established', async () => {
  expect((await fetchRoom(s4RoomId)).data).toMatchObject({ meetingTime: s4Time, decisionRevision: '9007199254740993', decisionMode: 's4' });
  expect(projection).toContain('meeting_starts_at'); expect(projection).toContain('s4_revision::text');
  const result = await fetchMyRooms(); expect(result.data[0].meetingTime).toEqual(s4Time);
  expect(probe).toHaveBeenCalledTimes(1); expect(probe.mock.calls[0][0]).toBe('get_s4_capabilities');
});
it('keeps the legacy projection free of columns that do not exist on old servers', async () => {
  probe.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.get_s4_capabilities() in the schema cache' }, status: 404 });
  expect((await fetchRoom(s4RoomId)).data).toMatchObject({ meetingTime: null, confirmedSlot: 'legacy original', decisionMode: 'legacy' });
  expect(projection).not.toContain('meeting_starts_at'); expect(projection).not.toContain('s4_revision');
});
it('does not fall back to legacy SELECT after a capability error', async () => {
  probe.mockResolvedValue({ data: null, error: { code: 'NETWORK' }, status: 503 });
  expect((await fetchMyRooms()).error).toBeTruthy(); expect(supabase.from).not.toHaveBeenCalled();
});
it('fails closed on incomplete structured columns instead of using meeting_date or a legacy start', async () => {
  row.meeting_ends_at = null; row.meeting_date = '2026-10-20';
  const result = await fetchRoom(s4RoomId); expect(result.error).toBeTruthy(); expect(result.data).toBeNull();
});
it('omits an invalid room row without discarding independently valid rooms or inventing a legacy time', async () => {
  query.returns.mockResolvedValue({ data: [row, { ...row, id: 'invalid', meeting_ends_at: null }], error: null });
  const result = await fetchMyRooms(); expect(result.error).toBeNull(); expect(result.data.map(room => room.id)).toEqual([s4RoomId]);
  query.returns.mockResolvedValue({ data: [{ ...row, meeting_ends_at: null }], error: null });
  const invalid = await fetchMyRooms(); expect(invalid.data).toBeNull(); expect(invalid.error).toBeTruthy();
});
it('never inserts caller-provided confirmation data into a newly created room', async () => {
  await createRoom({ ownerId: 'A', title: '가상 밥약', meetingDate: '2026-10-27', expiresAt: '2026-10-27T14:59:59Z', confirmedSlot: 'forged value' });
  expect(query.insert.mock.calls[0][0]).toMatchObject({ confirmed_slot: null, is_confirmed: false });
  expect(query.insert.mock.calls[0][0]).not.toHaveProperty('meeting_starts_at');
});
it('excludes null-profile votes from both the numerator and denominator', async () => {
  row = { voting_items: [{ id: s4ItemId, label: '가상 식당', kind: 'menu', created_by: 'A' }] };
  query.returns.mockResolvedValue({ data: [{ profile_id: 'A', name: '모아', avatar_color: '', voted_items: [s4ItemId] }, { profile_id: null, name: '이전 행', avatar_color: '', voted_items: [s4ItemId] }], error: null });
  const result = await fetchRoomVoting(s4RoomId, 'A'); expect(result.memberCount).toBe(1); expect(result.data[0].voters).toEqual([{ name: '모아', color: '' }]);
});
