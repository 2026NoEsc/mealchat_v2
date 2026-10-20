-- Retire an unused privileged RPC that bypasses confirmation, expiry and closed-bill checks.
-- Keep the function for history; clients must use the guarded settlement creation/update core.
begin;
revoke execute on function public.update_settlement_amount(uuid,integer) from public,anon,authenticated;

-- Defense in depth for every writer, including old privileged functions and FK cleanup.
-- Closing may still scrub accounts, and closed bills may detach from rooms/profiles.
create or replace function private.s1_bill_revision() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.payment_disclosure_closed_at is not null then
  if new.payment_disclosure_closed_at is distinct from old.payment_disclosure_closed_at
   or (new.bank_name,new.account_number,new.account_holder) is distinct from ('','','')
   or new.total_amount is distinct from old.total_amount
  then raise exception 'SETTLEMENT_DISCLOSURE_CLOSED' using errcode='S1005'; end if;
 end if;
 if (old.title,old.total_amount,old.bank_name,old.account_number,old.account_holder)
  is distinct from (new.title,new.total_amount,new.bank_name,new.account_number,new.account_holder)
 then new.event_revision:=old.event_revision+1; else new.event_revision:=old.event_revision; end if;
 return new;
end; $$;
revoke all on function private.s1_bill_revision() from public,anon,authenticated,service_role;

-- Internal trigger only: room writers already authorize and serialize on the room advisory lock.
-- Both mark_room_settling and settle_room_when_all_paid update rooms.stage, so neither path can
-- leave an unusable pending invitation visible. Accepted/declined/expired rows remain unchanged.
create or replace function private.s4_expire_settlement_invitations() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.room_invitations
 set status='expired',responded_at=coalesce(responded_at,clock_timestamp())
 where room_id=new.id and status='pending';
 return new;
end; $$;
revoke all on function private.s4_expire_settlement_invitations() from public,anon,authenticated,service_role;
drop trigger if exists s4_expire_settlement_invitations on public.rooms;
create trigger s4_expire_settlement_invitations after update of stage on public.rooms
for each row when (new.stage in ('settling','done') and old.stage is distinct from new.stage)
execute function private.s4_expire_settlement_invitations();

-- CREATE TRIGGER holds a room-table lock against concurrent stage writes until commit.
-- Do not acquire room advisory locks here: an existing writer may hold one while waiting on DDL.
update public.room_invitations i
set status='expired',responded_at=coalesce(i.responded_at,clock_timestamp())
from public.rooms r where r.id=i.room_id and r.stage in ('settling','done') and i.status='pending';
commit;
