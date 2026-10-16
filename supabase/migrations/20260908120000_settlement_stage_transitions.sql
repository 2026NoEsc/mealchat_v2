-- 정산 단계 전이의 빠진 고리 둘을 잇는다.
--
-- 1) 20260907140000 의 settle_room_when_all_paid 는 UPDATE 만 본다. 그런데
--    정산을 만들 때 서버가 참가자 행을 넣으면서 만든 사람 행은 처음부터
--    is_completed = true 로 INSERT 한다 (20260823072701). 그래서 마지막
--    미완료자가 UPDATE 가 아니라 INSERT 로 완료되는 경우 — 참가자가 혼자인
--    방, 또는 만든 사람이 마지막인 경우 — 트리거가 걸리지 않고 방이 영영
--    'done' 으로 넘어가지 않았다.
--
-- 2) 'settling' 을 세우는 코드가 어디에도 없었다. 20260906120000 이 "정산
--    중에는 방을 못 나간다" 를 stage = 'settling' 으로 판단하는데, 그 값이
--    한 번도 만들어지지 않아 가드가 통째로 죽어 있었다.
--
-- 단계는 정산을 만들면 settling, 전원이 보내면 done 으로 간다.

/* ------------------------------------ 1. 정산이 생기면 방을 settling 으로 */

create or replace function public.mark_room_settling()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  /* 방이 이미 사라진 과거 정산은 옮길 단계가 없다 */
  if new.room_id is null then
    return new;
  end if;

  /*
   * 앞으로만 간다. 이미 done 인 방을 settling 으로 되돌리면 사라질 기한이
   * 풀리고, 정산을 고칠 때마다 끝난 방이 되살아난다.
   */
  update public.rooms
  set stage = 'settling'
  where id = new.room_id
    and stage in ('scheduling', 'place', 'confirmed');

  return new;
end;
$$;

drop trigger if exists mark_room_settling on public.dutch_pay_bills;

/*
 * INSERT 에만 건다. 금액 수정으로 단계가 다시 움직일 이유가 없다.
 */
create trigger mark_room_settling
after insert on public.dutch_pay_bills
for each row
execute function public.mark_room_settling();

/* -------------------------- 2. INSERT 로 완료되는 경우까지 트리거가 본다 */

drop trigger if exists settle_room_when_all_paid on public.dutch_pay_members;

/*
 * AFTER ROW 트리거는 문장이 끝난 뒤에 줄줄이 발동하므로, 참가자를 한 번에
 * 넣어도 세는 시점에는 그 정산의 행이 모두 보인다. 함수는 그대로 쓴다 —
 * INSERT 든 UPDATE 든 "이 정산에 아직 안 보낸 사람이 있나" 를 물을 뿐이다.
 */
create trigger settle_room_when_all_paid
after insert or update of is_completed on public.dutch_pay_members
for each row
execute function public.settle_room_when_all_paid();

/* ------------------------------------------ 3. 이미 어긋난 방을 맞춰 준다 */

/* 정산이 걸려 있는데 단계가 뒤처진 방 */
update public.rooms r
set stage = 'settling'
where r.stage in ('scheduling', 'place', 'confirmed')
  and exists (
    select 1 from public.dutch_pay_bills b where b.room_id = r.id
  );

/*
 * 전원이 이미 보냈는데 트리거를 못 만난 방. 기한은 트리거와 같은 규칙으로
 * 지금부터 24시간을 준다 — 이미 지난 것으로 만들면 다음 목록 조회에서
 * 곧바로 지워져, 방이 예고 없이 사라진다.
 */
update public.rooms r
set
  stage = 'done',
  is_confirmed = true,
  settled_at = coalesce(r.settled_at, now()),
  expires_at = now() + interval '24 hours'
where r.stage is distinct from 'done'
  and exists (
    select 1 from public.dutch_pay_bills b where b.room_id = r.id
  )
  and not exists (
    select 1
    from public.dutch_pay_bills b
    join public.dutch_pay_members m on m.bill_id = b.id
    where b.room_id = r.id
      and not m.is_completed
  );
