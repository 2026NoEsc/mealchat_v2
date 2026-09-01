import { dedupeLabels } from './labels';
import { supabase } from './supabase';

export type VotingKind = 'menu' | 'time';

export type VotingItem = {
  id: string;
  kind: VotingKind;
  label: string;
  createdBy: string | null;
};

export type VotingOption = VotingItem & {
  /** 이 후보를 고른 참가자 이름 */
  voters: { name: string; color: string }[];
  /** 내가 골랐는지 */
  mine: boolean;
};

type RawItem = {
  id?: unknown;
  kind?: unknown;
  label?: unknown;
  created_by?: unknown;
};

type ParticipantVotes = {
  profile_id: string | null;
  name: string;
  avatar_color: string;
  voted_items: unknown;
};

/** jsonb 는 무엇이든 들어올 수 있으니 화면에 넘기기 전에 걸러 낸다 */
function toItem(raw: RawItem): VotingItem | null {
  const id = typeof raw.id === 'string' ? raw.id : null;
  const label = typeof raw.label === 'string' ? raw.label.trim() : '';
  const kind = raw.kind === 'menu' || raw.kind === 'time' ? raw.kind : null;

  if (!id || !label || !kind) return null;
  return { id, kind, label, createdBy: typeof raw.created_by === 'string' ? raw.created_by : null };
}

function votedIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

/**
 * 후보와 표를 한 번에 읽는다.
 *
 * 후보는 rooms.voting_items 에, 표는 각 참가자의 voted_items 에 있다.
 * 둘 다 방 참가자에게만 보이도록 정책이 걸려 있어 별도 필터가 필요 없다.
 */
export async function fetchRoomVoting(
  roomId: string,
  myId: string | null,
): Promise<{ data: VotingOption[] | null; error: Error | null }> {
  const [roomResult, participantResult] = await Promise.all([
    supabase
      .from('rooms')
      .select('voting_items')
      .eq('id', roomId)
      .maybeSingle<{ voting_items: unknown }>(),
    supabase
      .from('participants')
      .select('profile_id, name, avatar_color, voted_items')
      .eq('room_id', roomId)
      .returns<ParticipantVotes[]>(),
  ]);

  const error = roomResult.error ?? participantResult.error;
  if (error) return { data: null, error };

  const rawItems = Array.isArray(roomResult.data?.voting_items) ? roomResult.data.voting_items : [];
  const items = (rawItems as RawItem[]).map(toItem).filter((item): item is VotingItem => item !== null);

  const options = items.map<VotingOption>((item) => {
    const voters = (participantResult.data ?? []).filter((participant) =>
      votedIds(participant.voted_items).includes(item.id),
    );

    return {
      ...item,
      voters: voters.map((voter) => ({ name: voter.name, color: voter.avatar_color })),
      mine: voters.some((voter) => voter.profile_id === myId),
    };
  });

  return { data: options, error: null };
}

/** 후보 추가. 방 참가자만, 같은 이름은 서버가 거절한다. */
export async function addVotingItem(
  roomId: string,
  kind: VotingKind,
  label: string,
): Promise<Error | null> {
  const { error } = await supabase.rpc('add_voting_item', {
    target_room: roomId,
    item_kind: kind,
    item_label: label,
  });
  return error;
}

/** 표를 켜고 끈다. 내 참가행만 바뀐다. */
export async function toggleVote(roomId: string, itemId: string): Promise<Error | null> {
  const { error } = await supabase.rpc('toggle_vote', {
    target_room: roomId,
    item_id: itemId,
  });
  return error;
}

/**
 * 방을 만들 때 투표 후보를 미리 올려 둔다.
 *
 * 시간(`time`)은 방장이 고른 시간대를, 메뉴(`menu`)는 AI 가 추천한 식당을 심는다.
 * 빈 방에서 각자 후보를 만들어 넣게 두면 아무도 시작하지 않아서, 첫 후보는
 * 방을 만든 사람의 선택으로 채워 둔다.
 *
 * 한 건이 실패해도 나머지는 계속 심는다. 방은 이미 만들어졌고, 투표 후보가
 * 덜 올라간 것 때문에 사용자가 방에 못 들어가면 그게 더 나쁘다.
 */
export async function seedVotingOptions(
  roomId: string,
  kind: VotingKind,
  labels: string[],
): Promise<{ failed: string[] }> {
  const failed: string[] = [];

  for (const label of dedupeLabels(labels)) {
    const error = await addVotingItem(roomId, kind, label);
    if (error) failed.push(label);
  }

  return { failed };
}
