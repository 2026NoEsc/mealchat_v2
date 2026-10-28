begin;
set local s1.tap='off';
\ir s3_fixture.sql
select pg_temp.check((select expires_at=created_at+interval '7 days' and expires_at<clock_timestamp() from public.rooms where id='36000000-0000-4000-8000-000000000001'),'old unconfirmed room shortens against original creation and can immediately expire');
select pg_temp.check((select expires_at=appointment_confirmed_at+interval '30 days' from public.rooms where id='36000000-0000-4000-8000-000000000002'),'infinite confirmed room is bounded by original confirmation');
select pg_temp.check((select created_at='infinity'::timestamptz and expires_at=current_setting('mealchat.s3.transition_at')::timestamptz from public.rooms where id='36000000-0000-4000-8000-000000000003'),'unknown original anchor uses approved fixed cap without fabricating creation');
select pg_temp.check((select expires_at=settled_at+interval '24 hours' from public.rooms where id='36000000-0000-4000-8000-000000000004'),'legacy done room receives its original completion cap');
select pg_temp.check((select r.expires_at=b.expires_at from public.rooms r join s3_upgrade_before b using(id) where r.id='36000000-0000-4000-8000-000000000005'),'already expired room is never revived');
select pg_temp.check((select count(*)=0 from public.rooms where lifecycle_version=1 and (not isfinite(expires_at) or expires_at>hard_expires_at)),'upgraded rooms have finite bounded expiry');
select pg_temp.check((select count(*)=0 from public.rooms where lifecycle_version=1 and isfinite(created_at) and created_at<=clock_timestamp() and appointment_confirmed_at is null and expires_at>created_at+interval '7 days'),'unconfirmed old rooms cannot exceed original creation cap');
select pg_temp.check((select count(*)=0 from private.s3_invite_codes where expires_at>issued_at+interval '7 days'),'legacy code TTL receives one bounded generation');
select pg_temp.check((select count(*)=3 from pg_proc where pronamespace='private'::regnamespace and proname in('cleanup_expired_rooms_v1','expire_owner_transfers_v1','purge_s3_ephemeral_v1')),'three separate workers exist');
update public.rooms set expires_at=clock_timestamp()-interval '1 second' where id=pg_temp.s3_room();
select pg_temp.check(private.cleanup_expired_rooms_v1()>=1,'active worker deletes expired rooms without app access');
select pg_temp.check(not exists(select 1 from public.rooms where id=pg_temp.s3_room()),'expired room is physically removed');
rollback;
