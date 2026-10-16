-- 메이트가 전부 투표하면 방이 스스로 '확정' 으로 넘어간다.
--
-- 지금까지는 방장이 "약속 확정" 을 눌러야만 넘어갔다. 그런데 단계를 올리는
-- advance_room_stage 는 방장만 통과시키기 때문에, 마지막으로 투표한 사람이
-- 방장이 아니면 앱에서 대신 넘겨 줄 방법이 없었다. 그래서 판단을 서버로 옮긴다.
--
-- toggle_vote 는 security definer 라 호출자가 방장이 아니어도 rooms 를 고칠 수
-- 있다. 투표를 반영한 직후 같은 트랜잭션에서 확인하므로, 마지막 한 표가 들어온
-- 순간 곧바로 확정된다.
--
-- 확정과 함께 이긴 식당을 location_name 에 남긴다. 예전에는 채팅 메시지에만
-- 남아서 방 상세정보와 홈 "다가올 일정" 이 계속 비어 있었다.
--
-- 되돌리지는 않는다. 표를 뺐다고 확정을 취소하면 이미 나간 알림과 어긋난다.

create or replace function public.toggle_vote(target_room uuid, item_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  my_row public.participants%rowtype;
  voted boolean;
  room_stage text;
  total_members int;
  voted_members int;
  winner text;
begin
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select * into my_row
  from public.participants
  where room_id = target_room and profile_id = caller;

  if not found then
    raise exception 'Only room members can vote' using errcode = '42501';
  end if;

  -- 없는 후보에 표가 쌓이면 화면에서 영영 지울 수 없다.
  -- 목록에 uuid 가 아닌 예전 id 가 섞여 있어도 터지지 않도록 text 로 비교한다.
  if not exists (
    select 1
    from public.rooms room, jsonb_array_elements(coalesce(room.voting_items, '[]'::jsonb)) item
    where room.id = target_room and item ->> 'id' = item_id::text
  ) then
    raise exception 'Unknown option' using errcode = 'P0002';
  end if;

  voted := coalesce(my_row.voted_items, '[]'::jsonb) ? item_id::text;

  update public.participants
  set voted_items = case
    when voted then coalesce(voted_items, '[]'::jsonb) - item_id::text
    else coalesce(voted_items, '[]'::jsonb) || to_jsonb(item_id::text)
  end
  where id = my_row.id;

  /* 여기부터가 자동 확정. 식당을 고르는 중인 방만 본다. */
  select stage into room_stage from public.rooms where id = target_room;
  if room_stage is distinct from 'place' then
    return not voted;
  end if;

  select count(*) into total_members
  from public.participants
  where room_id = target_room;

  -- 메뉴 후보 중 하나라도 찍은 사람만 "투표했다" 로 센다
  select count(*) into voted_members
  from public.participants member
  where member.room_id = target_room
    and exists (
      select 1
      from public.rooms room, jsonb_array_elements(coalesce(room.voting_items, '[]'::jsonb)) item
      where room.id = target_room
        and item ->> 'kind' = 'menu'
        and coalesce(member.voted_items, '[]'::jsonb) ? (item ->> 'id')
    );

  if total_members = 0 or voted_members < total_members then
    return not voted;
  end if;

  -- 최다 득표. 같으면 먼저 올라온 후보가 이긴다.
  select item ->> 'label' into winner
  from public.rooms room,
       jsonb_array_elements(coalesce(room.voting_items, '[]'::jsonb)) with ordinality as listed(item, position)
  where room.id = target_room and item ->> 'kind' = 'menu'
  order by (
    select count(*)
    from public.participants member
    where member.room_id = target_room
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
