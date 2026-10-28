-- S1 M3: non-sensitive tastes and purpose-bound health storage. No scheduler registration.
begin;
create function private.s1_valid_food(p jsonb) returns boolean language sql immutable set search_path='' as $$
 select case when jsonb_typeof(p)='object' then not exists(select 1 from jsonb_each(p) e where e.key not in ('korean','meat','seafood','western','chinese','japanese') or jsonb_typeof(e.value)<>'boolean') else false end
$$;
create table public.profile_food_preferences (
 profile_id uuid primary key references public.profiles(id) on delete cascade,
 schema_version integer not null default 1 check(schema_version=1),
 preferences jsonb not null default '{}' check(private.s1_valid_food(preferences)),
 revision bigint not null default 0 check(revision>=0), updated_at timestamptz not null default clock_timestamp()
);
create table public.health_code_catalog (
 category text not null check(category in ('allergy','dietary_restriction')),
 code text not null check(code ~ '^[a-z][a-z0-9_]{0,63}$'),label text not null,enabled boolean not null default true,primary key(category,code)
);
create table public.profile_health_preferences (
 profile_id uuid primary key references public.profiles(id) on delete cascade,
 consent_event_id bigint not null references public.profile_consents(id),
 allergies text[] not null default '{}', dietary_restrictions text[] not null default '{}',
 revision bigint not null default 0 check(revision>=0), updated_at timestamptz not null default clock_timestamp(),
 check(cardinality(allergies)<=64 and cardinality(dietary_restrictions)<=64)
);
alter table public.profile_food_preferences enable row level security;
alter table public.profile_health_preferences enable row level security;
alter table public.health_code_catalog enable row level security;
-- Legacy taste-game answers are deleted without migration, including all six boolean keys.
update public.profile_private set tastes='{}';
alter table public.profile_private add constraint s1_no_legacy_tastes check(tastes='{}'::jsonb);
revoke update(tastes) on public.profile_private from public,anon,authenticated,service_role;
create function private.validate_s1_health_write() returns trigger language plpgsql volatile security definer set search_path='' as $$
begin
 if auth.uid() is null or new.profile_id<>auth.uid() or not private.has_active_health_consent(new.consent_event_id) then raise exception 'HEALTH_CONSENT_REQUIRED' using errcode='S1003'; end if;
 if not exists(select 1 from public.profile_consents e where e.id=new.consent_event_id and e.profile_id=new.profile_id and e.kind='health' and e.action='grant') then raise exception 'HEALTH_CONSENT_REQUIRED' using errcode='S1003'; end if;
 -- A consent-only rebind preserves previously accepted values, including codes later disabled.
 -- New/changed payloads still validate every enabled catalog code below.
 if TG_OP='UPDATE' and new.consent_event_id is distinct from old.consent_event_id and new.revision=old.revision and new.allergies is not distinct from old.allergies and new.dietary_restrictions is not distinct from old.dietary_restrictions then return new; end if;
 if cardinality(new.allergies)>64 or cardinality(new.dietary_restrictions)>64
 or array_ndims(new.allergies)>1 or array_ndims(new.dietary_restrictions)>1
 or cardinality(new.allergies)<>(select count(distinct c) from unnest(new.allergies) c)
 or cardinality(new.dietary_restrictions)<>(select count(distinct c) from unnest(new.dietary_restrictions) c)
 or exists(select 1 from unnest(new.allergies) c where not exists(select 1 from public.health_code_catalog h where h.category='allergy' and h.code=c and h.enabled))
 or exists(select 1 from unnest(new.dietary_restrictions) c where not exists(select 1 from public.health_code_catalog h where h.category='dietary_restriction' and h.code=c and h.enabled)) then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 return new;
end; $$;
create trigger s1_health_validate before insert or update on public.profile_health_preferences for each row execute function private.validate_s1_health_write();
revoke all on public.profile_food_preferences,public.profile_health_preferences,public.health_code_catalog from public,anon,authenticated,service_role;
grant select on public.profile_food_preferences,public.profile_health_preferences,public.health_code_catalog to authenticated;
create policy food_select_own on public.profile_food_preferences for select to authenticated using(profile_id=auth.uid());
create policy health_select_active_own on public.profile_health_preferences for select to authenticated using(profile_id=auth.uid() and private.has_active_health_consent(consent_event_id));
create policy health_codes_read on public.health_code_catalog for select to authenticated using(enabled);

create function public.get_my_food_preferences() returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare f public.profile_food_preferences%rowtype; begin
 perform private.require_current_terms_consent();
 select * into f from public.profile_food_preferences where profile_id=auth.uid();
 if not found then
  if not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'PROFILE_NOT_READY' using errcode='23503'; end if;
  -- Upgraded users have no food row until an explicit save. Reads never provision data.
  return jsonb_build_object('schema_version',1,'preferences','{}'::jsonb,'revision','0');
 end if;
 return jsonb_build_object('schema_version',1,'preferences',f.preferences,'revision',f.revision::text);
end; $$;
create function public.save_my_food_preferences(p_preferences jsonb,p_expected_revision bigint) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare f public.profile_food_preferences%rowtype; begin
 perform private.s1_lock_profile(); perform private.require_current_terms_consent();
 if p_preferences is null or not private.s1_valid_food(p_preferences) then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 -- Serialize first writes on the profile lock; seed only a blank row, never legacy answers.
 insert into public.profile_food_preferences(profile_id) values(auth.uid()) on conflict(profile_id) do nothing;
 select * into f from public.profile_food_preferences where profile_id=auth.uid() for update;
 if not found then raise exception 'PROFILE_NOT_READY' using errcode='23503'; end if;
 if p_expected_revision is distinct from f.revision then raise exception 'REVISION_CONFLICT' using errcode='S1004'; end if;
 update public.profile_food_preferences set preferences=p_preferences,revision=revision+1,updated_at=clock_timestamp() where profile_id=auth.uid();
 return public.get_my_food_preferences();
end; $$;
create function public.get_my_health_preferences() returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare s public.profile_consent_states%rowtype; h public.profile_health_preferences%rowtype; begin
 perform private.s1_lock_profile(); perform private.require_current_terms_consent();
 select * into s from public.profile_consent_states where profile_id=auth.uid() and kind='health' for update;
 if not found or not private.has_active_health_consent(s.granted_event_id) then raise exception 'HEALTH_CONSENT_REQUIRED' using errcode='S1003'; end if;
 select * into h from public.profile_health_preferences where profile_id=auth.uid() and consent_event_id=s.granted_event_id;
 return jsonb_build_object('allergies',coalesce(h.allergies,'{}'::text[]),'dietary_restrictions',coalesce(h.dietary_restrictions,'{}'::text[]),'revision',coalesce(h.revision,0)::text,'consent_revision',s.revision::text,'valid_until',s.valid_until);
end; $$;
create function public.save_my_health_preferences(p_allergies text[],p_dietary_restrictions text[],p_expected_revision bigint,p_consent_revision bigint) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare s public.profile_consent_states%rowtype; r bigint; begin
 perform private.s1_lock_profile(); perform private.require_current_terms_consent();
 select * into s from public.profile_consent_states where profile_id=auth.uid() and kind='health' for update;
 if not found or not private.has_active_health_consent(s.granted_event_id) then raise exception 'HEALTH_CONSENT_REQUIRED' using errcode='S1003'; end if;
 select revision into r from public.profile_health_preferences where profile_id=auth.uid();
 if p_consent_revision is distinct from s.revision or p_expected_revision is distinct from coalesce(r,0) then raise exception 'REVISION_CONFLICT' using errcode='S1004'; end if;
 if p_allergies is null or p_dietary_restrictions is null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 insert into public.profile_health_preferences(profile_id,consent_event_id,allergies,dietary_restrictions,revision)
 values(auth.uid(),s.granted_event_id,p_allergies,p_dietary_restrictions,coalesce(r,0)+1)
 on conflict(profile_id) do update set consent_event_id=excluded.consent_event_id,allergies=excluded.allergies,dietary_restrictions=excluded.dietary_restrictions,revision=excluded.revision,updated_at=clock_timestamp();
 return public.get_my_health_preferences();
end; $$;
create function public.run_s1_health_retention(p_limit integer default 1000) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare u uuid; s public.profile_consent_states%rowtype; t timestamptz; e bigint; n integer:=0; x integer:=0; c integer; more boolean; begin
 if p_limit is null or p_limit<1 or p_limit>10000 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 -- No state row is locked before its profile. Re-read after waiting for consent writers.
 for u in select q.profile_id from (
 select profile_id from public.profile_consent_states where kind='health' and status='granted' and valid_until<=clock_timestamp()
 union select h.profile_id from public.profile_health_preferences h where not exists(select 1 from public.profile_consent_states a where a.profile_id=h.profile_id and a.kind='health' and a.status='granted' and a.granted_event_id=h.consent_event_id and a.valid_until>clock_timestamp())
 ) q order by q.profile_id limit p_limit loop
  perform 1 from public.profiles where id=u for update;
  if not found then continue; end if;
  select * into s from public.profile_consent_states where profile_id=u and kind='health' for update;
  t:=clock_timestamp();
  if s.status='granted' and s.valid_until<=t then
   insert into public.profile_consents(profile_id,kind,version,agreed,agreed_at,document_id,action,source)
   select u,'health',d.version,false,t,s.document_id,'expire','maintenance' from public.consent_documents d where d.id=s.document_id returning id into e;
   update public.profile_consent_states set status='expired',latest_event_id=e,revision=revision+1,updated_at=t where profile_id=u and kind='health';
   x:=x+1;
  end if;
  delete from public.profile_health_preferences h where h.profile_id=u and not exists(select 1 from public.profile_consent_states a where a.profile_id=u and a.kind='health' and a.status='granted' and a.granted_event_id=h.consent_event_id and a.valid_until>clock_timestamp());
  get diagnostics c=row_count; n:=n+c;
 end loop;
 select exists(select 1 from public.profile_consent_states where kind='health' and status='granted' and valid_until<=clock_timestamp()) or exists(select 1 from public.profile_health_preferences h where not exists(select 1 from public.profile_consent_states a where a.profile_id=h.profile_id and a.kind='health' and a.status='granted' and a.granted_event_id=h.consent_event_id and a.valid_until>clock_timestamp())) into more;
 return jsonb_build_object('deleted_profiles',n,'expired_states',x,'remaining_due',more,'server_time',clock_timestamp());
end; $$;
revoke all on function private.s1_valid_food(jsonb),private.validate_s1_health_write(),public.get_my_food_preferences(),public.save_my_food_preferences(jsonb,bigint),public.get_my_health_preferences(),public.save_my_health_preferences(text[],text[],bigint,bigint),public.run_s1_health_retention(integer) from public,anon,authenticated,service_role;
grant execute on function private.s1_valid_food(jsonb) to authenticated;
grant execute on function public.get_my_food_preferences(),public.save_my_food_preferences(jsonb,bigint),public.get_my_health_preferences(),public.save_my_health_preferences(text[],text[],bigint,bigint) to authenticated;
grant execute on function public.run_s1_health_retention(integer) to service_role;
commit;
