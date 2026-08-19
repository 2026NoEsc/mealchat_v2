-- 투표가 방 전체에서 막히던 것을 고친다.
--
-- toggle_vote 는 후보가 실제로 있는지 확인하려고 voting_items 의 모든 항목을
-- `(item ->> 'id')::uuid` 로 캐스팅했다. 운영 데이터에는 지금 스키마 이전에 들어간
-- 항목이 남아 있고, 그 id 는 uuid 가 아니다.
--
--   {"id": "b2", "name": "허니콤보 치킨 🍗", "category": "치킨", ...}   ← 예전 모양
--   {"id": "9da6999a-…", "kind": "menu", "label": "칼국수", ...}        ← 지금 모양
--
-- 캐스팅이 행 하나만 건드리는 게 아니라 목록 전체를 훑기 때문에, 예전 항목이 하나만
-- 섞여 있어도 22P02 (invalid input syntax for type uuid: "b2") 로 함수가 통째로
-- 실패했다. 정상적인 uuid 를 보내도 마찬가지다. 그 방에서는 아무도 투표할 수 없다.
--
-- 클라이언트는 예전 항목을 걸러서 보여 주지 않으므로 (label·kind 가 없다) 화면에는
-- 정상 후보만 뜬다. 그래서 증상이 "눌러도 표가 안 올라간다" 로만 보였다. 게다가
-- react-native-web 에서는 Alert 이 동작하지 않아 실패 메시지조차 뜨지 않는다.
--
-- 고치는 방법은 캐스팅하지 않는 것이다. id 를 text 로 비교하면 예전 항목은 그냥
-- 일치하지 않고 지나간다. 예전 항목을 지우는 것은 데이터 정리라 별도로 판단한다.

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

  return not voted;
end;
$$;

revoke all on function public.toggle_vote(uuid, uuid) from public, anon, authenticated;
grant execute on function public.toggle_vote(uuid, uuid) to authenticated;
