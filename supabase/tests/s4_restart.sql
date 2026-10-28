begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local s1.tap='on';
select no_plan();
\ir s4_fixture.sql
-- Trusted owner-confirmed fixture; actual creation/completion APIs drive the lifecycle.
update public.rooms set stage='confirmed',appointment_confirmed_at=clock_timestamp(),appointment_confirmed_by=owner_id where id in('24000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000002');
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
insert into s4_data values('first-bill',to_jsonb(public.create_room_settlement_v2('24000000-0000-4000-8000-000000000001','First',2000,'Synthetic','0000','A')));
select pg_temp.check(public.get_room_s4_state('24000000-0000-4000-8000-000000000001')->>'stage'='settling','first bill still enters settling');
select public.set_settlement_completed(id,true) from public.dutch_pay_members where bill_id=(select (v#>>'{}')::uuid from s4_data where k='first-bill') and not is_completed;
reset role;
create temporary table first_completion as select settled_at,expires_at,appointment_confirmed_at from public.rooms where id='24000000-0000-4000-8000-000000000001';
select pg_temp.check((select stage='done' and settled_at is not null and expires_at=settled_at+interval '24 hours' from public.rooms where id='24000000-0000-4000-8000-000000000001'),'first completion creates a matching 24-hour deadline');
set local role authenticated;
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
insert into s4_data values('next-bill',to_jsonb(public.create_room_settlement_v2('24000000-0000-4000-8000-000000000001','Second',3000,'Synthetic','1111','B')));
select pg_temp.check((select v from s4_data where k='next-bill')<>(select v from s4_data where k='first-bill'),'restart creates a distinct bill');
select pg_temp.check(public.get_room_s4_state('24000000-0000-4000-8000-000000000001')->>'stage'='settling','real done-to-new-bill request returns to settling');
reset role;
select pg_temp.check((select settled_at is null and isfinite(expires_at) and expires_at=(select created_at+interval '7 days' from public.dutch_pay_bills where id=(select (v#>>'{}')::uuid from s4_data where k='next-bill')) and appointment_confirmed_at=(select appointment_confirmed_at from first_completion) from public.rooms where id='24000000-0000-4000-8000-000000000001'),'restart clears the old countdown and retains confirmation evidence');
set local role authenticated;
select pg_temp.check(public.create_room_settlement('24000000-0000-4000-8000-000000000001','Second',3000,'Synthetic','1111','B')=(select (v#>>'{}')::uuid from s4_data where k='next-bill'),'legacy retry reuses the active bill');
select public.delete_expired_rooms();
select pg_temp.check(public.get_room_s4_state('24000000-0000-4000-8000-000000000001')->>'stage'='settling','real cleanup cannot delete a live bounded active restart');
reset role;
-- The predicate remains false even well past the old deadline: no wall-clock sleep needed.
select pg_temp.check((select expires_at>(select expires_at from first_completion) and expires_at<=(select appointment_confirmed_at+interval '30 days' from first_completion) from public.rooms where id='24000000-0000-4000-8000-000000000001'),'active restart replaces the previous deadline but respects absolute retention');
update public.dutch_pay_members set is_completed=true where bill_id=(select (v#>>'{}')::uuid from s4_data where k='first-bill');
select pg_temp.check((select stage='settling' and settled_at is null from public.rooms where id='24000000-0000-4000-8000-000000000001'),'an old bill completion trigger cannot finish another unpaid bill');
set local role authenticated;
select pg_temp.check(public.get_settlement_payment_details((select (v#>>'{}')::uuid from s4_data where k='first-bill'))->'payment_details'='null'::jsonb,'old account disclosure remains closed after restart');
select pg_temp.as_user('10000003-0000-4000-8000-000000000003');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.create_room_settlement_v2('24000000-0000-4000-8000-000000000001','Other',4000,'Synthetic','2222','C')$q$)='42501','nonmember cannot restart or modify settlement');
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
select public.set_settlement_completed(id,true) from public.dutch_pay_members where bill_id=(select (v#>>'{}')::uuid from s4_data where k='next-bill') and not is_completed;
reset role;
select pg_temp.check((select stage='done' and settled_at>(select settled_at from first_completion) and expires_at=settled_at+interval '24 hours' from public.rooms where id='24000000-0000-4000-8000-000000000001'),'second completion uses a fresh completion timestamp and deadline');
create temporary table second_completion as select to_jsonb(r) value from public.rooms r where id='24000000-0000-4000-8000-000000000001';
set local role authenticated;
select public.set_settlement_completed(id,true) from public.dutch_pay_members where bill_id=(select (v#>>'{}')::uuid from s4_data where k='next-bill');
reset role;
select pg_temp.check((select to_jsonb(r)=(select value from second_completion) from public.rooms r where id='24000000-0000-4000-8000-000000000001'),'completed-true retry never extends the deadline');
set local role authenticated;
insert into s4_data values('third-bill',to_jsonb(public.create_room_settlement('24000000-0000-4000-8000-000000000001','Third',3000,'Synthetic','2222','B')));
select pg_temp.check(public.get_room_s4_state('24000000-0000-4000-8000-000000000001')->>'stage'='settling','legacy creation also restarts done correctly');
-- Single real recipient auto-completes a restarted bill via INSERT as before.
select pg_temp.as_user('10000003-0000-4000-8000-000000000003');
insert into s4_data values('solo-first',to_jsonb(public.create_room_settlement_v2('24000000-0000-4000-8000-000000000002','Solo',1000,'Synthetic','0000','C')));
insert into s4_data values('solo-next',to_jsonb(public.create_room_settlement_v2('24000000-0000-4000-8000-000000000002','Solo next',1000,'Synthetic','1111','C')));
select pg_temp.check(public.get_room_s4_state('24000000-0000-4000-8000-000000000002')->>'stage'='done','solo restart immediately reaches done again through the INSERT trigger');
reset role;
select pg_temp.check((select settled_at is not null and isfinite(expires_at) and expires_at=settled_at+interval '24 hours' from public.rooms where id='24000000-0000-4000-8000-000000000002'),'solo restart restores a finite completion deadline');
-- Rehearse the exact migration against the old done+open-bill bug, inside rollback.
update public.rooms set stage='done',settled_at=clock_timestamp()-interval '2 days',expires_at=clock_timestamp()+interval '1 day' where id='24000000-0000-4000-8000-000000000001';
update public.rooms set stage='done' where id='24000000-0000-4000-8000-000000000003';
insert into public.dutch_pay_bills(room_id,creator_id,title,total_amount,split_count) values('24000000-0000-4000-8000-000000000003','10000006-0000-4000-8000-000000000006','Unverified legacy empty bill',1000,1);
-- Expired owner-confirmed room has an open bill: migration must preserve it byte for byte.
insert into public.dutch_pay_bills(room_id,creator_id,title,total_amount,split_count) values('24000000-0000-4000-8000-000000000004','10000001-0000-4000-8000-000000000001','Expired open',1000,1);
update public.rooms set stage='done',appointment_confirmed_at=clock_timestamp()-interval '2 days',expires_at=clock_timestamp()-interval '1 day' where id='24000000-0000-4000-8000-000000000004';
-- Live historical rooms with an already exhausted absolute/bill window must not be revived.
insert into public.rooms(id,code,title,meeting_date,expires_at,owner_id) values
 ('24000000-0000-4000-8000-000000000005','S4REPAIR5','Absolute window exhausted',current_date+1,clock_timestamp()+interval '1 day','10000001-0000-4000-8000-000000000001'),
 ('24000000-0000-4000-8000-000000000006','S4REPAIR6','Bill window exhausted',current_date+1,clock_timestamp()+interval '1 day','10000001-0000-4000-8000-000000000001'),
 ('24000000-0000-4000-8000-000000000007','S4REPAIR7','Previous unbounded restart',current_date+1,clock_timestamp()+interval '1 day','10000001-0000-4000-8000-000000000001'),
 ('24000000-0000-4000-8000-000000000008','S4REPAIR8','Elapsed unbounded restart',current_date+1,clock_timestamp()+interval '1 day','10000001-0000-4000-8000-000000000001');
insert into public.dutch_pay_bills(room_id,creator_id,title,total_amount,split_count,created_at) values
 ('24000000-0000-4000-8000-000000000005','10000001-0000-4000-8000-000000000001','Absolute expired',1000,1,clock_timestamp()),
 ('24000000-0000-4000-8000-000000000006','10000001-0000-4000-8000-000000000001','Bill expired',1000,1,clock_timestamp()-interval '8 days'),
 ('24000000-0000-4000-8000-000000000007','10000001-0000-4000-8000-000000000001','Old unbounded',1000,1,clock_timestamp()-interval '2 days'),
 ('24000000-0000-4000-8000-000000000008','10000001-0000-4000-8000-000000000001','Elapsed unbounded',1000,1,clock_timestamp()-interval '8 days');
update public.rooms set stage='done',appointment_confirmed_at=clock_timestamp()-interval '31 days' where id='24000000-0000-4000-8000-000000000005';
update public.rooms set stage='done',appointment_confirmed_at=clock_timestamp() where id='24000000-0000-4000-8000-000000000006';
update public.rooms set stage='settling',appointment_confirmed_at=clock_timestamp(),expires_at='infinity' where id='24000000-0000-4000-8000-000000000007';
update public.rooms set stage='settling',appointment_confirmed_at=clock_timestamp(),expires_at='infinity' where id='24000000-0000-4000-8000-000000000008';
\ir s4_inventory_body.sql
select pg_temp.check((select expired_owner_confirmed_done_with_open_bill=1 and rooms_with_nonfinite_expiry=2 from actual_inventory),'actual read-only inventory counts expired owner-confirmed done with open bill');
create temporary table migration_before as select id,to_jsonb(r) value from public.rooms r;
create temporary table bills_before as select id,to_jsonb(b) value from public.dutch_pay_bills b;
\ir s4_lifecycle_body.sql
select pg_temp.check((select stage='settling' and settled_at is null and isfinite(expires_at) and expires_at=(select created_at+interval '7 days' from public.dutch_pay_bills where id=(select (v#>>'{}')::uuid from s4_data where k='third-bill')) from public.rooms where id='24000000-0000-4000-8000-000000000001'),'actual migration repairs a live owner-confirmed done room with unfinished bill');
select pg_temp.check(not exists(select 1 from migration_before old join public.rooms r using(id) where r.id not in('24000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000007','24000000-0000-4000-8000-000000000008') and old.value<>to_jsonb(r)),'migration preserves completed rooms, unverified legacy rooms and unrelated rooms exactly');
select pg_temp.check((select stage='settling' and settled_at is null and isfinite(expires_at) and expires_at=(select created_at+interval '7 days' from public.dutch_pay_bills where room_id=r.id) from public.rooms r where id='24000000-0000-4000-8000-000000000007'),'previous unbounded restart is bounded from original bill creation, not migration time');
select pg_temp.check((select stage='settling' and isfinite(expires_at) and expires_at<clock_timestamp() from public.rooms where id='24000000-0000-4000-8000-000000000008'),'elapsed old unbounded restart is shortened to its past finite limit without revival');
select pg_temp.check(not exists(select 1 from bills_before old join public.dutch_pay_bills b using(id) where old.value<>to_jsonb(b)),'migration never rewrites accounts, bills or disclosure state');
create temporary table migration_after as select id,to_jsonb(r) value from public.rooms r;
\ir s4_lifecycle_body.sql
select pg_temp.check(not exists(select 1 from migration_after old join public.rooms r using(id) where old.value<>to_jsonb(r)),'migration repair is idempotent');
set local role authenticated;
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
select public.delete_expired_rooms();
select pg_temp.check(public.get_room_s4_state('24000000-0000-4000-8000-000000000001')->>'stage'='settling','repaired room survives actual cleanup within its finite new deadline');
select public.set_settlement_completed(id,true) from public.dutch_pay_members where bill_id=(select (v#>>'{}')::uuid from s4_data where k='third-bill') and not is_completed;
reset role;
select pg_temp.check((select stage='done' and settled_at>clock_timestamp()-interval '1 minute' and expires_at=settled_at+interval '24 hours' from public.rooms where id='24000000-0000-4000-8000-000000000001'),'repaired active bill completes into a new cleanup deadline');
update public.rooms set expires_at=clock_timestamp()-interval '1 second' where id='24000000-0000-4000-8000-000000000001';
set local role authenticated;
select public.delete_expired_rooms();
reset role;
select pg_temp.check(not exists(select 1 from public.rooms where id='24000000-0000-4000-8000-000000000001'),'cleanup deletes the room once the new completion deadline passes');
select pg_temp.check((select room_id is null and payment_disclosure_closed_at is not null and account_number='' from public.dutch_pay_bills where id=(select (v#>>'{}')::uuid from s4_data where k='third-bill')),'final cleanup preserves closed settlement history without account contents');
select pg_temp.check(not has_function_privilege('authenticated','public.mark_room_settling()','EXECUTE') and not has_function_privilege('service_role','public.settle_room_when_all_paid()','EXECUTE') and (select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc where oid in('public.mark_room_settling()'::regprocedure,'public.settle_room_when_all_paid()'::regprocedure)),'lifecycle triggers keep fixed search_path and narrow execution rights');
select * from finish();
rollback;
