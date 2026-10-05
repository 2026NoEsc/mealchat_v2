-- [보관] 이 함수는 앱에서 쓰지 않는다.
--
-- 정산 금액 수정을 위해 만들었는데, 같은 일을 create_room_settlement_v2 가 이미
-- 하고 있었다 (20260823072701). v2 는 생성과 수정을 한 트랜잭션에서 처리하고
-- 시스템 메시지와 알림까지 원자적으로 남겨서 그쪽이 낫다.
--
-- 파일을 지우지 않는 이유는 이 마이그레이션이 이미 원격 DB 에 적용됐기 때문이다.
-- 파일만 지우면 저장소와 DB 가 어긋나서 db push 가 막힌다. 함수를 실제로 걷어낼
-- 때는 drop 하는 마이그레이션을 새로 추가한다.

-- 정산 금액을 고칠 수 있게 한다.
--
-- 지금까지 방에서 "정산 요청 보내기" 를 누를 때마다 새 정산표가 만들어졌다.
-- 금액을 잘못 넣으면 고칠 방법이 없어서 다시 요청하는 것 말고는 길이 없었고,
-- 그 결과 같은 방에 정산이 여러 건 쌓이고 알림도 그만큼 나갔다.
--
-- dutch_pay_bills 에는 update 정책이 아예 없어서 앱에서 고치면 0행이 바뀐다.
-- 정책을 여는 대신 함수로 좁힌다 — 고칠 수 있는 조건이 "만든 사람" 하나가
-- 아니기 때문이다.
--
-- 이미 누군가 보냈으면 못 고친다. 12,000원인 줄 알고 보낸 사람이 있는데 금액이
-- 20,000원으로 바뀌면 그 사람은 덜 보낸 사람이 된다. 만든 사람 자신은 처음부터
-- 완료로 들어가므로(create_room_settlement) 판정에서 제외한다.

create or replace function public.update_settlement_amount(
  bill_id uuid,
  new_amount integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  bill_creator uuid;
  paid_by_others int;
begin
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if new_amount is null or new_amount <= 0 then
    raise exception 'Amount must be positive' using errcode = '22023';
  end if;

  select creator_id into bill_creator
  from public.dutch_pay_bills
  where id = bill_id;

  if bill_creator is null then
    raise exception 'Settlement not found' using errcode = 'P0002';
  end if;

  if bill_creator is distinct from caller then
    raise exception 'Only the creator can change the amount' using errcode = '42501';
  end if;

  select count(*) into paid_by_others
  from public.dutch_pay_members
  where bill_id = update_settlement_amount.bill_id
    and is_completed
    and profile_id is distinct from bill_creator;

  if paid_by_others > 0 then
    raise exception 'Someone already sent money' using errcode = '42501';
  end if;

  update public.dutch_pay_bills
  set total_amount = new_amount
  where id = bill_id;

  return new_amount;
end;
$$;

revoke all on function public.update_settlement_amount(uuid, integer) from public, anon;
grant execute on function public.update_settlement_amount(uuid, integer) to authenticated;
