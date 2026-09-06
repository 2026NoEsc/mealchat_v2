-- 방에 "약속 단계" 를 둔다.
--
-- 지금은 모든 시트가 항상 열려 있어서, 정산이 끝난 방에서도 일정 조율이 열리고
-- 식당을 다시 고를 수 있다. 약속은 실제로 순서가 있는 일이라 — 식당을 정하고,
-- 확정하고, 정산한다 — 그 순서를 방이 들고 있어야 화면이 갈린다.
--
-- 기존 is_confirmed 는 그대로 둔다. 목록 화면이 쓰고 있고, 단계와 뜻이 겹치지만
-- 한 번에 걷어내면 그 화면들이 같이 무너진다. 단계가 자리잡은 뒤에 정리한다.

alter table public.rooms
  add column if not exists stage text not null default 'place';

alter table public.rooms
  drop constraint if exists rooms_stage_check;

alter table public.rooms
  add constraint rooms_stage_check
  check (stage in ('place', 'confirmed', 'settling', 'done'));

comment on column public.rooms.stage is
  '약속 단계: place(식당 결정) → confirmed(확정) → settling(정산) → done(완료)';

-- 정산이 언제 끝났는지. 흐름도의 "정산 완결 시간 저장" 에 해당한다.
alter table public.rooms
  add column if not exists settled_at timestamptz;

/*
 * 단계는 아무나 되돌릴 수 없다.
 *
 * rooms 의 update 정책은 참가자면 통과시키므로, 컬럼을 그냥 열어 두면 누구나
 * 정산 끝난 방을 식당 결정으로 되돌릴 수 있다. 방장만, 그리고 앞으로만 간다.
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
  order_of jsonb := '{"place":0,"confirmed":1,"settling":2,"done":3}'::jsonb;
begin
  if caller is null then
    raise exception 'authentication required';
  end if;

  if next_stage not in ('place', 'confirmed', 'settling', 'done') then
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

  /* 뒤로 되돌리지 않는다 — 정산까지 간 약속을 식당 고르기로 돌릴 수는 없다 */
  if (order_of ->> next_stage)::int <= (order_of ->> current_stage)::int then
    return current_stage;
  end if;

  update public.rooms
  set
    stage = next_stage,
    is_confirmed = next_stage <> 'place',
    settled_at = case when next_stage = 'done' then now() else settled_at end
  where id = target_room;

  return next_stage;
end;
$$;

revoke all on function public.advance_room_stage(uuid, text) from public;
grant execute on function public.advance_room_stage(uuid, text) to authenticated;

comment on function public.advance_room_stage(uuid, text) is
  '방장만 약속 단계를 다음으로 넘긴다. 되돌리지 않는다.';
