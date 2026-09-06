-- 정산이 끝난 방은 24시간 뒤에 사라진다.
--
-- 지금까지 expires_at 은 방을 만들 때 한 번 정해지고 끝이라, 정산을 마쳐도
-- 처음 잡아 둔 기한까지 방이 남아 있었다. 헤더의 "OO 후 방이 사라져요" 도
-- 정산과 무관한 숫자를 세고 있었다.
--
-- 정산(done)으로 넘어가는 순간 기한을 now() + 24시간으로 다시 잡는다.
-- settled_at 과 같은 조건에서 함께 움직이므로 둘이 어긋날 일이 없다.

create or replace function public.advance_room_stage(
  target_room uuid,
  next_stage text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  owner uuid;
  current_stage text;
  order_of jsonb := '{"scheduling":0,"place":1,"confirmed":2,"settling":3,"done":4}'::jsonb;
begin
  if caller is null then
    raise exception 'authentication required';
  end if;

  if order_of ? next_stage is not true then
    raise exception 'unknown stage';
  end if;

  select r.owner_id, r.stage into owner, current_stage
  from public.rooms r
  where r.id = target_room;

  if current_stage is null then
    raise exception 'room not found';
  end if;

  if owner is distinct from caller then
    raise exception 'only the room owner can change the stage';
  end if;

  /* 뒤로 되돌리지 않는다 — 정산까지 간 약속을 일정 조율로 돌릴 수는 없다 */
  if (order_of ->> next_stage)::int <= (order_of ->> coalesce(current_stage, 'scheduling'))::int then
    return current_stage;
  end if;

  update public.rooms
  set
    stage = next_stage,
    is_confirmed = (order_of ->> next_stage)::int >= 2,
    settled_at = case when next_stage = 'done' then now() else settled_at end,
    /* 정산을 마친 방만 기한을 다시 잡는다. 그 전 단계는 원래 기한을 지킨다. */
    expires_at = case when next_stage = 'done' then now() + interval '24 hours' else expires_at end
  where id = target_room;

  return next_stage;
end;
$$;

revoke all on function public.advance_room_stage(uuid, text) from public;
grant execute on function public.advance_room_stage(uuid, text) to authenticated;

comment on column public.rooms.expires_at is
  '방이 사라지는 시각. 정산(done)으로 넘어가면 그 시점 + 24시간으로 다시 잡힌다.';
