begin;
set local s1.tap='off';
\ir s3_fixture.sql
select pg_temp.check(not has_table_privilege('authenticated','public.rooms','INSERT') and not has_any_column_privilege('authenticated','public.rooms','INSERT'),'direct room INSERT table and column grants are both revoked');
select pg_temp.check(not has_table_privilege(role,'public.rooms','UPDATE') and not has_table_privilege(role,'public.rooms','DELETE') and not has_table_privilege(role,'public.participants','INSERT') and not has_table_privilege(role,'public.participants','DELETE'),'room/member direct write denied for '||role) from unnest(array['anon','authenticated','service_role']) role;
select pg_temp.check(not has_function_privilege(role,'public.post_room_system_message(uuid,text)','EXECUTE'),'R1 revoked for '||role) from unnest(array['anon','authenticated','service_role']) role;
select pg_temp.check(not has_function_privilege(role,'private.cleanup_expired_rooms_v1()','EXECUTE'),'worker RPC denied for '||role) from unnest(array['anon','authenticated','service_role']) role;
select pg_temp.check(has_function_privilege('mealchat_s3_worker','private.cleanup_expired_rooms_v1()','EXECUTE'),'dedicated worker has narrow cleanup execution');
select pg_temp.check(not has_table_privilege(role,'private.s3_invite_limits','SELECT'),'limiter table denied for '||role) from unnest(array['anon','authenticated','service_role']) role;
set local role authenticated;
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
select pg_temp.check(pg_temp.sqlstate_of($q$update public.rooms set owner_id=auth.uid() where id=pg_temp.s3_room()$q$)='42501','member cannot directly seize ownership');
select pg_temp.check(pg_temp.sqlstate_of($q$insert into public.messages(room_id,message,lifecycle_event_type) values(pg_temp.s3_room(),'forged','member_left')$q$)='42501','client cannot forge structured event');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.close_room_v1(pg_temp.s3_room(),pg_temp.s3_rev(),gen_random_uuid())$q$)='42501','nonowner cannot close room');
rollback;
