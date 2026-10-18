-- Trusted synthetic fixture helper, session-local only; never installed in public/private.
create function pg_temp.set_health_expiry(u uuid, expiry timestamptz) returns void language plpgsql as $$
declare s public.profile_consent_states%rowtype; e bigint; t timestamptz:=clock_timestamp()-interval '2 years';
 old_sub text:=current_setting('request.jwt.claim.sub',true); old_claims text:=current_setting('request.jwt.claims',true);
begin
 perform 1 from public.profiles where id=u for update;
 select * into s from public.profile_consent_states where profile_id=u and kind='health';
 insert into public.profile_consents(profile_id,kind,version,agreed,agreed_at,document_id,action,source)
 select u,'health',d.version,true,t,d.id,'grant','settings' from public.consent_documents d where d.id=s.document_id returning id into e;
 update public.profile_consent_states set status='granted',latest_event_id=e,granted_event_id=e,granted_at=t,valid_until=greatest(expiry,clock_timestamp()+interval '1 minute') where profile_id=u and kind='health';
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 update public.profile_health_preferences set consent_event_id=e where profile_id=u;
 update public.profile_consent_states set valid_until=expiry where profile_id=u and kind='health';
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 perform set_config('request.jwt.claims',coalesce(old_claims,''),true);
end; $$;
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
select pg_temp.check(not exists(select 1 from public.profile_consents where profile_id='10000007-0000-4000-8000-000000000007'),'signup metadata cannot create automatic consent');
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
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
insert into pg_temp.s1_ids values('bill',public.create_room_settlement_v2('20000000-0000-4000-8000-000000000001','Synthetic bill',6000,'Synthetic bank','0000000000','Synthetic A'));
insert into pg_temp.s1_ids values('pending_invite',public.create_room_invitation('20000000-0000-4000-8000-000000000001','10000008-0000-4000-8000-000000000008'));
reset role;
insert into public.participants(room_id,profile_id,name) values('20000000-0000-4000-8000-000000000001','10000005-0000-4000-8000-000000000005','Synthetic E');
delete from public.participants where room_id='20000000-0000-4000-8000-000000000001' and profile_id='10000006-0000-4000-8000-000000000006';
