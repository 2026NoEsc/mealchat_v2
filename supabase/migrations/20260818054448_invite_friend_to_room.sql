-- 방장이 친구를 방에 직접 넣는 경로.
--
-- 일정잡기 1 단계에서 메이트를 고르는데 방은 마지막 단계에서야 만들어진다.
-- 그래서 고른 사람을 방 생성 직후에 참가자로 넣어야 하는데, participants 는
-- 직접 INSERT 권한이 없고 join_room_by_code 는 부른 사람 자신만 넣는다.
--
-- 아무나 아무 방에 끌어넣을 수 있으면 안 되므로 두 가지를 확인한다.
--   1) 부르는 사람이 그 방의 참가자인가
--   2) 넣으려는 사람이 부르는 사람의 메이트인가 (follows 에 관계가 있는가)
--
-- 초대받은 사람은 자기 참가행을 지워 나갈 수 있다 (participants_delete_own).

create or replace function public.invite_friend_to_room(target_room uuid, friend_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  friend public.profiles%rowtype;
  inserted integer;
begin
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not private.is_room_member(target_room) then
    raise exception 'Only room members can invite' using errcode = '42501';
  end if;

  if friend_id = caller then
    -- 방을 만들면 트리거가 방장을 이미 넣는다
    return false;
  end if;

  -- 모르는 사람을 끌어넣지 못하게 메이트 관계를 요구한다
  if not exists (
    select 1 from public.follows
    where follower_id = caller and following_id = friend_id
  ) then
    raise exception 'You can only invite your mates' using errcode = '42501';
  end if;

  select * into friend from public.profiles where id = friend_id;
  if not found then
    raise exception 'That profile no longer exists' using errcode = '23503';
  end if;

  -- participants.name 은 기본값 없는 NOT NULL 이라 프로필에서 채운다
  insert into public.participants (room_id, profile_id, name, avatar_color, avatar_url)
  values (target_room, friend.id, friend.name, friend.avatar_color, friend.avatar_url)
  on conflict do nothing;

  /*
   * 이미 참가 중이면 아무 행도 안 들어간다. 그때 true 를 돌려주면 화면이
   * "초대했어요" 라고 잘못 알린다. 실제로 넣었을 때만 true 다.
   */
  get diagnostics inserted = row_count;
  return inserted > 0;
end;
$$;

revoke all on function public.invite_friend_to_room(uuid, uuid) from public, anon, authenticated;
grant execute on function public.invite_friend_to_room(uuid, uuid) to authenticated;
