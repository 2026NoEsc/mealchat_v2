/** Synthetic S4 contract transport. Only the isolated preview resolver imports this file. */
import { s4Capabilities, s4ItemId, s4Mutation, s4RoomId, s4State, s4Time } from '../../tests/fixtures/s4';
import type { RoomDecisionState } from '../../src/lib/roomDecisions';
export { canEditSettlement } from '../../src/lib/settlementAccess';
const scene = new URLSearchParams(globalThis.location?.search).get('scene') ?? 'time-manual';
const calls: { name: string; args?: unknown }[] = [];
Object.assign(globalThis, { __s4Calls: calls });
const record = (name: string, args?: unknown) => calls.push({ name, args });
export const fixtureParticipants = [{ id: 'p-me', profileId: 'A', name: '모아', avatarColor: '', avatarUrl: null }, { id: 'p-mate', profileId: 'B', name: '두두', avatarColor: '', avatarUrl: null }, { id: 'p-legacy', profileId: null, name: '이전 메이트', avatarColor: '', avatarUrl: null }];
let state = s4State();
if (scene === 'submissions-waiting' || scene === 'time-waiting' || scene === 'step2') { state.availability.members[1].submitted = false; state.availability.submitted_count = 1; state.availability.all_submitted = false; }
if (scene === 'step2') { state.availability.my_slots = []; state.availability.members[0].submitted = false; state.availability.submitted_count = 0; }
if (['voting', 'no-time', 'mate', 'confirmation', 'summary', 'detail', 'place-time', 'read-only', 'settlement-actions', 'settlement-locked'].includes(scene)) state = { ...state, stage: 'place', meeting_time: s4Time, time_status: 'selected', permissions: { can_submit: false, can_select_time: true, can_confirm: true } };
if (scene.startsWith('legacy-settlement')) state = { ...state, stage: 'settling', confirmation_status: 'legacy_settlement_unverified', permissions: { can_submit: false, can_select_time: false, can_confirm: false } };
if (scene === 'place-unset-edit') state = { ...state, stage: 'place', meeting_time: null, time_status: 'unset', permissions: { can_submit: true, can_select_time: true, can_confirm: false } };
if (scene === 'no-time') state = { ...state, meeting_time: null, time_status: 'legacy_unverified', legacy_time_label: '10/20(화) 18:00', permissions: { can_submit: false, can_select_time: true, can_confirm: false } };
if (scene === 'mate') state = { ...state, permissions: { can_submit: false, can_select_time: false, can_confirm: false } };
if (scene === 'read-only') state = { ...state, stage: 'settling', confirmation_status: 'owner_confirmed', permissions: { can_submit: false, can_select_time: false, can_confirm: false } };
export const fixtureRoom = { id: s4RoomId, code: 'S4MOCK', title: '같이 먹는 저녁', ownerId: 'A', color: '#FF9900', stage: state.stage, isConfirmed: false, confirmedSlot: '2026-10-20T09:00:00.000Z', meetingTime: state.meeting_time, decisionRevision: state.revision, appointmentConfirmedAt: null, appointmentConfirmedBy: null, decisionMode: 's4' as const, meetingDate: '2099-12-31', expiresAt: '2026-10-27T14:59:59Z', confirmedMenu: null, locationName: null, participants: fixtureParticipants, lastMessage: null };
export const s4PreviewTransport = async (name: string, args: Record<string, unknown>) => {
  record(name, args);
  if (scene === 'capability-error') return { data: null, error: { code: 'NETWORK' } };
  if (name === 'get_s4_capabilities') {
    if (scene === 'legacy' || scene === 'legacy-voting') return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.get_s4_capabilities() in the schema cache' }, status: 404 };
    return { data: s4Capabilities, error: null };
  }
  if (name === 'get_room_s4_state') return { data: state, error: null };
  if (name === 'preview_room_meeting_time_v1') {
    // Synthetic per-member schedules: A=18/19h, B=18h. Count continuous coverage, never the union.
    const start = new Date(String(args.p_starts_at)).getUTCHours() + 9, end = new Date(String(args.p_ends_at)).getUTCHours() + 9;
    const available = String(args.p_starts_at).startsWith('2026-10-20T')
      ? [[18, 19], [18]].filter(hours => Array.from({ length: end - start }, (_, index) => start + index).every(hour => hours.includes(hour))).length : 0;
    return { data: { eligible_count: 2, available_count: available, all_available: available === 2, revision: state.revision }, error: null };
  }
  if (name === 'select_room_meeting_time_v1') {
    state = { ...state, stage: 'place', revision: String(BigInt(state.revision) + 1n), meeting_time: args.p_time as RoomDecisionState['meeting_time'], time_status: args.p_time ? 'selected' : 'unset', permissions: { can_submit: false, can_select_time: true, can_confirm: Boolean(args.p_time) } };
  } else if (name === 'submit_room_availability_v1') {
    const keys = args.p_slot_keys as string[];
    if (JSON.stringify([...keys].sort()) === JSON.stringify([...state.availability.my_slots].sort())) return { data: s4Mutation(state), error: null };
    state = { ...state, revision: String(BigInt(state.revision) + 1n), availability: { ...state.availability, my_slots: keys,
      members: state.availability.members.map(m => m.participant_id === 'p-me' ? { ...m, submitted: keys.length > 0 } : m) } };
    state.availability.submitted_count = state.availability.members.filter(m => m.eligible && m.submitted).length;
    state.availability.all_submitted = state.availability.eligible_count === state.availability.submitted_count;
  } else if (name === 'confirm_room_appointment_v1') {
    state = { ...state, stage: 'confirmed', revision: String(BigInt(state.revision) + 1n), restaurant: { item_id: s4ItemId, label: '모아 식당' }, confirmation_status: 'owner_confirmed', permissions: { can_submit: false, can_select_time: false, can_confirm: false } };
  } else throw new Error('Unimplemented isolated preview RPC');
  return { data: s4Mutation(state), error: null };
};
export function useAuth() { return { user: { id: scene === 'mate' ? 'B' : 'A' } }; }
export function useRoom() { return { room: fixtureRoom, status: 'ready', reload() {} }; }
export function useNavigation() { return { current: { name: 'ScheduleConfirmed', params: { roomId: s4RoomId, name: fixtureRoom.title } }, navigate: (name: string, args: unknown) => record('navigate:' + name, args), goBack() {}, goBackWith() {}, resetTo() {} }; }
export const getConsentServerMode = () => 's1';
export const fetchConsentManifest = async () => ({ data: {}, error: null });
export const fetchFoodCatalog = async () => scene === 'legacy' ? { data: null, error: { code: 'S5_UNAVAILABLE' } } : { data: { contract_version: 2 }, error: null };
export const fetchRoomVoting = async () => ({ data: [{ id: s4ItemId, label: '모아 식당', kind: 'menu', createdBy: 'A', mine: true, voters: [{ name: '모아', color: '' }, { name: '두두', color: '' }] }], memberCount: 2, error: null });
export const toggleVote = async () => null;
export const addVotingItem = async () => null;
export const removeVotingItem = async () => null;
export const confirmRoomVote = async () => { throw new Error('Legacy confirmation must never run in S4 scenes'); };
export const fetchRoom = async () => ({ data: fixtureRoom, error: null });
export const advanceRoomStage = async () => { throw new Error('Legacy stage advancement must never run in S4 scenes'); };
export const leaveRoom = async () => null;
const reloadProfile = () => undefined;
export const useMyProfile = () => ({ bundle: null, status: 'loading', reload: reloadProfile });
export const fetchRoomSettlements = async () => ({ data: [], error: null });
export const subscribeSettlementPayments = () => () => undefined;
export const fetchSettlementPaymentDetails = async () => { throw new Error('No payment fixture for this preview'); };
export const createRoomSettlement = async () => { throw new Error('A pre-confirmation preview must never create a settlement'); };
export const setSettlementCompleted = async () => { throw new Error('No settlement completion in this preview'); };
export const searchPlaces = async () => [];
export const useKeyboardOverlap = () => ({ overlap: 0, remeasure() {} });
export const supabase = { functions: { invoke: async () => ({ data: { slotRecommendations: [{ slot: { id: 'rec-1', date: '2026-10-20', startTime: '18:00', endTime: '19:00' }, availableCount: 1, totalCount: 2, rank: 1, rainChance: null, reason: '제출된 시간에서 추천했어요.' }] }, error: null }) } };
