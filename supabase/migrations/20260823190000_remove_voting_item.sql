-- 투표 후보를 지운다.
--
-- 흐름도의 "식당 후보 삭제". 지금은 한 번 올린 후보를 뺄 수가 없어서, 잘못
-- 적었거나 이미 문 닫은 가게가 목록에 계속 남는다.
--
-- 올린 사람과 방장만 지울 수 있다. 아무나 지우면 남의 후보를 소리 없이 치울 수
-- 있고, 표를 잃은 사람은 왜 사라졌는지도 모른다.
--
-- 후보를 지우면 그 표도 같이 지운다. participants.voted_items 에 사라진 id 가
-- 남아 있으면 득표수가 영영 어긋난다.

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
  target jsonb;
  room_owner uuid;
begin
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not private.is_room_member(target_room) then
    raise exception 'Only room members can remove options' using errcode = '42501';
  end if;

  select r.owner_id into room_owner from public.rooms r where r.id = target_room;

  select item into target
  from public.rooms r
  cross join lateral jsonb_array_elements(coalesce(r.voting_items, '[]'::jsonb)) item
  where r.id = target_room
    and item ->> 'id' = item_id::text;

  if target is null then
    return false;
  end if;

  if (target ->> 'created_by') is distinct from caller::text
     and room_owner is distinct from caller then
    raise exception 'Only the author or the room owner can remove this option'
      using errcode = '42501';
  end if;

  update public.rooms r
  set voting_items = (
    select coalesce(jsonb_agg(item), '[]'::jsonb)
    from jsonb_array_elements(coalesce(r.voting_items, '[]'::jsonb)) item
    where item ->> 'id' <> item_id::text
  )
  where r.id = target_room;

  /* 사라진 후보에 던진 표를 걷어낸다 — 남겨 두면 득표수가 어긋난다 */
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

revoke all on function public.remove_voting_item(uuid, uuid) from public, anon;
grant execute on function public.remove_voting_item(uuid, uuid) to authenticated;

comment on function public.remove_voting_item(uuid, uuid) is
  '투표 후보를 지운다. 올린 사람이나 방장만 가능하고, 그 후보에 던진 표도 함께 지운다.';
