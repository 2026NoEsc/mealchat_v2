-- 메뉴·시간 투표.
--
-- 데이터는 baseline 이 이미 갖고 있는 두 컬럼을 쓴다.
--   rooms.voting_items       후보 목록  [{id, kind, label, created_by, created_at}]
--   participants.voted_items 내가 고른 후보 id 배열
--
-- scheduled_time 은 쓰지 않는다. 그 테이블에는 투표자 컬럼이 없어서 (room_id 와
-- slot_type 뿐) 누가 어디에 투표했는지 알 수 없고, 그래서 중복 투표도 취소도
-- 만들 수 없다. 확정된 시간 하나를 적어 두는 용도로 남겨 둔다.
--
-- 후보 추가와 투표는 모두 RPC 로만 한다. rooms 는 owner 만 UPDATE 할 수 있어
-- 참가자가 후보를 못 넣고, participants 를 직접 열어 주면 남의 투표를 고칠 수
-- 있기 때문이다. 함수 안에서 방 참가자인지, 내 참가행인지 확인한다.

create or replace function public.add_voting_item(
  target_room uuid,
  item_kind text,
  item_label text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  label text := btrim(item_label);
  new_id uuid := gen_random_uuid();
  current_items jsonb;
begin
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not private.is_room_member(target_room) then
    raise exception 'Only room members can add options' using errcode = '42501';
  end if;

  if item_kind not in ('menu', 'time') then
    raise exception 'Unknown option kind' using errcode = '22023';
  end if;

  if label = '' then
    raise exception 'Option needs a label' using errcode = '22023';
  end if;

  select voting_items into current_items from public.rooms where id = target_room;

  -- 같은 이름을 두 번 넣으면 표가 갈린다
  if exists (
    select 1 from jsonb_array_elements(coalesce(current_items, '[]'::jsonb)) item
    where item ->> 'kind' = item_kind and lower(item ->> 'label') = lower(label)
  ) then
    raise exception 'That option already exists' using errcode = '23505';
  end if;

  update public.rooms
  set voting_items = coalesce(voting_items, '[]'::jsonb) || jsonb_build_object(
    'id', new_id,
    'kind', item_kind,
    'label', label,
    'created_by', caller,
    'created_at', now()
  )
  where id = target_room;

  return new_id;
end;
$$;

/*
 * 투표를 켜고 끈다. 시간은 여러 개 고를 수 있어야 하고 (가능한 시간대가 여럿이다)
 * 메뉴도 마찬가지라 단순 토글로 둔다. 반환값은 토글 후 상태다.
 */
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

  -- 없는 후보에 표가 쌓이면 화면에서 영영 지울 수 없다
  if not exists (
    select 1
    from public.rooms room, jsonb_array_elements(coalesce(room.voting_items, '[]'::jsonb)) item
    where room.id = target_room and (item ->> 'id')::uuid = item_id
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

revoke all on function public.add_voting_item(uuid, text, text) from public, anon, authenticated;
grant execute on function public.add_voting_item(uuid, text, text) to authenticated;

revoke all on function public.toggle_vote(uuid, uuid) from public, anon, authenticated;
grant execute on function public.toggle_vote(uuid, uuid) to authenticated;
