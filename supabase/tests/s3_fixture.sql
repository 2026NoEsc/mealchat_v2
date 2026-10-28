\ir s4_fixture.sql
-- Adversarial upgrade rows are synthetic and live only inside test rollback
-- (or the dedicated HTTP/concurrency fixture followed by an isolated reset).
insert into public.rooms(id,code,title,meeting_date,created_at,expires_at,owner_id,stage,appointment_confirmed_at,settled_at) values
 ('36000000-0000-4000-8000-000000000001','OLD111','Synthetic old draft',current_date,clock_timestamp()-interval '30 days',clock_timestamp()+interval '10 days','10000001-0000-4000-8000-000000000001','scheduling',null,null),
 ('36000000-0000-4000-8000-000000000002','OLD222','Synthetic confirmed anchor',current_date,clock_timestamp()-interval '20 days','infinity','10000001-0000-4000-8000-000000000001','settling',clock_timestamp()-interval '15 days',null),
 ('36000000-0000-4000-8000-000000000003','OLD333','Synthetic unknown anchor',current_date,'infinity','infinity','10000001-0000-4000-8000-000000000001','scheduling',null,null),
 ('36000000-0000-4000-8000-000000000004','OLD444','Synthetic legacy done',current_date,clock_timestamp()-interval '20 days',clock_timestamp()+interval '10 days','10000001-0000-4000-8000-000000000001','done',clock_timestamp()-interval '15 days',clock_timestamp()-interval '4 days'),
 ('36000000-0000-4000-8000-000000000005','OLD555','Synthetic already expired',current_date,clock_timestamp()-interval '1 day',clock_timestamp()-interval '1 hour','10000001-0000-4000-8000-000000000001','scheduling',null,null),
 ('36000000-0000-4000-8000-000000000006','OLD666','Synthetic pre-creation confirmation',current_date,clock_timestamp()-interval '20 days',clock_timestamp()+interval '10 days','10000001-0000-4000-8000-000000000001','confirmed',clock_timestamp()-interval '21 days',null);
create temporary table s3_upgrade_before as select id,created_at,expires_at from public.rooms;
set local mealchat.s3.transition_at='2026-10-22T00:00:00Z';
-- Test deadline is computed once from the disposable server, never migration time
-- masquerading as an original created/confirmed anchor.
select set_config('mealchat.s3.transition_at',private.s4_iso(clock_timestamp()+interval '1 day'),true);
select set_config('mealchat.s3.expected_inventory',private.s3_inventory_counts()::text,true);
\ir s3_activation_test_body.sql
select pg_temp.check(not enabled and activated_at is not null,'activation leaves cleanup OFF') from private.s3_worker_control where singleton;
-- Fixture-only explicit cleanup start; the release uses s3_start_cleanup.sql.
update private.s3_worker_control set enabled=true where singleton;
grant all on s4_data to authenticated;
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
insert into s4_data values('s3_created',public.create_room_v1('Synthetic S3','#23A455','33000000-0000-4000-8000-000000000001'));
reset role;
create function pg_temp.s3_room() returns uuid language sql as $$select (v->>'room_id')::uuid from s4_data where k='s3_created'$$;
create function pg_temp.s3_rev() returns bigint language sql as $$select s4_revision from public.rooms where id=pg_temp.s3_room()$$;
grant execute on function pg_temp.s3_room(),pg_temp.s3_rev() to authenticated;
select pg_advisory_xact_lock(hashtextextended(pg_temp.s3_room()::text,0));
insert into public.participants(room_id,profile_id,name) values(pg_temp.s3_room(),'10000002-0000-4000-8000-000000000002','Synthetic B');
insert into public.participants(room_id,profile_id,name) values(pg_temp.s3_room(),null,'Synthetic display-only row');
