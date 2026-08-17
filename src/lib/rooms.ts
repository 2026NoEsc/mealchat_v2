import { toEmoticonToken } from './emoticon';
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
 * 이미 owner 이거나 참가자인 방으로 제한하기 때문이다. 참가자·메시지 임베드도
 * 각자의 정책을 통과한 것만 실린다.
 */
export async function fetchMyRooms(): Promise<{
  data: RoomSummary[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('rooms')
    .select(
      'id, code, title, color, is_confirmed, confirmed_slot, expires_at, meeting_date, ' +
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
      'id, code, title, color, is_confirmed, confirmed_slot, expires_at, meeting_date, ' +
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
    .select('id, room_id, sender_id, sender_name, sender_color, message, created_at')
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
    })),
    error: null,
  };
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

/** 방을 나간다. 자기 참가행만 지울 수 있다. */
export async function leaveRoom(roomId: string, profileId: string): Promise<Error | null> {
  const { error } = await supabase
    .from('participants')
    .delete()
    .eq('room_id', roomId)
    .eq('profile_id', profileId);
  return error;
}
