begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local s1.tap='on';
select no_plan();
\ir s4_fixture.sql
insert into public.follows(follower_id,following_id,role) values('10000001-0000-4000-8000-000000000001','10000004-0000-4000-8000-000000000004','mate') on conflict do nothing;
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
insert into s4_data values('accepted-invitation',to_jsonb(public.create_room_invitation('24000000-0000-4000-8000-000000000001','10000008-0000-4000-8000-000000000008')));
insert into s4_data values('pending-invitation',to_jsonb(public.create_room_invitation('24000000-0000-4000-8000-000000000001','10000004-0000-4000-8000-000000000004')));
select pg_temp.as_user('10000008-0000-4000-8000-000000000008');
select public.accept_room_invitation((select (v#>>'{}')::uuid from s4_data where k='accepted-invitation'));
reset role;
create temporary table accepted_before as select to_jsonb(i) value from public.room_invitations i where id=(select (v#>>'{}')::uuid from s4_data where k='accepted-invitation');
update public.rooms set stage='confirmed',appointment_confirmed_at=clock_timestamp(),appointment_confirmed_by=owner_id where id='24000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
insert into s4_data values('invitation-bill',to_jsonb(public.create_room_settlement_v2('24000000-0000-4000-8000-000000000001','Invitation lifecycle',3000,'Synthetic','0000','A')));
reset role;
select pg_temp.check((select stage='settling' from public.rooms where id='24000000-0000-4000-8000-000000000001'),'real settlement creation enters settling');
select pg_temp.check((select status='expired' and responded_at is not null from public.room_invitations where id=(select (v#>>'{}')::uuid from s4_data where k='pending-invitation')),'settling transition expires pending invitation immediately');
select pg_temp.check((select to_jsonb(i)=(select value from accepted_before) from public.room_invitations i where id=(select (v#>>'{}')::uuid from s4_data where k='accepted-invitation')),'settling transition preserves accepted invitation exactly');
set local role authenticated;
select pg_temp.as_user('10000004-0000-4000-8000-000000000004');
select pg_temp.check(not exists(select 1 from public.room_invitations where invitee_id=auth.uid() and status='pending'),'invitee pending-list query no longer returns the expired invitation');
select pg_temp.check(pg_temp.s4_error($q$select public.accept_room_invitation((select (v#>>'{}')::uuid from s4_data where k='pending-invitation'))$q$)='{"code":"S4003","hint":"operation=membership"}'::jsonb,'expired invitation acceptance in settling still raises documented S4003');
reset role;
-- Trusted historical inconsistency inserted after settling: exercise the done transition too.
insert into public.room_invitations(id,room_id,inviter_id,invitee_id,room_title,status,expires_at)
values('97000000-0000-4000-8000-000000000041','24000000-0000-4000-8000-000000000001','10000001-0000-4000-8000-000000000001','10000006-0000-4000-8000-000000000006','Legacy pending','pending',clock_timestamp()+interval '4 days');
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select public.set_settlement_completed(id,true) from public.dutch_pay_members where bill_id=(select (v#>>'{}')::uuid from s4_data where k='invitation-bill') and not is_completed;
reset role;
select pg_temp.check((select stage='done' from public.rooms where id='24000000-0000-4000-8000-000000000001'),'normal receipt completion enters done');
select pg_temp.check((select status='expired' and responded_at is not null from public.room_invitations where id='97000000-0000-4000-8000-000000000041'),'done transition also expires a historical pending invitation');
select pg_temp.check((select to_jsonb(i)=(select value from accepted_before) from public.room_invitations i where id=(select (v#>>'{}')::uuid from s4_data where k='accepted-invitation')),'done transition preserves accepted invitation exactly');
set local role authenticated;
select pg_temp.as_user('10000006-0000-4000-8000-000000000006');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.accept_room_invitation('97000000-0000-4000-8000-000000000041')$q$)='S4003','expired invitation acceptance in done still raises S4003');
reset role;
-- Rehearse the actual migration on preexisting settling/done rows, preserving all other states.
update public.rooms set stage='settling' where id='24000000-0000-4000-8000-000000000003';
insert into public.room_invitations(id,room_id,inviter_id,invitee_id,room_title,status,expires_at) values
 ('97000000-0000-4000-8000-000000000042','24000000-0000-4000-8000-000000000001','10000001-0000-4000-8000-000000000001','10000005-0000-4000-8000-000000000005','Historical done','pending',clock_timestamp()+interval '4 days'),
 ('97000000-0000-4000-8000-000000000043','24000000-0000-4000-8000-000000000003','10000006-0000-4000-8000-000000000006','10000004-0000-4000-8000-000000000004','Historical settling','pending',clock_timestamp()+interval '4 days'),
 ('97000000-0000-4000-8000-000000000044','24000000-0000-4000-8000-000000000004','10000001-0000-4000-8000-000000000001','10000008-0000-4000-8000-000000000008','Active scheduling','pending',clock_timestamp()+interval '4 days'),
 ('97000000-0000-4000-8000-000000000045','24000000-0000-4000-8000-000000000001','10000001-0000-4000-8000-000000000001','10000006-0000-4000-8000-000000000006','Previously declined','declined',clock_timestamp()+interval '4 days');
create temporary table invitations_before as select i.id,to_jsonb(i) value,r.stage from public.room_invitations i join public.rooms r on r.id=i.room_id;
\ir s4_security_followup_body.sql
select pg_temp.check(not exists(select 1 from public.room_invitations i join public.rooms r on r.id=i.room_id where r.stage in('settling','done') and i.status='pending'),'actual migration clears all preexisting settlement-stage pending invitations');
select pg_temp.check((select count(*)=2 and bool_and(status='expired' and responded_at is not null) from public.room_invitations where id in('97000000-0000-4000-8000-000000000042','97000000-0000-4000-8000-000000000043')),'actual migration expires both done and settling historical rows');
select pg_temp.check(not exists(select 1 from invitations_before old join public.room_invitations i using(id) where (old.value->>'status'<>'pending' or old.stage not in('settling','done')) and old.value<>to_jsonb(i)),'migration preserves accepted, declined, expired and active-stage pending rows exactly');
select pg_temp.check(not exists(select 1 from invitations_before old join public.room_invitations i using(id) where old.value-array['status','responded_at']<>to_jsonb(i)-array['status','responded_at']),'migration changes only invitation status and response time');
create temporary table invitations_after as select id,to_jsonb(i) value from public.room_invitations i;
\ir s4_security_followup_body.sql
select pg_temp.check(not exists(select 1 from invitations_after old join public.room_invitations i using(id) where old.value<>to_jsonb(i)),'actual migration replay does not rewrite invitation timestamps');
select pg_temp.check((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='private.s4_expire_settlement_invitations()'::regprocedure)
 and not has_function_privilege('authenticated','private.s4_expire_settlement_invitations()','EXECUTE')
 and not has_function_privilege('service_role','private.s4_expire_settlement_invitations()','EXECUTE'),'invitation cleanup trigger has fixed search_path and no client/worker execution');
select * from finish();
rollback;
