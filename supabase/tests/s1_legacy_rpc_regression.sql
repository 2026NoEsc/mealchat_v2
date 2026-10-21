-- Adaptation of 20260823_rpc_hardening.sql: explicit S1 consent and server-owned notifications. Original preserved.
begin;
set local search_path=public,extensions;
set local s1.tap='off';
-- Synthetic local-only documents. These are NOT the M7 legal seeds.
create temporary table s1_ids(k text primary key,v uuid);
grant all on pg_temp.s1_ids to authenticated;
create function pg_temp.as_user(u uuid) returns void language plpgsql as $$ begin
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
end; $$;
create function pg_temp.sqlstate_of(command text) returns text language plpgsql as $$ begin execute command; return '00000'; exception when others then return sqlstate; end; $$;
create function pg_temp.check(b boolean,label text) returns text language plpgsql as $$ begin
 if current_setting('s1.tap',true)='on' then return extensions.ok(coalesce(b,false),label); end if;
 if b is distinct from true then raise exception 'S1_ASSERTION_FAILED: %',label; end if; return 'ok - '||label;
end; $$;
grant execute on function pg_temp.as_user(uuid),pg_temp.sqlstate_of(text),pg_temp.check(boolean,text) to anon,authenticated,service_role;
update public.terms_versions set is_current=false where is_current;
update public.consent_documents set is_current=false where is_current;
insert into public.consent_documents(id,kind,version,edition,effective_from,published_at,is_current,canonical_content,content_hash) values('30000000-0000-4000-8000-000000000001','service','s1-test-service',1,'2020-01-01Z',clock_timestamp(),true,$doc${"id":"terms","title":"Synthetic service","effectiveDate":"2020-01-01","edition":1,"sections":[{"id":"test","title":"Synthetic","paragraphs":["Not a production document."]}]}
$doc$,'5acfbabc833243133df90a38fcc1a692f365ec333a48bc8b5a9092349d3958a8');
insert into public.consent_documents(id,kind,version,edition,effective_from,published_at,is_current,canonical_content,content_hash) values('30000000-0000-4000-8000-000000000002','privacy','s1-test-privacy',1,'2020-01-01Z',clock_timestamp(),true,$doc${"id":"privacy","title":"Synthetic privacy","effectiveDate":"2020-01-01","edition":1,"sections":[{"id":"test","title":"Synthetic","paragraphs":["Not a production document."]}]}
$doc$,'f41fc06f096f919821705ba9991906ee3f00fc7edd7d75c0ffa731437e034b86');
insert into public.consent_documents(id,kind,version,edition,effective_from,published_at,is_current,canonical_content,content_hash) values('30000000-0000-4000-8000-000000000003','health','s1-test-health',1,'2020-01-01Z',clock_timestamp(),true,$doc${"id":"health","title":"Synthetic health","effectiveDate":"2020-01-01","edition":1,"sections":[{"id":"test","title":"Synthetic","paragraphs":["Not a production document."]}]}
$doc$,'703aa3a30b3af1a0cbaa1c3deaa1f336b1b8d8f11f7de7fdd73597697b483a61');
insert into public.consent_documents(id,kind,version,edition,effective_from,published_at,is_current,canonical_content,content_hash) values('30000000-0000-4000-8000-000000000004','marketing','s1-test-marketing',1,'2020-01-01Z',clock_timestamp(),true,$doc${"id":"marketing","title":"Synthetic marketing","effectiveDate":"2020-01-01","edition":1,"sections":[{"id":"test","title":"Synthetic","paragraphs":["Not a production document."]}]}
$doc$,'5e05668bd3a762a1405e6aded76ee102c9456e22e8f57746585774ad6f10f18a');
insert into public.terms_versions(version,effective_from,is_current,service_document_id,privacy_document_id,published_at) values('s1-test-bundle','2020-01-01Z',true,'30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002',clock_timestamp());
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('10000001-0000-4000-8000-000000000001','authenticated','authenticated','s1-1@example.invalid','{}','{"name":"Synthetic 1","marketing_opt_in":true,"health":true}',clock_timestamp(),clock_timestamp());
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('10000002-0000-4000-8000-000000000002','authenticated','authenticated','s1-2@example.invalid','{}','{"name":"Synthetic 2","marketing_opt_in":true,"health":true}',clock_timestamp(),clock_timestamp());
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('10000003-0000-4000-8000-000000000003','authenticated','authenticated','s1-3@example.invalid','{}','{"name":"Synthetic 3","marketing_opt_in":true,"health":true}',clock_timestamp(),clock_timestamp());
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('10000004-0000-4000-8000-000000000004','authenticated','authenticated','s1-4@example.invalid','{}','{"name":"Synthetic 4","marketing_opt_in":true,"health":true}',clock_timestamp(),clock_timestamp());
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('10000005-0000-4000-8000-000000000005','authenticated','authenticated','s1-5@example.invalid','{}','{"name":"Synthetic 5","marketing_opt_in":true,"health":true}',clock_timestamp(),clock_timestamp());
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('10000006-0000-4000-8000-000000000006','authenticated','authenticated','s1-6@example.invalid','{}','{"name":"Synthetic 6","marketing_opt_in":true,"health":true}',clock_timestamp(),clock_timestamp());
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('10000007-0000-4000-8000-000000000007','authenticated','authenticated','s1-7@example.invalid','{}','{"name":"Synthetic 7","marketing_opt_in":true,"health":true}',clock_timestamp(),clock_timestamp());
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('10000008-0000-4000-8000-000000000008','authenticated','authenticated','s1-8@example.invalid','{}','{"name":"Synthetic 8","marketing_opt_in":true,"health":true}',clock_timestamp(),clock_timestamp());
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('10000009-0000-4000-8000-000000000009','authenticated','authenticated','s1-9@example.invalid','{}','{"name":"Synthetic 9","marketing_opt_in":true,"health":true}',clock_timestamp(),clock_timestamp());
set local role authenticated;
do $$ declare i integer; m jsonb; begin
 for i in 1..9 loop
  if i=7 then continue; end if;
  perform pg_temp.as_user((to_hex(268435456+i)||'-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid);
  m:=public.get_consent_manifest();
  perform public.record_required_consents(gen_random_uuid(),'s1-test-bundle',jsonb_build_object('service',(m->'documents'->'service')-'canonical_content'-'edition','privacy',(m->'documents'->'privacy')-'canonical_content'-'edition'),'{"service":true,"privacy":true}');
 end loop;
end; $$;
reset role;
insert into public.rooms(id,code,title,meeting_date,expires_at,owner_id) values('20000000-0000-4000-8000-000000000001','S1ROOM1','Synthetic room',current_date+1,clock_timestamp()+interval '1 day','10000001-0000-4000-8000-000000000001'),('20000000-0000-4000-8000-000000000002','S1ROOM2','Synthetic other',current_date+1,clock_timestamp()+interval '1 day','10000002-0000-4000-8000-000000000002');
insert into public.participants(room_id,profile_id,name) values('20000000-0000-4000-8000-000000000001','10000002-0000-4000-8000-000000000002','Synthetic B'),('20000000-0000-4000-8000-000000000001','10000006-0000-4000-8000-000000000006','Synthetic F'),('20000000-0000-4000-8000-000000000002','10000001-0000-4000-8000-000000000001','Synthetic A');
insert into public.follows(follower_id,following_id,role) values('10000003-0000-4000-8000-000000000003','10000001-0000-4000-8000-000000000001','mate');
insert into public.follows(follower_id,following_id,role) values('10000001-0000-4000-8000-000000000001','10000008-0000-4000-8000-000000000008','mate');
insert into public.health_code_catalog(category,code,label) values('allergy','test_allergy','Synthetic allergy'),('dietary_restriction','test_diet','Synthetic diet');
update public.profile_private set bank_name='Synthetic bank',account_number='0000000000',birth_date='1995-02-03',personal_data='{"gender":"female","bio":"Synthetic bio"}',start_location_name='Synthetic origin',start_latitude=37,start_longitude=127 where id='10000001-0000-4000-8000-000000000001';
do $$ begin if to_regprocedure('private.s4_settlement_allowed(public.rooms)') is not null then update public.rooms set stage='confirmed' where id in('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002'); end if; end; $$;
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
insert into pg_temp.s1_ids values('pending_invite',public.create_room_invitation('20000000-0000-4000-8000-000000000001','10000008-0000-4000-8000-000000000008'));
insert into pg_temp.s1_ids values('bill',public.create_room_settlement_v2('20000000-0000-4000-8000-000000000001','Synthetic bill',6000,'Synthetic bank','0000000000','Synthetic A'));
reset role;
insert into public.participants(room_id,profile_id,name) values('20000000-0000-4000-8000-000000000001','10000005-0000-4000-8000-000000000005','Synthetic E');
delete from public.participants where room_id='20000000-0000-4000-8000-000000000001' and profile_id='10000006-0000-4000-8000-000000000006';


create extension if not exists pgtap with schema extensions;

select plan(70);

create temporary table test_ids (
  key text primary key,
  id uuid not null
);
grant select, insert, update, delete on table pg_temp.test_ids to authenticated;

create or replace function pg_temp.sqlstate_of(command text)
returns text
language plpgsql
as $$
begin
  execute command;
  return '00000';
exception
  when others then
    return sqlstate;
end;
$$;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated',
   'runtime-a@example.invalid', '{}'::jsonb, '{"name":"Runtime A"}'::jsonb, now(), now()),
  ('bbbbbbbb-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated',
   'runtime-b@example.invalid', '{}'::jsonb, '{"name":"Runtime B"}'::jsonb, now(), now()),
  ('cccccccc-0000-0000-0000-0000000000c3', 'authenticated', 'authenticated',
   'runtime-c@example.invalid', '{}'::jsonb, '{"name":"Runtime C"}'::jsonb, now(), now());

set local role authenticated;
do $$ declare u uuid; m jsonb; begin
 foreach u in array array['aaaaaaaa-0000-0000-0000-0000000000a1'::uuid,'bbbbbbbb-0000-0000-0000-0000000000b2'::uuid,'cccccccc-0000-0000-0000-0000000000c3'::uuid] loop
 perform pg_temp.as_user(u); m:=public.get_consent_manifest();
 perform public.record_required_consents(gen_random_uuid(),'s1-test-bundle',jsonb_build_object('service',(m->'documents'->'service')-'canonical_content'-'edition','privacy',(m->'documents'->'privacy')-'canonical_content'-'edition'),'{"service":true,"privacy":true}');
 end loop;
end; $$;
reset role;

insert into public.follows (follower_id, following_id, role)
values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'bbbbbbbb-0000-0000-0000-0000000000b2', 'mate'),
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'cccccccc-0000-0000-0000-0000000000c3', 'mate');

select ok(
  not exists (
    select 1
    from pg_proc function
    join pg_namespace namespace on namespace.oid = function.pronamespace
    where (namespace.nspname, function.proname) in (
      ('public', 'create_room_invitation'),
      ('public', 'accept_room_invitation'),
      ('public', 'decline_room_invitation'),
      ('public', 'join_room_by_code'),
      ('public', 'leave_room'),
      ('public', 'create_room_settlement_v2'),
      ('public', 'set_settlement_completed'),
      ('public', 'add_voting_item'),
      ('public', 'toggle_vote'),
      ('public', 'confirm_room_vote'),
      ('private', 'create_room_settlement_impl')
    )
    and (
      not function.prosecdef
      or not coalesce('search_path=""' = any(function.proconfig), false)
    )
  ),
  'privileged RPCs are SECURITY DEFINER with an empty search_path'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'public.create_room_invitation(uuid,uuid)'::regprocedure,
      'public.accept_room_invitation(uuid)'::regprocedure,
      'public.decline_room_invitation(uuid)'::regprocedure,
      'public.join_room_by_code(text)'::regprocedure,
      'public.leave_room(uuid)'::regprocedure,
      'public.create_room_settlement_v2(uuid,text,integer,text,text,text)'::regprocedure,
      'public.set_settlement_completed(uuid,boolean)'::regprocedure,
      'public.add_voting_item(uuid,text,text)'::regprocedure,
      'public.toggle_vote(uuid,uuid)'::regprocedure,
      'public.confirm_room_vote(uuid,uuid)'::regprocedure
    ]) function_oid
    where not has_function_privilege('authenticated', function_oid, 'EXECUTE')
  ),
  'authenticated can execute only the intended current RPC surface'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'public.create_room_invitation(uuid,uuid)'::regprocedure,
      'public.accept_room_invitation(uuid)'::regprocedure,
      'public.decline_room_invitation(uuid)'::regprocedure,
      'public.create_room_settlement_v2(uuid,text,integer,text,text,text)'::regprocedure,
      'public.set_settlement_completed(uuid,boolean)'::regprocedure,
      'public.confirm_room_vote(uuid,uuid)'::regprocedure
    ]) function_oid
    where has_function_privilege('anon', function_oid, 'EXECUTE')
  ),
  'anon cannot execute authenticated state-changing RPCs'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'public.create_room_settlement(uuid,text,integer,text,text,text)'::regprocedure,
      'public.post_room_system_message(uuid,text)'::regprocedure
    ]) function_oid
    where not has_function_privilege('authenticated', function_oid, 'EXECUTE')
       or has_function_privilege('anon', function_oid, 'EXECUTE')
  ),
  'legacy settlement-v1 and generic-system compatibility remains authenticated-only; forced-invite is closed separately'
);

select ok(
  not has_column_privilege(
    'authenticated', 'public.notifications', 'settlement_id', 'INSERT'
  ),
  'clients cannot forge linked settlement notifications'
);

select ok(
  not has_table_privilege('authenticated', 'public.dutch_pay_bills', 'INSERT')
  and not has_table_privilege('authenticated', 'public.dutch_pay_bills', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.dutch_pay_bills', 'DELETE'),
  'direct settlement bill writes are closed'
);

select ok(
  not has_table_privilege('authenticated', 'public.rooms', 'UPDATE'),
  'direct room updates are closed'
);

select ok(
  not has_table_privilege('authenticated', 'public.participants', 'DELETE'),
  'direct participant deletion is closed'
);

select ok(
  not has_table_privilege('authenticated', 'public.rooms', 'DELETE'),
  'direct room deletion is closed'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'room_id', 'title', 'message', 'amount'
    ]) column_name
    where has_column_privilege(
      'authenticated', 'public.notifications', column_name, 'INSERT'
    )
  ),
  'legacy notification writes stay closed; server RPC owns creation'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'room_id', 'title', 'message', 'bank_name', 'account_number', 'amount'
    ]) column_name
    where has_column_privilege(
      'anon', 'public.notifications', column_name, 'INSERT'
    )
  ),
  'anon cannot use the temporary legacy notification columns'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'code', 'title', 'meeting_date', 'expires_at', 'owner_id',
      'is_confirmed', 'confirmed_slot', 'color', 'location_name'
    ]) column_name
    where not has_column_privilege(
      'authenticated', 'public.rooms', column_name, 'INSERT'
    )
  ),
  'room creation retains only the current client columns'
);

select is(
  (select count(*) from public.profiles where id in (
    'aaaaaaaa-0000-0000-0000-0000000000a1',
    'bbbbbbbb-0000-0000-0000-0000000000b2',
    'cccccccc-0000-0000-0000-0000000000c3'
  )),
  3::bigint,
  'local auth users receive profile rows through the production trigger'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-0000000000a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

select is(
  auth.uid(),
  'aaaaaaaa-0000-0000-0000-0000000000a1'::uuid,
  'JWT subject identifies user A'
);

select is(
  pg_temp.sqlstate_of($command$
    insert into public.rooms (
      code, title, meeting_date, expires_at, owner_id,
      is_confirmed, confirmed_slot, color, location_name
    )
    values (
      'RUNTIME01', 'Runtime room', current_date + 1, now() + interval '7 days',
      'aaaaaaaa-0000-0000-0000-0000000000a1',
      false, null, '#23A455', 'Test location'
    )
  $command$),
  '00000',
  'user A can create a room through the narrowed insert contract'
);

insert into pg_temp.test_ids (key, id)
select 'room', id from public.rooms where code = 'RUNTIME01';

select is(
  (select count(*) from public.participants
   where room_id = (select id from pg_temp.test_ids where key = 'room')
     and profile_id = auth.uid()),
  1::bigint,
  'room creation snapshots the owner exactly once'
);

select is(
  pg_temp.sqlstate_of(format(
    'insert into public.messages (room_id, message) values (%L::uuid, %L)',
    (select id from pg_temp.test_ids where key = 'room'),
    'seed message'
  )),
  '00000',
  'room member can create a normal message through the client contract'
);

insert into pg_temp.test_ids (key, id)
select 'invite_b', public.create_room_invitation(
  (select id from pg_temp.test_ids where key = 'room'),
  'bbbbbbbb-0000-0000-0000-0000000000b2'
);

select is(
  public.create_room_invitation(
    (select id from pg_temp.test_ids where key = 'room'),
    'bbbbbbbb-0000-0000-0000-0000000000b2'
  ),
  (select id from pg_temp.test_ids where key = 'invite_b'),
  'retrying a pending invitation returns the same invitation'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-0000000000b2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-0000000000b2","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.room_invitations
   where id = (select id from pg_temp.test_ids where key = 'invite_b')),
  1::bigint,
  'user B sees their pending invitation'
);

select is(
  (select count(*) from public.rooms
   where id = (select id from pg_temp.test_ids where key = 'room')),
  0::bigint,
  'user B cannot see the room before accepting'
);

select is(
  (select count(*) from public.participants
   where room_id = (select id from pg_temp.test_ids where key = 'room')),
  0::bigint,
  'user B cannot see participant data before accepting'
);

select is(
  (select count(*) from public.messages
   where room_id = (select id from pg_temp.test_ids where key = 'room')),
  0::bigint,
  'user B cannot see messages before accepting'
);

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000c3', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-0000000000c3","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.room_invitations
   where id = (select id from pg_temp.test_ids where key = 'invite_b')),
  0::bigint,
  'unrelated user C cannot see B invitation'
);

select is(
  pg_temp.sqlstate_of(format(
    'select public.accept_room_invitation(%L::uuid)',
    (select id from pg_temp.test_ids where key = 'invite_b')
  )),
  '42501',
  'unrelated user C cannot accept B invitation'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-0000000000a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

select is(
  pg_temp.sqlstate_of(format(
    'select public.accept_room_invitation(%L::uuid)',
    (select id from pg_temp.test_ids where key = 'invite_b')
  )),
  '42501',
  'inviter A cannot accept B invitation'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-0000000000b2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-0000000000b2","role":"authenticated"}',
  true
);

select is(
  public.accept_room_invitation(
    (select id from pg_temp.test_ids where key = 'invite_b')
  ),
  (select id from pg_temp.test_ids where key = 'room'),
  'invited user B accepts the room invitation'
);

select is(
  public.accept_room_invitation(
    (select id from pg_temp.test_ids where key = 'invite_b')
  ),
  (select id from pg_temp.test_ids where key = 'room'),
  'repeated invitation acceptance is idempotent'
);

select is(
  (select count(*) from public.participants
   where room_id = (select id from pg_temp.test_ids where key = 'room')
     and profile_id = auth.uid()),
  1::bigint,
  'acceptance creates one participant row for user B'
);

select is(
  (select count(*) from public.rooms
   where id = (select id from pg_temp.test_ids where key = 'room')),
  1::bigint,
  'user B sees the room after accepting'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-0000000000a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

-- Prepare a confirmed historical fixture for the independent settlement compatibility assertions.
select (to_regprocedure('private.s4_settlement_allowed(public.rooms)') is not null) as s4_settlement_guard \gset
\if :s4_settlement_guard
reset role;
update public.rooms set stage='confirmed' where id=(select id from pg_temp.test_ids where key='room');
set local role authenticated;
\endif
insert into pg_temp.test_ids (key, id)
select 'bill', public.create_room_settlement_v2(
  (select id from pg_temp.test_ids where key = 'room'),
  'Runtime dinner', 24000, 'Test bank', '000-000', 'Runtime A'
);

select ok(
  (select id is not null from pg_temp.test_ids where key = 'bill'),
  'settlement v2 creates an active bill'
);

select is(
  public.create_room_settlement_v2(
    (select id from pg_temp.test_ids where key = 'room'),
    'Runtime dinner', 24000, 'Test bank', '000-000', 'Runtime A'
  ),
  (select id from pg_temp.test_ids where key = 'bill'),
  'repeated settlement creation returns the same active bill'
);

select is(
  (select count(*) from public.dutch_pay_bills
   where room_id = (select id from pg_temp.test_ids where key = 'room')),
  1::bigint,
  'only one active settlement exists in the room'
);

select is(
  (select count(*) from public.dutch_pay_members
   where bill_id = (select id from pg_temp.test_ids where key = 'bill')),
  2::bigint,
  'settlement recipients are snapshotted at creation time'
);

select is(
  (select count(*) from public.notifications
   where settlement_id = (select id from pg_temp.test_ids where key = 'bill')),
  1::bigint,
  'settlement creates one linked notification'
);

select is(
  (select count(*) from public.messages
   where room_id = (select id from pg_temp.test_ids where key = 'room')
     and event_key like 'settlement-created:%'),
  1::bigint,
  'settlement v2 creates one fixed system event'
);

insert into pg_temp.test_ids (key, id)
select 'member_b', id
from public.dutch_pay_members
where bill_id = (select id from pg_temp.test_ids where key = 'bill')
  and profile_id = 'bbbbbbbb-0000-0000-0000-0000000000b2';

select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-0000000000b2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-0000000000b2","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.dutch_pay_bills
   where id = (select id from pg_temp.test_ids where key = 'bill')),
  1::bigint,
  'snapshotted recipient B sees the settlement'
);

select is(
  (select count(*) from public.notifications
   where settlement_id = (select id from pg_temp.test_ids where key = 'bill')),
  1::bigint,
  'snapshotted recipient B sees the linked notification'
);

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000c3', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-0000000000c3","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.dutch_pay_bills
   where id = (select id from pg_temp.test_ids where key = 'bill')),
  0::bigint,
  'unrelated user C cannot see the settlement'
);

select is(
  (select count(*) from public.notifications
   where settlement_id = (select id from pg_temp.test_ids where key = 'bill')),
  0::bigint,
  'unrelated user C cannot see the linked notification'
);

select is(
  pg_temp.sqlstate_of(format(
    'insert into public.notifications '
    || '(room_id, title, message, bank_name, account_number, amount, settlement_id) '
    || 'values (%L::uuid, %L, %L, %L, %L, 1, %L::uuid)',
    (select id from pg_temp.test_ids where key = 'room'),
    'forged', 'forged', 'forged', 'forged',
    (select id from pg_temp.test_ids where key = 'bill')
  )),
  '42501',
  'unrelated user cannot forge a linked notification'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-0000000000a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

-- S4 fixture adaptation only: the historical test orders settlement before joining and voting.
-- Its 70 assertions remain, but a fresh place/time fixture is required by S4's closed-stage guards.
-- Real submit/select/confirm and no-rewind behavior are exercised separately in s4_voting_atomicity.sql.
select (to_regprocedure('public.get_s4_capabilities()') is not null) as s4_enabled \gset
\if :s4_enabled
reset role;
update public.rooms set stage='place',meeting_starts_at=((clock_timestamp() at time zone 'Asia/Seoul')::date+1+time '11:00') at time zone 'Asia/Seoul',meeting_ends_at=((clock_timestamp() at time zone 'Asia/Seoul')::date+1+time '12:00') at time zone 'Asia/Seoul',meeting_time_zone='Asia/Seoul' where id=(select id from pg_temp.test_ids where key='room');
update public.participants set schedule=jsonb_build_object('slots',jsonb_build_array(to_char((clock_timestamp() at time zone 'Asia/Seoul')::date+1,'YYYY-MM-DD')||'-11')) where room_id=(select id from pg_temp.test_ids where key='room');
set local role authenticated;
\endif

insert into pg_temp.test_ids (key, id)
select 'invite_c', public.create_room_invitation(
  (select id from pg_temp.test_ids where key = 'room'),
  'cccccccc-0000-0000-0000-0000000000c3'
);

select ok(
  (select id is not null from pg_temp.test_ids where key = 'invite_c'),
  'user A creates a pending invitation for user C'
);

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000c3', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-0000000000c3","role":"authenticated"}',
  true
);

select is(
  public.accept_room_invitation(
    (select id from pg_temp.test_ids where key = 'invite_c')
  ),
  (select id from pg_temp.test_ids where key = 'room'),
  'user C accepts after the settlement snapshot'
);

select is(
  (select count(*) from public.participants
   where room_id = (select id from pg_temp.test_ids where key = 'room')),
  3::bigint,
  'the room has three active participants'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-0000000000a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);


insert into pg_temp.test_ids (key, id)
select 'menu_option', public.add_voting_item(
  (select id from pg_temp.test_ids where key = 'room'),
  'menu', 'Runtime menu'
);

select ok(
  (select id is not null from pg_temp.test_ids where key = 'menu_option'),
  'user A adds a menu voting option'
);

select is(
  public.toggle_vote(
    (select id from pg_temp.test_ids where key = 'room'),
    (select id from pg_temp.test_ids where key = 'menu_option')
  ),
  true,
  'user A casts the first vote'
);

select is(
  pg_temp.sqlstate_of(format(
    'select public.confirm_room_vote(%L::uuid, %L::uuid)',
    (select id from pg_temp.test_ids where key = 'room'),
    (select id from pg_temp.test_ids where key = 'menu_option')
  )),
  case when to_regprocedure('public.get_s4_capabilities()') is null then '22023' else 'S4008' end,
  'one of three votes cannot confirm a strict majority'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-0000000000b2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-0000000000b2","role":"authenticated"}',
  true
);

select is(
  public.toggle_vote(
    (select id from pg_temp.test_ids where key = 'room'),
    (select id from pg_temp.test_ids where key = 'menu_option')
  ),
  true,
  'user B casts the second vote'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-0000000000a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

select is(
  pg_temp.sqlstate_of(format(
    'select public.confirm_room_vote(%L::uuid, %L::uuid)',
    (select id from pg_temp.test_ids where key = 'room'),
    (select id from pg_temp.test_ids where key = 'menu_option')
  )),
  '00000',
  'two of three votes confirm the server-computed leader'
);

select is(
  (select confirmed_menu_item_id from public.rooms
   where id = (select id from pg_temp.test_ids where key = 'room')),
  (select id from pg_temp.test_ids where key = 'menu_option'),
  'room stores the finalized menu item id'
);

select is(
  (select count(*) from public.messages
   where room_id = (select id from pg_temp.test_ids where key = 'room')
     and event_key like case when to_regprocedure('public.get_s4_capabilities()') is null then 'vote-confirmed:%:menu:%' else 'appointment-confirmed:%' end),
  1::bigint,
  'vote confirmation creates one fixed system event'
);

select is(
  pg_temp.sqlstate_of(format(
    'select public.confirm_room_vote(%L::uuid, %L::uuid)',
    (select id from pg_temp.test_ids where key = 'room'),
    (select id from pg_temp.test_ids where key = 'menu_option')
  )),
  '00000',
  'repeating the same vote confirmation is idempotent'
);

select is(
  (select count(*) from public.messages
   where room_id = (select id from pg_temp.test_ids where key = 'room')
     and event_key like case when to_regprocedure('public.get_s4_capabilities()') is null then 'vote-confirmed:%:menu:%' else 'appointment-confirmed:%' end),
  1::bigint,
  'repeated vote confirmation does not duplicate the system event'
);

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000c3', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-0000000000c3","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.dutch_pay_bills
   where id = (select id from pg_temp.test_ids where key = 'bill')),
  0::bigint,
  'late-joining user C cannot see the earlier settlement'
);

select is(
  (select count(*) from public.notifications
   where settlement_id = (select id from pg_temp.test_ids where key = 'bill')),
  0::bigint,
  'late-joining user C cannot see the earlier linked notification'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-0000000000b2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-0000000000b2","role":"authenticated"}',
  true
);

select is(
  pg_temp.sqlstate_of(format(
    'select public.leave_room(%L::uuid)',
    (select id from pg_temp.test_ids where key = 'room')
  )),
  '42501',
  'non-owner B cannot close the room'
);

select is(
  (select count(*) from public.participants
   where room_id = (select id from pg_temp.test_ids where key = 'room')
     and profile_id = auth.uid()),
  1::bigint,
  'non-owner B remains a participant after close is rejected'
);

select is(
  (select count(*) from public.dutch_pay_bills
   where id = (select id from pg_temp.test_ids where key = 'bill')),
  1::bigint,
  'recipient B sees the settlement while the room remains open'
);

select is(
  (select count(*) from public.notifications
   where settlement_id = (select id from pg_temp.test_ids where key = 'bill')),
  1::bigint,
  'recipient B sees the linked notification while the room remains open'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-0000000000a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

select is(
  pg_temp.sqlstate_of(format(
    'select public.leave_room(%L::uuid)',
    (select id from pg_temp.test_ids where key = 'room')
  )),
  '42501',
  'owner cannot close while any settlement recipient is incomplete'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-0000000000b2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-0000000000b2","role":"authenticated"}',
  true
);

select is(
  pg_temp.sqlstate_of(format(
    'select public.set_settlement_completed(%L::uuid, true)',
    (select id from pg_temp.test_ids where key = 'member_b')
  )),
  '00000',
  'recipient B can complete their snapshotted settlement while the room remains open'
);

select is(
  (select is_completed from public.dutch_pay_members
   where id = (select id from pg_temp.test_ids where key = 'member_b')),
  true,
  'recipient completion state is persisted'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-0000000000a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

select is(
  public.leave_room((select id from pg_temp.test_ids where key = 'room')),
  'deleted',
  'owner can close after all settlement recipients complete'
);

reset role;

select ok(
  not exists (
    select 1 from public.participants
    where room_id = (select id from pg_temp.test_ids where key = 'room')
  )
  and not exists (
    select 1 from public.messages
    where room_id = (select id from pg_temp.test_ids where key = 'room')
  )
  and not exists (
    select 1 from public.notifications
    where settlement_id = (select id from pg_temp.test_ids where key = 'bill')
  ),
  'room-owned participant, message, and notification rows cascade when the room closes'
);

select ok(
  (select room_id is null from public.dutch_pay_bills
   where id = (select id from pg_temp.test_ids where key = 'bill')),
  'closing the room preserves the settlement and clears its room reference'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-0000000000b2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-0000000000b2","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.dutch_pay_bills
   where id = (select id from pg_temp.test_ids where key = 'bill')),
  1::bigint,
  'recipient B still sees the snapshotted settlement after the room closes'
);

select is(
  (select count(*) from public.notifications
   where settlement_id = (select id from pg_temp.test_ids where key = 'bill')),
  0::bigint,
  'linked notification is deleted with the closed room under the current cascade contract'
);

select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-0000000000c3', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-0000000000c3","role":"authenticated"}',
  true
);

select is(
  pg_temp.sqlstate_of(format(
    'select public.set_settlement_completed(%L::uuid, false)',
    (select id from pg_temp.test_ids where key = 'member_b')
  )),
  'P0002',
  'unrelated user C cannot change B settlement completion after room close'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-0000000000a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);

select is(
  pg_temp.sqlstate_of(format(
    'insert into public.dutch_pay_bills '
    || '(room_id, creator_id, title, total_amount, split_count) '
    || 'values (%L::uuid, %L::uuid, %L, 1, 1)',
    (select id from pg_temp.test_ids where key = 'room'),
    auth.uid(),
    'forged bill'
  )),
  '42501',
  'authenticated user cannot bypass settlement RPC with a direct bill insert'
);

select is(
  pg_temp.sqlstate_of(format(
    'update public.rooms set confirmed_menu = %L where id = %L::uuid',
    'forged menu',
    (select id from pg_temp.test_ids where key = 'room')
  )),
  '42501',
  'authenticated user cannot directly overwrite server-owned room state'
);

select is(
  pg_temp.sqlstate_of(format(
    'delete from public.participants where room_id = %L::uuid and profile_id = %L::uuid',
    (select id from pg_temp.test_ids where key = 'room'),
    auth.uid()
  )),
  '42501',
  'authenticated user cannot bypass leave_room with a direct participant delete'
);

reset role;

select * from finish();
rollback;
