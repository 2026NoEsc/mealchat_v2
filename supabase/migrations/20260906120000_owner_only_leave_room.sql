-- 방을 없앨 수 있는 사람을 방장으로 좁히고, 정산 중에는 막는다.
--
-- 지금까지 leave_room 은 누구나 부를 수 있었고, 자기 participants 행만 지운 뒤
-- 마지막 사람이 나가야 방이 사라졌다. 그래서 방장이 나가도 방은 남고, 남은
-- 사람들은 단계를 올릴 수 없는 방에 갇혔다 — advance_room_stage 가 방장만
-- 통과시키기 때문이다.
--
-- 이제 나가기는 "방장이 방을 닫는" 행위다. 방장이 아니면 거절하고, 방장이면
-- 방을 통째로 지운다. participants·messages 는 on delete cascade 로 따라 지워진다.
--
-- 정산(settling) 중에는 아무도 못 닫는다. 돈이 오가는 중에 방이 사라지면 누가
-- 얼마를 보내야 하는지 확인할 자리가 없어진다.
--
-- 정산 내역 자체는 남는다. dutch_pay_bills 의 room_id 는 on delete set null 이라
-- 방이 사라져도 기록은 그대로다 — 앱이 "방이 사라져도 정산 내역은 남아 있어요"
-- 라고 안내하는 근거다.

create or replace function public.leave_room(target_room uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  room_owner uuid;
  room_stage text;
begin
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select owner_id, stage into room_owner, room_stage
  from public.rooms
  where id = target_room;

  -- 이미 사라진 방이면 나간 것과 결과가 같다
  if not found then
    return 'gone';
  end if;

  if room_owner is distinct from caller then
    raise exception 'Only the room owner can close this room' using errcode = '42501';
  end if;

  if room_stage = 'settling' then
    raise exception 'Cannot close the room while a settlement is in progress'
      using errcode = '42501';
  end if;

  delete from public.rooms where id = target_room;

  return 'deleted';
end;
$$;

revoke all on function public.leave_room(uuid) from public, anon;
grant execute on function public.leave_room(uuid) to authenticated;
