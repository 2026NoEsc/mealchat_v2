-- Bounded restarts: seven days per new bill, thirty days from immutable owner confirmation.
-- Seven days permits an unpaid round to finish; thirty days bounds repeated retention extensions.
begin;
create or replace function public.mark_room_settling() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.room_id is not null then
  update public.rooms set stage='settling',
   settled_at=case when stage in('settling','done') and appointment_confirmed_at is not null then null else settled_at end,
   expires_at=case
    when stage in('settling','done') and appointment_confirmed_at is not null
     then least(new.created_at+interval '7 days',appointment_confirmed_at+interval '30 days')
    when appointment_confirmed_at is not null then least(expires_at,appointment_confirmed_at+interval '30 days')
    else expires_at end
  where id=new.room_id and (stage='confirmed' or (stage in('settling','done') and appointment_confirmed_at is not null));
 end if;
 return new;
end; $$;

create or replace function public.settle_room_when_all_paid() returns trigger
language plpgsql security definer set search_path='' as $$
declare target_room uuid; completed_at timestamptz; begin
 if not new.is_completed then return new; end if;
 select room_id into target_room from public.dutch_pay_bills where id=new.bill_id;
 if target_room is null then return new; end if;
 -- An old completed bill must not finish the room while any other bill is still open.
 if exists(select 1 from public.dutch_pay_bills b where b.room_id=target_room and b.payment_disclosure_closed_at is null
  and (not exists(select 1 from public.dutch_pay_members m where m.bill_id=b.id)
       or exists(select 1 from public.dutch_pay_members m where m.bill_id=b.id and not m.is_completed)))
 then return new; end if;
 completed_at:=clock_timestamp();
 update public.rooms set stage='done',is_confirmed=true,settled_at=completed_at,
  expires_at=least(completed_at+interval '24 hours',appointment_confirmed_at+interval '30 days')
 where id=target_room and stage is distinct from 'done';
 -- PostgreSQL least ignores NULL: legacy rooms keep their existing 24-hour rule.
 return new;
end; $$;
revoke all on function public.mark_room_settling(),public.settle_room_when_all_paid() from public,anon,authenticated,service_role;

-- Repair only live owner-confirmed done+open-bill rooms, or an older unbounded restart.
-- The earliest open bill's original creation time anchors its seven-day window, never migration time.
-- Recheck expiry after the advisory wait; expired rooms are never resurrected.
do $$ declare target uuid; room public.rooms%rowtype; first_open timestamptz; deadline timestamptz; begin
 for target in select r.id from public.rooms r where
  (r.stage='done' or (r.stage='settling' and not isfinite(r.expires_at)))
  and r.expires_at>clock_timestamp() and r.appointment_confirmed_at is not null
  and exists(select 1 from public.dutch_pay_bills b where b.room_id=r.id and b.payment_disclosure_closed_at is null
   and (not exists(select 1 from public.dutch_pay_members m where m.bill_id=b.id)
        or exists(select 1 from public.dutch_pay_members m where m.bill_id=b.id and not m.is_completed))) order by r.id
 loop
  perform pg_advisory_xact_lock(hashtextextended(target::text,0));
  select * into room from public.rooms where id=target for update;
  if not found or room.expires_at<=clock_timestamp() or room.appointment_confirmed_at is null
   or not (room.stage='done' or (room.stage='settling' and not isfinite(room.expires_at))) then continue; end if;
  select min(b.created_at) into first_open from public.dutch_pay_bills b
  where b.room_id=target and b.payment_disclosure_closed_at is null
   and (not exists(select 1 from public.dutch_pay_members m where m.bill_id=b.id)
        or exists(select 1 from public.dutch_pay_members m where m.bill_id=b.id and not m.is_completed));
  if first_open is null then continue; end if;
  deadline:=least(first_open+interval '7 days',room.appointment_confirmed_at+interval '30 days');
  if room.stage='settling' and not isfinite(room.expires_at) then
   -- Shortening an old unbounded restart to an elapsed limit expires it; it never revives a room.
   update public.rooms set expires_at=deadline where id=target;
   continue;
  end if;
  if deadline<=clock_timestamp() then continue; end if;
  update public.rooms set stage='settling',settled_at=null,expires_at=deadline where id=target;
 end loop;
end; $$;
commit;
