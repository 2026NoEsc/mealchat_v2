-- S1 M5: settlement request consent is independent of profile visibility.
begin;
alter table public.dutch_pay_bills add column payment_disclosure_source text check(payment_disclosure_source in ('request','legacy_linked_request')),
 add column payment_disclosure_requested_at timestamptz,add column payment_disclosure_closed_at timestamptz,
 add column event_revision bigint not null default 0 check(event_revision>=0),
 add constraint s1_request_time check(payment_disclosure_source is distinct from 'request' or payment_disclosure_requested_at is not null),
 add constraint s1_legacy_request_time check(payment_disclosure_source is distinct from 'legacy_linked_request' or payment_disclosure_requested_at is null);
update public.dutch_pay_bills b set payment_disclosure_source='legacy_linked_request'
where b.creator_id is not null and exists(select 1 from public.dutch_pay_members m where m.bill_id=b.id and m.profile_id=b.creator_id)
and not exists(select 1 from public.dutch_pay_members m where m.bill_id=b.id and m.profile_id is null)
and exists(select 1 from public.notifications n where n.settlement_id=b.id);
update public.dutch_pay_bills b set payment_disclosure_closed_at=clock_timestamp(),bank_name='',account_number='',account_holder=''
where exists(select 1 from public.dutch_pay_members m where m.bill_id=b.id) and not exists(select 1 from public.dutch_pay_members m where m.bill_id=b.id and not m.is_completed);
alter table public.dutch_pay_bills add constraint s1_closed_no_account check(payment_disclosure_closed_at is null or (bank_name='' and account_number='' and account_holder=''));
update public.notifications set bank_name='',account_number='';
alter table public.notifications add constraint s1_notifications_no_account check(bank_name='' and account_number='');
revoke select,insert,update on public.dutch_pay_bills,public.notifications from public,anon,authenticated;
revoke select(id,room_id,creator_id,title,total_amount,split_count,bank_name,account_number,account_holder,created_at,payment_disclosure_source,payment_disclosure_requested_at,payment_disclosure_closed_at,event_revision),update(bank_name,account_number,account_holder,total_amount,title,split_count),insert(bank_name,account_number,account_holder) on public.dutch_pay_bills from public,anon,authenticated;
revoke select(id,room_id,settlement_id,title,message,bank_name,account_number,amount,created_at),insert(bank_name,account_number),update(bank_name,account_number) on public.notifications from public,anon,authenticated;
grant select(id,room_id,creator_id,title,total_amount,split_count,created_at,payment_disclosure_closed_at,event_revision) on public.dutch_pay_bills to authenticated;
grant select(id,room_id,settlement_id,title,message,amount,created_at) on public.notifications to authenticated;
revoke update on public.dutch_pay_members from public,anon,authenticated;
revoke update(is_completed) on public.dutch_pay_members from public,anon,authenticated;
create function private.s1_bill_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.payment_disclosure_closed_at is not null then
  if new.payment_disclosure_closed_at is distinct from old.payment_disclosure_closed_at or (new.bank_name,new.account_number,new.account_holder) is distinct from ('','','') then raise exception 'SETTLEMENT_DISCLOSURE_CLOSED' using errcode='S1005'; end if;
 end if;
 if (old.title,old.total_amount,old.bank_name,old.account_number,old.account_holder) is distinct from (new.title,new.total_amount,new.bank_name,new.account_number,new.account_holder) then new.event_revision:=old.event_revision+1; else new.event_revision:=old.event_revision; end if;
 return new;
end; $$;
create trigger s1_bill_revision before update on public.dutch_pay_bills for each row execute function private.s1_bill_revision();
create function private.s1_close_bill(p_bill uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.dutch_pay_bills where id=p_bill for update;
 if exists(select 1 from public.dutch_pay_members where bill_id=p_bill) and not exists(select 1 from public.dutch_pay_members where bill_id=p_bill and not is_completed) then
 update public.dutch_pay_bills set payment_disclosure_closed_at=clock_timestamp(),bank_name='',account_number='',account_holder='' where id=p_bill and payment_disclosure_closed_at is null;
 end if;
end; $$;
create function private.close_completed_bill_disclosure() returns trigger language plpgsql volatile security definer set search_path='' as $$
begin perform private.s1_close_bill(new.bill_id); return new; end; $$;
create trigger s1_close_completed_bill after insert or update of is_completed on public.dutch_pay_members for each row execute function private.close_completed_bill_disclosure();
create function private.s1_lock_bill(p_bill uuid) returns void language plpgsql security definer set search_path='' as $$
declare r uuid; begin
 perform private.require_current_terms_consent();
 -- Do not take room/bill locks for unauthorized UUID probes.
 select b.room_id into r from public.dutch_pay_bills b where b.id=p_bill and private.is_bill_visible(b.id);
 if not found then raise exception 'RESOURCE_NOT_FOUND' using errcode='P0002'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(coalesce(r::text,'bill:'||p_bill::text),0));
 if r is not null then perform 1 from public.rooms where id=r for no key update; end if;
 perform 1 from public.dutch_pay_bills b where b.id=p_bill and private.is_bill_visible(b.id) for no key update;
 if not found then raise exception 'RESOURCE_NOT_FOUND' using errcode='P0002'; end if;
 perform private.require_current_terms_consent();
end; $$;
create function public.get_settlement_payment_details(p_bill_id uuid) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare b public.dutch_pay_bills%rowtype; st text; begin
 perform private.require_current_terms_consent();
 perform private.s1_lock_bill(p_bill_id);
 if not private.is_bill_visible(p_bill_id) then raise exception 'RESOURCE_NOT_FOUND' using errcode='P0002'; end if;
 select * into b from public.dutch_pay_bills where id=p_bill_id;
 if b.payment_disclosure_closed_at is not null or (exists(select 1 from public.dutch_pay_members where bill_id=p_bill_id) and not exists(select 1 from public.dutch_pay_members where bill_id=p_bill_id and not is_completed)) then st:='completed';
 elsif b.payment_disclosure_source is null or not exists(select 1 from public.dutch_pay_members where bill_id=p_bill_id) or b.bank_name='' or b.account_number='' or b.account_holder='' then st:='unavailable'; else st:='open'; end if;
 return jsonb_build_object('bill_id',p_bill_id,'status',st,'payment_details',case when st='open' then jsonb_build_object('bank_name',b.bank_name,'account_number',b.account_number,'account_holder',b.account_holder) else 'null'::jsonb end,'hidden_reason',case when st='open' then null else st end,'server_time',clock_timestamp());
end; $$;
create or replace function public.set_settlement_completed(target_member uuid,completed boolean) returns void language plpgsql security definer set search_path='' as $$
declare b uuid; m public.dutch_pay_members%rowtype; creator uuid; initial_profile uuid; begin
 perform private.require_current_terms_consent();
 if completed is null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 select member.bill_id,member.profile_id,bill.creator_id into b,initial_profile,creator
 from public.dutch_pay_members member join public.dutch_pay_bills bill on bill.id=member.bill_id
 where member.id=target_member and private.is_bill_visible(bill.id);
 if not found then raise exception 'RESOURCE_NOT_FOUND' using errcode='P0002'; end if;
 if auth.uid() is distinct from initial_profile and auth.uid() is distinct from creator then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 perform private.s1_lock_bill(b);
 select * into m from public.dutch_pay_members where id=target_member and bill_id=b for update;
 if not found then raise exception 'RESOURCE_NOT_FOUND' using errcode='P0002'; end if;
 select creator_id into creator from public.dutch_pay_bills where id=b;
 if auth.uid() is distinct from m.profile_id and auth.uid() is distinct from creator then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 -- Closing is final: keep the recipient set complete and leave_room consistent.
 if completed=false and exists(select 1 from public.dutch_pay_bills where id=b and payment_disclosure_closed_at is not null) then
  raise exception 'SETTLEMENT_DISCLOSURE_CLOSED' using errcode='S1005';
 end if;
 update public.dutch_pay_members set is_completed=completed where id=target_member and is_completed is distinct from completed;
 perform private.s1_close_bill(b);
end; $$;
create or replace function public.update_settlement_amount(bill_id uuid,new_amount integer) returns integer language plpgsql security definer set search_path='' as $$
declare creator uuid; begin
 perform private.require_current_terms_consent();
 if new_amount is null or new_amount<=0 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 select b.creator_id into creator from public.dutch_pay_bills b where b.id=bill_id and private.is_bill_visible(b.id);
 if not found then raise exception 'RESOURCE_NOT_FOUND' using errcode='P0002'; end if;
 if creator is distinct from auth.uid() then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 perform private.s1_lock_bill(bill_id);
 select creator_id into creator from public.dutch_pay_bills where id=bill_id;
 if creator is distinct from auth.uid() then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 if exists(select 1 from public.dutch_pay_members m where m.bill_id=update_settlement_amount.bill_id and m.is_completed and m.profile_id is distinct from creator) then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 update public.dutch_pay_bills b set total_amount=new_amount where b.id=bill_id;
 return new_amount;
end; $$;
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
  if not found or room.expires_at <= clock_timestamp() then
    perform private.require_current_terms_consent();
    raise exception 'Room no longer exists or has expired' using errcode = 'P0002';
  end if;
  perform private.require_current_terms_consent();

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
        'settlement-updated:' || target_bill::text || ':' || settlement.event_revision::text
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
      amount = excluded.amount;

  return target_bill;
end;
$$;
revoke all on function private.s1_bill_revision(),private.s1_close_bill(uuid),private.close_completed_bill_disclosure(),private.s1_lock_bill(uuid),private.create_room_settlement_impl(uuid,text,integer,text,text,text,boolean),public.get_settlement_payment_details(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_settlement_payment_details(uuid) to authenticated;
commit;
