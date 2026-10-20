begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local s1.tap='on';
select no_plan();
\ir s4_fixture.sql
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
-- Every prohibited code point, both alone and inside an otherwise valid label.
select pg_temp.check(pg_temp.sqlstate_of(format($q$select public.add_voting_item('24000000-0000-4000-8000-000000000001','time',%L)$q$,label))='S4002','format label rejected U+'||to_hex(cp)||' '||kind)
from (select cp from generate_series(8203,8207) cp where cp<>8205 union all select generate_series(8234,8238) union all select generate_series(8288,8292) union all select 65279) points
cross join lateral (values(chr(cp),'alone'),('Cafe'||chr(cp)||' name','embedded')) variants(label,kind);
select pg_temp.check(pg_temp.s4_error($q$select public.create_room_settlement_v2('24000000-0000-4000-8000-000000000001','Early',2000,'Synthetic','0000','A')$q$)='{"code":"S4008","hint":"operation=settlement"}'::jsonb,'preconfirmation settlement has machine-readable operation hint');
select pg_temp.s4_submit('24000000-0000-4000-8000-000000000001');
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
select pg_temp.s4_submit('24000000-0000-4000-8000-000000000001');
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select public.select_room_meeting_time_v1('24000000-0000-4000-8000-000000000001',(select v from s4_data where k='time'),pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid());
insert into s4_data values('format-menu',to_jsonb(public.add_voting_item('24000000-0000-4000-8000-000000000001','menu','Valid restaurant')));
select pg_temp.check(pg_temp.s4_error($q$select public.confirm_room_vote('24000000-0000-4000-8000-000000000001',(select (v#>>'{}')::uuid from s4_data where k='format-menu'))$q$)='{"code":"S4008","hint":"operation=vote_confirmation"}'::jsonb,'legacy vote error carries a distinct operation hint');
select public.toggle_vote('24000000-0000-4000-8000-000000000001',(select (v#>>'{}')::uuid from s4_data where k='format-menu'));
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
select public.toggle_vote('24000000-0000-4000-8000-000000000001',(select (v#>>'{}')::uuid from s4_data where k='format-menu'));
reset role;
update public.rooms set voting_items=jsonb_set(voting_items,'{0,label}',to_jsonb('Legacy'||chr(8238)||'Restaurant')) where id='24000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.confirm_room_vote('24000000-0000-4000-8000-000000000001',(select (v#>>'{}')::uuid from s4_data where k='format-menu'))$q$)='S4002','legacy bidi label cannot enter confirmation event');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.confirm_room_appointment_v1('24000000-0000-4000-8000-000000000001',(select (v#>>'{}')::uuid from s4_data where k='format-menu'),pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid())$q$)='S4002','new confirmation rejects the same stored format character');
reset role;
select pg_temp.check((select stage='place' and appointment_confirmed_at is null from public.rooms where id='24000000-0000-4000-8000-000000000001') and not exists(select 1 from public.messages where event_key='appointment-confirmed:24000000-0000-4000-8000-000000000001'),'invalid stored label leaves no evidence or event');
-- Trusted extreme legacy fixtures: open bill in a stage that never confirmed.
insert into public.dutch_pay_bills(id,room_id,creator_id,title,total_amount,split_count) values
('98000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000002','10000003-0000-4000-8000-000000000003','Legacy open',1000,1),
('98000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000001','10000001-0000-4000-8000-000000000001','Legacy open',2000,2);
create temporary table before_legacy_bill as select id,to_jsonb(b) value from public.dutch_pay_bills b where id::text like '98000000-%';
set local role authenticated;
select pg_temp.check(pg_temp.s4_error(format('select public.%I(%L,%L,3000,%L,%L,%L)',rpc,'24000000-0000-4000-8000-000000000001','Changed','Synthetic','1111','A'))='{"code":"S4008","hint":"operation=settlement"}'::jsonb,'place with an open bill still rejects '||rpc)
from (values('create_room_settlement_v2'),('create_room_settlement')) names(rpc);
select pg_temp.as_user('10000003-0000-4000-8000-000000000003');
select pg_temp.check(pg_temp.s4_error(format('select public.%I(%L,%L,3000,%L,%L,%L)',rpc,'24000000-0000-4000-8000-000000000002','Changed','Synthetic','1111','C'))='{"code":"S4008","hint":"operation=settlement"}'::jsonb,'scheduling with an open bill still rejects '||rpc)
from (values('create_room_settlement_v2'),('create_room_settlement')) names(rpc);
reset role;
select pg_temp.check(not exists(select 1 from before_legacy_bill old join public.dutch_pay_bills b using(id) where old.value<>to_jsonb(b)),'rejected legacy bill edits preserve account and amount');
-- Owner evidence persists after account deletion; absent evidence never enables a new bill.
update public.rooms set stage='settling' where id='24000000-0000-4000-8000-000000000001';
delete from public.dutch_pay_bills where room_id='24000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.create_room_settlement_v2('24000000-0000-4000-8000-000000000001','New',2000,'Synthetic','0000','A')$q$)='S4008','unverified settling room without active bill rejects a new bill');
reset role;
update public.rooms set stage='done' where id='24000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.check(pg_temp.sqlstate_of($q$select public.create_room_settlement('24000000-0000-4000-8000-000000000001','New',2000,'Synthetic','0000','A')$q$)='S4008','unverified done room without active bill rejects a new bill');
reset role;
-- Account deletion can clear confirmed_by; timestamp remains the permanent confirmation evidence.
update public.rooms set stage='settling',appointment_confirmed_at=clock_timestamp(),appointment_confirmed_by=null where id='24000000-0000-4000-8000-000000000001';
set local role authenticated;
insert into s4_data values('evidenced-settling-bill',to_jsonb(public.create_room_settlement_v2('24000000-0000-4000-8000-000000000001','New evidenced',2000,'Synthetic','0000','A')));
select pg_temp.check((select v#>>'{}' is not null from s4_data where k='evidenced-settling-bill'),'retained timestamp permits a new bill in settling even without confirmed_by');
select pg_temp.check(public.get_room_s4_state('24000000-0000-4000-8000-000000000001')->>'stage'='settling','new bill does not rewind or fabricate a stage transition');
select * from finish();
rollback;
