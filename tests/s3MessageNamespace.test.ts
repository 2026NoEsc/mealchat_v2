jest.mock('../src/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../src/lib/roomLifecycle', () => ({
  fetchS3Capabilities: jest.fn(async () => ({ mode: 's3', error: null })),
  roomLifecycleReadToken: () => 'same-session',
}));
import { supabase } from '../src/lib/supabase';
import { fetchRoomMessages } from '../src/lib/rooms';
import { fetchS3Capabilities } from '../src/lib/roomLifecycle';
const room = '33000000-0000-4000-8000-000000000001';
const actor = '10000001-0000-4000-8000-000000000001';
const request = '39000000-0000-4000-8000-000000000001';
async function event(key: string, type = 'member_left', actorId: string | null = actor) {
  const message = { id: request, room_id: room, sender_id: null, kind: 'system', event_key: key, lifecycle_actor_id: actorId, lifecycle_event_type: type };
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), returns: jest.fn(async () => ({ data: [message], error: null })) };
  (supabase.from as jest.Mock).mockImplementation(table => table === 'public_profiles'
    ? { ...query, returns: jest.fn(async () => ({ data: [{ id: actor, name: 'Synthetic' }], error: null })) } : query);
  return (await fetchRoomMessages(room)).data?.[0].lifecycleEvent;
}
it('projects scoped leave keys while preserving the historical key contract', async () => {
  expect(await event(`member-left:${room}:${actor}:${request}`)).toMatchObject({ actorId: actor, type: 'member_left' });
  expect(await event(`member-left:${request}`)).toMatchObject({ actorId: actor });
  expect(await event(`member-left:${room}:${actor}:${request}`, 'member_left', null)).toMatchObject({ actorId: null, actorName: '탈퇴한 메이트' });
});
it('projects scoped transfer keys including worker terminal events', async () => {
  expect(await event(`owner-transfer:${room}:${actor}:${request}:accepted`, 'owner_transfer_accepted')).toMatchObject({ transferId: request });
  expect(await event(`owner-transfer:${room}:server:${request}:expired`, 'owner_transfer_expired', null)).toMatchObject({ actorId: null, transferId: request });
});
it('rejects mismatched room, actor, event status and unverified historical rows', async () => {
  expect(await event(`member-left:${request}:${actor}:${request}`)).toBeNull();
  expect(await event(`member-left:${room}:${request}:${request}`)).toBeNull();
  expect(await event(`owner-transfer:${room}:${actor}:${request}:accepted`, 'owner_transfer_pending')).toBeNull();
  expect(await event('legacy-text')).toBeNull();
});

it.each(['NETWORK', 'TIMEOUT', 'INVALID_RESPONSE'])('keeps basic messages readable on a %s capability error without trusting lifecycle fields', async code => {
  (fetchS3Capabilities as jest.Mock).mockResolvedValueOnce({ mode: 'error', error: Object.assign(new Error('probe failed'), { code }) });
  const rows = [
    { id: request, room_id: room, sender_id: actor, kind: 'user', message: 'Synthetic chat' },
    { id: actor, room_id: room, sender_id: null, kind: 'system', message: 'Synthetic legacy notice', event_key: `member-left:${request}`, lifecycle_actor_id: actor, lifecycle_event_type: 'member_left' },
  ];
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), returns: jest.fn(async () => ({ data: rows, error: null })) };
  (supabase.from as jest.Mock).mockClear().mockReturnValue(query);
  const result = await fetchRoomMessages(room);
  expect(result.error).toBeNull();
  expect(result.data).toEqual([
    expect.objectContaining({ text: 'Synthetic chat', lifecycleEvent: null }),
    expect.objectContaining({ text: 'Synthetic legacy notice', lifecycleEvent: null }),
  ]);
  expect(query.select).toHaveBeenCalledWith('id, room_id, sender_id, sender_name, sender_color, message, created_at, kind');
  expect(supabase.from).toHaveBeenCalledTimes(1);
  expect(supabase.from).toHaveBeenCalledWith('messages');
});
