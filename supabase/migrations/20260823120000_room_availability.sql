-- 방의 일정 조율을 투표에서 "각자 격자 채우기" 로 옮긴다.
--
-- 예전에는 방장이 올린 후보에 표를 던졌다. 그러면 방장이 놓친 시간은 아예
-- 선택지가 없고, 누가 어느 시간에 표를 던졌는지도 방 전체에 보였다. 각자 자기
-- 가능한 시간을 내면 후보가 자연스럽게 모이고, 화면에는 제출 여부만 보여 줄 수
-- 있다.
--
-- 저장 위치는 이미 있는 participants.schedule (jsonb) 이다. 새 컬럼을 만들지
-- 않는다. 모양은 {"slots": ["2026-08-21-18", ...]} 로, 칸 키는 앱의
-- cellKey(date, hour) 와 같다.

-- participants 에는 UPDATE 정책이 없다(보안 하드닝 때 지워졌고 다시 만들지
-- 않았다). 정책을 여는 대신, 자기 행의 schedule 만 건드리는 함수를 연다.
create or replace function public.set_my_availability(
  target_room uuid,
  slot_keys text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  updated integer;
begin
  if caller is null then
    raise exception 'authentication required';
  end if;

  if array_length(slot_keys, 1) > 500 then
    raise exception 'too many slots';
  end if;

  update public.participants p
  set schedule = jsonb_build_object(
    'slots', to_jsonb(coalesce(slot_keys, '{}'::text[])),
    'submitted_at', to_jsonb(now())
  )
  where p.room_id = target_room
    and p.profile_id = caller;

  get diagnostics updated = row_count;

  if updated = 0 then
    raise exception 'not a room member';
  end if;
end;
$$;

revoke all on function public.set_my_availability(uuid, text[]) from public;
grant execute on function public.set_my_availability(uuid, text[]) to authenticated;

comment on function public.set_my_availability(uuid, text[]) is
  '내 가능한 시간을 방 참가행에 저장한다. 자기 행만 바꾼다.';

-- 현황 조회. 남의 시간표는 내보내지 않고 제출했는지만 준다.
-- 내 행에만 my_slots 를 채워서, 앱이 앞서 낸 답을 격자에 되살릴 수 있게 한다.
create or replace function public.room_availability_status(target_room uuid)
returns table (
  participant_id uuid,
  name text,
  avatar_color text,
  submitted boolean,
  my_slots jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'authentication required';
  end if;

  if not exists (
    select 1
    from public.participants p
    where p.room_id = target_room
      and p.profile_id = caller
  ) then
    raise exception 'not a room member';
  end if;

  return query
  select
    p.id,
    p.name,
    p.avatar_color,
    jsonb_array_length(coalesce(p.schedule -> 'slots', '[]'::jsonb)) > 0,
    case
      when p.profile_id = caller then coalesce(p.schedule -> 'slots', '[]'::jsonb)
      else '[]'::jsonb
    end
  from public.participants p
  where p.room_id = target_room
  order by p.created_at;
end;
$$;

revoke all on function public.room_availability_status(uuid) from public;
grant execute on function public.room_availability_status(uuid) to authenticated;

comment on function public.room_availability_status(uuid) is
  '방 참가자의 일정 제출 여부만 돌려준다. 남의 가능 시간은 내보내지 않는다.';
