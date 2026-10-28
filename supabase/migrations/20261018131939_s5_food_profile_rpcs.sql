-- S5 F2: owner-only v2 storage. Consent events, revocation and retention stay in S1.
begin;
create function public.get_food_profile_catalog_v2() returns jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare v text; f jsonb; h jsonb; begin
 perform private.require_current_terms_consent(); v:=private.s5_catalog();
 select coalesce(jsonb_agg(x.obj order by array_position(array['cuisine','preferred_ingredient','food_form','spice','allergy','avoided_food','diet_type','additional_avoid'],x.group_code)),'[]') into f from (
 select g.group_code,jsonb_build_object('group_code',g.group_code,'selection',g.selection,'min',g.min_choices,'max',g.max_choices,'sentinel',g.sentinel,
 'options',(select jsonb_agg(jsonb_build_object('code',o.code,'label',o.label,'enabled',o.enabled) order by o.sort_order)
 from public.food_profile_option_catalog o where o.catalog_version=v and o.group_code=g.group_code)) obj
 from public.food_profile_groups g where g.catalog_version=v and not g.is_health) x;
 select coalesce(jsonb_agg(x.obj order by array_position(array['cuisine','preferred_ingredient','food_form','spice','allergy','avoided_food','diet_type','additional_avoid'],x.group_code)),'[]') into h from (
 select g.group_code,jsonb_build_object('group_code',g.group_code,'selection',g.selection,'min',g.min_choices,'max',g.max_choices,'sentinel',g.sentinel,
 'options',(select jsonb_agg(jsonb_build_object('code',o.code,'label',o.label,'enabled',o.enabled) order by o.sort_order)
 from public.food_profile_option_catalog o where o.catalog_version=v and o.group_code=g.group_code)) obj
 from public.food_profile_groups g where g.catalog_version=v and g.is_health) x;
 return jsonb_build_object('contract_version',2,'catalog_version',v,'food_groups',f,'health_groups',h,
 'capabilities',jsonb_build_object('food_v2',true,'health_storage_v2',true,'health_filter',false,'automatic_midpoint',false,'recommendation_purposes',jsonb_build_array('places')));
end; $$;
create function public.get_my_food_preferences_v2() returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare f public.profile_food_preferences%rowtype; v text; begin
 perform private.require_current_terms_consent();
 if not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'PROFILE_NOT_READY' using errcode='23503'; end if;
 v:=private.s5_catalog(); select * into f from public.profile_food_preferences where profile_id=auth.uid();
 return jsonb_build_object('contract_version',2,'schema_version',2,'catalog_version',coalesce(f.catalog_version,v),
 'requires_update',case when f.schema_version=2 then f.catalog_version is distinct from v or not private.s5_food_valid(v,f.preferences) else false end,
 'preferences',case when f.schema_version=2 then f.preferences else '{}' end,'revision',coalesce(f.revision,0)::text,
 'completed_at',case when f.schema_version=2 then f.completed_at end,
 'onboarding',jsonb_build_object('seen_at',f.onboarding_seen_at,'snoozed_until',f.onboarding_snoozed_until));
end; $$;
create function public.save_my_food_preferences_v2(p_catalog_version text,p_preferences jsonb,p_expected_revision bigint)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare f public.profile_food_preferences%rowtype; t timestamptz; begin
 perform private.s1_lock_profile(); perform private.require_current_terms_consent();
 if p_expected_revision is null or p_expected_revision<0 or p_preferences is null or octet_length(p_preferences::text)>8192 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 if p_catalog_version is distinct from private.s5_catalog() then raise exception 'CATALOG_CHANGED' using errcode='S5001'; end if;
 if not private.s5_food_valid(p_catalog_version,p_preferences) then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 select * into f from public.profile_food_preferences where profile_id=auth.uid() for update;
 if p_expected_revision is distinct from coalesce(f.revision,0) then raise exception 'REVISION_CONFLICT' using errcode='S1004'; end if;
 t:=clock_timestamp();
 insert into public.profile_food_preferences(profile_id,schema_version,catalog_version,preferences,revision,completed_at)
 values(auth.uid(),2,p_catalog_version,p_preferences,coalesce(f.revision,0)+1,case when p_preferences<>'{}' then t end)
 on conflict(profile_id) do update set schema_version=2,catalog_version=excluded.catalog_version,preferences=excluded.preferences,
 revision=excluded.revision,completed_at=case when excluded.preferences='{}' then null else coalesce(case when f.schema_version=2 then f.completed_at end,t) end,updated_at=t;
 return public.get_my_food_preferences_v2();
end; $$;
create function public.mark_food_profile_prompt_v2(p_action text,p_expected_revision bigint)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare r bigint; t timestamptz; begin
 perform private.s1_lock_profile(); perform private.require_current_terms_consent();
 if p_action is null or p_action not in('shown','later') or p_expected_revision is null or p_expected_revision<0 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 select revision into r from public.profile_food_preferences where profile_id=auth.uid() for update;
 if p_expected_revision is distinct from coalesce(r,0) then raise exception 'REVISION_CONFLICT' using errcode='S1004'; end if;
 t:=clock_timestamp();
 insert into public.profile_food_preferences(profile_id,revision,onboarding_seen_at,onboarding_snoozed_until)
 values(auth.uid(),coalesce(r,0)+1,t,case when p_action='later' then t+interval '7 days' end)
 on conflict(profile_id) do update set revision=excluded.revision,onboarding_seen_at=coalesce(public.profile_food_preferences.onboarding_seen_at,t),
 onboarding_snoozed_until=case when p_action='later' then t+interval '7 days' else public.profile_food_preferences.onboarding_snoozed_until end,updated_at=t;
 return public.get_my_food_preferences_v2();
end; $$;
create function private.s5_health_state() returns public.profile_consent_states language plpgsql volatile security definer set search_path='' as $$
declare s public.profile_consent_states%rowtype; begin
 perform private.s1_lock_profile(); perform private.require_current_terms_consent();
 select * into s from public.profile_consent_states where profile_id=auth.uid() and kind='health' for update;
 if not found or not private.has_active_health_consent(s.granted_event_id) then raise exception 'HEALTH_CONSENT_REQUIRED' using errcode='S1003'; end if;
 return s;
end; $$;
create function public.get_my_health_preferences_v2() returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare s public.profile_consent_states%rowtype; h public.profile_health_preferences%rowtype; v text; begin
 s:=private.s5_health_state(); v:=private.s5_catalog();
 select * into h from public.profile_health_preferences where profile_id=auth.uid() and consent_event_id=s.granted_event_id;
 if h.schema_version=1 and (cardinality(h.allergies)>0 or cardinality(h.dietary_restrictions)>0) then raise exception 'CLIENT_UPDATE_REQUIRED' using errcode='S1008'; end if;
 return jsonb_build_object('contract_version',2,'schema_version',2,'catalog_version',coalesce(h.catalog_version,v),
 'requires_update',case when h.schema_version=2 then h.catalog_version is distinct from v
 or not private.s5_codes(v,'allergy',h.allergies) or not private.s5_codes(v,'avoided_food',h.avoided_food_codes)
 or not private.s5_codes(v,'additional_avoid',h.dietary_restrictions)
 or (h.diet_type_code is not null and not private.s5_codes(v,'diet_type',array[h.diet_type_code])) else false end,
 'status',case when h.schema_version=2 and h.completed_at is not null then 'complete' else 'not_started' end,
 'allergy_codes',case when h.schema_version=2 then h.allergies else '{}'::text[] end,
 'avoided_food_codes',coalesce(h.avoided_food_codes,'{}'::text[]),'diet_type_code',h.diet_type_code,
 'additional_avoid_codes',case when h.schema_version=2 then h.dietary_restrictions else '{}'::text[] end,
 'revision',coalesce(h.revision,0)::text,'consent_revision',s.revision::text,'valid_until',s.valid_until,'completed_at',h.completed_at);
end; $$;
create function public.save_my_health_preferences_v2(p_catalog_version text,p_allergy_codes text[],p_avoided_food_codes text[],p_diet_type_code text,p_additional_avoid_codes text[],p_expected_revision bigint,p_consent_revision bigint)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare s public.profile_consent_states%rowtype; h public.profile_health_preferences%rowtype; t timestamptz; begin
 s:=private.s5_health_state();
 if p_expected_revision is null or p_expected_revision<0 or p_consent_revision is null or p_consent_revision<0
 or octet_length(jsonb_build_array(p_allergy_codes,p_avoided_food_codes,p_diet_type_code,p_additional_avoid_codes)::text)>8192 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 if p_catalog_version is distinct from private.s5_catalog() then raise exception 'CATALOG_CHANGED' using errcode='S5001'; end if;
 if not private.s5_codes(p_catalog_version,'allergy',p_allergy_codes) or not private.s5_codes(p_catalog_version,'avoided_food',p_avoided_food_codes)
 or not private.s5_codes(p_catalog_version,'additional_avoid',p_additional_avoid_codes)
 or (p_diet_type_code is not null and not private.s5_codes(p_catalog_version,'diet_type',array[p_diet_type_code])) then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 select * into h from public.profile_health_preferences where profile_id=auth.uid() for update;
 if h.schema_version=1 and (cardinality(h.allergies)>0 or cardinality(h.dietary_restrictions)>0) then raise exception 'CLIENT_UPDATE_REQUIRED' using errcode='S1008'; end if;
 if p_expected_revision is distinct from coalesce(h.revision,0) or p_consent_revision is distinct from s.revision then raise exception 'REVISION_CONFLICT' using errcode='S1004'; end if;
 t:=clock_timestamp();
 -- The grant might expire while a preceding statement waited.
 if not private.has_active_health_consent(s.granted_event_id) then raise exception 'HEALTH_CONSENT_REQUIRED' using errcode='S1003'; end if;
 insert into public.profile_health_preferences(profile_id,schema_version,catalog_version,consent_event_id,allergies,avoided_food_codes,diet_type_code,dietary_restrictions,revision,completed_at)
 values(auth.uid(),2,p_catalog_version,s.granted_event_id,p_allergy_codes,p_avoided_food_codes,p_diet_type_code,p_additional_avoid_codes,coalesce(h.revision,0)+1,t)
 on conflict(profile_id) do update set schema_version=2,catalog_version=excluded.catalog_version,consent_event_id=excluded.consent_event_id,
 allergies=excluded.allergies,avoided_food_codes=excluded.avoided_food_codes,diet_type_code=excluded.diet_type_code,
 dietary_restrictions=excluded.dietary_restrictions,revision=excluded.revision,completed_at=coalesce(h.completed_at,t),updated_at=t;
 return public.get_my_health_preferences_v2();
end; $$;
revoke all on function private.s5_health_state(),public.get_food_profile_catalog_v2(),public.get_my_food_preferences_v2(),public.save_my_food_preferences_v2(text,jsonb,bigint),
public.mark_food_profile_prompt_v2(text,bigint),public.get_my_health_preferences_v2(),public.save_my_health_preferences_v2(text,text[],text[],text,text[],bigint,bigint)
from public,anon,authenticated,service_role;
grant execute on function public.get_food_profile_catalog_v2(),public.get_my_food_preferences_v2(),public.save_my_food_preferences_v2(text,jsonb,bigint),
public.mark_food_profile_prompt_v2(text,bigint),public.get_my_health_preferences_v2(),public.save_my_health_preferences_v2(text,text[],text[],text,text[],bigint,bigint) to authenticated;
commit;
