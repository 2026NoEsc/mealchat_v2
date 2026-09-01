import { supabase } from './supabase';

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
  }[];
  /** 내가 앞서 낸 답 — 격자에 되살려서 이어 고칠 수 있게 한다 */
  mySlots: string[];
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
  const { data, error } = await supabase.rpc('room_availability_status', {
    target_room: roomId,
  });

  if (error) return { data: null, error };

  const rows = (data ?? []) as StatusRow[];

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
): Promise<Error | null> {
  const { error } = await supabase.rpc('set_my_availability', {
    target_room: roomId,
    slot_keys: slotKeys,
  });

  return error;
}
