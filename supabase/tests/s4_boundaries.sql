begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local s1.tap='on';
select no_plan();
\ir s4_fixture.sql
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.submit_room_availability_v1('24000000-0000-4000-8000-000000000001',null,pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid())$q$)='22023','new submit rejects null');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.submit_room_availability_v1('24000000-0000-4000-8000-000000000001',array['invalid'],pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid())$q$)='22023','slot malformed rejected');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.submit_room_availability_v1('24000000-0000-4000-8000-000000000001',array['2027-02-29-11'],pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid())$q$)='22023','slot invalid leap date rejected');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.submit_room_availability_v1('24000000-0000-4000-8000-000000000001',array['2000-01-01-11'],pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid())$q$)='22023','past slot rejected');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.submit_room_availability_v1('24000000-0000-4000-8000-000000000001',array['2099-01-01-11'],pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid())$q$)='22023','slot beyond expiry rejected');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.submit_room_availability_v1('24000000-0000-4000-8000-000000000001',array[null]::text[],pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid())$q$)='22023','null slot element rejected');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.submit_room_availability_v1('24000000-0000-4000-8000-000000000001',array[['2027-01-01-11'],['2027-01-01-12']],pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid())$q$)='22023','multidimensional slot array rejected');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.submit_room_availability_v1('24000000-0000-4000-8000-000000000001',array['2027-01-01-11','2027-01-01-11'],pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid())$q$)='22023','duplicate slot rejected');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.submit_room_availability_v1('24000000-0000-4000-8000-000000000001',array(select '2027-01-01-11' from generate_series(1,501)),pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid())$q$)='22023','501 slots rejected');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.submit_room_availability_v1('24000000-0000-4000-8000-000000000001',array[repeat('x',9000)],pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid())$q$)='22023','oversize array rejected');
select pg_temp.s4_submit('24000000-0000-4000-8000-000000000001');
select public.set_my_availability('24000000-0000-4000-8000-000000000001',null);
select pg_temp.check(public.get_room_s4_state('24000000-0000-4000-8000-000000000001')->'availability'->>'submitted_count'='0','legacy null is withdrawal');
select pg_temp.s4_submit('24000000-0000-4000-8000-000000000001');
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
select pg_temp.s4_submit('24000000-0000-4000-8000-000000000001');
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(pg_temp.sqlstate_of(format($q$select public.select_room_meeting_time_v1('24000000-0000-4000-8000-000000000001',%L::jsonb,pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid())$q$,value::text))=expected,label) from
(select 'unknown time key' label,v||'{"extra":1}'::jsonb value,'22023' expected from s4_data where k='time'
 union all select 'missing time key',v-'ends_at','22023' from s4_data where k='time'
 union all select 'wrong zone',jsonb_set(v,'{time_zone}','"UTC"'),'22023' from s4_data where k='time'
 union all select 'no offset',jsonb_set(v,'{starts_at}',to_jsonb((select v#>>'{}' from s4_data where k='day')||'T11:00:00')),'22023' from s4_data where k='time'
 union all select 'bad date',jsonb_set(v,'{starts_at}','"2027-02-30T11:00:00+09:00"'),'22023' from s4_data where k='time'
 union all select 'bad leap date',jsonb_set(v,'{starts_at}','"2027-02-29T11:00:00+09:00"'),'22023' from s4_data where k='time'
 union all select 'valid leap outside expiry',jsonb_build_object('starts_at','2028-02-29T11:00:00+09:00','ends_at','2028-02-29T12:00:00+09:00','time_zone','Asia/Seoul'),'S4006'
 union all select 'nonfinite timestamp',jsonb_set(v,'{starts_at}','"infinity"'),'22023' from s4_data where k='time'
 union all select 'minute precision',jsonb_set(v,'{starts_at}',to_jsonb((select v#>>'{}' from s4_data where k='day')||'T11:30:00+09:00')),'S4006' from s4_data where k='time'
 union all select 'second precision',jsonb_set(v,'{starts_at}',to_jsonb((select v#>>'{}' from s4_data where k='day')||'T11:00:01+09:00')),'S4006' from s4_data where k='time'
 union all select 'microsecond precision',jsonb_set(v,'{starts_at}',to_jsonb((select v#>>'{}' from s4_data where k='day')||'T11:00:00.000001+09:00')),'S4006' from s4_data where k='time'
 union all select 'before 11 KST',jsonb_set(v,'{starts_at}',to_jsonb((select v#>>'{}' from s4_data where k='day')||'T10:00:00+09:00')),'S4006' from s4_data where k='time'
 union all select 'after 21 KST',jsonb_set(v,'{ends_at}',to_jsonb((select v#>>'{}' from s4_data where k='day')||'T22:00:00+09:00')),'S4006' from s4_data where k='time'
 union all select 'zero interval',jsonb_set(v,'{ends_at}',v->'starts_at'),'S4006' from s4_data where k='time'
 union all select 'reverse interval',jsonb_set(v,'{ends_at}',to_jsonb((select v#>>'{}' from s4_data where k='day')||'T10:00:00+09:00')),'S4006' from s4_data where k='time'
 union all select 'cross day',jsonb_set(v,'{ends_at}',to_jsonb(((select (v#>>'{}')::date from s4_data where k='day')+1)::text||'T12:00:00+09:00')),'S4006' from s4_data where k='time'
 union all select 'oversize time',v||jsonb_build_object('padding',repeat('x',9000)),'22023' from s4_data where k='time'
) cases;
select public.submit_room_availability_v1('24000000-0000-4000-8000-000000000004',array(select jsonb_array_elements_text(v) from s4_data where k='slots'),pg_temp.s4_revision('24000000-0000-4000-8000-000000000004'),gen_random_uuid());
select pg_temp.check(public.get_room_s4_state('24000000-0000-4000-8000-000000000004')->'availability'->>'eligible_count'='2','consent-pending actual member remains eligible');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.select_room_meeting_time_v1('24000000-0000-4000-8000-000000000004',null,pg_temp.s4_revision('24000000-0000-4000-8000-000000000004'),gen_random_uuid())$q$)='S4004','cannot omit pending actual member to advance');
reset role;
update public.participants set schedule=jsonb_build_object('slots',jsonb_build_array((select v#>>'{}'||'-11' from s4_data where k='day'))) where room_id='24000000-0000-4000-8000-000000000001' and profile_id='10000001-0000-4000-8000-000000000001';
update public.participants set schedule=jsonb_build_object('slots',jsonb_build_array((select v#>>'{}'||'-12' from s4_data where k='day'))) where room_id='24000000-0000-4000-8000-000000000001' and profile_id='10000002-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.select_room_meeting_time_v1('24000000-0000-4000-8000-000000000001',(select v from s4_data where k='time'),pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid())$q$)='S4006','union-only availability is insufficient for a full interval');
select pg_temp.s4_submit('24000000-0000-4000-8000-000000000001');
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
select pg_temp.s4_submit('24000000-0000-4000-8000-000000000001');
reset role;
update public.rooms set expires_at=(select (v->>'ends_at')::timestamptz from s4_data where k='time')-interval '1 microsecond' where id='24000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.select_room_meeting_time_v1('24000000-0000-4000-8000-000000000001',(select v from s4_data where k='time'),pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid())$q$)='S4006','end beyond expiry by one microsecond is rejected');
reset role;
update public.rooms set expires_at=(select (v->>'ends_at')::timestamptz from s4_data where k='time') where id='24000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
insert into s4_data values('select_revision',to_jsonb(pg_temp.s4_revision('24000000-0000-4000-8000-000000000001')));
select pg_temp.check(public.select_room_meeting_time_v1('24000000-0000-4000-8000-000000000001',(select v from s4_data where k='time'),pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),'64000000-0000-4000-8000-000000000010')->>'outcome'='applied','end exactly at expiry is accepted');
select pg_temp.check(public.select_room_meeting_time_v1('24000000-0000-4000-8000-000000000001',jsonb_build_object('starts_at',(select ((v#>>'{}')::date-1)::text from s4_data where k='day')||'T16:00:00-10:00','ends_at',(select ((v#>>'{}')::date-1)::text from s4_data where k='day')||'T18:00:00-10:00','time_zone','Asia/Seoul'),(select (v#>>'{}')::bigint from s4_data where k='select_revision'),'64000000-0000-4000-8000-000000000010')->>'outcome'='replayed','different input offset and date normalize to identical request');
select pg_temp.check(public.get_room_s4_state('24000000-0000-4000-8000-000000000001')->'meeting_time'->>'starts_at' like '%Z','output uses UTC ISO');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.select_room_meeting_time_v1('24000000-0000-4000-8000-000000000001',null,pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid())$q$)='22023','place time cannot be cleared with null');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.set_my_availability('24000000-0000-4000-8000-000000000001',null)$q$)='S4003','legacy withdrawal cannot bypass place stage');
select pg_temp.check(pg_temp.sqlstate_of($q$select pg_temp.s4_submit('24000000-0000-4000-8000-000000000001')$q$)='S4003','new submit cannot bypass place stage');
reset role;
select pg_temp.check((select meeting_date=(select (v#>>'{}')::date from s4_data where k='day') from public.rooms where id='24000000-0000-4000-8000-000000000001'),'meeting_date follows KST normalized date, not input offset date');
select * from finish();
rollback;
