begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local s1.tap='on';
select no_plan();
\ir s1_fixture.sql
select set_config('request.jwt.claim.sub','',true);
create temporary table s1_realtime_result(k text,action text,wal jsonb,subscription_ids uuid[],errors text[]);
do $$
declare tbl text; row_doc jsonb; columns_doc jsonb; row_id uuid; act text; u uuid; sid uuid;
begin
 foreach tbl in array array['participants','notifications','rooms'] loop
  if tbl='participants' then
   select to_jsonb(p) into row_doc from public.participants p where p.room_id='20000000-0000-4000-8000-000000000001' and p.profile_id='10000001-0000-4000-8000-000000000001';
   row_doc:=row_doc||'{"personal_data":{"legacy":"synthetic-private-marker"},"start_location_name":"synthetic-origin-marker","start_latitude":37.1,"start_longitude":127.1}';
  elsif tbl='notifications' then
   select to_jsonb(n) into row_doc from public.notifications n where n.settlement_id=(select v from pg_temp.s1_ids where k='bill');
   row_doc:=row_doc||'{"bank_name":"synthetic-bank-marker","account_number":"synthetic-account-marker"}';
  else
   select to_jsonb(r) into row_doc from public.rooms r where r.id='20000000-0000-4000-8000-000000000001';
  end if;
  row_id:=(row_doc->>'id')::uuid;
  select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,null),'typeoid',a.atttypid,'value',row_doc->a.attname) order by a.attnum) into columns_doc
   from pg_attribute a where a.attrelid=('public.'||tbl)::regclass and a.attnum>0 and not a.attisdropped;
  foreach u in array array['10000002-0000-4000-8000-000000000002'::uuid,'10000003-0000-4000-8000-000000000003'::uuid,'10000007-0000-4000-8000-000000000007'::uuid] loop
   sid:=('6000000'||substring(u::text,8,1)||'-0000-4000-8000-000000000001')::uuid;
   insert into realtime.subscription(subscription_id,entity,claims,filters)
    values(sid,('public.'||tbl)::regclass,jsonb_build_object('sub',u,'role','authenticated'),'{}');
  end loop;
  insert into realtime.subscription(subscription_id,entity,claims,filters)
   values('60000000-0000-4000-8000-000000000001',('public.'||tbl)::regclass,'{"role":"anon"}','{}');
  foreach act in array array['U','D'] loop
   insert into pg_temp.s1_realtime_result
    select tbl,act,r.wal,r.subscription_ids,r.errors from realtime.apply_rls(jsonb_build_object('schema','public','table',tbl,'action',act,'timestamp',clock_timestamp(),'columns',columns_doc,'identity',columns_doc,'pk',jsonb_build_array(jsonb_build_object('name','id','type','uuid','value',row_id)))) r;
  end loop;
 end loop;
end; $$;
select pg_temp.check(not exists(select 1 from pg_temp.s1_realtime_result where k='participants' and (coalesce(wal->'record','{}') ?| array['personal_data','start_location_name','start_latitude','start_longitude','bank_name','account_number'] or coalesce(wal->'old_record','{}') ?| array['personal_data','start_location_name','start_latitude','start_longitude','bank_name','account_number'])),'Realtime participants strips legacy private columns in new and old payload');
select pg_temp.check(exists(select 1 from pg_temp.s1_realtime_result where k='participants' and action='U' and '60000002-0000-4000-8000-000000000001'::uuid=any(subscription_ids)),'Realtime participants update reaches accepted recipient');
select pg_temp.check(not exists(select 1 from pg_temp.s1_realtime_result where k='participants' and action='U' and subscription_ids && array['60000003-0000-4000-8000-000000000001'::uuid,'60000007-0000-4000-8000-000000000001'::uuid]),'Realtime participants update excludes unrelated and pending subscriptions');
select pg_temp.check(not exists(select 1 from pg_temp.s1_realtime_result where k='participants' and action='D' and case when jsonb_typeof(wal->'old_record')='object' then (wal->'old_record')-array['id'] else '{}'::jsonb end<>'{}'::jsonb),'Realtime participants delete payload contains only primary key');
select pg_temp.check(not exists(select 1 from pg_temp.s1_realtime_result where k='notifications' and (coalesce(wal->'record','{}') ?| array['personal_data','start_location_name','start_latitude','start_longitude','bank_name','account_number'] or coalesce(wal->'old_record','{}') ?| array['personal_data','start_location_name','start_latitude','start_longitude','bank_name','account_number'])),'Realtime notifications strips legacy private columns in new and old payload');
select pg_temp.check(exists(select 1 from pg_temp.s1_realtime_result where k='notifications' and action='U' and '60000002-0000-4000-8000-000000000001'::uuid=any(subscription_ids)),'Realtime notifications update reaches accepted recipient');
select pg_temp.check(not exists(select 1 from pg_temp.s1_realtime_result where k='notifications' and action='U' and subscription_ids && array['60000003-0000-4000-8000-000000000001'::uuid,'60000007-0000-4000-8000-000000000001'::uuid]),'Realtime notifications update excludes unrelated and pending subscriptions');
select pg_temp.check(not exists(select 1 from pg_temp.s1_realtime_result where k='notifications' and action='D' and case when jsonb_typeof(wal->'old_record')='object' then (wal->'old_record')-array['id'] else '{}'::jsonb end<>'{}'::jsonb),'Realtime notifications delete payload contains only primary key');
select pg_temp.check(not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename in ('profile_private','profile_health_preferences','profile_food_preferences','profile_consents','profile_consent_states','consent_requests')),'personal and health tables are not published to Realtime');
-- Known upstream behavior: DELETE skips row RLS. Report identifiers delivered to pending subscribers separately.
select 'REALTIME_DELETE_UNRELATED_PK_ONLY='||count(*) from pg_temp.s1_realtime_result where action='D' and '60000003-0000-4000-8000-000000000001'::uuid=any(subscription_ids);
select 'REALTIME_DELETE_PENDING_PK_ONLY='||count(*) from pg_temp.s1_realtime_result where action='D' and '60000007-0000-4000-8000-000000000001'::uuid=any(subscription_ids);
-- Catalog guard: a future FULL identity can put the prior row into logical WAL.
select pg_temp.check(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and c.relreplident='f' and n.nspname not like 'pg_%' and n.nspname<>'information_schema'),'no non-system table uses REPLICA IDENTITY FULL');
select pg_temp.check(not exists(select 1 from pg_publication_tables p join pg_namespace n on n.nspname=p.schemaname join pg_class c on c.relnamespace=n.oid and c.relname=p.tablename where p.pubname='supabase_realtime' and (c.relreplident<>'d' or not exists(select 1 from pg_index i join pg_attribute a on a.attrelid=c.oid and a.attnum=i.indkey[0] where i.indrelid=c.oid and i.indisprimary and i.indnkeyatts=1 and a.atttypid='uuid'::regtype))),'Realtime published tables retain DEFAULT identity with a single UUID primary key');
select pg_temp.check((select count(*)=3 and bool_and(wal->'old_record'=jsonb_build_object('id',(wal->'old_record'->>'id')::uuid) and coalesce(wal->'record','{}'::jsonb)='{}'::jsonb) from pg_temp.s1_realtime_result where action='D' and '60000007-0000-4000-8000-000000000001'::uuid=any(subscription_ids)),'accepted DELETE limitation exposes only a UUID key and no row contents for participants notifications and rooms');
select pg_temp.check((select count(*)=3 and bool_and(wal->'old_record'=jsonb_build_object('id',(wal->'old_record'->>'id')::uuid) and coalesce(wal->'record','{}'::jsonb)='{}'::jsonb) from pg_temp.s1_realtime_result where action='D' and '60000003-0000-4000-8000-000000000001'::uuid=any(subscription_ids)),'upstream DELETE also exposes only UUID keys to unrelated authenticated users');
select pg_temp.check((select count(*)=3 and bool_and(wal->'old_record' is null or wal->'old_record'='null'::jsonb) from pg_temp.s1_realtime_result where action='D' and '60000000-0000-4000-8000-000000000001'::uuid=any(subscription_ids)),'anon DELETE old_record is null across participants notifications and rooms');
select pg_temp.check(exists(select 1 from pg_temp.s1_realtime_result where k='rooms' and action='U' and '60000002-0000-4000-8000-000000000001'::uuid=any(subscription_ids)) and not exists(select 1 from pg_temp.s1_realtime_result where k='rooms' and action='U' and subscription_ids && array['60000003-0000-4000-8000-000000000001'::uuid,'60000007-0000-4000-8000-000000000001'::uuid]),'rooms UPDATE still applies member and terms RLS');
select * from finish();
rollback;
