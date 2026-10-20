begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local s1.tap='on';
select no_plan();
\ir s4_fixture.sql
insert into public.follows(follower_id,following_id,role) values('10000001-0000-4000-8000-000000000001','10000004-0000-4000-8000-000000000004','mate') on conflict do nothing;
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select public.create_room_invitation('24000000-0000-4000-8000-000000000001','10000004-0000-4000-8000-000000000004');
create function pg_temp.s4_actor(u uuid,cmd text) returns text language plpgsql as $$ begin perform pg_temp.as_user(u); return pg_temp.sqlstate_of(cmd); end; $$;
select pg_temp.check(pg_temp.s4_actor(u,format(sql,r))=expected,label||' / '||name) from
(values
 ('10000003-0000-4000-8000-000000000003'::uuid,'24000000-0000-4000-8000-000000000001','outsider','42501'),
 ('10000004-0000-4000-8000-000000000004'::uuid,'24000000-0000-4000-8000-000000000001','invited pending','42501'),
 ('10000005-0000-4000-8000-000000000005'::uuid,'24000000-0000-4000-8000-000000000001','former member','42501'),
 ('10000006-0000-4000-8000-000000000006'::uuid,'24000000-0000-4000-8000-000000000003','owner without participant','42501'),
 ('10000007-0000-4000-8000-000000000007'::uuid,'24000000-0000-4000-8000-000000000004','required consent pending','S1001')
) actors(u,r,label,expected) cross join (values
 ('state',$q$select public.get_room_s4_state(%L::uuid)$q$),
 ('submit',$q$select public.submit_room_availability_v1(%L::uuid,array[]::text[],0,gen_random_uuid())$q$),
 ('time',$q$select public.select_room_meeting_time_v1(%L::uuid,null,0,gen_random_uuid())$q$),
 ('confirm',$q$select public.confirm_room_appointment_v1(%L::uuid,gen_random_uuid(),0,gen_random_uuid())$q$),
 ('legacy submit',$q$select public.set_my_availability(%L::uuid,null)$q$),
 ('legacy stage',$q$select public.advance_room_stage(%L::uuid,'place')$q$),
 ('legacy confirm',$q$select public.confirm_room_vote(%L::uuid,gen_random_uuid())$q$),
 ('candidate',$q$select public.add_voting_item(%L::uuid,'menu','Synthetic')$q$),
 ('remove',$q$select public.remove_voting_item(%L::uuid,gen_random_uuid())$q$),
 ('vote',$q$select public.toggle_vote(%L::uuid,gen_random_uuid())$q$),
 ('legacy status',$q$select public.room_availability_status(%L::uuid)$q$),
 ('legacy cells',$q$select public.room_availability_cells(%L::uuid)$q$)
) commands(name,sql);
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.get_room_s4_state('ffffffff-ffff-4fff-8fff-ffffffffffff')$q$)='42501','unknown room is indistinguishable from access denial');
select pg_temp.check(pg_temp.sqlstate_of($q$update public.rooms set stage='done' where id='24000000-0000-4000-8000-000000000001'$q$)='42501','direct stage update denied');
select pg_temp.check(pg_temp.sqlstate_of($q$delete from public.rooms where id='24000000-0000-4000-8000-000000000001'$q$)='42501','direct room delete denied');
select pg_temp.check(pg_temp.sqlstate_of($q$update public.participants set schedule='{"slots":[]}' where room_id='24000000-0000-4000-8000-000000000001'$q$)='42501','direct schedule update denied');
select pg_temp.check(pg_temp.sqlstate_of($q$update public.participants set voted_items='[]' where room_id='24000000-0000-4000-8000-000000000001'$q$)='42501','direct vote update denied');
select pg_temp.check(pg_temp.sqlstate_of($q$select * from private.s4_requests$q$)='42501','private ledger read denied');
select pg_temp.check(pg_temp.sqlstate_of($q$delete from private.s4_requests$q$)='42501','private ledger mutation denied');
select pg_temp.check(pg_temp.sqlstate_of($q$select private.s4_confirm_core('24000000-0000-4000-8000-000000000001',gen_random_uuid())$q$)='42501','private confirmation core denied');
select pg_temp.check(pg_temp.sqlstate_of($q$insert into public.rooms(code,title,meeting_date,expires_at,owner_id,is_confirmed,confirmed_slot) values('S4FORGE1','Synthetic',current_date+1,clock_timestamp()+interval '1 day',auth.uid(),true,'forged')$q$)='42501','legacy creation cannot inject confirmed state');
select pg_temp.check(pg_temp.sqlstate_of($q$insert into public.rooms(code,title,meeting_date,expires_at,owner_id,stage) values('S4FORGE2','Synthetic',current_date+1,clock_timestamp()+interval '1 day',auth.uid(),'confirmed')$q$)='42501','stage column insert denied');
select pg_temp.check(pg_temp.sqlstate_of($q$insert into public.rooms(code,title,meeting_date,expires_at,owner_id,meeting_starts_at) values('S4FORGE3','Synthetic',current_date+1,clock_timestamp()+interval '1 day',auth.uid(),clock_timestamp())$q$)='42501','structured time insert denied');
select pg_temp.check(pg_temp.sqlstate_of($q$insert into public.rooms(code,title,meeting_date,expires_at,owner_id,is_confirmed,confirmed_slot) values('S4NORMAL','Synthetic',current_date+1,clock_timestamp()+interval '1 day',auth.uid(),false,null)$q$)='00000','legacy draft room create remains supported');
reset role;
select pg_temp.check((select s4_revision=0 and meeting_starts_at is null from public.rooms where code='S4NORMAL'),'new-room bootstrap leaves revision zero');
select pg_temp.check(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 's4_%' and (has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE'))),'all private S4 helpers have narrow ACL');
select pg_temp.check(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='private' and p.proname like 's4_%' or n.nspname='public' and p.proname in('get_s4_capabilities','get_room_s4_state','submit_room_availability_v1','select_room_meeting_time_v1','confirm_room_appointment_v1')) and not p.proconfig @> array['search_path=""']),'all S4 functions fix search_path');
select pg_temp.check(not has_table_privilege('authenticated','private.s4_requests','SELECT,INSERT,UPDATE,DELETE') and not has_table_privilege('service_role','private.s4_requests','SELECT,INSERT,UPDATE,DELETE'),'ledger has no worker or user raw grants');
select pg_temp.check((select relrowsecurity from pg_class where oid='private.s4_requests'::regclass),'ledger RLS enabled');
select pg_temp.check(not exists(select 1 from pg_proc p where p.proname in('get_s4_capabilities','get_room_s4_state','submit_room_availability_v1','select_room_meeting_time_v1','confirm_room_appointment_v1') and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE'))),'new endpoints authenticated only');
update public.rooms set expires_at=clock_timestamp()-interval '1 second' where id='24000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.as_user('10000003-0000-4000-8000-000000000003');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.get_room_s4_state('24000000-0000-4000-8000-000000000002')$q$)='42501','expired member room uses same access denial');
set local role anon;
select pg_temp.check(pg_temp.sqlstate_of($q$select public.get_s4_capabilities()$q$)='42501','anon cannot probe capability');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.get_room_s4_state('24000000-0000-4000-8000-000000000001')$q$)='42501','anon cannot query decisions');
set local role service_role;
select pg_temp.check(pg_temp.sqlstate_of($q$select public.get_room_s4_state('24000000-0000-4000-8000-000000000001')$q$)='42501','worker cannot execute user decision RPC');
reset role;
select pg_temp.check(not exists(select 1 from private.s4_requests),'denied operations created no ledger');
select * from finish();
rollback;
