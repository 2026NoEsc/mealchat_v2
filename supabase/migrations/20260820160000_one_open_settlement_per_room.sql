-- 방 하나에 끝나지 않은 정산이 여러 건 생기지 않게 한다.
--
-- create_room_settlement 은 부를 때마다 dutch_pay_bills 에 새 행을 넣었다. 그래서
-- `정산 요청 보내기` 를 두 번 누르면 같은 방에 정산이 두 건 생긴다. 채팅방 시트는
-- 그중 하나만 보여 주므로 나머지는 화면에서 영영 닿을 수 없고, 홈은 "정산 2건" 으로
-- 세는데 눌러 들어가면 한 건만 보인다. 실제로 그 상태의 방이 있었다.
--
-- 이제 방에 아직 끝나지 않은 정산이 있으면 새로 만들지 않고 그 정산을 고쳐 쓴다.
-- "끝나지 않았다" 는 참가자 중 아직 보내지 않은 사람이 있거나, 참가자 행이 아예
-- 없어서 끝났는지 알 수 없는 경우다.
--
-- 참가자 행도 이때 함께 채운다. 방에 나중에 들어온 사람이 정산에서 빠져 있으면
-- 그 사람은 완료 표시를 할 수 없다. on conflict 로 막혀 있어 이미 있는 행은
-- 건드리지 않으므로 완료 표시가 지워지지 않는다.
--
-- 반환값은 변함없이 정산 id 다. 새로 만들었든 고쳐 썼든 호출부는 같게 쓴다.

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
  target_bill uuid;
  member_count integer;
  /*
   * UPDATE 의 SET 절에서는 컬럼 이름이 파라미터를 가려 `bank_name = bank_name` 이
   * 모호해진다. DECLARE 에는 컬럼이 보이지 않으므로 여기서 받아 둔다.
   */
  v_title text := btrim(bill_title);
  v_bank text := coalesce(bank_name, '');
  v_account text := coalesce(account_number, '');
  v_holder text := coalesce(account_holder, '');
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

  -- 아직 끝나지 않은 정산이 있으면 그것을 쓴다. 여럿이면 가장 최근 것.
  select bill.id into target_bill
  from public.dutch_pay_bills bill
  where bill.room_id = target_room
    and (
      not exists (
        select 1 from public.dutch_pay_members member where member.bill_id = bill.id
      )
      or exists (
        select 1
        from public.dutch_pay_members member
        where member.bill_id = bill.id and not member.is_completed
      )
    )
  order by bill.created_at desc
  limit 1;

  if target_bill is null then
    insert into public.dutch_pay_bills (
      room_id, creator_id, title, total_amount, split_count,
      bank_name, account_number, account_holder
    )
    values (
      target_room, caller, coalesce(nullif(v_title, ''), '정산'), amount,
      greatest(member_count, 1),
      v_bank, v_account, v_holder
    )
    returning id into target_bill;
  else
    update public.dutch_pay_bills
    set title = coalesce(nullif(v_title, ''), title),
        total_amount = amount,
        split_count = greatest(member_count, 1),
        bank_name = v_bank,
        account_number = v_account,
        account_holder = v_holder
    where id = target_bill;
  end if;

  -- 방 참가자를 정산 참가자로 옮긴다. 이미 있는 행은 건드리지 않는다.
  insert into public.dutch_pay_members (bill_id, profile_id, name, is_completed)
  select target_bill, participant.profile_id, participant.name, participant.profile_id = caller
  from public.participants participant
  where participant.room_id = target_room
  on conflict do nothing;

  return target_bill;
end;
$$;

revoke all on function public.create_room_settlement(uuid, text, integer, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_room_settlement(uuid, text, integer, text, text, text)
  to authenticated;
