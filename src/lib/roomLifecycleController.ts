import { subscribeConsentAccess } from '../consents/access';
import { canStartSettlement } from './roomSettlementPolicy';
import {
  cancelRoomOwnerTransfer, closeRoom, fetchRoomLifecycle, leaveRoomMember, lifecycleError,
  requestRoomOwnerTransfer, respondRoomOwnerTransfer, rotateRoomInviteCode, roomLifecycleSession,
  subscribeRoomLifecycle, invalidateRoomLifecycle, type RoomLifecycleState, type S3Mutation,
} from './roomLifecycle';

export const confirmedLeaveMessage = '정산 요청 전에 나가면 이 밥약 정산에서 빠져요. 아직 나눌 비용이 있다면 메이트와 먼저 확인해 주세요. 이미 만들어진 정산 내역은 그대로 남아요.';
export const doneLeaveMessage = '나가면 이후 새 정산에 포함되지 않아요. 기존 정산 내역은 남아요.';
export const settlementRecipientNotice = '현재 방에 있는 메이트만 이번 정산에 포함돼요. 정산 요청 전에 나간 메이트는 빠지니, 인원과 금액을 확인해 주세요.';
export type SettlementRecipients = { roomId: string; revision: string; members: { profileId: string; name: string }[] };
/** Snapshot proposal is only for reconfirmation. The settlement core decides its
 * actual recipients under the room lock, then the caller reads the committed bill. */
export async function prepareRoomSettlement(roomId: string): Promise<{ data: SettlementRecipients | null; error: Error | null }> {
  const session = roomLifecycleSession(), lifecycle = await fetchRoomLifecycle(roomId);
  if (!lifecycle.data) return { data: null, error: lifecycle.error };
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static lazy Metro/Jest boundary; no native client at controller import
  const { fetchRoom } = require('./rooms') as typeof import('./rooms'); const room = await fetchRoom(roomId);
  if (session !== roomLifecycleSession()) return { data: null, error: lifecycleError('ACCOUNT_CHANGED') };
  if (!room.data) return { data: null, error: room.error ?? lifecycleError() };
  if (room.data.decisionRevision !== lifecycle.data.revision) return { data: null, error: lifecycleError('S4005') };
  if (!canStartSettlement(room.data.stage, Boolean(room.data.appointmentConfirmedAt))) return { data: null, error: lifecycleError('S4008') };
  return { data: { roomId, revision: lifecycle.data.revision, members: room.data.participants.flatMap(member => member.profileId ? [{ profileId: member.profileId, name: member.name }] : []) }, error: null };
}
export async function createRoomSettlementWithSnapshot(input: Parameters<typeof import('./settlements').createRoomSettlement>[0], confirmedRevision: string) {
  const session = roomLifecycleSession(), state = await fetchRoomLifecycle(input.roomId);
  if (!state.data) return { data: null, error: state.error };
  if (state.data.revision !== confirmedRevision) return { data: null, error: lifecycleError('S4005') };
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- same lazy boundary as the room adapter
  const { createRoomSettlement, fetchSettlementDetail } = require('./settlements') as typeof import('./settlements');
  if (session !== roomLifecycleSession()) return { data: null, error: lifecycleError('ACCOUNT_CHANGED') };
  const created = await createRoomSettlement(input);
  if (session !== roomLifecycleSession()) return { data: null, error: lifecycleError('ACCOUNT_CHANGED') };
  invalidateRoomLifecycle(input.roomId, created.error ? 'uncertain' : 'changed');
  if (created.error || !created.billId) return { data: null, error: created.error ?? lifecycleError() };
  const actual = await fetchSettlementDetail(created.billId);
  if (session !== roomLifecycleSession()) return { data: null, error: lifecycleError('ACCOUNT_CHANGED') };
  // Never substitute the proposed member list on a failed/missing bill read.
  if (!actual.data || actual.data.id !== created.billId || actual.data.splitCount < 1 || actual.data.splitCount !== actual.data.members.length) return { data: null, error: actual.error ?? lifecycleError() };
  return actual;
}
export type RoomLifecycleView = {
  state: RoomLifecycleState | null; pending: boolean; error: Error | null; departed: boolean;
  canLeave: boolean; canClose: boolean; canTransfer: boolean; reason: string | null;
  transferState: RoomLifecycleState['transfer'];
};
/** Permission flags come only from server projection; UI never derives them from stage. */
export function createRoomLifecycleController(roomId: string) {
  let state: RoomLifecycleState | null = null, pending = false, error: Error | null = null, departed = false;
  let generation = 0, disposed = false, session = roomLifecycleSession();
  const listeners = new Set<(view: RoomLifecycleView) => void>();
  function snapshot(): RoomLifecycleView {
    return { state, pending, error, departed, canLeave: Boolean(state?.can_leave) && !pending && !departed,
      canClose: Boolean(state?.can_close) && !pending && !departed, canTransfer: Boolean(state?.can_transfer) && !pending && !departed,
      reason: state?.reason ?? null, transferState: state?.transfer ?? null };
  }
  function emit() { if (!disposed) for (const listener of listeners) listener(snapshot()); }
  async function refresh() {
    const token = ++generation, owner = roomLifecycleSession(); pending = true; state = null; error = null; emit();
    const result = await fetchRoomLifecycle(roomId);
    if (disposed || token !== generation || owner !== roomLifecycleSession()) return;
    pending = false; state = result.data; error = result.error; emit();
  }
  async function action(run: (revision: string) => Promise<{ data: S3Mutation | null; error: Error | null }>, removesAccess = false) {
    if (disposed || pending || departed || !state) return;
    const revision = state.revision, token = ++generation, owner = roomLifecycleSession(); pending = true; error = null; emit();
    const result = await run(revision);
    if (disposed || owner !== roomLifecycleSession()) return;
    // A synchronous departure invalidation emitted by the RPC may already clear state.
    if (result.data && removesAccess) { if (!departed) { departed = true; state = null; pending = false; emit(); } return; }
    if (token !== generation && departed) return;
    pending = false; error = result.error;
    if (result.data) await refresh();
    else { state = null; emit(); } // stale revisions require an explicit reload/reconfirmation.
  }
  const unsubscribe = subscribeRoomLifecycle(event => {
    if (event.roomId !== roomId) return;
    if (event.reason === 'session_ended') { generation++; state = null; pending = false; departed = false; error = lifecycleError('ACCOUNT_CHANGED'); emit(); return; }
    if (event.reason === 'departed') { departed = true; generation++; state = null; pending = false; emit(); }
    else if (!pending) { generation++; state = null; emit(); }
  });
  const authUnsubscribe = subscribeConsentAccess(() => {
    if (session !== roomLifecycleSession()) { session = roomLifecycleSession(); generation++; state = null; pending = false; departed = false; error = lifecycleError('ACCOUNT_CHANGED'); emit(); }
  });
  return {
    getState: snapshot, refresh,
    subscribe(listener: (view: RoomLifecycleView) => void) { listeners.add(listener); listener(snapshot()); return () => { listeners.delete(listener); }; },
    leave: () => action(rev => leaveRoomMember(roomId, rev), true), close: () => action(rev => closeRoom(roomId, rev), true),
    requestTransfer: (target: string, leaveAfterAccept: boolean) => action(rev => requestRoomOwnerTransfer(roomId, target, leaveAfterAccept, rev)),
    respondTransfer: (id: string, accept: boolean) => action(rev => respondRoomOwnerTransfer(roomId, id, accept, rev)),
    cancelTransfer: (id: string) => action(rev => cancelRoomOwnerTransfer(roomId, id, rev)),
    rotateInvite: () => action(rev => rotateRoomInviteCode(roomId, rev)),
    dispose() { disposed = true; generation++; unsubscribe(); authUnsubscribe(); listeners.clear(); state = null; },
  };
}
