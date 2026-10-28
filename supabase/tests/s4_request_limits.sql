begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local s1.tap='on';
select no_plan();
\ir s4_fixture.sql
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
insert into s4_data values('cap-before',to_jsonb(pg_temp.s4_revision('24000000-0000-4000-8000-000000000001')));
select public.submit_room_availability_v1('24000000-0000-4000-8000-000000000001',array(select jsonb_array_elements_text(v) from s4_data where k='slots'),pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),'68000000-0000-4000-8000-000000000001');
reset role;
insert into private.s4_requests(actor_id,request_id,room_id,operation,payload_hash,applied_revision)
select '10000001-0000-4000-8000-000000000001',gen_random_uuid(),'24000000-0000-4000-8000-000000000001','submit',repeat('0',64),0 from generate_series(1,999);
set local role authenticated;
select pg_temp.check(public.submit_room_availability_v1('24000000-0000-4000-8000-000000000001',array(select jsonb_array_elements_text(v) from s4_data where k='slots'),(select (v#>>'{}')::bigint from s4_data where k='cap-before'),'68000000-0000-4000-8000-000000000001')->>'outcome'='replayed','successful request replays at actor cap without consuming another row');
insert into s4_data values('cap-revision',to_jsonb(pg_temp.s4_revision('24000000-0000-4000-8000-000000000001')));
select pg_temp.check(pg_temp.sqlstate_of($q$select public.submit_room_availability_v1('24000000-0000-4000-8000-000000000001','{}',pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid())$q$)='S4011','actor cap rejects a fresh request');
select pg_temp.check(pg_temp.s4_revision('24000000-0000-4000-8000-000000000001')=(select (v#>>'{}')::bigint from s4_data where k='cap-revision') and public.get_room_s4_state('24000000-0000-4000-8000-000000000001')->'availability'->>'submitted_count'='1','actor-cap failure rolls back schedule and revision');
reset role;
select pg_temp.check((select count(*)=1000 from private.s4_requests),'actor cap leaves the bounded ledger unchanged');
set local role authenticated;
select pg_temp.check(pg_temp.s4_submit('24000000-0000-4000-8000-000000000001')->>'outcome'='applied','same schedule succeeds at actor cap without another ledger entry');
select pg_temp.s4_submit('24000000-0000-4000-8000-000000000001') from generate_series(1,20);
reset role;
select pg_temp.check((select count(*)=1000 from private.s4_requests) and pg_temp.s4_revision('24000000-0000-4000-8000-000000000001')=(select (v#>>'{}')::bigint from s4_data where k='cap-revision'),'fresh IDs for identical schedules do not grow ledger or revision');
-- Historical actor requests plus the owner at cap; caller B has no usage.

insert into private.s4_requests(actor_id,request_id,room_id,operation,payload_hash,applied_revision)
select ('1000000'||i||'-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,gen_random_uuid(),'24000000-0000-4000-8000-000000000001','submit',repeat('0',64),0 from generate_series(3,6) i cross join generate_series(1,1000) n;
set local role authenticated;
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
select pg_temp.check(pg_temp.sqlstate_of($q$select pg_temp.s4_submit('24000000-0000-4000-8000-000000000001')$q$)='S4011','room cap rejects another actor below their own cap');
reset role;
select pg_temp.check((select count(*)=5000 from private.s4_requests) and (select schedule='{}' from public.participants where room_id='24000000-0000-4000-8000-000000000001' and profile_id='10000002-0000-4000-8000-000000000002'),'room-cap failure leaves schedule and ledger unchanged');
-- Submission budgets never consume the owner's decision capacity, including their actor quota.
set local role authenticated;
select public.set_my_availability('24000000-0000-4000-8000-000000000001',array(select jsonb_array_elements_text(v) from s4_data where k='slots'));
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(public.select_room_meeting_time_v1('24000000-0000-4000-8000-000000000001',(select v from s4_data where k='time'),pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid())->'state'->>'stage'='place','owner time selection succeeds with actor and room submit budgets exhausted');
insert into s4_data values('cap-menu',to_jsonb(public.add_voting_item('24000000-0000-4000-8000-000000000001','menu','Capacity restaurant')));
select public.toggle_vote('24000000-0000-4000-8000-000000000001',(select (v#>>'{}')::uuid from s4_data where k='cap-menu'));
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
select public.toggle_vote('24000000-0000-4000-8000-000000000001',(select (v#>>'{}')::uuid from s4_data where k='cap-menu'));
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(public.confirm_room_appointment_v1('24000000-0000-4000-8000-000000000001',(select (v#>>'{}')::uuid from s4_data where k='cap-menu'),pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid())->'state'->>'confirmation_status'='owner_confirmed','owner confirmation succeeds with both submit budgets exhausted');
reset role;
select pg_temp.check((select count(*)=5000 from private.s4_requests where operation='submit') and (select count(*)=2 from private.s4_requests where operation in('select','confirm')),'decision rows retain replay history outside submission budgets');
-- Model an enlarged current membership and historical ledger at the old 5,000 limit.
delete from private.s4_requests;
update public.rooms set stage='scheduling',meeting_starts_at=null,meeting_ends_at=null,meeting_time_zone=null,appointment_confirmed_at=null,appointment_confirmed_by=null where id='24000000-0000-4000-8000-000000000001';
insert into public.participants(room_id,profile_id,name)
select '24000000-0000-4000-8000-000000000001',('1000000'||i||'-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'Synthetic extra' from generate_series(3,6) i;
update public.participants set schedule='{}' where room_id='24000000-0000-4000-8000-000000000001' and profile_id='10000002-0000-4000-8000-000000000002';
insert into private.s4_requests(actor_id,request_id,room_id,operation,payload_hash,applied_revision)
select ('1000000'||i||'-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,gen_random_uuid(),'24000000-0000-4000-8000-000000000001','submit',repeat('0',64),0 from generate_series(3,7) i cross join generate_series(1,1000) n;
set local role authenticated;
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
select pg_temp.check(pg_temp.s4_submit('24000000-0000-4000-8000-000000000001')->>'outcome'='applied','six actual members expand room submit capacity beyond 5000');
reset role;
insert into private.s4_requests(actor_id,request_id,room_id,operation,payload_hash,applied_revision)
select '10000008-0000-4000-8000-000000000008',gen_random_uuid(),'24000000-0000-4000-8000-000000000001','submit',repeat('0',64),0 from generate_series(1,999);
set local role authenticated;
select pg_temp.check(pg_temp.sqlstate_of($q$select public.submit_room_availability_v1('24000000-0000-4000-8000-000000000001','{}',pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid())$q$)='S4011','six-member room enforces its 6000-row submit budget');
select pg_temp.check(pg_temp.s4_submit('24000000-0000-4000-8000-000000000001')->>'outcome'='applied','unchanged schedule still succeeds at expanded room capacity');
reset role;
select pg_temp.check((select count(*)=6000 from private.s4_requests),'same schedule at room cap retains exactly 6000 ledger rows');
delete from public.rooms where id='24000000-0000-4000-8000-000000000001';
select pg_temp.check(not exists(select 1 from private.s4_requests),'room deletion frees request capacity by cascade without a cron');
select pg_temp.check(exists(select 1 from pg_indexes where schemaname='private' and tablename='s4_requests' and indexname='s4_requests_room_idx'),'room cap and FK cleanup have a supporting index');
select pg_temp.check(not exists(select 1 from pg_proc where oid in('public.submit_room_availability_v1(uuid,text[],bigint,uuid)'::regprocedure,'public.select_room_meeting_time_v1(uuid,jsonb,bigint,uuid)'::regprocedure,'public.confirm_room_appointment_v1(uuid,uuid,bigint,uuid)'::regprocedure) and prosrc like '%private.s4_room(%'),'public mutation wrappers delegate to a single room-lock boundary');
select pg_temp.check(not exists(select 1 from pg_proc where oid in('public.get_room_s4_state(uuid)'::regprocedure,'public.room_availability_status(uuid)'::regprocedure,'public.room_availability_cells(uuid)'::regprocedure,'private.s4_read_room(uuid)'::regprocedure,'private.s4_state(uuid)'::regprocedure,'private.s4_availability(uuid)'::regprocedure,'private.s4_leader(uuid)'::regprocedure) and provolatile<>'s'),'read endpoint graph uses a stable statement snapshot');
select * from finish();
rollback;
