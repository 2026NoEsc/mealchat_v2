
select pg_temp.check((select schema_version=1 and revision=1 and preferences->>'korean'='true' from public.profile_food_preferences where profile_id='10000001-0000-4000-8000-000000000001'),'upgrade preserves v1 food without copying into v2');
select pg_temp.check((select schema_version=1 and allergies=array['test_allergy'] and dietary_restrictions=array['test_diet'] from public.profile_health_preferences where profile_id='10000001-0000-4000-8000-000000000001'),'upgrade preserves v1 health without lossy mapping');
set local role authenticated;
select pg_temp.as_user('10000001-0000-4000-8000-000000000001');
select pg_temp.check(public.get_my_food_preferences_v2()->'preferences'='{}' and public.get_my_food_preferences_v2()->>'revision'='1' and public.get_my_food_preferences_v2()->>'completed_at' is null,'v2 treats legacy food as incomplete and retains CAS revision');
select pg_temp.check(public.get_my_food_preferences()->'preferences'->>'korean'='true','v1 client remains compatible until explicit v2 write');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.get_my_health_preferences_v2()$q$)='S1008','nonempty v1 health requires explicit update');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.save_my_health_preferences_v2('s5-food-2026-10-18-v1',array['egg'],array[]::text[],null,array[]::text[],1,1)$q$)='S1008','v2 cannot silently discard v1 health');
select pg_temp.check(public.save_my_food_preferences_v2('s5-food-2026-10-18-v1','{"cuisines":["korean"],"ingredients":[],"forms":[],"spice":null}',1)->>'revision'='2','explicit v2 input alone upgrades food');
select pg_temp.check(pg_temp.sqlstate_of($q$select public.get_my_food_preferences()$q$)='S1008','v1 read refuses upgraded food');
select public.set_optional_consent(gen_random_uuid(),'health','withdraw',null,null,null,'settings');
select public.set_optional_consent(gen_random_uuid(),'health','grant',(public.get_consent_manifest()->'documents'->'health'->>'version'),(public.get_consent_manifest()->'documents'->'health'->>'content_hash'),2,'settings');
select pg_temp.check(public.save_my_health_preferences_v2('s5-food-2026-10-18-v1',array['egg','milk_dairy'],array[]::text[],'vegan',array[]::text[],0,3)->'allergy_codes'='["egg","milk_dairy"]','explicit withdrawal and new input permits multiple allergies');
select pg_temp.as_user('10000002-0000-4000-8000-000000000002');
select pg_temp.check(public.save_my_food_preferences('{"korean":true}',0)->>'revision'='1','untouched v1 signup/save path remains compatible');
reset role;
select pg_temp.check((select count(*)=67 from public.food_profile_option_catalog),'additive catalog complete');
select pg_temp.check((select count(*)=37 and bool_and(enabled) from public.public_meeting_areas),'upgrade publishes exactly the 37 approved production areas');
