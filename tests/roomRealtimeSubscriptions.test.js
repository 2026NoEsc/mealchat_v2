const React = require('react');
const { act, create } = require('react-test-renderer');
const { RealtimeClient, RealtimeChannel } = require('@supabase/realtime-js');
jest.mock('../src/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'A' } }) }));
jest.mock('../src/lifecycle/AppLifecycleContext', () => ({ useForegroundRefreshToken: () => 0 }));
jest.mock('../src/lib/supabase', () => ({ supabase: { channel: jest.fn(), removeChannel: jest.fn() } }));
jest.mock('../src/lib/rooms', () => ({ fetchRoom: jest.fn() }));
jest.mock('../src/lib/roomDecisions', () => ({ fetchRoomDecisionState: jest.fn(), invalidateS4Capabilities: jest.fn(), subscribeRoomDecisions: jest.fn(() => () => {}) }));
const { supabase } = require('../src/lib/supabase');
const { fetchRoom } = require('../src/lib/rooms');
const { fetchRoomDecisionState } = require('../src/lib/roomDecisions');
const { setConsentAccess } = require('../src/consents/access');
const { useRoom } = require('../src/rooms/useMyRooms');
const { useRoomDecision } = require('../src/lib/useRoomDecision');
const { s4RoomId, s4State } = require('./fixtures/s4');
let renderer, client, subscribe, unsubscribe, connect;
const values = {};
function Consumer({ id, kind, enabled = true }) {
  const useSelectedHook = kind === 'room' ? useRoom : useRoomDecision;
  values[id] = useSelectedHook(enabled ? s4RoomId : null, enabled);
  return null;
}
function emit(channel, table) {
  // Real SDK bindings and same-topic registry; no socket or server is contacted.
  for (const binding of channel.bindings.postgres_changes ?? []) if (binding.filter.table === table) binding.callback({});
}
function close(channel) { channel.channelAdapter.getChannel().trigger('phx_close', {}); }
function respond(version) {
  fetchRoom.mockResolvedValue({ data: { id: s4RoomId, title: 'version ' + version }, error: null });
  fetchRoomDecisionState.mockResolvedValue({ mode: 's4', data: s4State({ revision: String(version) }), error: null });
}
function versionOf(id, kind) { return kind === 'room' ? values[id].room.title : values[id].data.revision; }
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); setConsentAccess('A', 'accepted');
  client = new RealtimeClient('ws://127.0.0.1:1/realtime/v1', { params: { apikey: 'synthetic-offline-test' } });
  connect = jest.spyOn(client, 'connect').mockImplementation(() => { throw Error('Network is forbidden in this test'); });
  jest.spyOn(client, 'disconnect').mockResolvedValue(undefined);
  // Only subscription transport is replaced. Real channel() reuse, on() guards,
  // filters, removeChannel() and teardown run from the installed realtime-js.
  subscribe = jest.spyOn(RealtimeChannel.prototype, 'subscribe').mockImplementation(function () { this.state = 'joined'; return this; });
  unsubscribe = jest.spyOn(RealtimeChannel.prototype, 'unsubscribe').mockImplementation(async function () { close(this); return 'ok'; });
  supabase.channel.mockImplementation(name => client.channel(name));
  supabase.removeChannel.mockImplementation(channel => client.removeChannel(channel));
  respond(1);
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount()); renderer = undefined;
  for (const channel of client.getChannels().slice()) await client.removeChannel(channel);
  expect(connect).not.toHaveBeenCalled();
  jest.restoreAllMocks(); jest.useRealTimers();
});
describe.each(['room', 's4'])('%s hook realtime ownership', kind => {
  it.each(['first', 'second'])('keeps the other same-room subscriber live when %s unmounts', async removed => {
    let mounted = ['first', 'second'];
    function Pair() { return mounted.map(id => React.createElement(Consumer, { key: id, id, kind })); }
    await act(async () => { renderer = create(React.createElement(Pair)); });
    const channels = client.getChannels().slice();
    expect(channels).toHaveLength(2); expect(subscribe).toHaveBeenCalledTimes(2);
    expect(new Set(channels.map(channel => channel.topic)).size).toBe(2);
    for (const channel of channels) {
      expect(channel.topic).toContain('realtime:' + kind + ':' + s4RoomId + ':');
      expect(channel.state).toBe('joined');
      expect(channel.bindings.postgres_changes.map(binding => binding.filter)).toEqual([
        { event: '*', schema: 'public', table: 'rooms', filter: 'id=eq.' + s4RoomId },
        { event: '*', schema: 'public', table: 'participants', filter: 'room_id=eq.' + s4RoomId },
      ]);
    }
    respond(2);
    await act(async () => { emit(channels[0], 'rooms'); emit(channels[1], 'participants'); });
    expect(versionOf('first', kind)).toBe(kind === 'room' ? 'version 2' : '2');
    expect(versionOf('second', kind)).toBe(kind === 'room' ? 'version 2' : '2');
    const removedChannel = channels[removed === 'first' ? 0 : 1], remainingChannel = channels[removed === 'first' ? 1 : 0];
    const remaining = removed === 'first' ? 'second' : 'first';
    mounted = [remaining]; await act(async () => renderer.update(React.createElement(Pair)));
    expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
    expect(supabase.removeChannel).toHaveBeenCalledWith(removedChannel);
    expect(client.getChannels()).toEqual([remainingChannel]); expect(remainingChannel.state).toBe('joined');
    expect(subscribe).toHaveBeenCalledTimes(2); expect(unsubscribe).toHaveBeenCalledTimes(1);
    respond(3); await act(async () => emit(remainingChannel, 'rooms'));
    expect(versionOf(remaining, kind)).toBe(kind === 'room' ? 'version 3' : '3');
    expect(versionOf(removed, kind)).toBe(kind === 'room' ? 'version 2' : '2');
    // No polling time has elapsed: the remaining instance refreshed via its own realtime callback.
    await act(async () => renderer.unmount()); renderer = undefined;
    expect(client.getChannels()).toHaveLength(0);
    expect(supabase.removeChannel).toHaveBeenCalledTimes(2);
  });
  it('can resubscribe while its previous channel is still awaiting unsubscribe', async () => {
    const props = { id: 'reopened', kind, enabled: true };
    await act(async () => { renderer = create(React.createElement(Consumer, props)); });
    const previous = client.getChannels()[0]; let finish;
    unsubscribe.mockImplementationOnce(function () { return new Promise(resolve => { finish = () => { close(this); resolve('ok'); }; }); });
    props.enabled = false; await act(async () => renderer.update(React.createElement(Consumer, props)));
    expect(client.getChannels()).toContain(previous);
    props.enabled = true; await act(async () => renderer.update(React.createElement(Consumer, props)));
    const current = client.getChannels().find(channel => channel !== previous);
    expect(current).toBeDefined(); expect(current.state).toBe('joined');
    expect(current.topic).not.toBe(previous.topic); expect(subscribe).toHaveBeenCalledTimes(2);
    await act(async () => finish()); expect(client.getChannels()).toEqual([current]);
    respond(4); await act(async () => emit(current, 'participants'));
    expect(versionOf('reopened', kind)).toBe(kind === 'room' ? 'version 4' : '4');
  });
});
