const React = require('react');
const { act, create } = require('react-test-renderer');
const { AppState } = require('react-native');
jest.mock('../src/lib/consents', () => ({ getConsentServerMode: () => 's1', fetchConsentManifest: jest.fn() }));
jest.mock('../src/lib/supabase', () => ({ supabase: { channel: jest.fn(), removeChannel: jest.fn() } }));
const { supabase } = require('../src/lib/supabase');
const { configureRoomDecisions } = require('../src/lib/roomDecisions');
const { setConsentAccess } = require('../src/consents/access');
const { useRoomDecision } = require('../src/lib/useRoomDecision');
const { s4Capabilities, s4RoomId, s4State, s4Time } = require('./fixtures/s4');
let renderer, value, state, rpc, props, realtime, channel;
const stateListeners = new Set();
function Harness() { value = useRoomDecision(props.roomId, props.visible); return null; }
async function mount() { await act(async () => { renderer = create(React.createElement(Harness)); }); }
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-20T00:00:00Z'));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => { stateListeners.add(listener); return { remove: () => stateListeners.delete(listener) }; });
  setConsentAccess('A', 'accepted');
  state = s4State(); props = { roomId: s4RoomId, visible: true }; realtime = [];
  channel = { on: jest.fn((_, filter, listener) => { realtime.push({ filter, listener }); return channel; }), subscribe: jest.fn(() => channel) };
  supabase.channel.mockReturnValue(channel); supabase.removeChannel.mockClear();
  rpc = jest.fn(async name => ({ data: name === 'get_s4_capabilities' ? s4Capabilities : state, error: null }));
  configureRoomDecisions({ transport: rpc, storage: { getItem: async () => null, setItem: async () => {} }, backend: 'hook-fixture' });
});
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = undefined; jest.restoreAllMocks(); jest.useRealTimers(); });
it('rechecks visible state through room and participant events and becomes read-only after server stage changes', async () => {
  await mount(); expect(value.data.stage).toBe('scheduling');
  expect(realtime.map(item => item.filter)).toEqual(expect.arrayContaining([expect.objectContaining({ table: 'rooms', filter: `id=eq.${s4RoomId}` }), expect.objectContaining({ table: 'participants', filter: `room_id=eq.${s4RoomId}` })]));
  state = s4State({ stage: 'settling', revision: '8', meeting_time: s4Time, time_status: 'selected', permissions: { can_submit: false, can_select_time: false, can_confirm: false } });
  await act(async () => realtime[0].listener());
  expect(value.data.stage).toBe('settling'); expect(value.data.permissions.can_select_time).toBe(false);
});
it('polls while visible and stops all reads/subscriptions when the sheet is closed', async () => {
  await mount(); const reads = rpc.mock.calls.length;
  state = s4State({ revision: '5' }); await act(async () => jest.advanceTimersByTimeAsync(10000)); expect(value.data.revision).toBe('5');
  expect(rpc.mock.calls.length).toBeGreaterThan(reads);
  props.visible = false; await act(async () => renderer.update(React.createElement(Harness)));
  const closed = rpc.mock.calls.length; await act(async () => jest.advanceTimersByTimeAsync(30000)); expect(rpc.mock.calls.length).toBe(closed); expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
});
it('keeps the last verified state on a transient polling failure and retries successfully', async () => {
  await mount(); const verified = value.data;
  let finish, pending;
  rpc.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => { pending = value.reload(); });
  expect(value.data).toBe(verified); expect(value.loading).toBe(false); expect(value.refreshing).toBe(true);
  await act(async () => { finish({ data: null, error: { code: 'NETWORK' }, status: 503 }); await pending; });
  expect(value.data).toBe(verified); expect(value.mode).toBe('s4'); expect(value.error).toBeTruthy();
  state = s4State({ revision: '5' }); await act(async () => value.reload());
  expect(value.data.revision).toBe('5'); expect(value.error).toBeNull();
});
it.each(['42501', 'PGRST301', '28000'])('still clears verified state for %s instead of treating it as a network failure', async code => {
  await mount(); rpc.mockResolvedValueOnce({ data: null, error: { code } });
  await act(async () => value.reload()); expect(value.data).toBeNull(); expect(value.mode).toBe('error');
});
it('reprobes a legacy backend on foreground and activates S4 only after a valid response', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.get_s4_capabilities() in the schema cache' }, status: 404 });
  await mount(); expect(value.mode).toBe('legacy');
  rpc.mockImplementation(async name => ({ data: name === 'get_s4_capabilities' ? s4Capabilities : state, error: null }));
  await act(async () => { for (const listener of stateListeners) listener('active'); });
  expect(value.mode).toBe('s4'); expect(value.data.room_id).toBe(s4RoomId);
});
it('reprobes legacy support when a visible flow is reopened', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.get_s4_capabilities() in the schema cache' }, status: 404 });
  await mount(); expect(value.mode).toBe('legacy'); props.visible = false; await act(async () => renderer.update(React.createElement(Harness)));
  rpc.mockImplementation(async name => ({ data: name === 'get_s4_capabilities' ? s4Capabilities : state, error: null }));
  props.visible = true; await act(async () => renderer.update(React.createElement(Harness))); expect(value.mode).toBe('s4');
});
it('hides old data immediately on an account switch and discards delayed old reads', async () => {
  await mount(); let finish;
  rpc.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => { void value.reload(); });
  await act(async () => setConsentAccess('B', 'accepted'));
  await act(async () => finish({ data: s4State({ revision: '77' }), error: null }));
  expect(value.data?.revision).not.toBe('77');
});
it('hides state and stops reads until required consent is accepted again', async () => {
  await mount(); await act(async () => setConsentAccess('A', 'required')); expect(value.data).toBeNull();
  const paused = rpc.mock.calls.length; await act(async () => jest.advanceTimersByTimeAsync(20000)); expect(rpc.mock.calls.length).toBe(paused);
  await act(async () => setConsentAccess('A', 'accepted')); expect(value.data.room_id).toBe(s4RoomId);
});
it('does not advertise an in-flight probe for a closed flow or missing room', async () => {
  props.roomId = null; await mount(); expect(value.loading).toBe(false); expect(rpc).not.toHaveBeenCalled();
  props.roomId = s4RoomId; props.visible = false; await act(async () => renderer.update(React.createElement(Harness)));
  expect(value.loading).toBe(false); expect(rpc).not.toHaveBeenCalled();
});
it('fetches and adopts a fresh server time on foreground even if the monotonic clock stopped during sleep', async () => {
  await mount(); const reads = rpc.mock.calls.length;
  jest.setSystemTime(new Date('2026-10-20T09:00:00Z')); state = s4State({ server_time: '2026-10-20T09:00:03Z' });
  await act(async () => { for (const listener of stateListeners) listener('active'); });
  expect(rpc.mock.calls.length).toBeGreaterThan(reads); expect(value.data.server_time).toBe('2026-10-20T09:00:03Z');
  expect(require('../src/lib/meetingTime').adjustedServerNow(value.data).toISOString()).toBe('2026-10-20T09:00:03.000Z');
});
