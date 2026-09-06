-- 방을 "일정 조율" 단계에서 시작하게 한다.
--
-- 메이트의 가능한 시간은 방을 만든 뒤에야 모을 수 있다. 초대도, 참가행도,
-- participants.schedule 도 전부 방에 매달려 있기 때문이다. 그래서 일정 추가
-- STEP 1 에서 방을 먼저 만들고, STEP 2 는 그 방의 조율 화면이 된다.
--
-- 조율이 끝나고 일정을 확정하면 그때 '식당 결정'(place) 으로 넘어간다.
-- 단계 순서: scheduling → place → confirmed → settling → done

alter table public.rooms
  drop constraint if exists rooms_stage_check;

alter table public.rooms
  add constraint rooms_stage_check
  check (stage in ('scheduling', 'place', 'confirmed', 'settling', 'done'));

alter table public.rooms
  alter column stage set default 'scheduling';

comment on column public.rooms.stage is
  '약속 단계: scheduling(일정 조율) → place(식당 결정) → confirmed(확정) → settling(정산) → done(완료)';

/*
 * 단계 순서를 새로 심는다. 앞선 함수는 scheduling 을 모르기 때문에, 그대로
 * 두면 새 방이 다음 단계로 넘어가지 못한다.
 *
 * is_confirmed 는 '확정' 부터 켠다 — 조율 중이거나 식당을 고르는 중인 방을
 * 목록에서 "확정" 으로 보여 주면 안 된다.
 */
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
    settled_at = case when next_stage = 'done' then now() else settled_at end
  where id = target_room;

  return next_stage;
end;
$$;

revoke all on function public.advance_room_stage(uuid, text) from public;
grant execute on function public.advance_room_stage(uuid, text) to authenticated;
