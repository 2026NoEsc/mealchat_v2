import { subscribeConsentAccess } from '../consents/access';
import { AppState } from 'react-native';
import {
  lifecycleError, parseInviteOutcome, requestRoomLifecycle, roomLifecycleRequestId, roomLifecycleSession,
  invalidateRoomLifecycle,
  type InvitePreview, type InviteRejection, type InviteJoin,
} from './roomLifecycle';

export type RoomInviteView = {
  code: string; pending: boolean; preview: InvitePreview | null; roomId: string | null;
  inviteRetryAt: string | null; retrySeconds: number; error: Error | null;
};
/** Counter authority stays on the server. This controller only displays its retry_at. */
export function createRoomInviteController(clock: () => number = () => performance.now()) {
  let view: RoomInviteView = { code: '', pending: false, preview: null, roomId: null, inviteRetryAt: null, retrySeconds: 0, error: null };
  let generation = 0, disposed = false, session = roomLifecycleSession(), serverAt = 0, receivedAt = 0;
  let sleep = 0, paused: { wall: number; monotonic: number } | null = null;
  const listeners = new Set<(state: RoomInviteView) => void>();
  function remaining() { return view.inviteRetryAt ? Math.max(0, Math.ceil((Date.parse(view.inviteRetryAt) - serverAt - (clock() - receivedAt) - sleep) / 1000)) : 0; }
  function snapshot(): RoomInviteView { return { ...view, preview: view.preview ? { ...view.preview } : null, retrySeconds: remaining() }; }
  function emit() { if (!disposed) for (const listener of listeners) listener(snapshot()); }
  function active(token: number, owner: string) { return !disposed && generation === token && owner === roomLifecycleSession(); }
  function rejected(value: InviteRejection) {
    serverAt = Date.parse(value.server_time); receivedAt = clock(); sleep = 0; paused = null;
    view = { ...view, preview: null, pending: false, inviteRetryAt: value.retry_at ?? view.inviteRetryAt, error: lifecycleError(value.reason) };
  }
  const unlisten = subscribeConsentAccess(() => {
    if (session !== roomLifecycleSession()) {
      session = roomLifecycleSession(); generation++;
      view = { code: '', pending: false, preview: null, roomId: null, inviteRetryAt: null, retrySeconds: 0, error: null }; emit();
    }
  });
  const appState = AppState.addEventListener('change', state => {
    if (state !== 'active') paused ??= { wall: Date.now(), monotonic: clock() };
    else if (paused) {
      // Compensate only an observed suspension; active-screen wall-clock edits
      // never change the server retry deadline.
      sleep += Math.max(0, Date.now() - paused.wall - Math.max(0, clock() - paused.monotonic)); paused = null; emit();
    }
  });
  return {
    getState: snapshot,
    subscribe(listener: (state: RoomInviteView) => void) { listeners.add(listener); listener(snapshot()); return () => { listeners.delete(listener); }; },
    setCode(value: string) {
      generation++;
      // No late response to an older input may restore its preview or lock state.
      view = { ...view, code: value.length <= 64 ? value.trim().toUpperCase() : '', preview: null, roomId: null, pending: false, error: null }; emit();
    },
    tick() { emit(); return remaining(); },
    async preview() {
      if (disposed || view.pending || remaining() > 0) return;
      if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(view.code)) { view = { ...view, error: lifecycleError('INVALID_CODE') }; emit(); return; }
      const token = ++generation, owner = roomLifecycleSession(); view = { ...view, pending: true, preview: null, error: null }; emit();
      const result = await requestRoomLifecycle('preview_room_invite_v1', { p_code: view.code }, parseInviteOutcome);
      if (!active(token, owner)) return;
      if (result.data?.outcome === 'rejected') rejected(result.data);
      else if (result.data?.outcome === 'preview') view = { ...view, pending: false, preview: result.data, inviteRetryAt: null, error: null };
      else view = { ...view, pending: false, error: result.error ?? lifecycleError() };
      emit();
    },
    async join() {
      if (disposed || view.pending || !view.preview || remaining() > 0) return;
      const token = ++generation, owner = roomLifecycleSession(), preview = view.preview;
      view = { ...view, pending: true, error: null }; emit();
      try {
        const args = { p_preview_id: preview.preview_id };
        const result = await requestRoomLifecycle('join_room_invite_v1', { ...args, p_request_id: roomLifecycleRequestId('join_room_invite_v1', args) }, parseInviteOutcome);
        if (!active(token, owner)) return;
        if (result.data?.outcome === 'rejected') rejected(result.data);
        else if (result.data && ['applied', 'replayed'].includes(result.data.outcome)) {
          const roomId = (result.data as InviteJoin).room_id;
          view = { ...view, pending: false, preview: null, roomId }; invalidateRoomLifecycle(roomId);
        }
        else view = { ...view, pending: false, error: result.error ?? lifecycleError() };
      } catch (error) { if (active(token, owner)) view = { ...view, pending: false, error: error as Error }; }
      emit();
    },
    dispose() { disposed = true; generation++; unlisten(); appState.remove(); listeners.clear(); view = { ...view, code: '', preview: null, roomId: null }; },
  };
}
