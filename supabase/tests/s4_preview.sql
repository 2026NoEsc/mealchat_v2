begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local s1.tap='on';
select no_plan();
\ir s4_fixture.sql
create function pg_temp.preview(r uuid) returns jsonb language sql as $$
 select public.preview_room_meeting_time_v1(r,v->>'starts_at',v->>'ends_at',v->>'time_zone') from s4_data where k='time'
$$;
grant execute on function pg_temp.preview(uuid) to authenticated;
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select public.create_room_invitation('24000000-0000-4000-8000-000000000001','10000008-0000-4000-8000-000000000008');
reset role;
create temporary table preview_before as select
 (select jsonb_agg(to_jsonb(r) order by id) from public.rooms r) rooms,
 (select jsonb_agg(to_jsonb(p) order by id) from public.participants p) participants,
 (select count(*) from private.s4_requests) requests,(select count(*) from public.messages) messages;
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(pg_temp.preview('24000000-0000-4000-8000-000000000001')=jsonb_build_object('eligible_count',2,'available_count',0,'all_available',false,'revision',pg_temp.s4_revision('24000000-0000-4000-8000-000000000001')::text),'empty schedules return four aggregate fields, exclude NULL profile and keep revision a string');
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
select pg_temp.check(pg_temp.preview('24000000-0000-4000-8000-000000000001')->>'eligible_count'='2','ordinary current member may preview');
select pg_temp.as_user('10000003-0000-4000-8000-000000000003');
select pg_temp.check(pg_temp.sqlstate_of($q$select pg_temp.preview('24000000-0000-4000-8000-000000000001')$q$)='42501','other-room owner cannot preview this room');
select pg_temp.as_user('10000006-0000-4000-8000-000000000006');
select pg_temp.check(pg_temp.sqlstate_of($q$select pg_temp.preview('24000000-0000-4000-8000-000000000003')$q$)='42501','owner without a current participant row cannot preview');
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(pg_temp.sqlstate_of($q$select pg_temp.preview('ffffffff-ffff-4fff-8fff-ffffffffffff')$q$)='42501','unknown room is indistinguishable from nonmembership');
select pg_temp.as_user('10000007-0000-4000-8000-000000000007');
select pg_temp.check(pg_temp.sqlstate_of($q$select pg_temp.preview('24000000-0000-4000-8000-000000000004')$q$)='S1001','actual member without required consent is gated');
reset role;
select pg_temp.check((select rooms=(select jsonb_agg(to_jsonb(r) order by id) from public.rooms r) and participants=(select jsonb_agg(to_jsonb(p) order by id) from public.participants p) and requests=(select count(*) from private.s4_requests) and messages=(select count(*) from public.messages) from preview_before),'successful and denied previews never mutate room, schedule, revision, ledger or messages');
-- Union of cells is insufficient: neither A nor B can attend the full two hours.
update public.participants set schedule=jsonb_build_object('slots',case when profile_id='10000001-0000-4000-8000-000000000001' then jsonb_build_array((select v#>>'{}' from s4_data where k='day')||'-11') when profile_id is not null then jsonb_build_array((select v#>>'{}' from s4_data where k='day')||'-12') else (select v from s4_data where k='slots') end) where room_id='24000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(pg_temp.preview('24000000-0000-4000-8000-000000000001')->>'available_count'='0','union-only availability and full NULL-profile schedule contribute no attendee');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.select_room_meeting_time_v1('24000000-0000-4000-8000-000000000001',(select v from s4_data where k='time'),pg_temp.s4_revision('24000000-0000-4000-8000-000000000001'),gen_random_uuid())$q$)='S4006','writer independently rejects a previewed zero-attendee interval');
select pg_temp.s4_submit('24000000-0000-4000-8000-000000000001');
select pg_temp.check(pg_temp.preview('24000000-0000-4000-8000-000000000001')->>'available_count'='1' and pg_temp.preview('24000000-0000-4000-8000-000000000001')->>'all_available'='false','one continuous attendee gives one of two, not all');
insert into s4_data values('preview-revision',to_jsonb(pg_temp.preview('24000000-0000-4000-8000-000000000001')->>'revision'));
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
select pg_temp.s4_submit('24000000-0000-4000-8000-000000000001');
select pg_temp.check(pg_temp.preview('24000000-0000-4000-8000-000000000001')->>'available_count'='2' and pg_temp.preview('24000000-0000-4000-8000-000000000001')->>'all_available'='true','all real members continuously available yields all_available');
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.select_room_meeting_time_v1('24000000-0000-4000-8000-000000000001',(select v from s4_data where k='time'),(select (v#>>'{}')::bigint from s4_data where k='preview-revision'),gen_random_uuid())$q$)='S4005','schedule change after displaying preview requires a new confirmation');
-- ISO syntax checks match the selection parser, including offset normalization.
select pg_temp.check(pg_temp.sqlstate_of(format('select public.preview_room_meeting_time_v1(%L,%L,%L,%L)','24000000-0000-4000-8000-000000000001',a,b,z))='22023','preview rejects malformed time: '||reason)
from s4_data d cross join lateral (values
 (null,v->>'ends_at','Asia/Seoul','null start'),(v->>'starts_at',null,'Asia/Seoul','null end'),(v->>'starts_at',v->>'ends_at',null,'null zone'),
 (v->>'starts_at',v->>'ends_at','UTC','unsupported zone'),(v->>'starts_at',v->>'ends_at','asia/seoul','zone case'),
 ('infinity',v->>'ends_at','Asia/Seoul','infinite literal'),('2030-02-30T11:00:00+09:00',v->>'ends_at','Asia/Seoul','invalid calendar'),
 (left(v->>'starts_at',19),v->>'ends_at','Asia/Seoul','missing offset'),(replace(v->>'starts_at','+09:00','+14:01'),v->>'ends_at','Asia/Seoul','bad offset'),
 (repeat('a',8193),v->>'ends_at','Asia/Seoul','oversized input')) bad(a,b,z,reason) where k='time';
select pg_temp.check(pg_temp.sqlstate_of(format('select public.preview_room_meeting_time_v1(%L,%L,%L,%L)','24000000-0000-4000-8000-000000000001',a,b,'Asia/Seoul'))='S4006','preview rejects invalid range: '||reason)
from s4_data d cross join lateral (values
 (v#>>'{}'||'T10:00:00+09:00',v#>>'{}'||'T12:00:00+09:00','before eleven'),
 (v#>>'{}'||'T20:00:00+09:00',v#>>'{}'||'T22:00:00+09:00','after twenty-one'),
 (v#>>'{}'||'T11:30:00+09:00',v#>>'{}'||'T13:00:00+09:00','non-hour start'),
 (v#>>'{}'||'T11:00:00+09:00',v#>>'{}'||'T12:30:00+09:00','non-hour end'),
 (v#>>'{}'||'T11:00:00.000001+09:00',v#>>'{}'||'T13:00:00+09:00','fractional second'),
 (v#>>'{}'||'T12:00:00+09:00',v#>>'{}'||'T12:00:00+09:00','empty interval'),
 (v#>>'{}'||'T13:00:00+09:00',v#>>'{}'||'T12:00:00+09:00','reversed interval'),
 ('2000-01-01T11:00:00+09:00','2000-01-01T12:00:00+09:00','past interval'),
 (v#>>'{}'||'T20:00:00+09:00',((v#>>'{}')::date+1)::text||'T11:00:00+09:00','next-day end'),
 (((v#>>'{}')::date+10)::text||'T11:00:00+09:00',((v#>>'{}')::date+10)::text||'T12:00:00+09:00','beyond room expiry')) bad(a,b,reason) where k='day';
select pg_temp.check(public.preview_room_meeting_time_v1('24000000-0000-4000-8000-000000000001',(select (v#>>'{}')||'T02:00:00Z' from s4_data where k='day'),(select (v#>>'{}')||'T04:00:00Z' from s4_data where k='day'),'Asia/Seoul')=pg_temp.preview('24000000-0000-4000-8000-000000000001'),'equivalent UTC offsets produce identical counts and revision');
select pg_temp.check(public.preview_room_meeting_time_v1('24000000-0000-4000-8000-000000000001',(select (v#>>'{}')||'T11:00:00+09:00' from s4_data where k='day'),(select (v#>>'{}')||'T21:00:00+09:00' from s4_data where k='day'),'Asia/Seoul')->>'available_count'='0','legal full eleven-to-twenty-one range may preview zero attendees');
reset role;
-- Pending invitations do not enter the denominator; malformed/past schedules are not available.
update public.participants set schedule='{"slots":["2000-01-01-11","2030-02-30-11"]}' where room_id='24000000-0000-4000-8000-000000000001' and profile_id='10000002-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.check(pg_temp.preview('24000000-0000-4000-8000-000000000001')->>'available_count'='1','past and malformed legacy cells do not create attendees');
select pg_temp.as_user(null);
select pg_temp.check(pg_temp.sqlstate_of($q$select public.preview_room_meeting_time_v1('24000000-0000-4000-8000-000000000001',null,null,null)$q$)='42501','authenticated role without an identity is rejected before parsing');
reset role;
delete from public.participants where room_id='24000000-0000-4000-8000-000000000001' and profile_id='10000002-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
select pg_temp.check(pg_temp.sqlstate_of($q$select pg_temp.preview('24000000-0000-4000-8000-000000000001')$q$)='42501','former member cannot preview');
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(pg_temp.preview('24000000-0000-4000-8000-000000000001')->>'eligible_count'='1' and pg_temp.preview('24000000-0000-4000-8000-000000000001')->>'all_available'='true','current membership changes the denominator and all_available');
reset role;
update public.rooms set expires_at=clock_timestamp()-interval '1 second' where id='24000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.as_user('10000003-0000-4000-8000-000000000003');
select pg_temp.check(pg_temp.sqlstate_of($q$select pg_temp.preview('24000000-0000-4000-8000-000000000002')$q$)='42501','expired member room is not disclosed');
reset role;
select pg_temp.check((select provolatile='s' and prosecdef and proconfig @> array['search_path=""','TimeZone=UTC'] from pg_proc where oid='public.preview_room_meeting_time_v1(uuid,text,text,text)'::regprocedure),'catalog: preview is STABLE, SECURITY DEFINER, fixed search_path and timezone');
select pg_temp.check(has_function_privilege('authenticated','public.preview_room_meeting_time_v1(uuid,text,text,text)','EXECUTE') and not has_function_privilege('anon','public.preview_room_meeting_time_v1(uuid,text,text,text)','EXECUTE') and not has_function_privilege('service_role','public.preview_room_meeting_time_v1(uuid,text,text,text)','EXECUTE'),'catalog: only authenticated has public execute');
select pg_temp.check(not exists(select 1 from pg_proc p cross join lateral aclexplode(p.proacl) a where p.oid='public.preview_room_meeting_time_v1(uuid,text,text,text)'::regprocedure and a.grantee=0),'catalog: no PUBLIC execute');
select pg_temp.check(not has_function_privilege('authenticated','private.s4_time_keys(jsonb,timestamptz,timestamptz)','EXECUTE') and not has_function_privilege('anon','private.s4_time_keys(jsonb,timestamptz,timestamptz)','EXECUTE') and not has_function_privilege('service_role','private.s4_time_keys(jsonb,timestamptz,timestamptz)','EXECUTE'),'catalog: common time validator has no caller/worker grant');
select pg_temp.check((select provolatile='s' and proconfig @> array['search_path=""'] from pg_proc where oid='private.s4_time_keys(jsonb,timestamptz,timestamptz)'::regprocedure) and (select prosrc like '%private.s4_time_keys(%' from pg_proc where oid='private.s4_assert_time(uuid,jsonb)'::regprocedure),'catalog: writer and preview share the STABLE time validator');
select pg_temp.check(not exists(select 1 from pg_proc where oid in('public.preview_room_meeting_time_v1(uuid,text,text,text)'::regprocedure,'private.s4_time_keys(jsonb,timestamptz,timestamptz)'::regprocedure,'private.s4_read_room(uuid)'::regprocedure) and prosrc ~* 'for\s+(update|share)|pg_advisory|\m(insert|delete|update)\M'),'catalog: preview read graph has no explicit row/advisory locks or DML');
set local role anon;
select pg_temp.check(pg_temp.sqlstate_of($q$select public.preview_room_meeting_time_v1(null,null,null,null)$q$)='42501','anonymous execution is denied');
reset role;
set local role service_role;
select pg_temp.check(pg_temp.sqlstate_of($q$select public.preview_room_meeting_time_v1(null,null,null,null)$q$)='42501','worker execution is denied');
reset role;
select * from finish();
rollback;
