import type { RoomDecisionState } from '../../src/lib/roomDecisions';
export const s4RoomId = '00000000-0000-4000-8000-000000000001';
export const s4ItemId = '00000000-0000-4000-8000-000000000002';
export const s4Capabilities = { contract_version: 1, atomic_confirmation: true, structured_meeting_time: true, owner_confirmation: true, availability_stage_guard: true, time_zones: ['Asia/Seoul'], requires_time_for_confirmation: true };
export const s4Time = { starts_at: '2026-10-20T09:00:00.000Z', ends_at: '2026-10-20T10:00:00.000Z', time_zone: 'Asia/Seoul' as const };
export function s4State(overrides: Partial<RoomDecisionState> = {}): RoomDecisionState {
  return { contract_version: 1, room_id: s4RoomId, revision: '4', stage: 'scheduling', server_time: '2026-10-20T00:00:00.000Z',
    meeting_time: null, time_status: 'unset', legacy_time_label: null, restaurant: null, confirmation_status: 'none',
    availability: { eligible_count: 2, submitted_count: 2, all_submitted: true,
      members: [{ participant_id: 'p-me', name: '모아', avatar_color: '#FFF3E0', eligible: true, submitted: true }, { participant_id: 'p-mate', name: '두두', avatar_color: '#E8F5EC', eligible: true, submitted: true }, { participant_id: 'p-legacy', name: '이전 메이트', avatar_color: '#F1EEE9', eligible: false, submitted: false }],
      my_slots: ['2026-10-20-18', '2026-10-20-19'], others_slots: ['2026-10-20-18'] },
    voting: { eligible_count: 2, leading_item_id: s4ItemId, leading_votes: 2, required_votes: 2 },
    permissions: { can_submit: true, can_select_time: true, can_confirm: false }, ...overrides };
}
export const s4Mutation = (state = s4State(), outcome: 'applied' | 'replayed' = 'applied') => ({ contract_version: 1, outcome, applied_revision: state.revision, state });
