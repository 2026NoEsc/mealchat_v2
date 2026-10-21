-- S5 F1: additive catalog/storage. No legacy data inference, activation, scheduler or remote action.
begin;
create table public.food_profile_catalog_versions(
 catalog_version text primary key, content_hash text not null check(content_hash ~ '^[0-9a-f]{64}$'),
 is_current boolean not null default false
);
create unique index s5_one_catalog on public.food_profile_catalog_versions(is_current) where is_current;
create table public.food_profile_groups(
 catalog_version text not null references public.food_profile_catalog_versions on delete cascade,
 group_code text not null, is_health boolean not null, selection text not null check(selection in('single','multiple')),
 min_choices integer not null, max_choices integer not null, sentinel text,
 primary key(catalog_version,group_code)
);
create table public.food_profile_option_catalog(
 catalog_version text not null, group_code text not null, code text not null check(code ~ '^[a-z][a-z0-9_]{0,63}$'),
 label text not null, sort_order integer not null, enabled boolean not null, is_control boolean not null,
 primary key(catalog_version,group_code,code),
 foreign key(catalog_version,group_code) references public.food_profile_groups on delete cascade
);
insert into public.food_profile_catalog_versions values('s5-food-2026-10-18-v1','d9e9bed4857b3dc9590b36c13907d3212172baedde3f615cd4f63ee6c48d3122',true);
insert into public.food_profile_groups values
('s5-food-2026-10-18-v1','cuisine',false,'multiple',1,8,'any'),
('s5-food-2026-10-18-v1','preferred_ingredient',false,'multiple',0,12,null),
('s5-food-2026-10-18-v1','food_form',false,'multiple',0,9,null),
('s5-food-2026-10-18-v1','spice',false,'single',0,1,null),
('s5-food-2026-10-18-v1','allergy',true,'multiple',0,15,'none'),
('s5-food-2026-10-18-v1','avoided_food',true,'multiple',0,8,'none'),
('s5-food-2026-10-18-v1','diet_type',true,'single',0,1,'none'),
('s5-food-2026-10-18-v1','additional_avoid',true,'multiple',0,1,null);
insert into public.food_profile_option_catalog values
('s5-food-2026-10-18-v1','cuisine','korean','한식',1,true,false),
('s5-food-2026-10-18-v1','cuisine','japanese','일식',2,true,false),
('s5-food-2026-10-18-v1','cuisine','chinese','중식',3,true,false),
('s5-food-2026-10-18-v1','cuisine','western','양식',4,true,false),
('s5-food-2026-10-18-v1','cuisine','southeast_asian','동남아',5,true,false),
('s5-food-2026-10-18-v1','cuisine','other_world','기타 세계음식',6,true,false),
('s5-food-2026-10-18-v1','cuisine','snack_food','분식',7,true,false),
('s5-food-2026-10-18-v1','cuisine','any','상관없음',8,true,true),
('s5-food-2026-10-18-v1','preferred_ingredient','beef','소고기',9,true,false),
('s5-food-2026-10-18-v1','preferred_ingredient','pork','돼지고기',10,true,false),
('s5-food-2026-10-18-v1','preferred_ingredient','chicken','닭고기',11,true,false),
('s5-food-2026-10-18-v1','preferred_ingredient','lamb','양고기',12,true,false),
('s5-food-2026-10-18-v1','preferred_ingredient','fish','생선',13,true,false),
('s5-food-2026-10-18-v1','preferred_ingredient','crustaceans','새우·게 등 갑각류',14,true,false),
('s5-food-2026-10-18-v1','preferred_ingredient','shellfish','조개류',15,true,false),
('s5-food-2026-10-18-v1','preferred_ingredient','squid_octopus','오징어·문어',16,true,false),
('s5-food-2026-10-18-v1','preferred_ingredient','egg','계란',17,true,false),
('s5-food-2026-10-18-v1','preferred_ingredient','tofu_soy','두부·콩',18,true,false),
('s5-food-2026-10-18-v1','preferred_ingredient','vegetables','채소',19,true,false),
('s5-food-2026-10-18-v1','preferred_ingredient','cheese_dairy','치즈·유제품',20,true,false),
('s5-food-2026-10-18-v1','food_form','rice','밥',21,true,false),
('s5-food-2026-10-18-v1','food_form','noodles','면',22,true,false),
('s5-food-2026-10-18-v1','food_form','soup','국물·탕',23,true,false),
('s5-food-2026-10-18-v1','food_form','stew_hotpot','찌개·전골',24,true,false),
('s5-food-2026-10-18-v1','food_form','grilled','구이',25,true,false),
('s5-food-2026-10-18-v1','food_form','fried','튀김',26,true,false),
('s5-food-2026-10-18-v1','food_form','stir_fried','볶음',27,true,false),
('s5-food-2026-10-18-v1','food_form','steamed','찜',28,true,false),
('s5-food-2026-10-18-v1','food_form','salad_light_meal','샐러드·가벼운 식사',29,true,false),
('s5-food-2026-10-18-v1','spice','not_spicy','전혀 못 먹음',30,true,false),
('s5-food-2026-10-18-v1','spice','mild','조금 매운 정도',31,true,false),
('s5-food-2026-10-18-v1','spice','medium','보통',32,true,false),
('s5-food-2026-10-18-v1','spice','hot','매운 음식 좋아함',33,true,false),
('s5-food-2026-10-18-v1','spice','very_hot','아주 매운 음식도 좋아함',34,true,false),
('s5-food-2026-10-18-v1','allergy','egg','계란',35,true,false),
('s5-food-2026-10-18-v1','allergy','milk_dairy','우유·유제품',36,true,false),
('s5-food-2026-10-18-v1','allergy','peanut','땅콩',37,true,false),
('s5-food-2026-10-18-v1','allergy','tree_nuts','견과류',38,true,false),
('s5-food-2026-10-18-v1','allergy','wheat','밀',39,true,false),
('s5-food-2026-10-18-v1','allergy','buckwheat','메밀',40,true,false),
('s5-food-2026-10-18-v1','allergy','soy','대두·콩',41,true,false),
('s5-food-2026-10-18-v1','allergy','fish','생선',42,true,false),
('s5-food-2026-10-18-v1','allergy','shrimp','새우',43,true,false),
('s5-food-2026-10-18-v1','allergy','crab','게',44,true,false),
('s5-food-2026-10-18-v1','allergy','shellfish','조개류',45,true,false),
('s5-food-2026-10-18-v1','allergy','squid','오징어',46,true,false),
('s5-food-2026-10-18-v1','allergy','beef','소고기',47,true,false),
('s5-food-2026-10-18-v1','allergy','pork','돼지고기',48,true,false),
('s5-food-2026-10-18-v1','allergy','chicken','닭고기',49,true,false),
('s5-food-2026-10-18-v1','allergy','other_input','기타 직접 입력',50,false,false),
('s5-food-2026-10-18-v1','allergy','none','알레르기 없음',51,true,true),
('s5-food-2026-10-18-v1','avoided_food','raw_fish','회·날생선',52,true,false),
('s5-food-2026-10-18-v1','avoided_food','offal','내장',53,true,false),
('s5-food-2026-10-18-v1','avoided_food','intestines','곱창·막창',54,true,false),
('s5-food-2026-10-18-v1','avoided_food','cilantro','고수',55,true,false),
('s5-food-2026-10-18-v1','avoided_food','beef','소고기',56,true,false),
('s5-food-2026-10-18-v1','avoided_food','seafood','해산물',57,true,false),
('s5-food-2026-10-18-v1','avoided_food','dairy','유제품',58,true,false),
('s5-food-2026-10-18-v1','avoided_food','all_meat','육류 전체',59,true,false),
('s5-food-2026-10-18-v1','avoided_food','other_input','기타 직접 입력',60,false,false),
('s5-food-2026-10-18-v1','avoided_food','none','없음',61,true,true),
('s5-food-2026-10-18-v1','diet_type','none','식단 제한 없음',62,true,true),
('s5-food-2026-10-18-v1','diet_type','vegetarian','채식 (고기 · 생선을 먹지 않음)',63,true,false),
('s5-food-2026-10-18-v1','diet_type','vegan','비건 (동물성 음식을 먹지 않음)',64,true,false),
('s5-food-2026-10-18-v1','diet_type','pescatarian','페스코 (생선 · 해산물은 먹음)',65,true,false),
('s5-food-2026-10-18-v1','additional_avoid','exclude_pork','돼지고기 제외',66,true,false),
('s5-food-2026-10-18-v1','additional_avoid','other_input','기타 직접 입력',67,false,false);
alter table public.profile_food_preferences
 drop constraint profile_food_preferences_schema_version_check,
 drop constraint profile_food_preferences_preferences_check,
 add column catalog_version text references public.food_profile_catalog_versions,
 add column completed_at timestamptz,
 add column onboarding_seen_at timestamptz,
 add column onboarding_snoozed_until timestamptz,
 add constraint s5_food_schema check(schema_version in(1,2));
create function private.s5_food_shape(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$
begin
 if p is null or jsonb_typeof(p)<>'object' then return false; end if;
 if p='{}' then return true; end if;
 if (select count(*) from jsonb_object_keys(p))<>4 or not p ?& array['cuisines','ingredients','forms','spice'] then return false; end if;
 if jsonb_typeof(p->'cuisines')<>'array' or jsonb_typeof(p->'ingredients')<>'array' or jsonb_typeof(p->'forms')<>'array' then return false; end if;
 if jsonb_typeof(p->'spice') not in('string','null') then return false; end if;
 return not exists(select 1 from jsonb_array_elements((p->'cuisines')||(p->'ingredients')||(p->'forms')) e where jsonb_typeof(e)<>'string');
end; $$;
alter table public.profile_food_preferences add constraint s5_food_shape
 check((schema_version=1 and private.s1_valid_food(preferences)) or (schema_version=2 and private.s5_food_shape(preferences)));
alter table public.profile_health_preferences
 add column schema_version integer not null default 1 check(schema_version in(1,2)),
 add column catalog_version text references public.food_profile_catalog_versions,
 add column avoided_food_codes text[] not null default '{}',
 add column diet_type_code text,
 add column completed_at timestamptz;
alter table public.health_code_catalog drop constraint health_code_catalog_category_check;
alter table public.health_code_catalog add constraint s5_health_categories
 check(category in('allergy','dietary_restriction','avoided_food','diet_type','additional_avoid'));
insert into public.health_code_catalog(category,code,label,enabled)
select o.group_code,o.code,o.label,o.enabled and not o.is_control
from public.food_profile_option_catalog o join public.food_profile_groups g using(catalog_version,group_code)
where g.is_health
on conflict(category,code) do nothing;

create function private.s5_catalog() returns text language plpgsql stable security definer set search_path='' as $$
declare v text; begin
 select catalog_version into v from public.food_profile_catalog_versions where is_current;
 if not found then raise exception 'CATALOG_CHANGED' using errcode='S5001'; end if; return v;
end; $$;
create function private.s5_codes(v text,g text,a text[]) returns boolean language plpgsql stable security definer set search_path='' as $$
declare lim integer; begin
 if a is null or coalesce(array_ndims(a),1)>1 or cardinality(a)>64 or cardinality(a)<>(select count(distinct x) from unnest(a) x) then return false; end if;
 select max_choices into lim from public.food_profile_groups where catalog_version=v and group_code=g;
 if not found or cardinality(a)>lim then return false; end if;
 return not exists(select 1 from unnest(a) x where x is null or not exists(
 select 1 from public.food_profile_option_catalog o where o.catalog_version=v and o.group_code=g and o.code=x and o.enabled and not o.is_control));
end; $$;
create function private.s5_food_valid(v text,p jsonb) returns boolean language plpgsql stable security definer set search_path='' as $$
declare c text[]; i text[]; f text[]; s text; begin
 if not private.s5_food_shape(p) then return false; end if;
 if p='{}' then return true; end if;
 c:=array(select jsonb_array_elements_text(p->'cuisines'));
 i:=array(select jsonb_array_elements_text(p->'ingredients'));
 f:=array(select jsonb_array_elements_text(p->'forms')); s:=p->>'spice';
 if cardinality(c)<1 or cardinality(c)>8 or cardinality(i)>12 or cardinality(f)>9 then return false; end if;
 if c<>array['any'] and (not private.s5_codes(v,'cuisine',c) or 'any'=any(c)) then return false; end if;
 return private.s5_codes(v,'preferred_ingredient',i) and private.s5_codes(v,'food_form',f)
 and (s is null or private.s5_codes(v,'spice',array[s]));
end; $$;
create function private.s5_food_write() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and old.schema_version=2 and new.schema_version<>2 then raise exception 'CLIENT_UPDATE_REQUIRED' using errcode='S1008'; end if;
 if new.schema_version=2 then
  if TG_OP='UPDATE' and new.schema_version=old.schema_version and new.preferences=old.preferences and new.catalog_version=old.catalog_version then return new; end if;
  if new.catalog_version is distinct from private.s5_catalog() or not private.s5_food_valid(new.catalog_version,new.preferences) then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 end if; return new;
end; $$;
create trigger s5_food_write before insert or update on public.profile_food_preferences for each row execute function private.s5_food_write();
create or replace function private.validate_s1_health_write() returns trigger language plpgsql volatile security definer set search_path='' as $$
begin
 if auth.uid() is null or new.profile_id<>auth.uid() or not private.has_active_health_consent(new.consent_event_id) then raise exception 'HEALTH_CONSENT_REQUIRED' using errcode='S1003'; end if;
 if not exists(select 1 from public.profile_consents e where e.id=new.consent_event_id and e.profile_id=new.profile_id and e.kind='health' and e.action='grant') then raise exception 'HEALTH_CONSENT_REQUIRED' using errcode='S1003'; end if;

 if TG_OP='UPDATE' and new.consent_event_id is distinct from old.consent_event_id and new.revision=old.revision
 and (new.schema_version,new.catalog_version,new.allergies,new.dietary_restrictions,new.avoided_food_codes,new.diet_type_code,new.completed_at)
 is not distinct from (old.schema_version,old.catalog_version,old.allergies,old.dietary_restrictions,old.avoided_food_codes,old.diet_type_code,old.completed_at) then return new; end if;
 if TG_OP='UPDATE' and old.schema_version=2 and new.schema_version<>2 then raise exception 'CLIENT_UPDATE_REQUIRED' using errcode='S1008'; end if;
 if new.schema_version=2 then
  if new.catalog_version is distinct from private.s5_catalog()
  or not private.s5_codes(new.catalog_version,'allergy',new.allergies)
  or not private.s5_codes(new.catalog_version,'avoided_food',new.avoided_food_codes)
  or not private.s5_codes(new.catalog_version,'additional_avoid',new.dietary_restrictions)
  or (new.diet_type_code is not null and not private.s5_codes(new.catalog_version,'diet_type',array[new.diet_type_code]))
  then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 else
 if cardinality(new.allergies)>64 or cardinality(new.dietary_restrictions)>64
 or array_ndims(new.allergies)>1 or array_ndims(new.dietary_restrictions)>1
 or cardinality(new.allergies)<>(select count(distinct c) from unnest(new.allergies) c)
 or cardinality(new.dietary_restrictions)<>(select count(distinct c) from unnest(new.dietary_restrictions) c)
 or exists(select 1 from unnest(new.allergies) c where not exists(select 1 from public.health_code_catalog h where h.category='allergy' and h.code=c and h.enabled))
 or exists(select 1 from unnest(new.dietary_restrictions) c where not exists(select 1 from public.health_code_catalog h where h.category='dietary_restriction' and h.code=c and h.enabled)) then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 end if;
 return new;
end; $$;
create or replace function public.get_my_food_preferences() returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare f public.profile_food_preferences%rowtype; begin
 perform private.require_current_terms_consent();
 select * into f from public.profile_food_preferences where profile_id=auth.uid();
 if found and f.schema_version=2 then raise exception 'CLIENT_UPDATE_REQUIRED' using errcode='S1008'; end if;
 if not found then
  if not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'PROFILE_NOT_READY' using errcode='23503'; end if;
  -- Upgraded users have no food row until an explicit save. Reads never provision data.
  return jsonb_build_object('schema_version',1,'preferences','{}'::jsonb,'revision','0');
 end if;
 return jsonb_build_object('schema_version',1,'preferences',f.preferences,'revision',f.revision::text);
end; $$;
create or replace function public.save_my_food_preferences(p_preferences jsonb,p_expected_revision bigint) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare f public.profile_food_preferences%rowtype; begin
 perform private.s1_lock_profile(); perform private.require_current_terms_consent();
 if p_preferences is null or not private.s1_valid_food(p_preferences) then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 -- Serialize first writes on the profile lock; seed only a blank row, never legacy answers.
 insert into public.profile_food_preferences(profile_id) values(auth.uid()) on conflict(profile_id) do nothing;
 select * into f from public.profile_food_preferences where profile_id=auth.uid() for update;
 if found and f.schema_version=2 then raise exception 'CLIENT_UPDATE_REQUIRED' using errcode='S1008'; end if;
 if not found then raise exception 'PROFILE_NOT_READY' using errcode='23503'; end if;
 if p_expected_revision is distinct from f.revision then raise exception 'REVISION_CONFLICT' using errcode='S1004'; end if;
 update public.profile_food_preferences set preferences=p_preferences,revision=revision+1,updated_at=clock_timestamp() where profile_id=auth.uid();
 return public.get_my_food_preferences();
end; $$;
create or replace function public.get_my_health_preferences() returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare s public.profile_consent_states%rowtype; h public.profile_health_preferences%rowtype; begin
 perform private.s1_lock_profile(); perform private.require_current_terms_consent();
 select * into s from public.profile_consent_states where profile_id=auth.uid() and kind='health' for update;
 if not found or not private.has_active_health_consent(s.granted_event_id) then raise exception 'HEALTH_CONSENT_REQUIRED' using errcode='S1003'; end if;
 select * into h from public.profile_health_preferences where profile_id=auth.uid() and consent_event_id=s.granted_event_id;
 if found and h.schema_version=2 then raise exception 'CLIENT_UPDATE_REQUIRED' using errcode='S1008'; end if;
 return jsonb_build_object('allergies',coalesce(h.allergies,'{}'::text[]),'dietary_restrictions',coalesce(h.dietary_restrictions,'{}'::text[]),'revision',coalesce(h.revision,0)::text,'consent_revision',s.revision::text,'valid_until',s.valid_until);
end; $$;
create or replace function public.save_my_health_preferences(p_allergies text[],p_dietary_restrictions text[],p_expected_revision bigint,p_consent_revision bigint) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare s public.profile_consent_states%rowtype; r bigint; begin
 perform private.s1_lock_profile(); perform private.require_current_terms_consent();
 select * into s from public.profile_consent_states where profile_id=auth.uid() and kind='health' for update;
 if not found or not private.has_active_health_consent(s.granted_event_id) then raise exception 'HEALTH_CONSENT_REQUIRED' using errcode='S1003'; end if;
 if exists(select 1 from public.profile_health_preferences where profile_id=auth.uid() and schema_version=2) then raise exception 'CLIENT_UPDATE_REQUIRED' using errcode='S1008'; end if;
 select revision into r from public.profile_health_preferences where profile_id=auth.uid();
 if p_consent_revision is distinct from s.revision or p_expected_revision is distinct from coalesce(r,0) then raise exception 'REVISION_CONFLICT' using errcode='S1004'; end if;
 if p_allergies is null or p_dietary_restrictions is null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 insert into public.profile_health_preferences(profile_id,consent_event_id,allergies,dietary_restrictions,revision)
 values(auth.uid(),s.granted_event_id,p_allergies,p_dietary_restrictions,coalesce(r,0)+1)
 on conflict(profile_id) do update set consent_event_id=excluded.consent_event_id,allergies=excluded.allergies,dietary_restrictions=excluded.dietary_restrictions,revision=excluded.revision,updated_at=clock_timestamp();
 return public.get_my_health_preferences();
end; $$;
do $$ declare n text; begin
 foreach n in array array['food_profile_catalog_versions','food_profile_groups','food_profile_option_catalog'] loop
 execute format('alter table public.%I enable row level security',n);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',n);
 execute format('grant select on public.%I to authenticated',n);
 execute format('create policy s5_catalog_read on public.%I for select to authenticated using(true)',n);
 execute format('create policy s5_catalog_terms on public.%I as restrictive for all to authenticated using((select private.has_current_terms_consent())) with check((select private.has_current_terms_consent()))',n);
 end loop;
end; $$;
revoke all on function private.s5_food_shape(jsonb),private.s5_catalog(),private.s5_codes(text,text,text[]),private.s5_food_valid(text,jsonb),private.s5_food_write() from public,anon,authenticated,service_role;
commit;
