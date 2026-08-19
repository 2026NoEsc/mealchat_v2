import { toEmoticonToken } from './emoticon';
import {
  toSettlementSummary,
  type SettlementBillRow,
  type SettlementSummary,
} from './settlementSummary';
import { supabase } from './supabase';

export type RoomParticipant = {
  id: string;
  profileId: string | null;
  name: string;
  avatarColor: string;
};

export type RoomSummary = {
  id: string;
  code: string;
  title: string;
  color: string;
  isConfirmed: boolean;
  confirmedSlot: string | null;
  expiresAt: string;
  meetingDate: string;
  locationName: string | null;
  participants: RoomParticipant[];
  lastMessage: { text: string; senderName: string; createdAt: string } | null;
};

export type RoomMessage = {
  id: string;
  roomId: string;
  senderId: string | null;
  senderName: string;
  senderColor: string;
  text: string;
  createdAt: string;
  /** system 은 방에서 일어난 일의 안내다. 사람이 보낼 수 없다 */
  kind: 'user' | 'system';
};

type ParticipantRow = {
  id: string;
  profile_id: string | null;
  name: string;
  avatar_color: string;
};

type RoomRow = {
  id: string;
  code: string;
  title: string;
  color: string;
  is_confirmed: boolean;
  confirmed_slot: string | null;
  expires_at: string;
  meeting_date: string;
  location_name: string | null;
  participants: ParticipantRow[] | null;
  messages: { message: string; sender_name: string; created_at: string }[] | null;
};

type MessageRow = {
  id: string;
  room_id: string;
  sender_id: string | null;
  sender_name: string;
  sender_color: string;
  message: string;
  created_at: string;
  kind: string | null;
};

function toParticipant(row: ParticipantRow): RoomParticipant {
  return {
    id: row.id,
    profileId: row.profile_id,
    name: row.name,
    avatarColor: row.avatar_color,
  };
}

/**
 * 내가 속한 방만 돌아온다. 필터를 쓰지 않는 이유는 rooms 의 select 정책이
 * 이미 참가자인 방으로 제한하기 때문이다. 참가자·메시지 임베드도
 * 각자의 정책을 통과한 것만 실린다.
 */
export async function fetchMyRooms(): Promise<{
  data: RoomSummary[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('rooms')
    .select(
      'id, code, title, color, is_confirmed, confirmed_slot, expires_at, meeting_date, location_name, ' +
        'participants(id, profile_id, name, avatar_color), ' +
        'messages(message, sender_name, created_at)',
    )
    // 미리보기에 쓸 마지막 한 건만 가져온다
    .order('created_at', { referencedTable: 'messages', ascending: false })
    .limit(1, { referencedTable: 'messages' })
    .order('created_at', { ascending: false })
    .returns<RoomRow[]>();

  if (error) return { data: null, error };

  const rooms = (data ?? []).map<RoomSummary>((row) => {
    const last = row.messages?.[0];
    return {
      id: row.id,
      code: row.code,
      title: row.title,
      color: row.color,
      isConfirmed: row.is_confirmed,
      confirmedSlot: row.confirmed_slot,
      expiresAt: row.expires_at,
      meetingDate: row.meeting_date,
      locationName: row.location_name,
      participants: (row.participants ?? []).map(toParticipant),
      lastMessage: last
        ? { text: last.message, senderName: last.sender_name, createdAt: last.created_at }
        : null,
    };
  });

  return { data: rooms, error: null };
}

/** 채팅방 헤더가 쓰는 방 한 건. 정책이 이미 접근을 제한하므로 id 로만 찾는다. */
export async function fetchRoom(roomId: string): Promise<{
  data: RoomSummary | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('rooms')
    .select(
      'id, code, title, color, is_confirmed, confirmed_slot, expires_at, meeting_date, location_name, ' +
        'participants(id, profile_id, name, avatar_color), ' +
        'messages(message, sender_name, created_at)',
    )
    .eq('id', roomId)
    .limit(1, { referencedTable: 'messages' })
    .maybeSingle<RoomRow>();

  if (error) return { data: null, error };
  if (!data) return { data: null, error: null };

  return {
    data: {
      id: data.id,
      code: data.code,
      title: data.title,
      color: data.color,
      isConfirmed: data.is_confirmed,
      confirmedSlot: data.confirmed_slot,
      expiresAt: data.expires_at,
      meetingDate: data.meeting_date,
      locationName: data.location_name,
      participants: (data.participants ?? []).map(toParticipant),
      lastMessage: null,
    },
    error: null,
  };
}

export async function fetchRoomMessages(roomId: string): Promise<{
  data: RoomMessage[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, room_id, sender_id, sender_name, sender_color, message, created_at, kind')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .returns<MessageRow[]>();

  if (error) return { data: null, error };

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      roomId: row.room_id,
      senderId: row.sender_id,
      senderName: row.sender_name,
      senderColor: row.sender_color,
      text: row.message,
      createdAt: row.created_at,
      /* 모르는 값이 오면 사람 말로 다룬다 — 시스템 줄로 잘못 꾸미는 쪽이 더 나쁘다 */
      kind: row.kind === 'system' ? 'system' : 'user',
    })),
    error: null,
  };
}

/**
 * 방에서 일어난 일을 채팅에 남긴다.
 *
 * messages 직접 INSERT 로는 kind 를 정할 수 없다 (권한이 room_id, message 뿐).
 * 서버가 참가자인지 확인하고 system 으로 넣어 준다.
 */
export async function postRoomSystemMessage(roomId: string, text: string): Promise<Error | null> {
  const { error } = await supabase.rpc('post_room_system_message', {
    target_room: roomId,
    body: text,
  });
  return error;
}

/**
 * 보낼 수 있는 컬럼은 room_id 와 message 뿐이다. 나머지는 트리거가
 * auth.uid() 기준으로 채우므로 보낸 사람을 사칭할 수 없다.
 */
export async function sendRoomMessage(roomId: string, text: string): Promise<Error | null> {
  const trimmed = text.trim();
  if (!trimmed) return new Error('메시지를 입력해 주세요.');

  const { error } = await supabase.from('messages').insert({ room_id: roomId, message: trimmed });
  return error;
}

/** 이모티콘도 같은 messages 테이블에 토큰 문자열로 실어 보낸다. */
export async function sendRoomSticker(roomId: string, stickerId: string): Promise<Error | null> {
  return sendRoomMessage(roomId, toEmoticonToken(stickerId));
}

/**
 * 초대 코드로 참가한다. participants 직접 INSERT 는 권한이 없고,
 * 이 RPC 가 코드와 만료를 서버에서 확인한 뒤 참가행을 만든다.
 */
export async function joinRoomByCode(code: string): Promise<{
  roomId: string | null;
  error: Error | null;
}> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { roomId: null, error: new Error('초대 코드를 입력해 주세요.') };

  const { data, error } = await supabase.rpc('join_room_by_code', { room_code: trimmed });
  if (error) return { roomId: null, error };

  return { roomId: typeof data === 'string' ? data : null, error: null };
}

/**
 * 방 나가기.
 *
 * 참가행만 지우면 방이 목록에 남을 수 있어 RPC 로 옮겼다. 참가자에서 빼고,
 * 마지막 사람이었으면 방까지 한 트랜잭션으로 지운다.
 */
export async function leaveRoom(roomId: string): Promise<Error | null> {
  const { error } = await supabase.rpc('leave_room', { target_room: roomId });
  return error;
}

/**
 * 내가 만들었거나 내가 참가한 방의 정산.
 *
 * dutch_pay_bills 의 정책은 creator 와 방 참가자를 통과시키고, dutch_pay_members 도
 * 같은 기준으로 열려 있다 (`20260817200241_open_room_features.sql`). 그래서 누가
 * 아직 안 보냈는지까지 함께 읽는다.
 */
export type { SettlementSummary };

export async function fetchMySettlements(userId: string | null): Promise<{
  data: SettlementSummary[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('dutch_pay_bills')
    .select('id, room_id, title, total_amount, dutch_pay_members(profile_id, is_completed)')
    .order('created_at', { ascending: false })
    .returns<SettlementBillRow[]>();

  if (error) return { data: null, error };

  return {
    data: (data ?? []).map((row) => toSettlementSummary(row, userId)),
    error: null,
  };
}

/** 초대 코드에 헷갈리는 글자(0/O, 1/I)를 빼고 만든다 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * 방을 만든다. 트리거가 방장을 참가자로 넣는다.
 *
 * rooms.code 가 UNIQUE 라 아주 드물게 부딪힐 수 있다. 그때는 다른 코드로 몇 번
 * 더 시도한다 — 서버에서 코드를 만들게 옮기는 것이 더 낫지만, 그러려면 RPC 가
 * 방 생성 전체를 맡아야 해서 별도 작업이다.
 */
export async function createRoom(input: {
  /** 누가 만들었는지 기록만 한다 — 방 안에서 권한 차이는 없다 */
  ownerId: string;
  title: string;
  meetingDate: string;
  expiresAt: string;
  locationName?: string | null;
  confirmedSlot?: string | null;
  color?: string;
}): Promise<{ roomId: string | null; code: string | null; error: Error | null }> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = randomCode();
    /*
     * 일부러 RETURNING 을 쓰지 않는다.
     *
     * rooms 의 select 정책은 참가자만 통과시키는데, 나를 참가자로 넣어 주는 것은
     * AFTER INSERT 트리거다. `insert().select()` 로 한 번에 받으려 하면 반환 시점에
     * 아직 참가행이 없어 정책에 걸린다. 삽입한 뒤 코드로 다시 찾는다 — 그때는
     * 트리거가 끝나 있어 정상적으로 보인다.
     */
    const { error } = await supabase.from('rooms').insert({
      code,
      title: input.title,
      meeting_date: input.meetingDate,
      expires_at: input.expiresAt,
      owner_id: input.ownerId,
      location_name: input.locationName ?? null,
      confirmed_slot: input.confirmedSlot ?? null,
      is_confirmed: Boolean(input.confirmedSlot),
      color: input.color ?? '#FF9900',
    });

    if (!error) {
      const { data, error: findError } = await supabase
        .from('rooms')
        .select('id')
        .eq('code', code)
        .maybeSingle<{ id: string }>();

      if (findError) return { roomId: null, code: null, error: findError };
      return { roomId: data?.id ?? null, code, error: null };
    }
    // 23505 = unique_violation. 코드가 겹친 경우에만 다시 만든다.
    if (error.code !== '23505') return { roomId: null, code: null, error };
  }

  return { roomId: null, code: null, error: new Error('초대 코드를 만들지 못했어요. 다시 시도해 주세요.') };
}

/**
 * 방장이 메이트를 방에 넣는다. 서버가 부른 사람의 방 참가 여부와
 * 메이트 관계를 확인하므로 모르는 사람은 넣을 수 없다.
 *
 * added 가 false 면 이미 참가 중이라 아무것도 하지 않은 것이다.
 * 화면이 "초대했어요" 와 "이미 있어요" 를 구분할 수 있어야 한다.
 */
export async function inviteFriendToRoom(
  roomId: string,
  friendId: string,
): Promise<{ added: boolean; error: Error | null }> {
  const { data, error } = await supabase.rpc('invite_friend_to_room', {
    target_room: roomId,
    friend_id: friendId,
  });

  return { added: data === true, error };
}
