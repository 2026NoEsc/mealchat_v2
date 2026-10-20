import { supabase } from './supabase';
import { fetchRoomDecisionState, fetchS4Capabilities, roomDecisionErrorMessage, submitRoomAvailability } from './roomDecisions';

/**
 * 방의 일정 조율 현황.
 *
 * 다른 사람이 어느 시간에 가능한지는 담지 않는다. 제출했는지만 알려 주고,
 * 시간대별 합계는 추천을 만들 때 서버가 직접 센다 — 개인의 가능·불가 패턴이
 * 방 전체에 보이면 곤란하기 때문이다.
 */
export type AvailabilityStatus = {
  members: {
    id: string;
    name: string;
    avatarColor: string;
    submitted: boolean;
    eligible?: boolean;
  }[];
  /** 내가 앞서 낸 답 — 격자에 되살려서 이어 고칠 수 있게 한다 */
  mySlots: string[];
  /** 다른 사람이 고른 칸. 누가 골랐는지는 오지 않는다 */
  othersSlots: string[];
  revision?: string;
  allSubmitted?: boolean;
  eligibleCount?: number;
  submittedCount?: number;
};

type StatusRow = {
  participant_id: string;
  name: string;
  avatar_color: string;
  submitted: boolean;
  my_slots: unknown;
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

export async function fetchRoomAvailability(roomId: string): Promise<{
  data: AvailabilityStatus | null;
  error: Error | null;
}> {
  const support = await fetchS4Capabilities();
  if (support.mode === 'error') return { data: null, error: support.error };
  if (support.mode === 's4') {
    const result = await fetchRoomDecisionState(roomId);
    if (!result.data) return { data: null, error: result.error };
    const a = result.data.availability;
    return { data: { members: a.members.map(m => ({ id: m.participant_id, name: m.name, avatarColor: m.avatar_color, submitted: m.submitted, eligible: m.eligible })), mySlots: a.my_slots, othersSlots: a.others_slots, revision: result.data.revision, allSubmitted: a.all_submitted, eligibleCount: a.eligible_count, submittedCount: a.submitted_count }, error: null };
  }
  const [status, cells] = await Promise.all([
    supabase.rpc('room_availability_status', { target_room: roomId }),
    supabase.rpc('room_availability_cells', { target_room: roomId }),
  ]);

  if (status.error) return { data: null, error: status.error };

  const rows = (status.data ?? []) as StatusRow[];

  return {
    data: {
      members: rows.map((row) => ({
        id: row.participant_id,
        name: row.name,
        avatarColor: row.avatar_color,
        submitted: row.submitted,
      })),
      /* 내 행에만 my_slots 가 채워져 온다 */
      mySlots: toStringArray(rows.find((row) => toStringArray(row.my_slots).length > 0)?.my_slots),
      /* 겹쳐 보여 줄 칸은 없어도 그만이다 — 실패해도 화면은 그린다 */
      othersSlots: cells.error ? [] : toStringArray(cells.data),
    },
    error: null,
  };
}

/**
 * 내 가능한 시간을 저장한다.
 *
 * participants 에는 UPDATE 정책이 없어서 직접 고칠 수 없다. 자기 행만 건드리는
 * RPC 로 넘긴다.
 */
export async function saveMyAvailability(
  roomId: string,
  slotKeys: string[],
  expectedRevision?: string,
): Promise<Error | null> {
  const support = await fetchS4Capabilities();
  if (support.mode === 'error') return support.error;
  if (support.mode === 's4') {
    if (expectedRevision === undefined) return Object.assign(new Error(roomDecisionErrorMessage({ code: 'S4005' })), { code: 'S4005' });
    return (await submitRoomAvailability(roomId, slotKeys, expectedRevision)).error;
  }
  const { error } = await supabase.rpc('set_my_availability', {
    target_room: roomId,
    slot_keys: slotKeys,
  });

  return error;
}
