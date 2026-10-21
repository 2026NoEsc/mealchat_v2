import { setConsentAccess } from '../src/consents/access';
import { configureRoomLifecycle } from '../src/lib/roomLifecycle';
import { createRoomInviteController } from '../src/lib/roomInviteController';
const id = '33000000-0000-4000-8000-000000000001';
const preview = { contract_version: 1, outcome: 'preview', preview_id: id, title: 'Synthetic', member_count: 2, can_join: true, server_time: '2026-10-21T00:00:00Z', preview_expires_at: '2026-10-21T00:02:00Z', code_expires_at: '2026-10-22T00:00:00Z' };
let rpc: jest.Mock;
beforeEach(() => {
  setConsentAccess('A', 'accepted'); rpc = jest.fn(async name => ({ data: name === 'get_s3_capabilities' ? { contract_version: 1, member_leave: true, owner_transfer: true, invite_preview: true, invite_limits: true, bounded_expiry: true, invite_links: false } : preview, error: null }));
  configureRoomLifecycle({ transport: rpc, backend: 's3-invite-test', storage: { getItem: async () => null, setItem: async () => {} } });
});
it.each(['', 'ABCDE', 'ABC0EF', 'AB CD2', 'ＡBCDE2'])('does not submit invalid code %s', async code => {
  const c = createRoomInviteController(); c.setCode(code); await c.preview(); expect(rpc).not.toHaveBeenCalled(); expect(c.getState().error).toBeTruthy(); c.dispose();
});
it('normalizes pasted lowercase code and joins only after explicit action', async () => {
  const c = createRoomInviteController(); c.setCode(' abcde2 '); await c.preview(); expect(c.getState().preview?.title).toBe('Synthetic'); expect(c.getState().roomId).toBeNull();
  rpc.mockResolvedValueOnce({ data: { contract_version: 1, outcome: 'applied', applied_revision: '5', room_id: id, server_time: preview.server_time }, error: null });
  await c.join(); expect(c.getState().roomId).toBe(id); expect(rpc.mock.calls[1]).toEqual(['preview_room_invite_v1', { p_code: 'ABCDE2' }]); c.dispose();
});
it('uses the server clock and retry_at without a local failure counter', async () => {
  let time = 100; const c = createRoomInviteController(() => time); c.setCode('ABCDE2');
  await c.preview(); rpc.mockResolvedValueOnce({ data: { contract_version: 1, outcome: 'rejected', reason: 'INVITE_RATE_LIMITED', retry_at: '2026-10-21T00:15:00Z', server_time: preview.server_time }, error: null });
  await c.preview(); expect(c.getState().retrySeconds).toBe(900); const calls = rpc.mock.calls.length;
  c.setCode('FGHJK2'); await c.preview(); expect(rpc).toHaveBeenCalledTimes(calls); time += 60000; expect(c.tick()).toBe(840); c.dispose();
});
it('drops late preview results after input changes', async () => {
  const c = createRoomInviteController(); c.setCode('ABCDE2'); await c.preview(); let resolve!: (v: unknown) => void;
  rpc.mockImplementationOnce(() => new Promise(done => { resolve = done; })); const pending = c.preview();
  for (let i = 0; i < 10 && !resolve; i++) await Promise.resolve(); c.setCode('FGHJK2'); resolve({ data: preview, error: null }); await pending;
  expect(c.getState()).toMatchObject({ code: 'FGHJK2', preview: null, pending: false }); c.dispose();
});
it('clears code and preview on logout', async () => {
  const c = createRoomInviteController(); c.setCode('ABCDE2'); await c.preview(); setConsentAccess(null, 'loading');
  expect(c.getState()).toMatchObject({ code: '', preview: null, roomId: null }); c.dispose();
});
it('retains the same join ID after an uncertain transport failure', async () => {
  const c = createRoomInviteController(); c.setCode('ABCDE2'); await c.preview(); rpc.mockResolvedValue({ data: null, error: { code: 'NETWORK' } });
  await c.join(); await c.join(); const joins = rpc.mock.calls.filter(call => call[0] === 'join_room_invite_v1');
  expect(joins).toHaveLength(2); expect(joins[0][1]).toEqual(joins[1][1]); expect(c.getState().roomId).toBeNull(); c.dispose();
});
