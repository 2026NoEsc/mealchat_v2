-- 격자에 겹쳐 보여 줄 "다른 사람이 고른 칸".
--
-- room_availability_status 는 제출 여부만 준다. 그런데 시안의 격자는 남이 고른
-- 칸을 회색으로 겹쳐 보여 준다 — 내가 언제를 고를지 정하는 데 그 정보가 필요해서다.
--
-- 누가 골랐는지는 내보내지 않는다. 칸 목록만 주면 "이 시간은 누군가 된다" 까지만
-- 알 수 있고, 특정인의 가능·불가 패턴은 드러나지 않는다.

create or replace function public.room_availability_cells(target_room uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  cells jsonb;
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

  select coalesce(jsonb_agg(distinct slot), '[]'::jsonb)
  into cells
  from public.participants p
  cross join lateral jsonb_array_elements_text(
    coalesce(p.schedule -> 'slots', '[]'::jsonb)
  ) as slot
  where p.room_id = target_room
    /* 내 칸은 빼고 준다 — 앱에서 내 선택은 주황으로 따로 그린다 */
    and p.profile_id is distinct from caller;

  return cells;
end;
$$;

revoke all on function public.room_availability_cells(uuid) from public;
grant execute on function public.room_availability_cells(uuid) to authenticated;

comment on function public.room_availability_cells(uuid) is
  '다른 참가자가 고른 칸 목록. 누가 골랐는지는 내보내지 않는다.';
