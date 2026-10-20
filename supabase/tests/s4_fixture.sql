-- Trusted synthetic S4 fixtures only. Included inside the caller's rollback transaction.
\ir s1_fixture.sql
create temporary table s4_data(k text primary key,v jsonb);
grant all on s4_data to authenticated,service_role;
insert into s4_data values('day',to_jsonb(to_char((clock_timestamp() at time zone 'Asia/Seoul')::date+1,'YYYY-MM-DD')));
insert into s4_data select 'slots',jsonb_build_array(v#>>'{}'||'-11',v#>>'{}'||'-12') from s4_data where k='day';
insert into s4_data select 'time',jsonb_build_object('starts_at',v#>>'{}'||'T11:00:00+09:00','ends_at',v#>>'{}'||'T13:00:00+09:00','time_zone','Asia/Seoul') from s4_data where k='day';
insert into public.rooms(id,code,title,meeting_date,expires_at,owner_id) values
('24000000-0000-4000-8000-000000000001','S4TEST1','S4 primary',current_date+1,clock_timestamp()+interval '4 days','10000001-0000-4000-8000-000000000001'),
('24000000-0000-4000-8000-000000000002','S4TEST2','S4 outsider',current_date+1,clock_timestamp()+interval '4 days','10000003-0000-4000-8000-000000000003'),
('24000000-0000-4000-8000-000000000003','S4TEST3','S4 owner only',current_date+1,clock_timestamp()+interval '4 days','10000006-0000-4000-8000-000000000006'),
('24000000-0000-4000-8000-000000000004','S4TEST4','S4 pending participant',current_date+1,clock_timestamp()+interval '4 days','10000001-0000-4000-8000-000000000001');
insert into public.participants(room_id,profile_id,name) values
('24000000-0000-4000-8000-000000000001','10000002-0000-4000-8000-000000000002','S4 B'),
('24000000-0000-4000-8000-000000000004','10000007-0000-4000-8000-000000000007','S4 pending'),
('24000000-0000-4000-8000-000000000001',null,'Legacy display');
delete from public.participants where room_id='24000000-0000-4000-8000-000000000003';
create function pg_temp.s4_revision(r uuid) returns bigint language sql as $$ select s4_revision from public.rooms where id=r $$;
create function pg_temp.s4_submit(r uuid) returns jsonb language sql as $$ select public.submit_room_availability_v1(r,array(select jsonb_array_elements_text(v) from s4_data where k='slots'),pg_temp.s4_revision(r),gen_random_uuid()) $$;
grant execute on function pg_temp.s4_revision(uuid),pg_temp.s4_submit(uuid) to authenticated;

create function pg_temp.s4_error(command text) returns jsonb language plpgsql as $$
declare operation_hint text; begin execute command; return '{}'::jsonb;
exception when others then get stacked diagnostics operation_hint=PG_EXCEPTION_HINT;
return jsonb_build_object('code',sqlstate,'hint',operation_hint); end; $$;
grant execute on function pg_temp.s4_error(text) to authenticated;
