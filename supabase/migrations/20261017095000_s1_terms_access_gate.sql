-- S1 M6: closed until M7; all data APIs require the current exact bundle.
begin;
create policy app_terms_gate_profiles on public.profiles as restrictive for all to authenticated using((select private.has_current_terms_consent())) with check((select private.has_current_terms_consent()));
create policy app_terms_gate_public_profiles on public.public_profiles as restrictive for all to authenticated using((select private.has_current_terms_consent())) with check((select private.has_current_terms_consent()));
create policy app_terms_gate_profile_private on public.profile_private as restrictive for all to authenticated using((select private.has_current_terms_consent())) with check((select private.has_current_terms_consent()));
create policy app_terms_gate_profile_food_preferences on public.profile_food_preferences as restrictive for all to authenticated using((select private.has_current_terms_consent())) with check((select private.has_current_terms_consent()));
create policy app_terms_gate_profile_health_preferences on public.profile_health_preferences as restrictive for all to authenticated using((select private.has_current_terms_consent())) with check((select private.has_current_terms_consent()));
create policy app_terms_gate_health_code_catalog on public.health_code_catalog as restrictive for all to authenticated using((select private.has_current_terms_consent())) with check((select private.has_current_terms_consent()));
create policy app_terms_gate_rooms on public.rooms as restrictive for all to authenticated using((select private.has_current_terms_consent())) with check((select private.has_current_terms_consent()));
create policy app_terms_gate_participants on public.participants as restrictive for all to authenticated using((select private.has_current_terms_consent())) with check((select private.has_current_terms_consent()));
create policy app_terms_gate_messages on public.messages as restrictive for all to authenticated using((select private.has_current_terms_consent())) with check((select private.has_current_terms_consent()));
create policy app_terms_gate_follows on public.follows as restrictive for all to authenticated using((select private.has_current_terms_consent())) with check((select private.has_current_terms_consent()));
create policy app_terms_gate_calendar_notes on public.calendar_notes as restrictive for all to authenticated using((select private.has_current_terms_consent())) with check((select private.has_current_terms_consent()));
create policy app_terms_gate_dutch_pay_bills on public.dutch_pay_bills as restrictive for all to authenticated using((select private.has_current_terms_consent())) with check((select private.has_current_terms_consent()));
create policy app_terms_gate_dutch_pay_members on public.dutch_pay_members as restrictive for all to authenticated using((select private.has_current_terms_consent())) with check((select private.has_current_terms_consent()));
create policy app_terms_gate_notifications on public.notifications as restrictive for all to authenticated using((select private.has_current_terms_consent())) with check((select private.has_current_terms_consent()));
create policy app_terms_gate_scheduled_time on public.scheduled_time as restrictive for all to authenticated using((select private.has_current_terms_consent())) with check((select private.has_current_terms_consent()));
create policy app_terms_gate_room_invitations on public.room_invitations as restrictive for all to authenticated using((select private.has_current_terms_consent())) with check((select private.has_current_terms_consent()));
create policy s1_avatar_gate on storage.objects as restrictive for all to authenticated using((select private.has_current_terms_consent())) with check((select private.has_current_terms_consent()));
create or replace function public.join_room_by_code(room_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target public.rooms%rowtype;
begin
  perform private.require_current_terms_consent();
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select * into target
  from public.rooms
  where code = btrim(room_code);

  if not found then
    raise exception 'Invalid invite code' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target.id::text, 0)
  );
  perform private.require_current_terms_consent();

  -- 잠금 대기 중 방이 삭제되었거나 만료된 경우를 다시 확인한다.
  select * into target
  from public.rooms
  where id = target.id
  for update;
  if not found or target.expires_at <= clock_timestamp() then
    perform private.require_current_terms_consent();
    raise exception 'This invite has expired' using errcode = 'P0002';
  end if;
  perform private.require_current_terms_consent();

  perform private.participant_snapshot(target.id, caller);
  return target.id;
end;
$$;

create or replace function public.create_room_invitation(
  target_room uuid,
  invitee_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target public.rooms%rowtype;
  existing_invitation uuid;
  new_invitation uuid;
begin
  perform private.require_current_terms_consent();
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if $2 = caller then
    raise exception 'You cannot invite yourself' using errcode = '22023';
  end if;

  -- 생성·수락·코드 참가·퇴장과 모두 같은 방 잠금을 쓴다. 대상자별 잠금을
  -- 따로 잡으면 create/accept가 반대 순서로 잠길 수 있으므로 사용하지 않는다.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_room::text, 0)
  );
  perform private.require_current_terms_consent();

  -- advisory lock 아래에서 방·만료·멤버십·대상 참가 상태·pending을 다시
  -- 검사한다. 수락이나 퇴장과 경쟁해도 즉시 참가 초대로 바뀌지 않는다.
  if not private.is_room_member(target_room) then
    raise exception 'Only room members can invite' using errcode = '42501';
  end if;

  select * into target
  from public.rooms
  where id = target_room
  for update;
  if not found then
    perform private.require_current_terms_consent();
    raise exception 'Room no longer exists' using errcode = 'P0002';
  end if;
  perform private.require_current_terms_consent();

  if target.expires_at <= clock_timestamp() then
    raise exception 'This invite has expired' using errcode = 'P0002';
  end if;

  -- 기존 제품의 메이트 관계 범위는 유지한다. 관계 없는 임의 계정 초대는 허용하지 않는다.
  if not exists (
    select 1
    from public.follows follow
    where follow.follower_id = caller
      and follow.following_id = $2
  ) then
    raise exception 'You can only invite your mates' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = $2) then
    raise exception 'That profile no longer exists' using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.participants participant
    where participant.room_id = target_room
    and participant.profile_id = $2
  ) then
    raise exception 'That person is already in this room' using errcode = '23505';
  end if;

  update public.room_invitations invitation
  set status = 'expired', responded_at = coalesce(invitation.responded_at, clock_timestamp())
  where invitation.room_id = target_room
    and invitation.invitee_id = $2
    and invitation.status = 'pending'
    and invitation.expires_at <= clock_timestamp();

  select invitation.id into existing_invitation
  from public.room_invitations invitation
  where invitation.room_id = target_room
    and invitation.invitee_id = $2
    and invitation.status = 'pending'
    and invitation.expires_at > clock_timestamp();

  if existing_invitation is not null then
    -- 같은 요청의 재시도는 기존 pending 초대를 돌려줘서 중복을 만들지 않는다.
    return existing_invitation;
  end if;

  insert into public.room_invitations (
    room_id, inviter_id, invitee_id, room_title, status, expires_at
  )
  values (
    target_room, caller, $2, target.title, 'pending', target.expires_at
  )
  returning id into new_invitation;

  return new_invitation;
end;
$$;

create or replace function public.accept_room_invitation(target_invitation uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  invitation public.room_invitations%rowtype;
  target public.rooms%rowtype;
begin
  perform private.require_current_terms_consent();
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select * into invitation
  from public.room_invitations
  where id = target_invitation;

  if not found then
    raise exception 'Invitation no longer exists' using errcode = 'P0002';
  end if;

  -- 첫 조회는 advisory key만 얻기 위한 비잠금 조회다. 그 전에 대상자 일치를
  -- 확인해 UUID를 아는 제3자가 방 잠금이나 만료 상태를 관측·변경하지 못하게 한다.
  if invitation.invitee_id <> caller then
    raise exception 'Only the invited person can accept this invitation' using errcode = '42501';
  end if;

  -- join/leave/create settlement와 같은 방 잠금을 먼저 잡고, 그 뒤 초대 행을 잠근다.
  -- 이 순서로 pending 재초대와 수락이 서로 반대 순서의 잠금을 기다리지 않는다.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(invitation.room_id::text, 0)
  );
  perform private.require_current_terms_consent();

  select * into invitation
  from public.room_invitations
  where id = target_invitation
  for update;
  if not found then
    perform private.require_current_terms_consent();
    raise exception 'Invitation no longer exists' using errcode = 'P0002';
  end if;
  perform private.require_current_terms_consent();

  if invitation.invitee_id <> caller then
    raise exception 'Only the invited person can accept this invitation' using errcode = '42501';
  end if;

  -- 두 번 눌러도 한 번만 참가행을 만든다. 첫 수락의 결과를 그대로 돌려준다.
  if invitation.status = 'accepted' then
    return invitation.room_id;
  end if;

  if invitation.status <> 'pending' then
    return null;
  end if;

  select * into target
  from public.rooms
  where id = invitation.room_id
  for update;
  if not found or target.expires_at <= clock_timestamp() then
    perform private.require_current_terms_consent();
    update public.room_invitations
    set status = 'expired', responded_at = coalesce(responded_at, clock_timestamp())
    where id = invitation.id
      and status = 'pending';
    return null;
  end if;
  perform private.require_current_terms_consent();

  if invitation.expires_at <= clock_timestamp() then
    update public.room_invitations
    set status = 'expired', responded_at = coalesce(responded_at, clock_timestamp())
    where id = invitation.id;
    return null;
  end if;

  -- 수락 전에는 participants 행이 없으므로 rooms/messages/participants RLS가 모두 닫힌다.
  -- snapshot 은 프로필 표시값을 서버에서 읽고 UNIQUE 제약으로 중복 행을 막는다.
  perform private.participant_snapshot(invitation.room_id, caller);

  update public.room_invitations
  set status = 'accepted', responded_at = clock_timestamp()
  where id = invitation.id;

  return invitation.room_id;
end;
$$;

create or replace function public.decline_room_invitation(target_invitation uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  invitation public.room_invitations%rowtype;
begin
  perform private.require_current_terms_consent();
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select * into invitation
  from public.room_invitations
  where id = target_invitation
  for update;
  if not found then
    perform private.require_current_terms_consent();
    raise exception 'Invitation no longer exists' using errcode = 'P0002';
  end if;
  perform private.require_current_terms_consent();

  if invitation.invitee_id <> caller then
    raise exception 'Only the invited person can decline this invitation' using errcode = '42501';
  end if;

  if invitation.status <> 'pending' then
    return invitation.status;
  end if;

  if invitation.expires_at <= clock_timestamp() then
    update public.room_invitations
    set status = 'expired', responded_at = coalesce(responded_at, clock_timestamp())
    where id = invitation.id;
    return 'expired';
  end if;

  update public.room_invitations
  set status = 'declined', responded_at = clock_timestamp()
  where id = invitation.id;

  return 'declined';
end;
$$;

-- invite_friend_to_room is closed by the independent 085900 migration.

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
  perform private.require_current_terms_consent();
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_room::text, 0)
  );
  perform private.require_current_terms_consent();

  select * into room
  from public.rooms
  where id = target_room
  for update;
  if not found then
    perform private.require_current_terms_consent();
    return 'gone';
  end if;
  perform private.require_current_terms_consent();

  if room.owner_id is distinct from caller then
    raise exception 'Only the room owner can close this room' using errcode = '42501';
  end if;

  -- stage는 과거 앱이 마음대로 바꿀 수 있었고 정산과 완전히 동기화되지 않는다.
  -- 같은 room advisory lock을 쓰는 정산 완료 RPC와 직렬화한 뒤, 실제 snapshot
  -- 수취인 중 미완료자가 한 명이라도 있으면 방을 지우지 않는다.
  if exists (
    select 1
    from public.dutch_pay_bills bill
    join public.dutch_pay_members member on member.bill_id = bill.id
    where bill.room_id = target_room
      and member.is_completed is not true
  ) then
    raise exception 'Cannot close the room while a settlement recipient is incomplete'
      using errcode = '42501';
  end if;

  delete from public.rooms where id = target_room;
  return 'deleted';
end;
$$;

create or replace function public.create_room_settlement(
  target_room uuid,
  bill_title text,
  amount integer,
  bank_name text default '',
  account_number text default '',
  account_holder text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_current_terms_consent();
  if (select auth.uid()) is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  return private.create_room_settlement_impl(
    target_room, bill_title, amount, bank_name, account_number, account_holder, false
  );
end;
$$;

create or replace function public.create_room_settlement_v2(
  target_room uuid,
  bill_title text,
  amount integer,
  bank_name text default '',
  account_number text default '',
  account_holder text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_current_terms_consent();
  if (select auth.uid()) is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  return private.create_room_settlement_impl(
    target_room, bill_title, amount, bank_name, account_number, account_holder, true
  );
end;
$$;

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
  room public.rooms%rowtype;
  label text := btrim(item_label);
  new_id uuid := gen_random_uuid();
begin
  perform private.require_current_terms_consent();
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if item_kind is null or item_kind not in ('menu', 'time') then
    raise exception 'Unknown option kind' using errcode = '22023';
  end if;

  if label is null or label = '' then
    raise exception 'Option needs a label' using errcode = '22023';
  end if;

  if char_length(label) > 120 then
    raise exception 'Option label is too long' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_room::text, 0)
  );
  perform private.require_current_terms_consent();

  select * into room
  from public.rooms
  where id = target_room
  for update;
  if not found then
    perform private.require_current_terms_consent();
    raise exception 'Room no longer exists' using errcode = 'P0002';
  end if;
  perform private.require_current_terms_consent();

  if not private.is_room_member(target_room) then
    raise exception 'Only room members can add options' using errcode = '42501';
  end if;

  if item_kind = 'time' and (
    room.is_confirmed or room.confirmed_time_item_id is not null
  ) then
    raise exception 'A time vote has already been confirmed' using errcode = '42501';
  end if;

  if item_kind = 'menu' and room.confirmed_menu_item_id is not null then
    raise exception 'A menu vote has already been confirmed' using errcode = '42501';
  end if;

  -- voting_items는 rooms 한 행의 jsonb라 참가자가 무제한 후보를 넣어 행을
  -- 비대하게 만들 수 없다. 종류별 상한은 menu/time 모두 같은 제품 한도다.
  if (
    select count(*)
    from jsonb_array_elements(coalesce(room.voting_items, '[]'::jsonb)) item
    where item ->> 'kind' = item_kind
  ) >= 30 then
    raise exception 'Too many options of this kind' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(room.voting_items, '[]'::jsonb)) item
    where item ->> 'kind' = item_kind
      and lower(item ->> 'label') = lower(label)
  ) then
    raise exception 'That option already exists' using errcode = '23505';
  end if;

  update public.rooms
  set voting_items = coalesce(voting_items, '[]'::jsonb) || jsonb_build_object(
    'id', new_id,
    'kind', item_kind,
    'label', label,
    'created_by', caller,
    'created_at', clock_timestamp()
  )
  where id = target_room;

  return new_id;
end;
$$;

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
  perform private.require_current_terms_consent();
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_room::text, 0)
  );
  perform private.require_current_terms_consent();

  select * into room
  from public.rooms
  where id = target_room
  for update;
  if not found then
    perform private.require_current_terms_consent();
    return false;
  end if;
  perform private.require_current_terms_consent();

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
  perform private.require_current_terms_consent();
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_room::text, 0)
  );
  perform private.require_current_terms_consent();

  select * into room
  from public.rooms
  where id = target_room
  for update;
  if not found then
    perform private.require_current_terms_consent();
    raise exception 'Room no longer exists' using errcode = 'P0002';
  end if;
  perform private.require_current_terms_consent();

  select * into my_row
  from public.participants
  where room_id = target_room
    and profile_id = caller
  for update;
  if not found then
    perform private.require_current_terms_consent();
    raise exception 'Only room members can vote' using errcode = '42501';
  end if;
  perform private.require_current_terms_consent();

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

create or replace function public.confirm_room_vote(
  target_room uuid,
  item_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  room public.rooms%rowtype;
  item_kind text;
  item_label text;
  leading_item_id text;
  leading_vote_count integer;
  member_count integer;
begin
  perform private.require_current_terms_consent();
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_room::text, 0)
  );
  perform private.require_current_terms_consent();

  if not private.is_room_member(target_room) then
    raise exception 'Only room members can confirm a vote' using errcode = '42501';
  end if;

  select * into room
  from public.rooms
  where id = target_room
  for update;
  if not found then
    perform private.require_current_terms_consent();
    raise exception 'Room no longer exists' using errcode = 'P0002';
  end if;
  perform private.require_current_terms_consent();

  select item ->> 'kind', nullif(btrim(item ->> 'label'), '')
  into item_kind, item_label
  from jsonb_array_elements(coalesce(room.voting_items, '[]'::jsonb)) item
  where item ->> 'id' = item_id::text
  limit 1;

  if item_kind is null or item_kind not in ('menu', 'time') or item_label is null then
    raise exception 'Unknown option' using errcode = 'P0002';
  end if;

  -- 확정은 종류별로 한 번만 가능하다. 같은 item의 재호출은 idempotent하고,
  -- 다른 item으로 덮어쓰는 것은 허용하지 않는다.
  if item_kind = 'time' then
    if room.confirmed_time_item_id is not null then
      if room.confirmed_time_item_id = item_id then
        return;
      end if;
      raise exception 'A time vote has already been confirmed' using errcode = '42501';
    end if;

    -- 추천 단계에서 이미 확정된 시간은 voting item id가 없으므로 재확정하지 않는다.
    if room.is_confirmed then
      raise exception 'This room already has a confirmed time' using errcode = '42501';
    end if;
  else
    if room.confirmed_menu_item_id is not null then
      if room.confirmed_menu_item_id = item_id then
        return;
      end if;
      raise exception 'A menu vote has already been confirmed' using errcode = '42501';
    end if;
  end if;

  -- 클라이언트가 보낸 leader를 신뢰하지 않는다. 같은 advisory+room row lock
  -- 구간에서 실제 투표 가능한 참가자 수와 kind별 득표수를 계산한다. 동률이면
  -- voting_items 배열의 앞선 항목을 고른다.
  select count(*)::integer into member_count
  from public.participants participant
  where participant.room_id = target_room
    and participant.profile_id is not null;

  select candidate.id, candidate.vote_count
  into leading_item_id, leading_vote_count
  from (
    select
      item ->> 'id' as id,
      ordinality,
      (
        select count(*)::integer
        from public.participants participant
        where participant.room_id = target_room
          and participant.profile_id is not null
          and coalesce(participant.voted_items, '[]'::jsonb) ? (item ->> 'id')
      ) as vote_count
    from jsonb_array_elements(coalesce(room.voting_items, '[]'::jsonb))
      with ordinality as candidate_item(item, ordinality)
    where item ->> 'kind' = item_kind
  ) candidate
  order by candidate.vote_count desc, candidate.ordinality asc
  limit 1;

  if leading_item_id is null or coalesce(leading_vote_count, 0) = 0 then
    raise exception 'A vote is required before confirmation' using errcode = '22023';
  end if;

  -- 방 인원의 strict majority가 아니면 최다 득표여도 확정할 수 없다.
  -- 1명 방은 1표, 2명 방은 2표, 3명 방은 2표가 필요하다.
  if leading_vote_count <= member_count / 2 then
    raise exception 'A strict majority is required before confirmation' using errcode = '22023';
  end if;

  if leading_item_id <> item_id::text then
    raise exception 'Only the leading vote option can be confirmed' using errcode = '22023';
  end if;

  if item_kind = 'time' then
    update public.rooms
    set confirmed_slot = item_label,
        is_confirmed = true,
        confirmed_time_item_id = item_id
    where id = target_room;

    insert into public.messages (
      room_id, sender_id, sender_name, sender_color, message, kind, event_key
    )
    values (
      target_room,
      null,
      '밀챗',
      '#FF9900',
      format('일정을 %s로 확정했어요', item_label),
      'system',
      format('vote-confirmed:%s:time:%s', target_room, item_id)
    )
    on conflict do nothing;
  else
    update public.rooms
    set confirmed_menu = item_label,
        confirmed_menu_at = clock_timestamp(),
        confirmed_menu_item_id = item_id
    where id = target_room;

    insert into public.messages (
      room_id, sender_id, sender_name, sender_color, message, kind, event_key
    )
    values (
      target_room,
      null,
      '밀챗',
      '#FF9900',
      format('오늘 메뉴를 %s로 확정했어요', item_label),
      'system',
      format('vote-confirmed:%s:menu:%s', target_room, item_id)
    )
    on conflict do nothing;
  end if;
end;
$$;

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
  perform private.require_current_terms_consent();
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
    settled_at = case when next_stage = 'done' then clock_timestamp() else settled_at end,
    /* 정산을 마친 방만 기한을 다시 잡는다. 그 전 단계는 원래 기한을 지킨다. */
    expires_at = case when next_stage = 'done' then clock_timestamp() + interval '24 hours' else expires_at end
  where id = target_room;

  return next_stage;
end;
$$;

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
  perform private.require_current_terms_consent();
  if caller is null then
    raise exception 'authentication required';
  end if;

  if array_length(slot_keys, 1) > 500 then
    raise exception 'too many slots';
  end if;

  update public.participants p
  set schedule = jsonb_build_object(
    'slots', to_jsonb(coalesce(slot_keys, '{}'::text[])),
    'submitted_at', to_jsonb(clock_timestamp())
  )
  where p.room_id = target_room
    and p.profile_id = caller;

  get diagnostics updated = row_count;

  if updated = 0 then
    raise exception 'not a room member';
  end if;
end;
$$;

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
  perform private.require_current_terms_consent();
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
  perform private.require_current_terms_consent();
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

create or replace function public.post_room_system_message(target_room uuid, body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  trimmed text := btrim(body);
  new_id uuid;
begin
  perform private.require_current_terms_consent();
  if (select auth.uid()) is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not private.is_room_member(target_room) then
    raise exception 'Only room members can post here' using errcode = '42501';
  end if;

  if trimmed = '' then
    raise exception 'Message must not be empty' using errcode = '22023';
  end if;

  insert into public.messages (room_id, sender_id, sender_name, sender_color, message, kind)
  values (target_room, null, '밀챗', '#FF9900', trimmed, 'system')
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.delete_expired_rooms()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed int;
begin
  perform private.require_current_terms_consent();
  with gone as (
    delete from public.rooms
    where expires_at < clock_timestamp()
    returning 1
  )
  select count(*) into removed from gone;

  return removed;
end;
$$;
create or replace function public.record_terms_consent(marketing_opt_in boolean default false) returns text language plpgsql security definer set search_path='' as $$
begin raise exception 'CLIENT_UPDATE_REQUIRED' using errcode='S1008'; end; $$;
create or replace function public.current_terms_consent_status() returns table(version text,agreed boolean) language plpgsql security definer set search_path='' as $$
declare b public.terms_versions%rowtype; begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 b:=private.s1_current_bundle(); return query select b.version,private.has_current_terms_consent();
end; $$;
-- Trigger functions are not Data API endpoints.
revoke all on function public.mark_room_settling(),public.settle_room_when_all_paid() from public,anon,authenticated,service_role;
commit;
