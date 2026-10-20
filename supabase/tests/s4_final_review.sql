begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local s1.tap='on';
select no_plan();
\ir s4_fixture.sql
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(pg_temp.sqlstate_of(format($q$select public.add_voting_item('24000000-0000-4000-8000-000000000001','time',%L)$q$,label))='S4002','invisible-only label rejected U+'||to_hex(cp)||' '||kind)
from (values(12644),(4447),(4448),(10240),(173),(847),(8205)) points(cp)
cross join lateral(values(chr(cp),'alone'),(' '||chr(cp)||chr(12644)||chr(8205)||' ','mixed')) variants(label,kind);
-- ZWJ is part of visible emoji sequences, not an independently visible label.
insert into s4_data values('emoji-label',to_jsonb(chr(128105)||chr(8205)||chr(127859)));
insert into s4_data values('emoji-time',to_jsonb(public.add_voting_item('24000000-0000-4000-8000-000000000001','time',(select v#>>'{}' from s4_data where k='emoji-label'))));
select pg_temp.check((public.get_room_s4_state('24000000-0000-4000-8000-000000000001')->>'stage')='scheduling','visible ZWJ emoji candidate accepted');
-- An invitation can be created before settlement, but neither pending nor accepted retries may add members later.
insert into s4_data values('closed-invite',to_jsonb(public.create_room_invitation('24000000-0000-4000-8000-000000000001','10000008-0000-4000-8000-000000000008')));
select pg_temp.s4_submit('24000000-0000-4000-8000-000000000001');
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
select pg_temp.s4_submit('24000000-0000-4000-8000-000000000001');
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select public.select_room_meeting_time_v1('24000000-0000-4000-8000-000000000001',(select v from s4_data where k='time'),pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid());
insert into s4_data values('emoji-menu',to_jsonb(public.add_voting_item('24000000-0000-4000-8000-000000000001','menu',(select v#>>'{}' from s4_data where k='emoji-label'))));
reset role;
create temporary table selected_snapshot as select s4_revision,(select count(*) from private.s4_requests where room_id=r.id) ledger from public.rooms r where id='24000000-0000-4000-8000-000000000001';
set local role authenticated;
select public.select_room_meeting_time_v1('24000000-0000-4000-8000-000000000001',(select v from s4_data where k='time'),pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid()) from generate_series(1,20);
reset role;
select pg_temp.check((select r.s4_revision=s.s4_revision and s.ledger=(select count(*) from private.s4_requests where room_id=r.id) from public.rooms r cross join selected_snapshot s where r.id='24000000-0000-4000-8000-000000000001'),'same selected payload and fresh IDs never grow ledger or revision');
set local role authenticated;
select pg_temp.check(pg_temp.sqlstate_of($q$select public.select_room_meeting_time_v1('24000000-0000-4000-8000-000000000001',(select v from s4_data where k='time'),0,gen_random_uuid())$q$)='S4005','same selected payload still enforces CAS');
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.select_room_meeting_time_v1('24000000-0000-4000-8000-000000000001',(select v from s4_data where k='time'),pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid())$q$)='42501','same payload never bypasses owner identity');
select public.toggle_vote('24000000-0000-4000-8000-000000000001',(select (v#>>'{}')::uuid from s4_data where k='emoji-menu'));
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select public.toggle_vote('24000000-0000-4000-8000-000000000001',(select (v#>>'{}')::uuid from s4_data where k='emoji-menu'));
select public.confirm_room_appointment_v1('24000000-0000-4000-8000-000000000001',(select (v#>>'{}')::uuid from s4_data where k='emoji-menu'),pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid());
reset role;
create temporary table confirmed_snapshot as select to_jsonb(r) value,(select count(*) from private.s4_requests where room_id=r.id) ledger from public.rooms r where id='24000000-0000-4000-8000-000000000001';
set local role authenticated;
select public.confirm_room_appointment_v1('24000000-0000-4000-8000-000000000001',(select (v#>>'{}')::uuid from s4_data where k='emoji-menu'),pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid()) from generate_series(1,20);
reset role;
select pg_temp.check((select to_jsonb(r)=s.value and s.ledger=(select count(*) from private.s4_requests where room_id=r.id) from public.rooms r cross join confirmed_snapshot s where r.id='24000000-0000-4000-8000-000000000001'),'same confirmed payload preserves original evidence, revision and ledger');
select pg_temp.check((select confirmed_menu=(select v#>>'{}' from s4_data where k='emoji-label') from public.rooms where id='24000000-0000-4000-8000-000000000001') and (select count(*)=1 from public.messages where event_key='appointment-confirmed:24000000-0000-4000-8000-000000000001'),'ZWJ emoji survives exactly one confirmation event');
-- Boundaries for both settlement stages use real authenticated RPC calls.
create temporary table closed_membership_before as select to_jsonb(p) value from public.participants p where room_id='24000000-0000-4000-8000-000000000001';
create temporary table closed_invite_before as select to_jsonb(i) value from public.room_invitations i where id=(select (v#>>'{}')::uuid from s4_data where k='closed-invite');
create function pg_temp.check_closed_membership(phase text) returns setof text language plpgsql as $$ begin
 perform pg_temp.as_user('10000003-0000-4000-8000-000000000003');
 return next pg_temp.check(pg_temp.s4_error($q$select public.join_room_by_code('S4TEST1')$q$)='{"code":"S4003","hint":"operation=membership"}'::jsonb,phase||' denies unrelated code join');
 perform pg_temp.as_user('10000001-0000-4000-8000-000000000001');
 return next pg_temp.check(pg_temp.s4_error($q$select public.create_room_invitation('24000000-0000-4000-8000-000000000001','10000008-0000-4000-8000-000000000008')$q$)='{"code":"S4003","hint":"operation=membership"}'::jsonb,phase||' denies invitation creation and pending retry');
 perform pg_temp.as_user('10000008-0000-4000-8000-000000000008');
 return next pg_temp.check(pg_temp.s4_error($q$select public.accept_room_invitation((select (v#>>'{}')::uuid from s4_data where k='closed-invite'))$q$)='{"code":"S4003","hint":"operation=membership"}'::jsonb,phase||' denies invitation acceptance');
end; $$;
grant execute on function pg_temp.check_closed_membership(text) to authenticated;
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
insert into s4_data values('round-one',to_jsonb(public.create_room_settlement_v2('24000000-0000-4000-8000-000000000001','First',2000,'Synthetic','0000','A')));
select * from pg_temp.check_closed_membership('settling');
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select public.set_settlement_completed(id,true) from public.dutch_pay_members where bill_id=(select (v#>>'{}')::uuid from s4_data where k='round-one') and not is_completed;
select * from pg_temp.check_closed_membership('done');
reset role;
select pg_temp.check(not exists((select to_jsonb(p) from public.participants p where room_id='24000000-0000-4000-8000-000000000001') except select value from closed_membership_before) and not exists(select value from closed_membership_before except select to_jsonb(p) from public.participants p where room_id='24000000-0000-4000-8000-000000000001'),'denied joins preserve membership exactly');
select pg_temp.check((select (to_jsonb(i)-array['status','responded_at'])=((select value from closed_invite_before)-array['status','responded_at']) and i.status='expired' and i.responded_at is not null from public.room_invitations i where id=(select (v#>>'{}')::uuid from s4_data where k='closed-invite')),'settlement expires pending invitation and denied acceptance preserves its expired state');
-- Even an accepted invitation replay is closed after settlement begins.
update public.room_invitations set status='accepted' where id=(select (v#>>'{}')::uuid from s4_data where k='closed-invite');
set local role authenticated;
select pg_temp.as_user('10000008-0000-4000-8000-000000000008');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.accept_room_invitation((select (v#>>'{}')::uuid from s4_data where k='closed-invite'))$q$)='S4003','accepted invitation replay cannot re-enter a done room');
reset role;
-- Trusted clock displacement, without sleeps: only half a day remains in the absolute window.
update public.rooms set appointment_confirmed_at=clock_timestamp()-interval '29 days 12 hours' where id='24000000-0000-4000-8000-000000000001';
create temporary table absolute_cap as select appointment_confirmed_at+interval '30 days' deadline from public.rooms where id='24000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
insert into s4_data values('capped-round',to_jsonb(public.create_room_settlement_v2('24000000-0000-4000-8000-000000000001','Capped',4000,'Synthetic','1111','B')));
reset role;
select pg_temp.check((select stage='settling' and isfinite(expires_at) and expires_at=(select deadline from absolute_cap) and settled_at is null from public.rooms where id='24000000-0000-4000-8000-000000000001'),'restart cannot extend beyond confirmation plus thirty days');
set local role authenticated;
select public.set_settlement_completed(id,true) from public.dutch_pay_members where bill_id=(select (v#>>'{}')::uuid from s4_data where k='capped-round') and not is_completed;
reset role;
select pg_temp.check((select stage='done' and expires_at=(select deadline from absolute_cap) and expires_at<settled_at+interval '24 hours' from public.rooms where id='24000000-0000-4000-8000-000000000001'),'completion twenty-four hours is also capped absolutely');
set local role authenticated;
insert into s4_data values('last-round',to_jsonb(public.create_room_settlement('24000000-0000-4000-8000-000000000001','Last',4000,'Synthetic','2222','B')));
reset role;
select pg_temp.check((select stage='settling' and expires_at=(select deadline from absolute_cap) from public.rooms where id='24000000-0000-4000-8000-000000000001'),'repeated rounds cannot reset the absolute window');
-- An expired absolute cap rejects a new request even if historical expiry was erroneously longer.
update public.rooms set appointment_confirmed_at=clock_timestamp()-interval '31 days',expires_at=clock_timestamp()+interval '1 day' where id='24000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.check(pg_temp.sqlstate_of($q$select public.create_room_settlement_v2('24000000-0000-4000-8000-000000000001','Too late',4000,'Synthetic','2222','B')$q$)='P0002','absolute cap also rejects a legacy overlong expiry');
reset role;
-- Expiring a still-open round removes the room, never its receipt snapshot or payment permissions.
update public.rooms set expires_at=clock_timestamp()-interval '1 second' where id='24000000-0000-4000-8000-000000000001';
create temporary table open_bill_before as select to_jsonb(b)-'room_id' value from public.dutch_pay_bills b where id=(select (v#>>'{}')::uuid from s4_data where k='last-round');
create temporary table open_receipts_before as select to_jsonb(m) value from public.dutch_pay_members m where bill_id=(select (v#>>'{}')::uuid from s4_data where k='last-round');
set local role authenticated;
select public.delete_expired_rooms();
reset role;
select pg_temp.check(not exists(select 1 from public.rooms where id='24000000-0000-4000-8000-000000000001'),'finite expiry permits cleanup while settlement remains open');
select pg_temp.check((select room_id is null and to_jsonb(b)-'room_id'=(select value from open_bill_before) from public.dutch_pay_bills b where id=(select (v#>>'{}')::uuid from s4_data where k='last-round')),'open bill is detached and preserved without changing payment disclosure');
select pg_temp.check(not exists((select to_jsonb(m) from public.dutch_pay_members m where bill_id=(select (v#>>'{}')::uuid from s4_data where k='last-round')) except select value from open_receipts_before),'room expiry preserves recipient receipts');
set local role authenticated;
select pg_temp.check(public.get_settlement_payment_details((select (v#>>'{}')::uuid from s4_data where k='last-round'))->'payment_details'<>'null'::jsonb,'original recipient retains payment details after room cleanup');
select public.set_settlement_completed(id,true) from public.dutch_pay_members where bill_id=(select (v#>>'{}')::uuid from s4_data where k='last-round') and not is_completed;
select pg_temp.check(public.get_settlement_payment_details((select (v#>>'{}')::uuid from s4_data where k='last-round'))->'payment_details'='null'::jsonb,'detached settlement can still complete and close payment details');
reset role;
select pg_temp.check((select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc where oid in('public.join_room_by_code(text)'::regprocedure,'public.create_room_invitation(uuid,uuid)'::regprocedure,'public.accept_room_invitation(uuid)'::regprocedure)) and not has_function_privilege('anon','public.create_room_invitation(uuid,uuid)','execute') and not has_function_privilege('service_role','public.accept_room_invitation(uuid)','execute'),'membership writers retain fixed search_path and narrow authenticated-only grants');
select * from finish();
rollback;
