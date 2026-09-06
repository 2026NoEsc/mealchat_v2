-- 최신 후속 마이그레이션이 이전 하드닝 함수의 잠금과 확정 경계를 덮어쓰지
-- 않도록, 현재 앱이 호출하는 RPC를 마지막 상태에서 다시 고정한다.
--
-- 모든 함수는 같은 방 UUID를 advisory transaction lock의 키로 먼저 잡는다.
-- 그 다음 rooms 행, 필요하면 participants 행을 잠근다. 초대·정산·투표·퇴장
-- 경로가 같은 순서를 쓰므로 마지막 표/후보 삭제/방 삭제가 서로 교차하지 않는다.

create or replace function public.remove_voting_item(
  target_room uuid,
  item_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  room public.rooms%rowtype;
  target jsonb;
begin
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_room::text, 0)
  );

  select * into room
  from public.rooms
  where id = target_room
  for update;

  if not found then
    return false;
  end if;

  if not private.is_room_member(target_room) then
    raise exception 'Only room members can remove options' using errcode = '42501';
  end if;

  if room.stage = 'confirmed' or room.is_confirmed then
    raise exception 'Cannot change options after confirmation' using errcode = '42501';
  end if;

  select item into target
  from jsonb_array_elements(coalesce(room.voting_items, '[]'::jsonb)) item
  where item ->> 'id' = item_id::text;

  if target is null then
    return false;
  end if;

  if (target ->> 'created_by') is distinct from caller::text
     and room.owner_id is distinct from caller then
    raise exception 'Only the author or the room owner can remove this option'
      using errcode = '42501';
  end if;

  update public.rooms
  set voting_items = (
    select coalesce(jsonb_agg(item), '[]'::jsonb)
    from jsonb_array_elements(coalesce(room.voting_items, '[]'::jsonb)) item
    where item ->> 'id' <> item_id::text
  )
  where id = target_room;

  update public.participants p
  set voted_items = (
    select coalesce(jsonb_agg(voted), '[]'::jsonb)
    from jsonb_array_elements_text(coalesce(p.voted_items, '[]'::jsonb)) voted
    where voted <> item_id::text
  )
  where p.room_id = target_room;

  return true;
end;
$$;

revoke all on function public.remove_voting_item(uuid, uuid) from public, anon, authenticated;
grant execute on function public.remove_voting_item(uuid, uuid) to authenticated;

comment on function public.remove_voting_item(uuid, uuid) is
  '방 잠금 아래에서 후보와 해당 표를 함께 지운다. 작성자 또는 방장만 가능하다.';

create or replace function public.toggle_vote(target_room uuid, item_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  room public.rooms%rowtype;
  my_row public.participants%rowtype;
  selected_kind text;
  voted boolean;
  total_members integer;
  voted_members integer;
  winner text;
begin
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_room::text, 0)
  );

  select * into room
  from public.rooms
  where id = target_room
  for update;

  if not found then
    raise exception 'Room no longer exists' using errcode = 'P0002';
  end if;

  select * into my_row
  from public.participants
  where room_id = target_room
    and profile_id = caller
  for update;

  if not found then
    raise exception 'Only room members can vote' using errcode = '42501';
  end if;

  if room.stage = 'confirmed' or room.is_confirmed then
    raise exception 'Voting is already confirmed' using errcode = '42501';
  end if;

  select item ->> 'kind' into selected_kind
  from jsonb_array_elements(coalesce(room.voting_items, '[]'::jsonb)) item
  where item ->> 'id' = item_id::text
  limit 1;

  if selected_kind is null or selected_kind not in ('menu', 'time') then
    raise exception 'Unknown option' using errcode = 'P0002';
  end if;

  voted := coalesce(my_row.voted_items, '[]'::jsonb) ? item_id::text;

  update public.participants
  set voted_items = case
    when voted then coalesce(voted_items, '[]'::jsonb) - item_id::text
    else coalesce(voted_items, '[]'::jsonb) || to_jsonb(item_id::text)
  end
  where id = my_row.id;

  -- 메뉴 단계에서는 마지막 참가자의 표가 들어온 같은 트랜잭션 안에서
  -- 최다 득표 후보를 확정한다. NULL profile_id인 레거시 표시 행은 정족수에서
  -- 제외해 실제 사용자 수와 서버 판단을 일치시킨다.
  if room.stage is distinct from 'place' then
    return not voted;
  end if;

  select count(*) into total_members
  from public.participants
  where room_id = target_room
    and profile_id is not null;

  select count(*) into voted_members
  from public.participants member
  where member.room_id = target_room
    and member.profile_id is not null
    and exists (
      select 1
      from jsonb_array_elements(coalesce(room.voting_items, '[]'::jsonb)) item
      where item ->> 'kind' = 'menu'
        and coalesce(member.voted_items, '[]'::jsonb) ? (item ->> 'id')
    );

  if total_members = 0 or voted_members < total_members then
    return not voted;
  end if;

  select item ->> 'label' into winner
  from jsonb_array_elements(coalesce(room.voting_items, '[]'::jsonb))
       with ordinality as listed(item, position)
  where item ->> 'kind' = 'menu'
  order by (
    select count(*)
    from public.participants member
    where member.room_id = target_room
      and member.profile_id is not null
      and coalesce(member.voted_items, '[]'::jsonb) ? (item ->> 'id')
  ) desc, listed.position asc
  limit 1;

  update public.rooms
  set
    stage = 'confirmed',
    is_confirmed = true,
    location_name = coalesce(winner, location_name)
  where id = target_room;

  return not voted;
end;
$$;

revoke all on function public.toggle_vote(uuid, uuid) from public, anon, authenticated;
grant execute on function public.toggle_vote(uuid, uuid) to authenticated;

create or replace function public.leave_room(target_room uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  room public.rooms%rowtype;
begin
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_room::text, 0)
  );

  select * into room
  from public.rooms
  where id = target_room
  for update;

  if not found then
    return 'gone';
  end if;

  if room.owner_id is distinct from caller then
    raise exception 'Only the room owner can close this room' using errcode = '42501';
  end if;

  if room.stage = 'settling' then
    raise exception 'Cannot close the room while a settlement is in progress'
      using errcode = '42501';
  end if;

  delete from public.rooms where id = target_room;
  return 'deleted';
end;
$$;

revoke all on function public.leave_room(uuid) from public, anon, authenticated;
grant execute on function public.leave_room(uuid) to authenticated;

comment on function public.leave_room(uuid) is
  '방 잠금 아래에서 정산 중이 아닌 방을 방장만 닫는다.';
