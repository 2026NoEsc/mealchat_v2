import { getConsentAccess, setConsentAccess, subscribeConsentAccess } from '../consents/access';
import { newConsentRequestId } from '../consents/contracts';
import { fetchConsentManifest, getConsentServerMode } from './consents';
import { normalizeMeetingTime, recordServerTime, validKstSlot, validMeetingInstant, type MeetingTime } from './meetingTime';
import type { RoomStage } from './rooms';
import { AppState } from 'react-native';
import { URL } from 'react-native-url-polyfill';
import { getRoomDecisionClient } from './roomDecisionClient';
import { s4008Message } from './roomSettlementPolicy';
import { isRoomMembershipClosed, membershipClosedMessage } from './roomMembership';

export type S4Mode = 'unknown' | 'legacy' | 's4' | 'error';
export type RoomDecisionState = {
  contract_version: 1; room_id: string; revision: string; stage: RoomStage; server_time: string;
  meeting_time: MeetingTime | null; time_status: 'selected' | 'unset' | 'legacy_unverified'; legacy_time_label: string | null;
  restaurant: { item_id: string | null; label: string } | null;
  confirmation_status: 'none' | 'legacy_partial' | 'legacy_confirmed' | 'legacy_settlement_unverified' | 'owner_confirmed';
  availability: { eligible_count: number; submitted_count: number; all_submitted: boolean;
    members: { participant_id: string; name: string; avatar_color: string; eligible: boolean; submitted: boolean }[]; my_slots: string[]; others_slots: string[] };
  voting: { eligible_count: number; leading_item_id: string | null; leading_votes: number; required_votes: number };
  permissions: { can_submit: boolean; can_select_time: boolean; can_confirm: boolean };
};
export type S4Mutation = { contract_version: 1; outcome: 'applied' | 'replayed'; applied_revision: string; state: RoomDecisionState };
export type S4Transport = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown; status?: number }>;
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
const live: S4Transport = async (name, args) => getRoomDecisionClient().supabase.rpc(name, args);
const device: Storage = { async getItem(key) { return (await import('@react-native-async-storage/async-storage')).default.getItem(key); }, async setItem(key, value) { await (await import('@react-native-async-storage/async-storage')).default.setItem(key, value); } };
let transport = live, storage = device;
function backendIdentity(value: string) {
  try { const url = new URL(value); return url.origin + url.pathname.replace(/\/+$/, ''); } catch { return value; }
}
let backend = backendIdentity(process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'unconfigured');
let generation = 0;
let observingForeground = false;
const confirmedBackends = new Set<string>();
const probes = new Map<string, Promise<{ mode: 'legacy' | 's4' | 'error'; error: Error | null }>>();
const requests = new Map<string, string>();
const listeners = new Set<(roomId: string) => void>();
const account = () => `${backend}|${getConsentAccess().userId ?? 'anonymous'}`;
let lastAccount = account();
let lastAccess = getConsentAccess().state;
subscribeConsentAccess(() => {
  const key = account(), state = getConsentAccess().state;
  if (key !== lastAccount || (state === 'accepted' && lastAccess !== 'accepted')) invalidateS4Capabilities();
  if (key !== lastAccount || state !== 'accepted') requests.clear();
  lastAccount = key; lastAccess = state;
});
export function subscribeRoomDecisions(listener: (roomId: string) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function invalidateS4Capabilities() { generation++; probes.clear(); }
/** Test fixtures use isolated transports/storage, never a fake production backend. */
export function configureRoomDecisions(next?: { transport?: S4Transport; storage?: Storage; backend?: string }) {
  transport = next?.transport ?? live; storage = next?.storage ?? device; backend = backendIdentity(next?.backend ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'unconfigured');
  if (next?.storage) { confirmedBackends.clear(); previewBackends.clear(); }
  requests.clear(); invalidateS4Capabilities(); lastAccount = account(); lastAccess = getConsentAccess().state;
}
export function roomDecisionErrorMessage(error: unknown): string {
  if (isRoomMembershipClosed(error)) return membershipClosedMessage;
  const code = (error as { code?: string } | null)?.code;
  if (code === 'S4008') return s4008Message(error, 'vote_confirmation');
  const messages: Record<string, string> = {
    S4001: '후보는 30개까지 추가할 수 있어요. 기존 후보를 지운 뒤 다시 추가해 주세요.', S4002: '후보 이름은 1~120자로 입력해 주세요. 보이지 않는 서식 문자나 제어문자를 빼고 다시 입력해 주세요.',
    S4003: '밥약 단계가 바뀌었어요. 다시 불러와 주세요.', S4004: '실제 메이트 모두 가능한 시간을 제출해야 진행할 수 있어요.',
    S4005: '일정이나 투표가 바뀌었어요. 다시 불러온 뒤 선택해 주세요.', S4006: '선택한 시간에 계속 참석할 수 있는 메이트가 없거나 유효한 시간이 아니에요. 다시 골라 주세요.',
    S4007: '약속을 확정하기 전에 시간을 선택해 주세요.',
    S4009: '이미 확정된 약속은 바꿀 수 없어요.', S4010: '이전 시간이나 식당을 확인할 수 없어요. 시간을 다시 고르고 식당 후보도 확인해 주세요.', S1007: '요청 내용이 달라졌어요. 다시 불러온 뒤 선택해 주세요.',
    S4011: '처리할 수 있는 요청 수를 넘었어요. 새 요청을 반복하지 말고 밥약 상태를 확인해 주세요.',
    S1001: '필수 약관에 다시 동의해 주세요.', S1006: '동의 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
    '42501': '로그인과 밥약 참여 상태를 확인해 주세요.', '22023': '입력 내용을 확인하고 다시 시도해 주세요.', '22P02': '입력 내용을 확인하고 다시 시도해 주세요.',
    S4_UNAVAILABLE: '시간 저장과 약속 확정 기능은 곧 이용할 수 있어요.', ACCOUNT_CHANGED: '계정이 바뀌었어요. 다시 열어 주세요.',
  };
  return code && Object.hasOwn(messages, code) ? messages[code] : '밥약 상태를 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.';
}
const failure = (code = 'INVALID_RESPONSE', hint?: unknown) => {
  const safeHint = code === 'S4008' && (hint === 'operation=settlement' || hint === 'operation=vote_confirmation') ? hint : undefined;
  return Object.assign(new Error(roomDecisionErrorMessage({ code, hint: safeHint })), { code, ...(safeHint ? { hint: safeHint } : {}) });
};
const record = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw failure(); return v as Record<string, unknown>; };
const revision = (v: unknown): v is string => typeof v === 'string' && /^(0|[1-9]\d*)$/.test(v);
const text = (v: unknown): v is string => typeof v === 'string';
const nullableText = (v: unknown) => v === null || text(v);
const count = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const utc = (v: unknown) => validMeetingInstant(v) && /(Z|\+00:00)$/.test(v);
const slotList = (v: unknown) => Array.isArray(v) && v.length <= 500 && v.every(key => typeof key === 'string' && validKstSlot(key)) && new Set(v).size === v.length;
export function parseS4Capabilities(value: unknown) {
  const v = record(value);
  if (v.contract_version !== 1 || v.atomic_confirmation !== true || v.structured_meeting_time !== true || v.owner_confirmation !== true
    || v.availability_stage_guard !== true || v.requires_time_for_confirmation !== true || !Array.isArray(v.time_zones)
    || v.time_zones.length !== 1 || v.time_zones[0] !== 'Asia/Seoul') throw failure();
}
export function parseRoomDecisionState(value: unknown, expectedRoom?: string): RoomDecisionState {
  const v = record(value), a = record(v.availability), vote = record(v.voting), p = record(v.permissions);
  if (v.contract_version !== 1 || !text(v.room_id) || !v.room_id || (expectedRoom && v.room_id !== expectedRoom) || !revision(v.revision)
    || !['scheduling', 'place', 'confirmed', 'settling', 'done'].includes(String(v.stage)) || !utc(v.server_time)
    || !['selected', 'unset', 'legacy_unverified'].includes(String(v.time_status)) || !nullableText(v.legacy_time_label)
    || !['none', 'legacy_partial', 'legacy_confirmed', 'legacy_settlement_unverified', 'owner_confirmed'].includes(String(v.confirmation_status))) throw failure();
  const meeting = v.meeting_time === null ? null : normalizeMeetingTime(v.meeting_time);
  if ((v.time_status === 'selected') !== Boolean(meeting) || (v.time_status === 'legacy_unverified' && !v.legacy_time_label)) throw failure();
  if (v.restaurant !== null) { const r = record(v.restaurant); if (!nullableText(r.item_id) || !text(r.label) || !r.label.trim()) throw failure(); }
  if (!count(a.eligible_count) || !count(a.submitted_count) || a.submitted_count > a.eligible_count || !Array.isArray(a.members)
    || a.all_submitted !== (a.eligible_count > 0 && a.submitted_count === a.eligible_count) || !slotList(a.my_slots) || !slotList(a.others_slots)) throw failure();
  for (const member of a.members) { const m = record(member); if (!text(m.participant_id) || !m.participant_id || !text(m.name) || !text(m.avatar_color) || typeof m.eligible !== 'boolean' || typeof m.submitted !== 'boolean' || (!m.eligible && m.submitted)) throw failure(); }
  if (new Set(a.members.map(m => m.participant_id)).size !== a.members.length || a.members.filter(m => m.eligible).length !== a.eligible_count
    || a.members.filter(m => m.eligible && m.submitted).length !== a.submitted_count) throw failure();
  if (!count(vote.eligible_count) || vote.eligible_count !== a.eligible_count || !nullableText(vote.leading_item_id) || !count(vote.leading_votes)
    || vote.leading_votes > vote.eligible_count || vote.required_votes !== Math.floor(vote.eligible_count / 2) + 1
    || ['can_submit', 'can_select_time', 'can_confirm'].some(key => typeof p[key] !== 'boolean')) throw failure();
  return recordServerTime({ ...(value as RoomDecisionState), meeting_time: meeting });
}
async function call(name: string, args: Record<string, unknown>) {
  const owner = account();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([Promise.resolve(transport(name, args)), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(failure('TIMEOUT')), 12000); })]);
    if (account() !== owner) throw failure('ACCOUNT_CHANGED');
    if (result.error) {
      const e = record(result.error), status = result.status ?? e.status;
      const code = text(e.code) ? e.code : status === 401 || status === 403 ? '42501' : 'NETWORK';
      if (code === 'S1001' || code === 'S1006') setConsentAccess(getConsentAccess().userId, code === 'S1001' ? 'required' : 'error');
      return { data: null, error: { code, message: e.message, hint: e.hint, status: result.status ?? e.status } };
    }
    if (name !== 'get_s4_capabilities' && getConsentAccess().state !== 'accepted') throw failure('S1001');
    return { data: result.data, error: null };
  } finally { clearTimeout(timer); }
}
/** Only the absent public probe itself is evidence of an old server. Never a bare HTTP 404/helper failure. */
export function isMissingS4Capabilities(error: unknown) {
  const e = error as { code?: string; message?: unknown; status?: unknown } | null;
  if (!e || typeof e.message !== 'string') return false;
  return (e.code === 'PGRST202' && (e.status === undefined || e.status === 404) && /^Could not find the function public\.get_s4_capabilities(?:\(\)| without parameters) in the schema cache\.?$/i.test(e.message))
    || (e.code === '42883' && (e.status === undefined || e.status === 400 || e.status === 404) && /^function public\.get_s4_capabilities\(\) does not exist\.?$/i.test(e.message));
}
export async function fetchS4Capabilities(refresh = false): Promise<{ mode: 'legacy' | 's4' | 'error'; error: Error | null }> {
  if (!observingForeground) {
    observingForeground = true;
    AppState.addEventListener('change', state => { if (state === 'active') invalidateS4Capabilities(); });
  }
  const key = account();
  if (refresh) invalidateS4Capabilities();
  const cached = probes.get(key); if (cached) return cached;
  const ownerBackend = backend, epoch = generation;
  const pending = (async () => {
    try {
      const remembered = await storage.getItem(`mealchat.s4.confirmed.v1:${encodeURIComponent(ownerBackend)}`);
      if (remembered !== null && remembered !== '1') throw failure();
      if (remembered === '1') confirmedBackends.add(ownerBackend);
      if (getConsentServerMode() === 'unknown') { const result = await fetchConsentManifest(); if (result.error) throw result.error; }
      if (account() !== key) throw failure('ACCOUNT_CHANGED');
      if (generation !== epoch) return fetchS4Capabilities();
      if (getConsentServerMode() === 'legacy' && !confirmedBackends.has(ownerBackend)) return { mode: 'legacy' as const, error: null };
      const result = await call('get_s4_capabilities', {});
      if (result.error) {
        if (!confirmedBackends.has(ownerBackend) && isMissingS4Capabilities(result.error)) return { mode: 'legacy' as const, error: null };
        throw failure(result.error.code);
      }
      parseS4Capabilities(result.data);
      confirmedBackends.add(ownerBackend);
      await storage.setItem(`mealchat.s4.confirmed.v1:${encodeURIComponent(ownerBackend)}`, '1');
      if (account() !== key) throw failure('ACCOUNT_CHANGED');
      if (generation !== epoch) return fetchS4Capabilities();
      return { mode: 's4' as const, error: null };
    } catch (error) {
      if (account() !== key) return { mode: 'error' as const, error: failure('ACCOUNT_CHANGED') };
      if (generation !== epoch) return fetchS4Capabilities();
      return { mode: 'error' as const, error: failure((error as { code?: string })?.code) };
    }
  })();
  probes.set(key, pending);
  const result = await pending;
  if (result.mode === 'error' && probes.get(key) === pending) probes.delete(key);
  return result;
}
export async function fetchRoomDecisionState(roomId: string) {
  try {
    const support = await fetchS4Capabilities();
    if (support.mode !== 's4') return { data: null, error: support.error ?? failure('S4_UNAVAILABLE'), mode: support.mode };
    const result = await call('get_room_s4_state', { p_room_id: roomId });
    if (result.error) throw failure(result.error.code);
    return { data: parseRoomDecisionState(result.data, roomId), error: null, mode: 's4' as const };
  } catch (error) { return { data: null, error: failure((error as { code?: string })?.code), mode: 'error' as const }; }
}
export type MeetingTimePreview = { eligible_count: number; available_count: number; all_available: boolean; revision: string };
const previewBackends = new Set<string>();
/** Only this optional RPC's exact missing signature permits omission on older S4 servers. */
function missingMeetingPreview(error: { code: string; message?: unknown; status?: unknown }) {
  if (typeof error.message !== 'string') return false;
  return (error.code === 'PGRST202' && (error.status === undefined || error.status === 404)
    && /^Could not find the function public\.preview_room_meeting_time_v1\((?:p_ends_at, p_room_id, p_starts_at, p_time_zone|p_room_id, p_starts_at, p_ends_at, p_time_zone)\) in the schema cache\.?$/i.test(error.message))
    || (error.code === '42883' && (error.status === undefined || error.status === 400 || error.status === 404)
      && /^function public\.preview_room_meeting_time_v1\(uuid, ?text, ?text, ?text\) does not exist\.?$/i.test(error.message));
}
export async function previewRoomMeetingTime(roomId: string, time: MeetingTime): Promise<{ data: MeetingTimePreview | null; unsupported: boolean; error: ReturnType<typeof failure> | null }> {
  const owner = account(), ownerBackend = backend;
  try {
    if (getConsentAccess().state !== 'accepted') throw failure('S1001');
    const interval = normalizeMeetingTime(time), support = await fetchS4Capabilities();
    if (owner !== account()) throw failure('ACCOUNT_CHANGED');
    if (support.mode === 'legacy') return { data: null, unsupported: true, error: null };
    if (support.mode !== 's4') throw support.error ?? failure('S4_UNAVAILABLE');
    const result = await call('preview_room_meeting_time_v1', { p_room_id: roomId, p_starts_at: interval.starts_at, p_ends_at: interval.ends_at, p_time_zone: interval.time_zone });
    if (result.error) {
      if (!previewBackends.has(ownerBackend) && missingMeetingPreview(result.error)) return { data: null, unsupported: true, error: null };
      throw failure(result.error.code);
    }
    const value = record(result.data);
    if (!count(value.eligible_count) || !count(value.available_count) || value.available_count > value.eligible_count || !revision(value.revision)
      || value.all_available !== (value.eligible_count > 0 && value.available_count === value.eligible_count)) throw failure();
    previewBackends.add(ownerBackend);
    return { data: { eligible_count: value.eligible_count, available_count: value.available_count, all_available: value.all_available as boolean, revision: value.revision }, unsupported: false, error: null };
  } catch (error) { return { data: null, unsupported: false, error: failure((error as { code?: string })?.code) }; }
}
async function mutate(name: string, roomId: string, payload: Record<string, unknown>, expectedRevision: string) {
  const owner = account();
  const args = { p_room_id: roomId, ...payload, p_expected_revision: expectedRevision };
  const key = `${owner}|${name}|${JSON.stringify(args)}`;
  const requestId = requests.get(key) ?? newConsentRequestId(); requests.set(key, requestId);
  try {
    if (getConsentAccess().state !== 'accepted') throw failure('S1001');
    if (!revision(expectedRevision)) throw failure('22023');
    const support = await fetchS4Capabilities();
    if (owner !== account()) throw failure('ACCOUNT_CHANGED');
    if (support.mode !== 's4') throw support.error ?? failure('S4_UNAVAILABLE');
    const result = await call(name, { ...args, p_request_id: requestId });
    if (result.error) { if (/^(S\d{4}|22023|22P02|42501)$/.test(result.error.code)) requests.delete(key); throw failure(result.error.code, result.error.hint); }
    const response = record(result.data), state = parseRoomDecisionState(response.state, roomId);
    if (response.contract_version !== 1 || !['applied', 'replayed'].includes(String(response.outcome)) || !revision(response.applied_revision)
      || BigInt(response.applied_revision) > BigInt(state.revision) || BigInt(response.applied_revision) < BigInt(expectedRevision)) throw failure();
    requests.delete(key); listeners.forEach(listener => listener(roomId));
    return { data: { ...response, state } as S4Mutation, error: null };
  } catch (error) { const e = error as { code?: string; hint?: unknown }; return { data: null, error: failure(e?.code, e?.hint) }; }
}
export const submitRoomAvailability = (roomId: string, slots: string[], expectedRevision: string) => {
  if (!Array.isArray(slots) || slots.length > 500 || !slots.every(key => typeof key === 'string' && validKstSlot(key)) || new Set(slots).size !== slots.length) return Promise.resolve({ data: null, error: failure('22023') });
  return mutate('submit_room_availability_v1', roomId, { p_slot_keys: [...slots].sort() }, expectedRevision);
};
export const selectRoomMeetingTime = (roomId: string, time: MeetingTime | null, expectedRevision: string) => {
  try { return mutate('select_room_meeting_time_v1', roomId, { p_time: time === null ? null : normalizeMeetingTime(time) }, expectedRevision); }
  catch { return Promise.resolve({ data: null, error: failure('22023') }); }
};
export const confirmRoomAppointment = (roomId: string, itemId: string, expectedRevision: string) => mutate('confirm_room_appointment_v1', roomId, { p_restaurant_item_id: itemId }, expectedRevision);
