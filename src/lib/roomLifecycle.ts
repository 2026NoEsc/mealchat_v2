import { AppState } from 'react-native';
import { URL } from 'react-native-url-polyfill';
import { getConsentAccess, setConsentAccess, subscribeConsentAccess } from '../consents/access';
import { newConsentRequestId } from '../consents/contracts';
import { getRoomDecisionClient } from './roomDecisionClient';
import { validMeetingInstant } from './meetingTime';
import type { RoomStage } from './rooms';

export type S3Mode = 'unknown' | 'legacy' | 's3' | 'error';
export type S3Transport = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown; status?: number }>;
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
export type OwnerTransferState = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
export type OwnerTransfer = { id: string; from_owner_id: string | null; target_profile_id: string | null; leave_after_accept: boolean; status: OwnerTransferState; expires_at: string; terminal_reason: string | null };
export type RoomInviteCode = { code: string; generation: string; expires_at: string };
export type RoomLifecycleState = {
  contract_version: 1; room_id: string; stage: RoomStage; revision: string; server_time: string; expires_at: string;
  can_leave: boolean; can_close: boolean; can_transfer: boolean; reason: string | null;
  transfer: OwnerTransfer | null; invite: RoomInviteCode | null;
};
export type S3Mutation = { contract_version: 1; outcome: 'applied' | 'replayed' | 'expired'; applied_revision: string; transfer_id?: string };
export type InvitePreview = { contract_version: 1; outcome: 'preview'; preview_id: string; title: string; member_count: number; can_join: true; code_expires_at: string; preview_expires_at: string; server_time: string };
export type InviteRejection = { contract_version: 1; outcome: 'rejected'; reason: 'INVITE_UNAVAILABLE' | 'INVITE_RATE_LIMITED' | 'PREVIEW_STALE'; retry_at: string | null; server_time: string };
export type InviteJoin = S3Mutation & { room_id: string; server_time: string };
export type LifecycleInvalidation = { roomId: string; reason: 'changed' | 'departed' | 'uncertain' | 'session_ended' };

const live: S3Transport = (name, args) => getRoomDecisionClient().supabase.rpc(name, args);
const device: Storage = {
  async getItem(key) { return (await import('@react-native-async-storage/async-storage')).default.getItem(key); },
  async setItem(key, value) { await (await import('@react-native-async-storage/async-storage')).default.setItem(key, value); },
};
function identity(value: string) { try { const url = new URL(value); return url.origin + url.pathname.replace(/\/+$/, ''); } catch { return value; } }
let backend = identity(process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'unconfigured');
let transport = live, storage = device, epoch = 0, probeEpoch = 0, dataEpoch = 0, observing = false;
const confirmed = new Set<string>();
const probes = new Map<string, Promise<{ mode: 'legacy' | 's3' | 'error'; error: Error | null }>>();
const requests = new Map<string, { id: string; createdAt: number }>();
const listeners = new Set<(event: LifecycleInvalidation) => void>();
const resources = new Map<string, Set<{ invalidate(): void; unsubscribe(): void }>>();
export const roomLifecycleSession = () => `${backend}|${getConsentAccess().userId ?? ''}|${epoch}`;
export const roomLifecycleReadToken = () => `${roomLifecycleSession()}|${dataEpoch}`;
let lastUser = getConsentAccess().userId, lastState = getConsentAccess().state;
subscribeConsentAccess(() => {
  const access = getConsentAccess();
  if (access.userId !== lastUser || access.state !== lastState) {
    epoch++; requests.clear(); invalidateS3Capabilities();
    for (const roomId of resources.keys()) invalidateRoomLifecycle(roomId, 'session_ended');
  }
  lastUser = access.userId; lastState = access.state;
});
export function invalidateS3Capabilities() { probeEpoch++; probes.clear(); }
/** Test-only injection also isolates remembered support from other fixtures. */
export function configureRoomLifecycle(next?: { transport?: S3Transport; storage?: Storage; backend?: string }) {
  transport = next?.transport ?? live; storage = next?.storage ?? device;
  backend = identity(next?.backend ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'unconfigured');
  if (next?.storage) confirmed.clear();
  epoch++; requests.clear(); invalidateS3Capabilities();
}
export function subscribeRoomLifecycle(listener: (event: LifecycleInvalidation) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
/** B registers room caches, recommendation tickets and realtime teardown here. */
export function registerRoomLifecycleResources(roomId: string, handlers: { invalidate(): void; unsubscribe(): void }) {
  const set = resources.get(roomId) ?? new Set(); set.add(handlers); resources.set(roomId, set);
  return () => { set.delete(handlers); if (!set.size) resources.delete(roomId); };
}
export function invalidateRoomLifecycle(roomId: string, reason: LifecycleInvalidation['reason'] = 'changed') {
  dataEpoch++;
  for (const handlers of resources.get(roomId) ?? []) {
    try { handlers.invalidate(); } catch { /* One consumer cannot preserve another cache. */ }
    if (reason === 'departed' || reason === 'session_ended') try { handlers.unsubscribe(); } catch { /* Best effort disposal; server authorization remains authoritative. */ }
  }
  if (reason === 'departed' || reason === 'session_ended') resources.delete(roomId);
  for (const listener of listeners) try { listener({ roomId, reason }); } catch { /* Isolate unmounted views. */ }
}
export function roomLifecycleErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  const messages: Record<string, string> = {
    S3001: '아직 끝나지 않은 정산이 있어요. 정산을 먼저 확인해 주세요.', S3002: '방장을 넘긴 뒤 나가거나 방 없애기를 선택해 주세요.',
    S3003: '방장 넘기기 요청을 처리할 수 없어요. 다시 확인해 주세요.', S3004: '대기 중인 방장 넘기기 요청을 먼저 취소해 주세요.',
    S3005: '초대 코드를 잠시 후 다시 발급해 주세요.', S4003: '밥약 단계가 바뀌었어요. 다시 확인해 주세요.', S4005: '메이트나 밥약 상태가 바뀌었어요. 다시 확인해 주세요.',
    S1007: '이전 요청과 내용이 달라요. 상태를 다시 확인해 주세요.', S1001: '필수 약관에 다시 동의해 주세요.', S1006: '동의 상태를 확인하지 못했어요.',
    '42501': '로그인과 밥약 참여 상태를 확인해 주세요.', S3_UNAVAILABLE: '서버 준비 후 이용할 수 있어요.', ACCOUNT_CHANGED: '계정이 바뀌었어요. 다시 열어 주세요.',
    REQUEST_EXPIRED: '오래된 요청이에요. 현재 밥약 상태를 확인한 뒤 다시 시작해 주세요.',
    TIMEOUT: '처리 결과를 확인하지 못했어요. 현재 상태를 확인하거나 같은 요청으로 다시 시도해 주세요.',
    ROOM_HAS_UNFINISHED_SETTLEMENT: '아직 끝나지 않은 정산이 있어요. 정산을 먼저 확인해 주세요.',
    OWNER_TRANSFER_REQUIRED: '방장을 넘긴 뒤 나가거나 방 없애기를 선택해 주세요.', ROOM_STAGE_CONFLICT: '밥약 단계가 바뀌었어요. 다시 확인해 주세요.',
    TRANSFER_ALREADY_PENDING: '대기 중인 방장 넘기기 요청을 먼저 취소해 주세요.',
    INVITE_UNAVAILABLE: '초대 코드를 확인해 주세요.', INVITE_RATE_LIMITED: '초대 코드 확인이 잠겼어요. 표시된 시간 뒤 다시 시도해 주세요.',
    PREVIEW_STALE: '밥약 정보가 바뀌었어요. 초대 정보를 다시 확인해 주세요.', PREVIEW_REQUIRED: '초대 정보를 먼저 확인해 주세요.',
  };
  return code && Object.hasOwn(messages, code) ? messages[code] : '밥약 상태를 확인하지 못했어요. 다시 시도해 주세요.';
}
export const lifecycleError = (code = 'INVALID_RESPONSE') => Object.assign(new Error(roomLifecycleErrorMessage({ code })), { code });
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw lifecycleError();
  return value as Record<string, unknown>;
};
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const revision = (v: unknown): v is string => typeof v === 'string' && /^(0|[1-9]\d*)$/.test(v);
const utc = (v: unknown): v is string => validMeetingInstant(v) && /(Z|\+00:00)$/.test(v);
const nullableId = (v: unknown) => v === null || uuid(v);
export function parseS3Capabilities(value: unknown) {
  const v = object(value);
  if (v.contract_version !== 1 || ['member_leave', 'owner_transfer', 'invite_preview', 'invite_limits', 'bounded_expiry'].some(key => v[key] !== true) || v.invite_links !== false) throw lifecycleError();
}
export function parseRoomLifecycle(value: unknown, roomId: string): RoomLifecycleState {
  const v = object(value);
  if (v.contract_version !== 1 || v.room_id !== roomId || !uuid(v.room_id) || !revision(v.revision) || !utc(v.server_time) || !utc(v.expires_at)
    || !['scheduling', 'place', 'confirmed', 'settling', 'done'].includes(String(v.stage))
    || ['can_leave', 'can_close', 'can_transfer'].some(key => typeof v[key] !== 'boolean') || (v.reason !== null && typeof v.reason !== 'string')) throw lifecycleError();
  if (v.transfer !== null) {
    const t = object(v.transfer);
    if (!uuid(t.id) || !nullableId(t.from_owner_id) || !nullableId(t.target_profile_id) || typeof t.leave_after_accept !== 'boolean'
      || !['pending', 'accepted', 'declined', 'cancelled', 'expired'].includes(String(t.status)) || !utc(t.expires_at)
      || (t.terminal_reason !== null && !['owner_cancelled', 'ttl', 'target_left', 'owner_unavailable', 'settlement_started', 'room_closed'].includes(String(t.terminal_reason)))) throw lifecycleError();
  }
  if (v.invite !== null) {
    const i = object(v.invite);
    if (typeof i.code !== 'string' || !/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(i.code) || !revision(i.generation) || i.generation === '0' || !utc(i.expires_at)) throw lifecycleError();
  }
  return value as RoomLifecycleState;
}
export function parseS3Mutation(value: unknown): S3Mutation {
  const v = object(value);
  if (v.contract_version !== 1 || !['applied', 'replayed', 'expired'].includes(String(v.outcome)) || !revision(v.applied_revision) || (v.transfer_id !== undefined && !uuid(v.transfer_id))) throw lifecycleError();
  return value as S3Mutation;
}
export function parseInviteOutcome(value: unknown): InvitePreview | InviteRejection | InviteJoin {
  const v = object(value);
  if (v.contract_version !== 1 || !utc(v.server_time)) throw lifecycleError();
  if (v.outcome === 'rejected') {
    if (!['INVITE_UNAVAILABLE', 'INVITE_RATE_LIMITED', 'PREVIEW_STALE'].includes(String(v.reason)) || (v.retry_at !== null && !utc(v.retry_at)) || (v.reason === 'INVITE_RATE_LIMITED' && v.retry_at === null)) throw lifecycleError();
    return value as InviteRejection;
  }
  if (v.outcome === 'preview') {
    const allowed = ['contract_version', 'outcome', 'preview_id', 'title', 'member_count', 'can_join', 'code_expires_at', 'preview_expires_at', 'server_time'];
    if (Object.keys(v).some(key => !allowed.includes(key)) || !uuid(v.preview_id) || typeof v.title !== 'string' || [...v.title].length > 120
      || !Number.isSafeInteger(v.member_count) || Number(v.member_count) < 0 || v.can_join !== true || !utc(v.code_expires_at) || !utc(v.preview_expires_at)) throw lifecycleError();
    return value as InvitePreview;
  }
  parseS3Mutation(value); if (!uuid(v.room_id) || v.outcome === 'expired') throw lifecycleError();
  return value as InviteJoin;
}
export function isMissingS3Capabilities(error: unknown) {
  const e = error as { code?: unknown; message?: unknown; status?: unknown } | null;
  return Boolean(e && typeof e.message === 'string' && (
    (e.code === 'PGRST202' && (e.status === undefined || e.status === 404) && /^Could not find the function public\.get_s3_capabilities(?:\(\)| without parameters) in the schema cache\.?$/i.test(e.message))
    || (e.code === '42883' && (e.status === undefined || e.status === 400 || e.status === 404) && /^function public\.get_s3_capabilities\(\) does not exist\.?$/i.test(e.message))));
}
async function call(name: string, args: Record<string, unknown>) {
  const session = roomLifecycleSession(); let timer: ReturnType<typeof setTimeout> | undefined;
  if (!getConsentAccess().userId || getConsentAccess().state !== 'accepted') throw lifecycleError('S1001');
  try {
    const result = await Promise.race([Promise.resolve(transport(name, args)), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(lifecycleError('TIMEOUT')), 12000); })]);
    if (roomLifecycleSession() !== session) throw lifecycleError('ACCOUNT_CHANGED');
    if (result.error) {
      const error = object(result.error), code = typeof error.code === 'string' ? error.code : 'NETWORK';
      if (code === 'S1001' || code === 'S1006') setConsentAccess(getConsentAccess().userId, code === 'S1001' ? 'required' : 'error');
      return { data: null, error: { code, message: error.message, status: result.status ?? error.status } };
    }
    return { data: result.data, error: null };
  } finally { clearTimeout(timer); }
}
export async function fetchS3Capabilities(refresh = false): Promise<{ mode: 'legacy' | 's3' | 'error'; error: Error | null }> {
  if (!observing) { observing = true; AppState.addEventListener('change', state => { if (state === 'active') invalidateS3Capabilities(); }); }
  if (refresh) invalidateS3Capabilities();
  const key = roomLifecycleSession(), generation = probeEpoch, ownerBackend = backend;
  const existing = probes.get(key); if (existing) return existing;
  const pending = (async () => {
    try {
      const remembered = await storage.getItem(`mealchat.s3.confirmed.v1:${encodeURIComponent(ownerBackend)}`);
      if (remembered !== null && remembered !== '1') throw lifecycleError();
      if (remembered === '1') confirmed.add(ownerBackend);
      if (key !== roomLifecycleSession()) throw lifecycleError('ACCOUNT_CHANGED');
      if (generation !== probeEpoch) return fetchS3Capabilities();
      const result = await call('get_s3_capabilities', {});
      if (key !== roomLifecycleSession()) throw lifecycleError('ACCOUNT_CHANGED');
      if (generation !== probeEpoch) return fetchS3Capabilities();
      if (result.error) {
        if (!confirmed.has(ownerBackend) && isMissingS3Capabilities(result.error)) return { mode: 'legacy' as const, error: null };
        throw lifecycleError(result.error.code);
      }
      parseS3Capabilities(result.data); confirmed.add(ownerBackend);
      await storage.setItem(`mealchat.s3.confirmed.v1:${encodeURIComponent(ownerBackend)}`, '1');
      if (key !== roomLifecycleSession()) throw lifecycleError('ACCOUNT_CHANGED');
      if (generation !== probeEpoch) return fetchS3Capabilities();
      return { mode: 's3' as const, error: null };
    } catch (error) { return { mode: 'error' as const, error: lifecycleError((error as { code?: string })?.code) }; }
  })();
  probes.set(key, pending); const result = await pending;
  if (result.mode === 'error' && probes.get(key) === pending) probes.delete(key);
  return result;
}
/** No writer-specific missing signature ever permits legacy fallback. */
export async function requestRoomLifecycle<T>(name: string, args: Record<string, unknown>, parse: (value: unknown) => T): Promise<{ data: T | null; error: Error | null }> {
  const session = roomLifecycleSession();
  try {
    const support = await fetchS3Capabilities();
    if (session !== roomLifecycleSession()) throw lifecycleError('ACCOUNT_CHANGED');
    if (support.mode !== 's3') throw support.error ?? lifecycleError('S3_UNAVAILABLE');
    const result = await call(name, args); if (result.error) throw lifecycleError(result.error.code);
    return { data: parse(result.data), error: null };
  } catch (error) { return { data: null, error: lifecycleError((error as { code?: string })?.code) }; }
}
export const fetchRoomLifecycle = (roomId: string) => requestRoomLifecycle('get_room_lifecycle_v1', { p_room_id: roomId }, value => parseRoomLifecycle(value, roomId));
export async function createLifecycleRoom(title: string, color: string) {
  const args = { p_title: title, p_color: color };
  const key = `${roomLifecycleSession()}|create_room_v1|${JSON.stringify(args)}`;
  const result = await requestRoomLifecycle('create_room_v1', { ...args, p_request_id: roomLifecycleRequestId('create_room_v1', args) }, value => {
    parseS3Mutation(value); const v = object(value);
    if (!uuid(v.room_id) || typeof v.code !== 'string' || !/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(v.code) || !utc(v.expires_at)) throw lifecycleError();
    return { roomId: v.room_id, code: v.code, expiresAt: v.expires_at };
  });
  // Once success was delivered, a later explicit creation is a new intent.
  // Concurrent calls already captured the old ID; uncertain failures retain it.
  if (result.data) { requests.delete(key); invalidateRoomLifecycle(result.data.roomId); }
  return result;
}
/** Timeouts retain identical input/ID. Expired IDs are never silently recreated. */
export function roomLifecycleRequestId(name: string, args: Record<string, unknown>) {
  const key = `${roomLifecycleSession()}|${name}|${JSON.stringify(args)}`, saved = requests.get(key);
  if (saved && Date.now() - saved.createdAt >= 86400000) throw lifecycleError('REQUEST_EXPIRED');
  if (saved) return saved.id;
  const id = newConsentRequestId(); requests.set(key, { id, createdAt: Date.now() }); return id;
}
export async function mutateRoomLifecycle(name: string, roomId: string, expectedRevision: string, args: Record<string, unknown> = {}) {
  if (!revision(expectedRevision)) return { data: null, error: lifecycleError('22023') };
  const input = { p_room_id: roomId, ...args, p_expected_revision: expectedRevision };
  // transfer response/cancel have no p_room_id in their public signatures.
  if (name === 'respond_room_owner_transfer_v1' || name === 'cancel_room_owner_transfer_v1') delete (input as Record<string, unknown>).p_room_id;
  try {
    const result = await requestRoomLifecycle(name, { ...input, p_request_id: roomLifecycleRequestId(name, input) }, parseS3Mutation);
    if (result.data) invalidateRoomLifecycle(roomId, name === 'leave_room_member_v1' || name === 'close_room_v1' ? 'departed' : 'changed');
    else if (['TIMEOUT', '42501', 'P0002'].includes((result.error as { code?: string })?.code ?? '')) invalidateRoomLifecycle(roomId, 'uncertain');
    return result;
  } catch (error) { return { data: null, error: lifecycleError((error as { code?: string })?.code) }; }
}
export const leaveRoomMember = (id: string, revision: string) => mutateRoomLifecycle('leave_room_member_v1', id, revision);
export const closeRoom = (id: string, revision: string) => mutateRoomLifecycle('close_room_v1', id, revision);
export const requestRoomOwnerTransfer = (id: string, target: string, leave: boolean, revision: string) => mutateRoomLifecycle('request_room_owner_transfer_v1', id, revision, { p_target_profile_id: target, p_leave_after_accept: leave });
export const respondRoomOwnerTransfer = (id: string, transferId: string, accept: boolean, revision: string) => mutateRoomLifecycle('respond_room_owner_transfer_v1', id, revision, { p_transfer_id: transferId, p_accept: accept });
export const cancelRoomOwnerTransfer = (id: string, transferId: string, revision: string) => mutateRoomLifecycle('cancel_room_owner_transfer_v1', id, revision, { p_transfer_id: transferId });
export const rotateRoomInviteCode = (id: string, revision: string) => mutateRoomLifecycle('rotate_room_invite_code_v1', id, revision);
