-- Run after local reset; rollback leaves the operational catalog unchanged.
begin;
set local s1.tap='off';
create temporary table s5_reset_catalog as
 select count(*) filter(where enabled) as enabled_count,
 count(*) filter(where id='local-dev-seoul-center' and not enabled) as hidden_fixture_count
 from public.public_meeting_areas;
\ir s1_fixture.sql
reset role;
select pg_temp.check((select enabled_count=37 and hidden_fixture_count=1 from s5_reset_catalog),'reset exposes 37 areas and hides the local seed example');
-- The common fixture enables this synthetic example only for old recommendation tests.
update public.public_meeting_areas set enabled=false where id='local-dev-seoul-center';
select pg_temp.check((select count(*)=37 from public.public_meeting_areas where enabled),'exactly 37 enabled operational areas');
select pg_temp.check((select count(*)=23 from public.public_meeting_areas where enabled and latitude>37),'Seoul has 23 areas');
select pg_temp.check((select count(*)=14 from public.public_meeting_areas where enabled and latitude<36),'Busan has 14 areas including Hadan');
select pg_temp.check(not exists(select 1 from public.public_meeting_areas where id in ('hapjeong','apgujeong_rodeo','jagalchi','geumnyeonsan','jangsan','oncheonjang') or id like 'donga_univ_%'),'excluded candidates absent');
select pg_temp.check((select label='하단' and radius_m=1500 and latitude=35.106180 and longitude=128.966803 from public.public_meeting_areas where id='hadan'),'Hadan remains a standalone public area');
select pg_temp.check((select label='홍대·합정' and radius_m=1500 from public.public_meeting_areas where id='hongdae'),'Hongdae and Hapjeong combined');
select pg_temp.check((select label='압구정·로데오' and radius_m=1500 from public.public_meeting_areas where id='apgujeong'),'Apgujeong and Rodeo combined');
select pg_temp.check((select label='남포·광복·자갈치' and radius_m=1500 from public.public_meeting_areas where id='nampo'),'Nampo includes Gwangbok and Jagalchi');
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(jsonb_array_length(public.get_public_meeting_areas_v2()->'areas')=37,'consenting user RPC returns 37 operational areas');
select pg_temp.as_user('10000003-0000-4000-8000-000000000003');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.get_room_recommendation_settings_v2('20000000-0000-4000-8000-000000000001')$q$)='42501','nonmember cannot read another room settings');
select pg_temp.as_user('10000007-0000-4000-8000-000000000007');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.get_public_meeting_areas_v2()$q$)='S1001','user without required consent cannot list areas');
set local role anon;
select pg_temp.check(pg_temp.sqlstate_of($q$select public.get_public_meeting_areas_v2()$q$)='42501','anonymous RPC access denied');
rollback;
