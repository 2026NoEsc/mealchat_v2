-- 정산·초대와 방 안의 상태 변경을 다시 좁힌다.
--
-- Additive phase: 새 클라이언트가 수락형 초대·전용 완료 RPC·투표 확정을 호출할 수
-- 있게 먼저 추가한다. 구버전 앱의 강제 초대/직접 완료/일반 system message 경로를
-- 닫는 권한 철회는 20260823091028_rpc_hardening_cutover.sql 에서 최소 버전 적용 뒤
-- 수행한다. 적용 전에는 두 실제 계정으로 초대 수락·정산·투표 확정의 RLS 및 동시성
-- 검증을 수행해야 한다.
--
-- 공통 원칙:
--   * SECURITY DEFINER 함수는 auth.uid()를 직접 확인하고 search_path 를 고정한다.
--   * PUBLIC/anon 에는 실행 권한을 남기지 않는다.
--   * 채팅의 system 행은 임의 문자열이 아니라 실제 상태 변경 RPC에서만 만든다.

/* --------------------------------------------------------------------------
 * 수락형 방 초대
 * ----------------------------------------------------------------------- */

-- 원격 스키마에는 room_invitations 가 아직 없다. 방 초대는 즉시 participants 행을
-- 넣지 않고, 대상자만 수락하거나 거절할 수 있는 상태 행으로 남긴다.
create table public.room_invitations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  room_title text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint room_invitations_distinct_people check (inviter_id <> invitee_id)
);

alter table public.room_invitations enable row level security;

-- pending 하나만 유지한다. 같은 요청의 빠른 재시도와 동시 요청은 아래 RPC의
-- advisory lock 과 이 인덱스가 함께 막는다.
create unique index room_invitations_one_pending_per_target_idx
  on public.room_invitations (room_id, invitee_id)
  where status = 'pending';

create index room_invitations_invitee_pending_idx
  on public.room_invitations (invitee_id, expires_at)
  where status = 'pending';

create policy room_invitations_select_party
on public.room_invitations
for select to authenticated
using (
  inviter_id = (select auth.uid())
  or invitee_id = (select auth.uid())
);

revoke all on public.room_invitations from public, anon, authenticated;
grant select on public.room_invitations to authenticated;

-- 기존 invite_friend_to_room은 구버전 앱 호환을 위해 cutover 전까지 유지한다.
-- 새 클라이언트는 아래 pending RPC만 호출한다.

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
    raise exception 'Room no longer exists' using errcode = 'P0002';
  end if;

  if target.expires_at <= now() then
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
  set status = 'expired', responded_at = coalesce(invitation.responded_at, now())
  where invitation.room_id = target_room
    and invitation.invitee_id = $2
    and invitation.status = 'pending'
    and invitation.expires_at <= now();

  select invitation.id into existing_invitation
  from public.room_invitations invitation
  where invitation.room_id = target_room
    and invitation.invitee_id = $2
    and invitation.status = 'pending'
    and invitation.expires_at > now();

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

  select * into invitation
  from public.room_invitations
  where id = target_invitation
  for update;

  if not found then
    raise exception 'Invitation no longer exists' using errcode = 'P0002';
  end if;

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

  if not found or target.expires_at <= now() then
    update public.room_invitations
    set status = 'expired', responded_at = coalesce(responded_at, now())
    where id = invitation.id
      and status = 'pending';
    return null;
  end if;

  if invitation.expires_at <= now() then
    update public.room_invitations
    set status = 'expired', responded_at = coalesce(responded_at, now())
    where id = invitation.id;
    return null;
  end if;

  -- 수락 전에는 participants 행이 없으므로 rooms/messages/participants RLS가 모두 닫힌다.
  -- snapshot 은 프로필 표시값을 서버에서 읽고 UNIQUE 제약으로 중복 행을 막는다.
  perform private.participant_snapshot(invitation.room_id, caller);

  update public.room_invitations
  set status = 'accepted', responded_at = now()
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
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select * into invitation
  from public.room_invitations
  where id = target_invitation
  for update;

  if not found then
    raise exception 'Invitation no longer exists' using errcode = 'P0002';
  end if;

  if invitation.invitee_id <> caller then
    raise exception 'Only the invited person can decline this invitation' using errcode = '42501';
  end if;

  if invitation.status <> 'pending' then
    return invitation.status;
  end if;

  if invitation.expires_at <= now() then
    update public.room_invitations
    set status = 'expired', responded_at = coalesce(responded_at, now())
    where id = invitation.id;
    return 'expired';
  end if;

  update public.room_invitations
  set status = 'declined', responded_at = now()
  where id = invitation.id;

  return 'declined';
end;
$$;

revoke all on function public.create_room_invitation(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.create_room_invitation(uuid, uuid) to authenticated;

revoke all on function public.accept_room_invitation(uuid)
  from public, anon, authenticated;
grant execute on function public.accept_room_invitation(uuid) to authenticated;

revoke all on function public.decline_room_invitation(uuid)
  from public, anon, authenticated;
grant execute on function public.decline_room_invitation(uuid) to authenticated;

/*
 * 방 멤버십 변경도 정산 생성과 같은 advisory lock을 공유한다. 그러면 정산이
 * 수취인 snapshot을 만드는 동안 입장/퇴장이 끼어들지 않는다.
 */
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

  -- 잠금 대기 중 방이 삭제되었거나 만료된 경우를 다시 확인한다.
  select * into target
  from public.rooms
  where id = target.id
  for update;

  if not found or target.expires_at <= now() then
    raise exception 'This invite has expired' using errcode = 'P0002';
  end if;

  perform private.participant_snapshot(target.id, caller);
  return target.id;
end;
$$;

revoke all on function public.join_room_by_code(text) from public, anon, authenticated;
grant execute on function public.join_room_by_code(text) to authenticated;

create or replace function public.leave_room(target_room uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  remaining integer;
begin
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.rooms where id = target_room) then
    return 'gone';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_room::text, 0)
  );

  if not exists (select 1 from public.rooms where id = target_room) then
    return 'gone';
  end if;

  if not exists (
    select 1
    from public.participants
    where room_id = target_room
      and profile_id = caller
  ) then
    raise exception 'Not a member of this room' using errcode = '42501';
  end if;

  delete from public.participants
  where room_id = target_room
    and profile_id = caller;

  select count(*) into remaining
  from public.participants
  where room_id = target_room;

  if remaining = 0 then
    delete from public.rooms where id = target_room;
    return 'deleted';
  end if;

  return 'left';
end;
$$;

revoke all on function public.leave_room(uuid) from public, anon, authenticated;
grant execute on function public.leave_room(uuid) to authenticated;

-- 현재 앱은 leave_room RPC만 쓴다. 직접 participant DELETE는 이 shared advisory
-- lock을 우회하므로 additive 단계에서 즉시 닫는다.
drop policy if exists participants_delete_own on public.participants;
revoke delete on public.participants from anon, authenticated;
revoke delete on public.rooms from anon, authenticated;

/* --------------------------------------------------------------------------
 * 정산: RPC 단일 쓰기 경로 + 원자적 알림/시스템 이벤트
 * ----------------------------------------------------------------------- */

-- 현재 앱은 bill 테이블을 직접 쓰지 않는다. 직접 DML을 열어 두면 orphan/open bill
-- 생성과 수취인 snapshot 우회가 가능하므로 additive 단계에서 즉시 닫는다.
drop policy if exists dutch_pay_bills_insert_creator on public.dutch_pay_bills;
drop policy if exists dutch_pay_bills_update_creator on public.dutch_pay_bills;
drop policy if exists dutch_pay_bills_delete_creator on public.dutch_pay_bills;
revoke insert, update, delete on public.dutch_pay_bills from anon, authenticated;
-- 이전 migration의 column-level UPDATE grant는 table-level revoke로 지워지지 않는다.
revoke update (title, total_amount, split_count, bank_name, account_number, account_holder)
  on public.dutch_pay_bills from anon, authenticated;

-- 정산 수취인은 생성 시점의 dutch_pay_members snapshot으로 고정한다. 현재 방에
-- 새로 들어온 사람은 과거 정산의 계좌·금액을 보지 못하고, 방을 나간 수취인은
-- 본인 정산과 완료 표시를 계속 볼 수 있다.
create or replace function private.is_bill_visible(target_bill uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.dutch_pay_bills bill
    where bill.id = target_bill
      and (
        bill.creator_id = (select auth.uid())
        or exists (
          select 1
          from public.dutch_pay_members member
          where member.bill_id = bill.id
            and member.profile_id = (select auth.uid())
        )
      )
  );
$$;

revoke all on function private.is_bill_visible(uuid) from public, anon, authenticated;
grant execute on function private.is_bill_visible(uuid) to authenticated;

drop policy if exists dutch_pay_bills_select_creator on public.dutch_pay_bills;
drop policy if exists dutch_pay_bills_select_room_member on public.dutch_pay_bills;
create policy dutch_pay_bills_select_bill_recipient
on public.dutch_pay_bills
for select to authenticated
using (private.is_bill_visible(id));

drop policy if exists dutch_pay_members_select_bill on public.dutch_pay_members;
create policy dutch_pay_members_select_bill_recipient
on public.dutch_pay_members
for select to authenticated
using (private.is_bill_visible(bill_id));

-- 알림은 정산 생성과 같은 트랜잭션에서만 만든다. 과거 행은 settlement_id 가 NULL 이고,
-- 새 행은 정산 하나당 하나만 허용한다.
alter table public.notifications
  add column if not exists settlement_id uuid
  references public.dutch_pay_bills(id) on delete cascade;

create unique index if not exists notifications_settlement_id_unique_idx
  on public.notifications (settlement_id)
  where settlement_id is not null;

-- 새 settlement_id를 authenticated client가 직접 넣으면 linked notification을
-- 선점·위조할 수 있다. table INSERT를 닫고, 구버전 알림 UI가 쓰던 열만 다시
-- 연다. policy도 settlement_id가 NULL일 때만 통과시킨다.
drop policy if exists notifications_insert_member on public.notifications;
revoke insert on public.notifications from anon, authenticated;
grant insert (room_id, title, message, bank_name, account_number, amount)
  on public.notifications to authenticated;
create policy notifications_insert_legacy_member
on public.notifications
for insert to authenticated
with check (
  private.is_room_member(room_id)
  and settlement_id is null
);

-- settlement_id 없는 레거시 알림은 연결된 bill 수취인을 증명할 수 없다. 그중에는
-- 계좌번호가 있는 행도 있어 현재 방 멤버에게도 노출하지 않는다. 삭제·추정 backfill은
-- 하지 않고, 새 RPC가 만든 settlement_id 연결 알림만 bill 수취인에게 보인다.
drop policy if exists notifications_select_member on public.notifications;
create policy notifications_select_bill_recipient
on public.notifications
for select to authenticated
using (
  settlement_id is not null
  and private.is_bill_visible(settlement_id)
);

-- 새 클라이언트는 아래 RPC를 쓰지만 구버전의 is_completed 직접 UPDATE는 cutover
-- 전까지 호환용으로 남긴다.

-- system 행은 사건 키가 있을 때만 서버가 만들고, 같은 사건을 재시도해도 한 번만 남긴다.
alter table public.messages
  add column if not exists event_key text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'messages_event_key_system_only'
  ) then
    alter table public.messages
      add constraint messages_event_key_system_only
      check (event_key is null or kind = 'system');
  end if;
end;
$$;

create unique index if not exists messages_system_event_key_unique_idx
  on public.messages (event_key)
  where event_key is not null;

-- v1/v2 wrapper가 공유하는 privileged write implementation. v1은 구버전 화면이
-- 별도 notification/system message를 보내는 동안 event를 만들지 않고, v2만 상태와
-- 고정 event/linked notification을 하나의 트랜잭션으로 만든다.
create or replace function private.create_room_settlement_impl(
  target_room uuid,
  bill_title text,
  amount integer,
  bank_name text,
  account_number text,
  account_holder text,
  emit_server_events boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target_bill uuid;
  target_creator uuid;
  snapshot_member_count integer;
  per_person_amount integer;
  created boolean := false;
  updated boolean := false;
  room public.rooms%rowtype;
  settlement public.dutch_pay_bills%rowtype;
  v_title text := nullif(btrim(bill_title), '');
  -- 빈 문자열과 NULL은 기존 계좌 정보를 지우라는 뜻으로 해석하지 않는다.
  v_bank text := nullif(btrim(bank_name), '');
  v_account text := nullif(btrim(account_number), '');
  v_holder text := nullif(btrim(account_holder), '');
begin
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if amount is null or amount <= 0 then
    raise exception 'Amount must be positive' using errcode = '22023';
  end if;

  -- 방 하나의 진행 중 정산 결정은 같은 잠금 아래에서만 이뤄진다.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_room::text, 0)
  );

  -- lock을 기다리는 사이 leave/delete가 끝났을 수 있으므로 권한과 방 상태를
  -- 반드시 여기에서 다시 검사한다. 이 아래의 수취인 snapshot도 같은 lock 범위다.
  if not private.is_room_member(target_room) then
    raise exception 'Only room members can start a settlement' using errcode = '42501';
  end if;

  select * into room
  from public.rooms
  where id = target_room
  for update;

  if not found or room.expires_at <= now() then
    raise exception 'Room no longer exists or has expired' using errcode = 'P0002';
  end if;

  select bill.id, bill.creator_id
  into target_bill, target_creator
  from public.dutch_pay_bills bill
  where bill.room_id = target_room
    and (
      not exists (
        select 1
        from public.dutch_pay_members member
        where member.bill_id = bill.id
      )
      or exists (
        select 1
        from public.dutch_pay_members member
        where member.bill_id = bill.id
          and not member.is_completed
      )
    )
  order by bill.created_at desc, bill.id desc
  limit 1
  for update;

  if target_bill is null then
    -- 먼저 임시 split_count로 bill을 만든다. 이후 한 INSERT ... SELECT로
    -- participants를 bill recipient snapshot으로 옮기고 그 실제 행 수만 쓴다.
    -- pre-count를 쓰면 join/leave와의 타이밍에 split_count와 수취인이 어긋난다.
    insert into public.dutch_pay_bills (
      room_id, creator_id, title, total_amount, split_count,
      bank_name, account_number, account_holder
    )
    values (
      target_room, caller, coalesce(v_title, '정산'), amount,
      1,
      coalesce(v_bank, ''), coalesce(v_account, ''), coalesce(v_holder, '')
    )
    returning id into target_bill;
    created := true;
  else
    if target_creator is distinct from caller then
      raise exception 'Only the settlement creator can update this settlement' using errcode = '42501';
    end if;

    select count(*) into snapshot_member_count
    from public.dutch_pay_members member
    where member.bill_id = target_bill;

    if snapshot_member_count < 1 then
      raise exception 'Settlement recipients are missing' using errcode = 'P0002';
    end if;

    update public.dutch_pay_bills bill
    set title = coalesce(v_title, bill.title),
        total_amount = amount,
        split_count = snapshot_member_count,
        bank_name = coalesce(v_bank, bill.bank_name),
        account_number = coalesce(v_account, bill.account_number),
        account_holder = coalesce(v_holder, bill.account_holder)
    where bill.id = target_bill
      and (
        bill.title,
        bill.total_amount,
        bill.split_count,
        bill.bank_name,
        bill.account_number,
        bill.account_holder
      ) is distinct from (
        coalesce(v_title, bill.title),
        amount,
        snapshot_member_count,
        coalesce(v_bank, bill.bank_name),
        coalesce(v_account, bill.account_number),
        coalesce(v_holder, bill.account_holder)
      );
    updated := found;
  end if;

  -- 수취인은 생성 순간의 방 참가자로 고정한다. 기존 bill 수정 때 새 방 멤버를
  -- 추가하지 않아 계좌 공개 범위와 1인당 금액이 뒤늦게 변하지 않는다.
  if created then
    insert into public.dutch_pay_members (bill_id, profile_id, name, is_completed)
    select target_bill, participant.profile_id, participant.name, participant.profile_id = caller
    from public.participants participant
    where participant.room_id = target_room
    on conflict do nothing;

    select count(*) into snapshot_member_count
    from public.dutch_pay_members member
    where member.bill_id = target_bill;

    if snapshot_member_count < 1 then
      raise exception 'Settlement recipients are missing' using errcode = 'P0002';
    end if;

    update public.dutch_pay_bills bill
    set split_count = snapshot_member_count
    where bill.id = target_bill;
  end if;

  select * into settlement
  from public.dutch_pay_bills
  where id = target_bill;

  -- v1/v2 모두 수취인 snapshot에 연결된 알림 하나를 원자적으로 만든다. 구버전
  -- 화면이 만든 settlement_id 없는 알림은 SELECT 정책상 숨겨져 중복 노출되지 않는다.
  per_person_amount := ceil(settlement.total_amount::numeric / snapshot_member_count)::integer;

  if emit_server_events then
    if created then
      insert into public.messages (
        room_id, sender_id, sender_name, sender_color, message, kind, event_key
      )
      values (
        target_room,
        null,
        '밀챗',
        '#FF9900',
        format('정산 요청을 시작했어요 · 1인당 %s원', per_person_amount),
        'system',
        'settlement-created:' || target_bill::text
      )
      on conflict do nothing;
    elsif updated then
      insert into public.messages (
        room_id, sender_id, sender_name, sender_color, message, kind, event_key
      )
      values (
        target_room,
        null,
        '밀챗',
        '#FF9900',
        format('정산 요청 내용을 수정했어요 · 1인당 %s원', per_person_amount),
        'system',
        'settlement-updated:' || target_bill::text || ':' || md5(format(
          '%s|%s|%s|%s|%s|%s',
          settlement.title,
          settlement.total_amount,
          settlement.split_count,
          settlement.bank_name,
          settlement.account_number,
          settlement.account_holder
        ))
      )
      on conflict do nothing;
    end if;
  end if;

  -- 새 정산과 수정 정산 모두 연결 알림을 현재 값으로 덮어쓴다. v1도 이 경로를
  -- 사용하므로, legacy null 알림을 숨기면서도 구버전 수취인 알림은 유지한다.
  insert into public.notifications (
    room_id, settlement_id, title, message, bank_name, account_number, amount
  )
  values (
    target_room,
    target_bill,
    'N빵 정산 요청이 도착했어요!',
    format('1인당 %s원', per_person_amount),
    settlement.bank_name,
    settlement.account_number,
    per_person_amount
  )
  on conflict (settlement_id) where settlement_id is not null do update
  set room_id = excluded.room_id,
      title = excluded.title,
      message = excluded.message,
      bank_name = excluded.bank_name,
      account_number = excluded.account_number,
      amount = excluded.amount;

  return target_bill;
end;
$$;

revoke all on function private.create_room_settlement_impl(uuid, text, integer, text, text, text, boolean)
  from public, anon, authenticated;

-- v1 is retained only for the installed stale client. It has the legacy name
-- and deliberately emits no fixed system event, so its own old UI system
-- message cannot duplicate the v2 server event. The shared helper still creates
-- the one recipient-visible linked notification for both versions.
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
  if (select auth.uid()) is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  return private.create_room_settlement_impl(
    target_room, bill_title, amount, bank_name, account_number, account_holder, false
  );
end;
$$;

revoke all on function public.create_room_settlement(uuid, text, integer, text, text, text)
  from public, anon;
grant execute on function public.create_room_settlement(uuid, text, integer, text, text, text)
  to authenticated;

-- v2 is the only path used by the current client. It adds the linked
-- notification and fixed system event atomically with the state change.
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
  if (select auth.uid()) is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  return private.create_room_settlement_impl(
    target_room, bill_title, amount, bank_name, account_number, account_holder, true
  );
end;
$$;

revoke all on function public.create_room_settlement_v2(uuid, text, integer, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_room_settlement_v2(uuid, text, integer, text, text, text)
  to authenticated;

/*
 * 정산 완료 표시는 participants/정산 생성과 같은 방 advisory lock을 공유한다.
 * 이 함수 밖에서는 dutch_pay_members.is_completed를 바꿀 수 없다.
 */
create or replace function public.set_settlement_completed(
  target_member uuid,
  completed boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  initial_bill_id uuid;
  target_room uuid;
  lock_subject text;
  member_row public.dutch_pay_members%rowtype;
  bill_creator uuid;
begin
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if completed is null then
    raise exception 'Completion state is required' using errcode = '22023';
  end if;

  -- room 잠금의 키를 얻고, 잠금 뒤에는 member 행을 다시 읽어 TOCTOU를 막는다.
  select member.bill_id, bill.room_id
  into initial_bill_id, target_room
  from public.dutch_pay_members member
  join public.dutch_pay_bills bill on bill.id = member.bill_id
  where member.id = $1;

  if initial_bill_id is null then
    raise exception 'Settlement member no longer exists' using errcode = 'P0002';
  end if;

  -- 방이 없어진 과거 정산은 bill id를 잠금 키로 쓴다. 수취인은 방을 나가도
  -- 자기 완료 표시를 바꿀 수 있다.
  lock_subject := coalesce(target_room::text, 'bill:' || initial_bill_id::text);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(lock_subject, 0)
  );

  select member.*
  into member_row
  from public.dutch_pay_members member
  join public.dutch_pay_bills bill on bill.id = member.bill_id
  where member.id = $1
    and bill.id = initial_bill_id
  for update of member;

  if not found then
    raise exception 'Settlement member no longer exists' using errcode = 'P0002';
  end if;

  select creator_id into bill_creator
  from public.dutch_pay_bills
  where id = member_row.bill_id;

  if member_row.profile_id is distinct from caller
    and bill_creator is distinct from caller then
    raise exception 'Only this member or the settlement creator can update completion' using errcode = '42501';
  end if;

  update public.dutch_pay_members
  set is_completed = completed
  where id = member_row.id
    and is_completed is distinct from completed;
end;
$$;

revoke all on function public.set_settlement_completed(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.set_settlement_completed(uuid, boolean) to authenticated;

/* --------------------------------------------------------------------------
 * 투표 확정: 실제 상태와 고정 시스템 이벤트를 함께 기록
 * ----------------------------------------------------------------------- */

-- menu 는 기존 rooms에 확정 상태가 없었다. item id까지 기록해 같은 후보의 재시도와
-- 다른 후보로의 재확정을 구분한다. 시간은 기존 confirmed_slot을 그대로 쓴다.
alter table public.rooms
  add column if not exists confirmed_menu text,
  add column if not exists confirmed_menu_at timestamptz,
  add column if not exists confirmed_menu_item_id uuid,
  add column if not exists confirmed_time_item_id uuid;

-- createRoom이 쓰는 열만 허용한다. confirmed/voting/recommendation 값은 직접
-- 주입할 수 없고 아래 RPC가 서버 소유 상태와 event를 함께 관리한다.
revoke insert on public.rooms from anon, authenticated;
grant insert (
  code, title, meeting_date, expires_at, owner_id,
  is_confirmed, confirmed_slot, color, location_name
) on public.rooms to authenticated;

drop policy if exists rooms_insert_owner on public.rooms;
create policy rooms_insert_owner
on public.rooms
for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and is_confirmed = (confirmed_slot is not null)
  and voting_items = '[]'::jsonb
  and confirmed_menu is null
  and confirmed_menu_at is null
  and confirmed_menu_item_id is null
  and confirmed_time_item_id is null
  and ai_recommendations is null
  and latitude is null
  and longitude is null
  and memo is null
  and memo_visibility = 'public'
  and memo_author_id is null
);

-- 현재 앱에는 rooms 직접 UPDATE 호출이 없다. 남기면 확정 상태를 RPC/event 없이
-- 바꿀 수 있으므로 policy와 grant를 additive 단계에서 함께 닫는다.
drop policy if exists rooms_update_member on public.rooms;
revoke update on public.rooms from anon, authenticated;

-- 후보 추가와 표 토글은 확정과 동일하게 방 advisory lock → rooms row lock 순서로
-- 직렬화한다. 확정 뒤에는 해당 종류의 후보/표를 더 바꿀 수 없다.
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

  select * into room
  from public.rooms
  where id = target_room
  for update;

  if not found then
    raise exception 'Room no longer exists' using errcode = 'P0002';
  end if;

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
    'created_at', now()
  )
  where id = target_room;

  return new_id;
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

  -- 방 행을 먼저 잠근 뒤 자신의 participant 행만 잠근다. 비회원에게 후보의
  -- 존재·종류를 알려 주지 않으려면 server-side item 조회도 이 확인 뒤여야 한다.
  select * into my_row
  from public.participants
  where room_id = target_room
    and profile_id = caller
  for update;

  if not found then
    raise exception 'Only room members can vote' using errcode = '42501';
  end if;

  select item ->> 'kind' into selected_kind
  from jsonb_array_elements(coalesce(room.voting_items, '[]'::jsonb)) item
  where item ->> 'id' = item_id::text
  limit 1;

  if selected_kind is null or selected_kind not in ('menu', 'time') then
    raise exception 'Unknown option' using errcode = 'P0002';
  end if;

  if selected_kind = 'time' and (
    room.is_confirmed or room.confirmed_time_item_id is not null
  ) then
    raise exception 'A time vote has already been confirmed' using errcode = '42501';
  end if;

  if selected_kind = 'menu' and room.confirmed_menu_item_id is not null then
    raise exception 'A menu vote has already been confirmed' using errcode = '42501';
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

revoke all on function public.add_voting_item(uuid, text, text) from public, anon;
grant execute on function public.add_voting_item(uuid, text, text) to authenticated;

revoke all on function public.toggle_vote(uuid, uuid) from public, anon;
grant execute on function public.toggle_vote(uuid, uuid) to authenticated;

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
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_room::text, 0)
  );

  if not private.is_room_member(target_room) then
    raise exception 'Only room members can confirm a vote' using errcode = '42501';
  end if;

  select * into room
  from public.rooms
  where id = target_room
  for update;

  if not found then
    raise exception 'Room no longer exists' using errcode = 'P0002';
  end if;

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
        confirmed_menu_at = now(),
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

revoke all on function public.confirm_room_vote(uuid, uuid) from public, anon;
grant execute on function public.confirm_room_vote(uuid, uuid) to authenticated;

-- post_room_system_message 권한 철회는 cutover migration에서 한다. 구버전 앱은
-- 그 전까지 고정 event_key 없는 안내문을 계속 만들 수 있다.
