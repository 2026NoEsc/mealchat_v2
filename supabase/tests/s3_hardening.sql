begin;
set local s1.tap='off';
\ir s3_fixture.sql
set local role authenticated;
select pg_temp.as_user('10000003-0000-4000-8000-000000000003');
insert into s4_data values('stale_preview',public.preview_room_invite_v1((select v->>'code' from s4_data where k='s3_created')));
reset role;
update public.rooms set title='Synthetic revised title' where id=pg_temp.s3_room();
set local role authenticated;
select pg_temp.check(public.join_room_invite_v1((select (v->>'preview_id')::uuid from s4_data where k='stale_preview'),gen_random_uuid())->>'reason'='PREVIEW_STALE','stale preview is a retryable display conflict') from generate_series(1,5);
reset role;
select pg_temp.check((select failure_count=0 and lock_until is null and minute_count=6 from private.s3_invite_limits where actor_id='10000003-0000-4000-8000-000000000003'),'stale previews consume request allowance but never guess failures');
update private.s3_invite_previews set expires_at=clock_timestamp()-interval '1 second' where id=(select (v->>'preview_id')::uuid from s4_data where k='stale_preview');
set local role authenticated;
select pg_temp.check(public.join_room_invite_v1((select (v->>'preview_id')::uuid from s4_data where k='stale_preview'),gen_random_uuid())->>'reason'='INVITE_UNAVAILABLE','expired actor-bound preview is uniform without guess penalty') from generate_series(1,5);
reset role;
select pg_temp.check((select failure_count=0 and lock_until is null and minute_count=11 from private.s3_invite_limits where actor_id='10000003-0000-4000-8000-000000000003'),'expired previews never lock an otherwise valid actor');
select pg_temp.check((select condeferrable and condeferred from pg_constraint where conrelid='private.s3_invite_limits'::regclass and contype='f'),'initial limiter FK is deferred past room/profile acquisition');
select pg_temp.check((select count(*)=4 from pg_indexes where schemaname='private' and indexname in('s3_requests_room','s3_transfer_requests_room','s3_invite_previews_room','s3_create_tombstones_room')),'all room cascade and lookup ledgers have room indexes');
select pg_temp.check(exists(select 1 from pg_indexes where schemaname='public' and indexname='s3_messages_actor_room_time'),'actor FK and bounded event count have an actor-leading index');
select pg_temp.check((select not rolcanlogin and not rolsuper from pg_roles where rolname='mealchat_s3_worker'),'worker owner is NOLOGIN and not superuser');
select pg_temp.check((select pg_get_userbyid(proowner)='mealchat_s3_worker' and prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='private.run_s3_job_v1(text)'::regprocedure),'single cron entry uses the restricted worker identity');
select pg_temp.check(not has_function_privilege(role,'private.run_s3_job_v1(text)','EXECUTE'),'cron entry denied for '||role) from unnest(array['anon','authenticated','service_role']) role;
-- Same request UUID is legal for different actors. Scope prevents global
-- event_key uniqueness from swallowing one of their independent facts.
select private.s3_event(pg_temp.s3_room(),'member_left','10000001-0000-4000-8000-000000000001','member-left:39000000-0000-4000-8000-000000000001');
select private.s3_event(pg_temp.s3_room(),'member_left','10000002-0000-4000-8000-000000000002','member-left:39000000-0000-4000-8000-000000000001');
select pg_temp.check((select count(*)=2 from public.messages where room_id=pg_temp.s3_room() and event_key like '%:39000000-0000-4000-8000-000000000001'),'same UUID across actors preserves both event facts');
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
do $$ declare result jsonb; i integer; begin
 for i in 1..12 loop
  result:=public.request_room_owner_transfer_v1(pg_temp.s3_room(),'10000002-0000-4000-8000-000000000002',false,pg_temp.s3_rev(),gen_random_uuid());
  perform public.cancel_room_owner_transfer_v1((result->>'transfer_id')::uuid,pg_temp.s3_rev(),gen_random_uuid());
 end loop;
end; $$;
reset role;
select pg_temp.check((select count(*)=24 from private.s3_requests where room_id=pg_temp.s3_room() and operation in('request_transfer','cancel_transfer')),'announcement budget does not drop mutation receipts');
select pg_temp.check((select count(*)=10 from public.messages where room_id=pg_temp.s3_room() and lifecycle_actor_id='10000001-0000-4000-8000-000000000001' and lifecycle_event_type in('member_left','owner_transfer_pending','owner_transfer_cancelled')),'repeated transfer/cancel announcements are capped at ten per actor room minute');
set local role authenticated;
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
do $$ declare preview jsonb; i integer; begin
 for i in 1..12 loop
  perform public.leave_room_member_v1(pg_temp.s3_room(),pg_temp.s3_rev(),gen_random_uuid());
  preview:=public.preview_room_invite_v1((select v->>'code' from s4_data where k='s3_created'));
  perform public.join_room_invite_v1((preview->>'preview_id')::uuid,gen_random_uuid());
 end loop;
end; $$;
reset role;
select pg_temp.check((select count(*)=24 from private.s3_requests where room_id=pg_temp.s3_room() and actor_id='10000002-0000-4000-8000-000000000002' and operation in('leave','join')),'leave and rejoin cycles preserve every authoritative mutation');
select pg_temp.check((select count(*)=10 from public.messages where room_id=pg_temp.s3_room() and lifecycle_actor_id='10000002-0000-4000-8000-000000000002' and lifecycle_event_type in('member_left','member_joined')),'repeated leave and rejoin announcements share the same budget');
-- Isolate a failing delete. The complete failed room subtransaction (including
-- tombstone/transfer work) rolls back; other expired rooms still get collected.
create function pg_temp.fail_one_delete() returns trigger language plpgsql as $$ begin
 if old.id='36000000-0000-4000-8000-000000000001' then raise exception 'SYNTHETIC_ROOM_DELETE_FAILURE'; end if;
 return old;
end; $$;
create trigger s3_test_delete_failure before delete on public.rooms for each row execute function pg_temp.fail_one_delete();
select pg_temp.check(private.run_s3_job_v1('rooms')>=1,'one bad room does not abort cleanup of other rooms');
select pg_temp.check(exists(select 1 from public.rooms where id='36000000-0000-4000-8000-000000000001') and not exists(select 1 from public.rooms where id='36000000-0000-4000-8000-000000000004'),'failed room remains for retry while another expired room is deleted');
select pg_temp.check((select failure_count=1 and last_failure_sqlstate='P0001' and last_failure_at is not null from private.s3_worker_stats where worker='rooms'),'room failure count and non-sensitive SQLSTATE persist');
drop trigger s3_test_delete_failure on public.rooms;
-- A pre-creation appointment is an untrusted anchor, not a write-time exception.
update public.rooms set appointment_confirmed_at=created_at-interval '1 day' where id=pg_temp.s3_room();
update public.rooms set title='Synthetic untrusted anchor update' where id=pg_temp.s3_room();
select pg_temp.check((select expires_at<=hard_expires_at and isfinite(hard_expires_at) from public.rooms where id=pg_temp.s3_room()),'untrusted appointment falls back to existing finite hard cap');
update public.rooms set title='Synthetic D8 untrusted anchor update' where id='36000000-0000-4000-8000-000000000006';
select pg_temp.check((select hard_expires_at=current_setting('mealchat.s3.transition_at')::timestamptz and expires_at<=hard_expires_at from public.rooms where id='36000000-0000-4000-8000-000000000006'),'D8 untrusted pre-creation confirmation retains its approved cap on later writes');
-- The transfer worker has the same room-level exception isolation.
insert into private.s3_transfer_requests(room_id,from_owner_id,target_profile_id,leave_after_accept,expires_at,request_id)
 values(pg_temp.s3_room(),'10000001-0000-4000-8000-000000000001','10000002-0000-4000-8000-000000000002',false,clock_timestamp()-interval '1 second',gen_random_uuid()),
 ('24000000-0000-4000-8000-000000000001','10000001-0000-4000-8000-000000000001','10000002-0000-4000-8000-000000000002',false,clock_timestamp()-interval '1 second',gen_random_uuid());
create function pg_temp.fail_one_transfer() returns trigger language plpgsql as $$ begin
 if old.room_id=pg_temp.s3_room() then raise exception 'SYNTHETIC_TRANSFER_FAILURE'; end if;
 return new;
end; $$;
create trigger s3_test_transfer_failure before update on private.s3_transfer_requests for each row execute function pg_temp.fail_one_transfer();
select pg_temp.check(private.run_s3_job_v1('transfers')=1,'failed transfer room does not abort another room expiry');
select pg_temp.check(exists(select 1 from private.s3_transfer_requests where room_id=pg_temp.s3_room() and status='pending') and exists(select 1 from private.s3_transfer_requests where room_id='24000000-0000-4000-8000-000000000001' and status='expired'),'transfer failures leave their room retryable and commit other room outcomes');
select pg_temp.check((select failure_count=1 and last_failure_sqlstate='P0001' from private.s3_worker_stats where worker='transfers'),'transfer failures persist only count time and SQLSTATE');
rollback;
