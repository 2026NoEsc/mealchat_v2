-- 정산이 끝난 방을 24시간 뒤에 지운다.
--
-- 빠져 있던 고리가 둘이다.
--
-- 1) 방을 'done' 으로 넘기는 코드가 어디에도 없었다. advance_room_stage 는
--    'place' 와 'confirmed' 로만 불렸고, 그래서 20260903120000 이 심어 둔
--    "done 이면 expires_at = now() + 24시간" 이 영영 발동하지 않았다.
-- 2) expires_at 이 지나도 방을 지우는 것이 없었다. 기한은 화면에 숫자로만
--    보이고 방은 계속 남았다.
--
-- 정산 완료는 참가자가 각자 dutch_pay_members 를 고쳐서 표시한다. 마지막
-- 사람이 표시하는 순간을 잡아야 하므로 트리거로 건다 — 앱에서 "이제 다
-- 냈나?" 를 세게 하면 앱을 안 켠 사람 때문에 방이 안 닫힌다.
--
-- 정산 내역은 남는다. dutch_pay_bills.room_id 가 on delete set null 이라
-- 방이 사라져도 기록은 그대로다.

/* ---------------------------------------- 1. 전원이 보내면 방을 done 으로 */

create or replace function public.settle_room_when_all_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room uuid;
  unpaid int;
begin
  /* 완료로 바뀌는 순간만 본다 — 취소나 다른 컬럼 수정은 지나간다 */
  if not new.is_completed then
    return new;
  end if;

  select count(*) into unpaid
  from public.dutch_pay_members
  where bill_id = new.bill_id and not is_completed;

  if unpaid > 0 then
    return new;
  end if;

  select room_id into target_room
  from public.dutch_pay_bills
  where id = new.bill_id;

  if target_room is null then
    return new;
  end if;

  /*
   * 이미 done 인 방은 건드리지 않는다. 다시 만지면 기한이 24시간 뒤로 밀려서,
   * 정산을 껐다 켤 때마다 방이 되살아난다.
   */
  update public.rooms
  set
    stage = 'done',
    is_confirmed = true,
    settled_at = coalesce(settled_at, now()),
    expires_at = now() + interval '24 hours'
  where id = target_room and stage is distinct from 'done';

  return new;
end;
$$;

drop trigger if exists settle_room_when_all_paid on public.dutch_pay_members;

create trigger settle_room_when_all_paid
after update of is_completed on public.dutch_pay_members
for each row
execute function public.settle_room_when_all_paid();

/* ---------------------------------------------- 2. 기한이 지난 방을 지운다 */

create or replace function public.delete_expired_rooms()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed int;
begin
  with gone as (
    delete from public.rooms
    where expires_at < now()
    returning 1
  )
  select count(*) into removed from gone;

  return removed;
end;
$$;

revoke all on function public.delete_expired_rooms() from public, anon, authenticated;

comment on function public.delete_expired_rooms is
  '기한이 지난 방을 지운다. pg_cron 이 부른다. 정산 내역은 room_id 가 null 이 되어 남는다.';

/* ------------------------------------------------------- 3. 10분마다 청소 */

do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;

  /* 같은 이름이 이미 있으면 지우고 다시 건다 */
  perform cron.unschedule('delete-expired-rooms')
  where exists (select 1 from cron.job where jobname = 'delete-expired-rooms');

  perform cron.schedule(
    'delete-expired-rooms',
    '*/10 * * * *',
    $cron$ select public.delete_expired_rooms(); $cron$
  );
exception when others then
  /*
   * pg_cron 을 못 쓰는 프로젝트도 있다. 그때는 함수만 남기고 넘어간다 —
   * 마이그레이션 전체가 실패해서 트리거까지 못 걸리는 편이 더 나쁘다.
   * 대시보드의 Integrations > Cron 에서 손으로 걸어 주면 된다.
   */
  raise warning 'pg_cron 예약 실패: %. delete_expired_rooms 를 직접 예약해 주세요.', sqlerrm;
end;
$$;
