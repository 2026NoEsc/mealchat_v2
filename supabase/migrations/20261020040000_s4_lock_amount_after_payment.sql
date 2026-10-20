-- Freeze monetary terms after a non-creator recipient reports payment.
-- Preserve S4008, expiry checks, lock order, snapshot and v1/v2 grants.
begin;
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
  payment_changed boolean := false;
  room public.rooms%rowtype;
  settlement public.dutch_pay_bills%rowtype;
  v_title text := nullif(btrim(bill_title), '');
  -- 빈 문자열과 NULL은 기존 계좌 정보를 지우라는 뜻으로 해석하지 않는다.
  v_bank text := nullif(btrim(bank_name), '');
  v_account text := nullif(btrim(account_number), '');
  v_holder text := nullif(btrim(account_holder), '');
begin
  perform private.require_current_terms_consent();
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if v_bank is null or v_account is null or v_holder is null then
    raise exception 'INVALID_INPUT' using errcode='22023';
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
  if not found or room.expires_at <= clock_timestamp()
    or (room.appointment_confirmed_at is not null and room.appointment_confirmed_at+interval '30 days' <= clock_timestamp()) then
    perform private.require_current_terms_consent();
    raise exception 'Room no longer exists or has expired' using errcode = 'P0002';
  end if;
  perform private.require_current_terms_consent();

  if not private.s4_settlement_allowed(room) then
    raise exception 'SETTLEMENT_REQUIRES_CONFIRMATION' using errcode='S4008',hint='operation=settlement';
  end if;

  select bill.id, bill.creator_id
  into target_bill, target_creator
  from public.dutch_pay_bills bill
  where bill.room_id = target_room
    and bill.payment_disclosure_closed_at is null
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
  perform private.require_current_terms_consent();

  if target_bill is null then
    -- 먼저 임시 split_count로 bill을 만든다. 이후 한 INSERT ... SELECT로
    -- participants를 bill recipient snapshot으로 옮기고 그 실제 행 수만 쓴다.
    -- pre-count를 쓰면 join/leave와의 타이밍에 split_count와 수취인이 어긋난다.
    insert into public.dutch_pay_bills (
      room_id, creator_id, title, total_amount, split_count,
      bank_name, account_number, account_holder, payment_disclosure_source, payment_disclosure_requested_at
    )
    values (
      target_room, caller, coalesce(v_title, '정산'), amount,
      1,
      coalesce(v_bank, ''), coalesce(v_account, ''), coalesce(v_holder, ''), 'request', clock_timestamp()
    )
    returning id into target_bill;
    created := true;
  else
    if target_creator is distinct from caller then
      raise exception 'Only the settlement creator can update this settlement' using errcode = '42501';
    end if;

    if exists(select 1 from public.dutch_pay_bills where id=target_bill and payment_disclosure_closed_at is not null) then raise exception 'SETTLEMENT_DISCLOSURE_CLOSED' using errcode='S1005'; end if;

    select count(*) into snapshot_member_count
    from public.dutch_pay_members member
    where member.bill_id = target_bill;

    if snapshot_member_count < 1 then
      raise exception 'Settlement recipients are missing' using errcode = 'P0002';
    end if;

    -- Payment completion and this update share the room advisory/row/bill locks.
    -- A paid non-creator freezes all values that determine the payment obligation.
    -- Title-only edits remain allowed: they change neither the split nor destination.
    select (bill.total_amount, bill.split_count, bill.bank_name, bill.account_number, bill.account_holder)
      is distinct from (amount, snapshot_member_count,
        coalesce(v_bank, bill.bank_name), coalesce(v_account, bill.account_number), coalesce(v_holder, bill.account_holder))
    into payment_changed from public.dutch_pay_bills bill where bill.id = target_bill;

    if exists (
      select 1 from public.dutch_pay_members member
      where member.bill_id = target_bill and member.is_completed
        and member.profile_id is distinct from target_creator
    ) and payment_changed then
      raise exception 'SETTLEMENT_LOCKED_AFTER_PAYMENT' using errcode = '42501';
    end if;

    update public.dutch_pay_bills bill
    set payment_disclosure_source='request', payment_disclosure_requested_at=clock_timestamp(), title = coalesce(v_title, bill.title),
        total_amount = amount,
        split_count = snapshot_member_count,
        bank_name = coalesce(v_bank, bill.bank_name),
        account_number = coalesce(v_account, bill.account_number),
        account_holder = coalesce(v_holder, bill.account_holder)
    where bill.id = target_bill
      and (bill.payment_disclosure_source is distinct from 'request' or (
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
      ));
    updated := found;
  end if;

  -- 수취인은 생성 순간의 방 참가자로 고정한다. 기존 bill 수정 때 새 방 멤버를
  -- 추가하지 않아 계좌 공개 범위와 1인당 금액이 뒤늦게 변하지 않는다.
  if created then
    insert into public.dutch_pay_members (bill_id, profile_id, name, is_completed)
    select target_bill, participant.profile_id, participant.name, coalesce(participant.profile_id = caller, false)
    from public.participants participant
    where participant.room_id = target_room
      and participant.profile_id is not null
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

  perform private.s1_close_bill(target_bill);

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
    -- A title-only edit advances the bill revision but never announces new payment terms.
    elsif updated and payment_changed then
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
        'settlement-updated:' || target_bill::text || ':' || settlement.event_revision::text
      )
      on conflict do nothing;
    end if;
  end if;

  -- 새 정산과 실제 금전 조건 변경만 기존 알림을 갱신한다. 제목 수정/멱등 재시도는
  -- 재알림하지 않는다. 알림이 없는 legacy bill의 연결 알림 복구는 INSERT로 유지한다.
  insert into public.notifications (
    room_id, settlement_id, title, message, bank_name, account_number, amount
  )
  values (
    target_room,
    target_bill,
    'N빵 정산 요청이 도착했어요!',
    format('1인당 %s원', per_person_amount),
    '',
    '',
    per_person_amount
  )
  on conflict (settlement_id) where settlement_id is not null do update
  set room_id = excluded.room_id,
      title = excluded.title,
      message = excluded.message,
      bank_name = excluded.bank_name,
      account_number = excluded.account_number,
      amount = excluded.amount
  where created or payment_changed;

  return target_bill;
end;
$$;
revoke all on function private.create_room_settlement_impl(uuid,text,integer,text,text,text,boolean) from public,anon,authenticated,service_role;
commit;
