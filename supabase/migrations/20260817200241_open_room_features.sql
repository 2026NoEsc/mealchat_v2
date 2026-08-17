-- 하드닝 때 닫아 둔 테이블을 화면이 쓸 수 있도록 필요한 만큼만 연다.
--
-- 앞선 마이그레이션은 정책이 전부 USING (true) 인 상태를 급히 막느라 notifications,
-- dutch_pay_members, scheduled_time 을 정책도 권한도 없이 닫아 두었다. 이제 각
-- 테이블이 실제로 누구에게 보여야 하는지 정해서 그만큼만 연다.
--
-- 공통 규칙:
--   * 방에 매인 데이터는 그 방 참가자에게만 보인다 (private.is_room_member).
--   * 본인을 가리키는 컬럼은 auth.uid() 로 강제한다.
--   * 표시용·계산용 컬럼만 UPDATE 를 열어 소유자를 바꿔치기할 수 없게 한다.

/*
 * notifications — 정산 요청 알림.
 *
 * 계좌번호가 들어 있어 같은 방 참가자에게만 보인다. 정산을 요청하려면 참가자가
 * 만들 수 있어야 하므로 INSERT 도 같은 조건으로 연다. 수정·삭제는 열지 않는다 —
 * 보낸 알림을 나중에 바꾸면 기록으로서 의미가 없다.
 */
drop policy if exists notifications_select_member on public.notifications;
create policy notifications_select_member
on public.notifications
for select to authenticated
using (private.is_room_member(room_id));

drop policy if exists notifications_insert_member on public.notifications;
create policy notifications_insert_member
on public.notifications
for insert to authenticated
with check (private.is_room_member(room_id));

grant select, insert on public.notifications to authenticated;

/*
 * dutch_pay_bills — 정산 건.
 *
 * 지금까지 creator 만 조회할 수 있었는데, 그러면 정작 돈을 보내야 하는 참가자가
 * 자기 정산을 보지 못한다. 방 참가자로 넓힌다. 만들고 지우는 것은 creator 만 한다.
 */
drop policy if exists dutch_pay_bills_select_creator on public.dutch_pay_bills;
create policy dutch_pay_bills_select_room_member
on public.dutch_pay_bills
for select to authenticated
using (
  creator_id = (select auth.uid())
  or (room_id is not null and private.is_room_member(room_id))
);

drop policy if exists dutch_pay_bills_update_creator on public.dutch_pay_bills;
create policy dutch_pay_bills_update_creator
on public.dutch_pay_bills
for update to authenticated
using (creator_id = (select auth.uid()))
with check (creator_id = (select auth.uid()));

grant update (title, total_amount, split_count, bank_name, account_number, account_holder)
  on public.dutch_pay_bills to authenticated;

/*
 * dutch_pay_members — 정산 참가자와 송금 완료 여부.
 *
 * 같은 정산에 속한 사람끼리는 서로의 완료 여부를 봐야 한다. 누가 아직 안 보냈는지
 * 모르면 정산 화면이 아무 쓸모가 없다. 그래서 조회는 같은 bill 의 방 참가자에게 연다.
 *
 * 완료 표시는 본인 것만 바꿀 수 있고, 정산을 만든 사람은 대신 표시해 줄 수 있다
 * (현금을 직접 받는 경우가 있다). is_completed 컬럼만 열어서 다른 사람의 행을
 * 자기 것으로 바꾸는 경로를 막는다.
 */
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
        or (bill.room_id is not null and private.is_room_member(bill.room_id))
      )
  );
$$;

revoke all on function private.is_bill_visible(uuid) from public, anon;
grant execute on function private.is_bill_visible(uuid) to authenticated;

drop policy if exists dutch_pay_members_select_bill on public.dutch_pay_members;
create policy dutch_pay_members_select_bill
on public.dutch_pay_members
for select to authenticated
using (private.is_bill_visible(bill_id));

drop policy if exists dutch_pay_members_update_own on public.dutch_pay_members;
create policy dutch_pay_members_update_own
on public.dutch_pay_members
for update to authenticated
using (
  profile_id = (select auth.uid())
  or exists (
    select 1 from public.dutch_pay_bills bill
    where bill.id = bill_id and bill.creator_id = (select auth.uid())
  )
)
with check (
  profile_id = (select auth.uid())
  or exists (
    select 1 from public.dutch_pay_bills bill
    where bill.id = bill_id and bill.creator_id = (select auth.uid())
  )
);

grant select on public.dutch_pay_members to authenticated;
grant update (is_completed) on public.dutch_pay_members to authenticated;

/*
 * 정산 참가자는 클라이언트가 직접 넣지 않는다. 방 참가자 명단에서 서버가 채운다 —
 * 그래야 이름을 사칭하거나 방에 없는 사람을 끼워 넣을 수 없다.
 */
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
declare
  caller uuid := (select auth.uid());
  new_bill uuid;
  member_count integer;
begin
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not private.is_room_member(target_room) then
    raise exception 'Only room members can start a settlement' using errcode = '42501';
  end if;

  if amount is null or amount < 0 then
    raise exception 'Amount must not be negative' using errcode = '22023';
  end if;

  select count(*) into member_count
  from public.participants
  where room_id = target_room;

  insert into public.dutch_pay_bills (
    room_id, creator_id, title, total_amount, split_count,
    bank_name, account_number, account_holder
  )
  values (
    target_room, caller, coalesce(nullif(btrim(bill_title), ''), '정산'), amount,
    greatest(member_count, 1),
    coalesce(bank_name, ''), coalesce(account_number, ''), coalesce(account_holder, '')
  )
  returning id into new_bill;

  -- 방 참가자를 그대로 정산 참가자로 옮긴다
  insert into public.dutch_pay_members (bill_id, profile_id, name, is_completed)
  select new_bill, participant.profile_id, participant.name, participant.profile_id = caller
  from public.participants participant
  where participant.room_id = target_room
  on conflict do nothing;

  return new_bill;
end;
$$;

revoke all on function public.create_room_settlement(uuid, text, integer, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_room_settlement(uuid, text, integer, text, text, text)
  to authenticated;

/*
 * scheduled_time — 방의 시간대 후보.
 * 방에 매인 데이터라 참가자면 읽고 쓸 수 있다.
 */
drop policy if exists scheduled_time_select_member on public.scheduled_time;
create policy scheduled_time_select_member
on public.scheduled_time
for select to authenticated
using (private.is_room_member(room_id));

drop policy if exists scheduled_time_insert_member on public.scheduled_time;
create policy scheduled_time_insert_member
on public.scheduled_time
for insert to authenticated
with check (private.is_room_member(room_id));

drop policy if exists scheduled_time_delete_member on public.scheduled_time;
create policy scheduled_time_delete_member
on public.scheduled_time
for delete to authenticated
using (private.is_room_member(room_id));

grant select, delete on public.scheduled_time to authenticated;
grant insert (room_id, slot_type) on public.scheduled_time to authenticated;

/*
 * follows — 친구 관계.
 *
 * baseline 의 follows_insert 는 WITH CHECK (true) 라 남을 대신해 관계를 만들거나
 * role 을 leader 로 지어낼 수 있었다. follower_id 를 본인으로 강제하고, 만들 수 있는
 * role 은 mate 로 제한한다. leader 승격은 별도 경로가 필요한 일이다.
 */
drop policy if exists follows_insert_own on public.follows;
create policy follows_insert_own
on public.follows
for insert to authenticated
with check (
  follower_id = (select auth.uid())
  and role = 'mate'
);

drop policy if exists follows_delete_own on public.follows;
create policy follows_delete_own
on public.follows
for delete to authenticated
using (
  follower_id = (select auth.uid())
  or following_id = (select auth.uid())
);

grant delete on public.follows to authenticated;
grant insert (follower_id, following_id, role) on public.follows to authenticated;
