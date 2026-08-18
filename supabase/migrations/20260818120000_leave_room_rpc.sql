-- 방장 개념을 걷어내고, 나가기를 한 번에 처리한다.
--
-- 지금까지는 클라이언트가 participants 행만 지웠다. 그런데 rooms 조회 정책이
-- `owner_id = auth.uid() or private.is_room_member(id)` 라서, 내가 만든 방은
-- 참가자에서 빠져도 소유자 조건에 걸려 목록에 그대로 남았다.
--
-- 소유권을 넘기는 대신 아예 쓰지 않기로 한다. 밥약 방은 단톡방에 가깝다 —
-- 누가 열었는지가 권한을 주지 않고, 마지막 사람이 나가면 방도 사라진다.
-- `owner_id` 는 "누가 만들었는지" 기록으로만 남기고 접근 판단에서 뺀다.
--
-- 이 김에 고쳐지는 것이 하나 더 있다. 기존 update 정책이 소유자만 허용해서,
-- 방을 만든 사람이 아니면 장소나 확정 일정을 저장할 수 없었다. 방 안의 결정은
-- 모두가 함께 하는 것이므로 참가자면 고칠 수 있어야 한다.

-- 조회: 참가자만. 나가면 그 즉시 목록에서 사라진다.
drop policy if exists rooms_select_member_or_owner on public.rooms;
drop policy if exists rooms_select_member on public.rooms;

create policy rooms_select_member
on public.rooms
for select to authenticated
using (private.is_room_member(id));

-- 수정: 참가자 누구나. 장소·메뉴·확정 일정은 방 안에서 같이 정한다.
drop policy if exists rooms_update_owner on public.rooms;
drop policy if exists rooms_update_member on public.rooms;

create policy rooms_update_member
on public.rooms
for update to authenticated
using (private.is_room_member(id))
with check (private.is_room_member(id));

-- 삭제: 직접 지우는 경로를 없앤다. 아래 leave_room 이 빈 방만 정리한다.
drop policy if exists rooms_delete_owner on public.rooms;

/*
 * 방 나가기.
 *
 * 참가자에서 빠지고, 남은 사람이 없으면 방을 지운다. 두 단계를 클라이언트에서
 * 나눠 하면 사이에 실패했을 때 아무도 못 보는 방이 남으므로 한 함수로 묶는다.
 * 방 삭제 권한을 클라이언트에 주지 않으려고 security definer 로 두고,
 * 호출자가 그 방의 참가자인지 함수 안에서 확인한다.
 */
create or replace function public.leave_room(target_room uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  remaining integer;
begin
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.rooms where id = target_room) then
    -- 이미 사라진 방이면 나간 것과 결과가 같다
    return 'gone';
  end if;

  if not exists (
    select 1
    from public.participants
    where room_id = target_room
      and profile_id = caller
  ) then
    raise exception 'Not a member of this room' using errcode = '42501';
  end if;

  delete from public.participants
  where room_id = target_room
    and profile_id = caller;

  select count(*) into remaining
  from public.participants
  where room_id = target_room;

  if remaining = 0 then
    delete from public.rooms where id = target_room;
    return 'deleted';
  end if;

  return 'left';
end;
$$;

revoke all on function public.leave_room(uuid) from public, anon;
grant execute on function public.leave_room(uuid) to authenticated;

-- 버그가 남긴 빈 방을 치운다.
--
-- 참가자가 하나도 없는 방은 나가기가 participants 행만 지우던 때 생긴 잔재다.
-- 이제 조회 정책이 참가자만 보게 하므로 아무에게도 보이지 않는다. 지운다.
delete from public.rooms room
where not exists (
  select 1 from public.participants participant
  where participant.room_id = room.id
);
