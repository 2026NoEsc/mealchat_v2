begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local s1.tap='on';
select no_plan();
\ir s1_fixture.sql
insert into public.rooms(id,code,title,meeting_date,expires_at,owner_id) values('20000000-0000-4000-8000-000000000003','S1ATTACK','Synthetic adversary room',current_date+1,clock_timestamp()+interval '1 day','10000003-0000-4000-8000-000000000003');
update public.rooms set voting_items='[{"id":"50000000-0000-4000-8000-000000000001","kind":"menu","title":"Synthetic option"}]' where id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select public.set_profile_visibility('birthdate','public',0);
select public.set_profile_visibility('bank_account','public',1);
select pg_temp.as_user('10000003-0000-4000-8000-000000000003');

select pg_temp.check(public.get_visible_profile('10000001-0000-4000-8000-000000000001')->>'relationship'='identity_only','one-way follower has identity-only access before attack');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.invite_friend_to_room('20000000-0000-4000-8000-000000000003','10000001-0000-4000-8000-000000000001')$q$)='42501','one-way follow cannot force another profile into participants');
select pg_temp.check(public.get_visible_profile('10000001-0000-4000-8000-000000000001')->>'relationship'='identity_only' and public.get_visible_profile('10000001-0000-4000-8000-000000000001')->'fields'='{}'::jsonb,'forced-invite denial preserves identity-only with public birth and bank switches');
select pg_temp.check(not exists(select 1 from public.participants where room_id='20000000-0000-4000-8000-000000000003' and profile_id='10000001-0000-4000-8000-000000000001'),'forced invite has no participant side effect');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.toggle_vote('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001')$q$)='42501','nonmember toggle_vote is rejected before a successful true result');
select pg_temp.check(public.leave_room('99000000-0000-4000-8000-000000000001')='gone','missing-room leave_room retains gone contract');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.decline_room_invitation('99000000-0000-4000-8000-000000000001')$q$)='P0002','missing invitation decline retains original missing-resource error');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.add_voting_item('99000000-0000-4000-8000-000000000001','menu','Synthetic')$q$)=case when to_regprocedure('public.get_s4_capabilities()') is null then 'P0002' else '42501' end,'missing add-vote room follows the active versioned access contract');
select pg_temp.check(case when to_regprocedure('public.get_s4_capabilities()') is null then public.remove_voting_item('99000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001')=false else pg_temp.sqlstate_of($q$select public.remove_voting_item('99000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001')$q$)='42501' end,'missing remove-vote room follows the active versioned access contract');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.confirm_room_vote('99000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001')$q$)='42501','missing confirm-vote room retains earlier membership denial');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.get_settlement_payment_details((select v from pg_temp.s1_ids where k='bill'))$q$)='P0002','invisible existing bill is indistinguishable from absent bill');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.get_settlement_payment_details('99000000-0000-4000-8000-000000000001')$q$)='P0002','absent bill uses identical not-found error');
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select public.set_optional_consent(gen_random_uuid(),'health','grant',public.get_consent_manifest()->'documents'->'health'->>'version',public.get_consent_manifest()->'documents'->'health'->>'content_hash',0,'settings');
select public.save_my_health_preferences(array['test_allergy'],array[]::text[],0,1);
reset role;
update public.health_code_catalog set enabled=false where category='allergy' and code='test_allergy';
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(public.set_optional_consent(gen_random_uuid(),'health','grant',public.get_consent_manifest()->'documents'->'health'->>'version',public.get_consent_manifest()->'documents'->'health'->>'content_hash',1,'settings')->>'revision'='2','reconsent succeeds with an existing code disabled after its original save');
select pg_temp.check(public.get_my_health_preferences()->'allergies'='["test_allergy"]'::jsonb and public.get_my_health_preferences()->>'consent_revision'='2','consent-only rebind preserves previously accepted values');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.save_my_health_preferences(array['test_allergy'],array[]::text[],1,2)$q$)='22023','a new payload save still rejects disabled catalog codes');
select pg_temp.check(pg_temp.sqlstate_of($q$select private.s1_valid_personal('{}')$q$)='42501','authenticated cannot directly call private personal validator');
select pg_temp.check(pg_temp.sqlstate_of($q$select private.s1_normalize_privacy('{}')$q$)='42501','authenticated cannot directly call private privacy validator');
select pg_temp.check(pg_temp.sqlstate_of($q$update public.profile_private set push_token='synthetic-push' where id=auth.uid()$q$)='00000','unrelated push-token update remains usable without private validator execute');
select pg_temp.check(pg_temp.sqlstate_of($q$update public.profile_private set personal_data='{"gender":"female"}' where id=auth.uid()$q$)='00000','inline CHECK allows valid owner updates without validator execute');
reset role;
delete from public.profile_private where id='10000009-0000-4000-8000-000000000009';
set local role service_role;
select pg_temp.check(pg_temp.sqlstate_of($q$insert into public.profile_private(id) values('10000009-0000-4000-8000-000000000009')$q$)='00000','service_role profile_private INSERT has required validation access');
reset role;
select pg_temp.check(has_function_privilege('service_role','private.s1_valid_personal(jsonb)','EXECUTE') and has_function_privilege('service_role','private.s1_normalize_privacy(jsonb)','EXECUTE'),'service_role validators have explicit execute');
reset role;
select pg_temp.check(pg_temp.sqlstate_of($q$update public.profile_consents set agreed=false,action='withdraw' where profile_id='10000001-0000-4000-8000-000000000001'$q$)='42501','owner UPDATE cannot rewrite consent history');
select pg_temp.check(pg_temp.sqlstate_of($q$delete from public.profile_consents where profile_id='10000001-0000-4000-8000-000000000001'$q$)='42501','owner DELETE cannot erase consent history while profile exists');
select pg_temp.check(pg_temp.sqlstate_of($q$truncate public.profile_consents cascade$q$)='42501','owner TRUNCATE CASCADE cannot erase append-only consent history');
select pg_temp.check(exists(select 1 from public.profile_consents where profile_id='10000001-0000-4000-8000-000000000001') and exists(select 1 from public.profile_consent_states where profile_id='10000001-0000-4000-8000-000000000001'),'rejected TRUNCATE preserves events and dependent state');
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select public.record_required_consents(gen_random_uuid(),'s1-test-bundle',(select jsonb_object_agg(k,v-'canonical_content'-'edition') from jsonb_each(public.get_consent_manifest()->'documents') e(k,v) where k in ('service','privacy')),'{"service":true,"privacy":true}');
select pg_temp.check((select document_id='30000000-0000-4000-8000-000000000001'::uuid from public.profile_consents where profile_id=auth.uid() and kind='service' order by agreed_at desc,id desc limit 1),'required record uses the exact displayed manifest version and hash');
reset role;
-- Test-only concurrent-publication interleaving: change current privacy after manifest validation.
create function pg_temp.swap_privacy_during_consent() returns trigger language plpgsql as $$
declare d public.consent_documents%rowtype; b public.terms_versions%rowtype; replacement uuid;
begin
 if new.kind='service' and new.request_id='78000000-0000-4000-8000-000000000001'::uuid then
  select * into d from public.consent_documents where kind='privacy' and is_current;
  select * into b from public.terms_versions where is_current;
  update public.consent_documents set is_current=false where id=d.id;
  insert into public.consent_documents(kind,version,edition,effective_from,published_at,is_current,canonical_content,content_hash)
  values('privacy','s1-fixture-after-manifest',d.edition,d.effective_from,clock_timestamp(),true,d.canonical_content,d.content_hash) returning id into replacement;
  update public.terms_versions set is_current=false where id=b.id;
  insert into public.terms_versions(version,effective_from,is_current,service_document_id,privacy_document_id,published_at)
  values('s1-fixture-after-manifest-bundle',b.effective_from,true,b.service_document_id,replacement,clock_timestamp());
 end if;
 return new;
end; $$;
create trigger s1_test_swap_privacy before insert on public.profile_consents for each row execute function pg_temp.swap_privacy_during_consent();
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.record_required_consents('78000000-0000-4000-8000-000000000001','s1-test-bundle',(select jsonb_object_agg(k,v-'canonical_content'-'edition') from jsonb_each(public.get_consent_manifest()->'documents') e(k,v) where k in ('service','privacy')),'{"service":true,"privacy":true}')$q$)='S1002','publication between manifest and record cannot substitute an unseen document');
select pg_temp.check(public.get_consent_manifest()->>'bundle_version'='s1-test-bundle' and not exists(select 1 from public.profile_consents where request_id='78000000-0000-4000-8000-000000000001'),'document publication race rolls back both required events and request ledger transaction');
reset role;
drop trigger s1_test_swap_privacy on public.profile_consents;
select pg_temp.check(not exists(select 1 from private.consent_requests where profile_id='10000001-0000-4000-8000-000000000001' and request_id='78000000-0000-4000-8000-000000000001'),'document publication race also rolls back the idempotency ledger');

delete from public.profiles where id='10000001-0000-4000-8000-000000000001';
select pg_temp.check(not exists(select 1 from public.profile_consents where profile_id='10000001-0000-4000-8000-000000000001') and not exists(select 1 from public.profile_consent_states where profile_id='10000001-0000-4000-8000-000000000001'),'history guard still permits profile-root cascade');
select * from finish();
rollback;
