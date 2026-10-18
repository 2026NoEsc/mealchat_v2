-- S1 M1: control schema only; publication/activation belongs to M7.
begin;
-- Read-only preflight MUST precede every S1 DDL/ACL/data change.
-- Unknown business keys need a separately reviewed mapping, never silent erasure.
do $$ begin
 if exists(select 1 from public.profile_private p where jsonb_typeof(p.personal_data) is distinct from 'object' or exists(select 1 from jsonb_object_keys(case when jsonb_typeof(p.personal_data)='object' then p.personal_data else '{}'::jsonb end) k where k not in ('gender','bio','allergies','allergy','dietary_restrictions','dietaryRestrictions','health','health_preferences'))) then
 raise exception 'S1_UPGRADE_PERSONAL_DATA_MAPPING_REQUIRED' using errcode='22023'; end if;
 if exists(select 1 from public.profile_private where (personal_data ? 'gender' and (jsonb_typeof(personal_data->'gender')<>'string' or personal_data->>'gender' not in ('male','female','none'))) or (personal_data ? 'bio' and (jsonb_typeof(personal_data->'bio')<>'string' or char_length(personal_data->>'bio')>120))) then
 raise exception 'S1_UPGRADE_PERSONAL_DATA_MAPPING_REQUIRED' using errcode='22023'; end if;
 if exists(select 1 from public.profile_private where birth_date is not null and (birth_date<date '1900-01-01' or birth_date>current_date)) then raise exception 'S1_UPGRADE_BIRTH_DATE_MAPPING_REQUIRED' using errcode='22023'; end if;
end; $$;

-- Deployment impact: global defaults change for future objects, including service_role.
-- Inspect production pg_default_acl BEFORE any separately approved rollout.
-- All future functions/tables/sequences need explicit role-specific GRANTs.
alter default privileges for role postgres revoke execute on functions from public,anon,authenticated,service_role;
alter default privileges for role postgres in schema public revoke all on tables from public,anon,authenticated,service_role;
alter default privileges for role postgres in schema public revoke all on sequences from public,anon,authenticated,service_role;
alter default privileges for role postgres in schema public revoke execute on functions from public,anon,authenticated,service_role;
alter default privileges for role postgres in schema private revoke all on tables from public,anon,authenticated,service_role;
alter default privileges for role postgres in schema private revoke execute on functions from public,anon,authenticated,service_role;
create table public.consent_documents (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('service','privacy','health','marketing')),
 version text not null, edition integer not null check(edition>0),
 effective_from timestamptz not null, published_at timestamptz,
 is_current boolean not null default false,
 canonical_content text not null, content_hash text not null check(content_hash ~ '^[0-9a-f]{64}$'),
 change_summary text not null default '', unique(kind,version), unique(id,kind),
 check(not is_current or published_at is not null)
);
create unique index consent_documents_current on public.consent_documents(kind) where is_current;
alter table public.consent_documents enable row level security;
alter table public.terms_versions
 add column service_document_id uuid references public.consent_documents(id) on delete restrict,
 add column privacy_document_id uuid references public.consent_documents(id) on delete restrict,
 add column published_at timestamptz, add column change_summary text not null default '';
alter table public.profile_consents drop constraint profile_consents_known_kind;
alter table public.profile_consents
 add constraint profile_consents_known_kind check(kind in ('service','privacy','health','marketing')),
 add column document_id uuid references public.consent_documents(id),
 add column action text, add column source text not null default 'legacy', add column request_id uuid;
update public.profile_consents set action=case when agreed then 'grant' else 'decline' end;
alter table public.profile_consents alter column action set not null;
alter table public.profile_consents add constraint s1_event_action check(action in ('grant','decline','withdraw','expire')),
 add constraint s1_event_source check(source in ('legacy','signup','reconsent','settings','food_step2','maintenance')),
 add constraint s1_event_agreed check(agreed=(action='grant')),
 add constraint s1_event_identity unique(id,profile_id,kind);
create unique index s1_event_request on public.profile_consents(profile_id,kind,request_id) where request_id is not null;
drop index public.profile_consents_profile_kind_idx;
create index profile_consents_profile_kind_idx on public.profile_consents(profile_id,kind,agreed_at desc,id desc);
create table public.profile_consent_states (
 profile_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('service','privacy','health','marketing')),
 status text not null check(status in ('granted','declined','withdrawn','expired')),
 document_id uuid references public.consent_documents(id), latest_event_id bigint not null,
 granted_event_id bigint, granted_at timestamptz, valid_until timestamptz, next_confirmation_at timestamptz,
 revision bigint not null check(revision>0), updated_at timestamptz not null default clock_timestamp(),
 primary key(profile_id,kind),
 foreign key(latest_event_id,profile_id,kind) references public.profile_consents(id,profile_id,kind),
 foreign key(granted_event_id,profile_id,kind) references public.profile_consents(id,profile_id,kind),
 check(kind='health' or valid_until is null), check(kind='marketing' or next_confirmation_at is null),
 check(status<>'granted' or (granted_at is not null and granted_event_id is not null)),
 check(status<>'granted' or kind<>'health' or (valid_until>granted_at and valid_until is not null)),
 check(status<>'granted' or kind<>'marketing' or next_confirmation_at is not null),
 check(status not in ('declined','withdrawn') or (granted_event_id is null and granted_at is null and valid_until is null and next_confirmation_at is null))
);
alter table public.profile_consent_states enable row level security;
create index s1_health_due on public.profile_consent_states(valid_until,profile_id) where kind='health' and status='granted';
create index s1_marketing_due on public.profile_consent_states(next_confirmation_at,profile_id) where kind='marketing' and status='granted';
create table private.consent_requests (
 profile_id uuid not null references public.profiles(id) on delete cascade, request_id uuid not null,
 operation text not null, payload_hash text not null check(payload_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default clock_timestamp(), primary key(profile_id,request_id)
);
alter table private.consent_requests enable row level security;

create function private.validate_s1_document() returns trigger language plpgsql security definer set search_path='' as $$
declare d jsonb; s jsonb; p jsonb;
begin
 if TG_OP='DELETE' then
  if old.published_at is not null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  return old;
 end if;
 if TG_OP='UPDATE' and old.published_at is not null and
  (new.id,new.kind,new.version,new.edition,new.effective_from,new.canonical_content,new.content_hash,new.published_at)
  is distinct from (old.id,old.kind,old.version,old.edition,old.effective_from,old.canonical_content,old.content_hash,old.published_at) then
  raise exception 'INVALID_INPUT' using errcode='22023';
 end if;
 if octet_length(new.canonical_content)>131072 or right(new.canonical_content,1)<>chr(10)
 or encode(extensions.digest(convert_to(new.canonical_content,'UTF8'),'sha256'),'hex')<>new.content_hash then
  raise exception 'INVALID_INPUT' using errcode='22023';
 end if;
 begin d:=new.canonical_content::jsonb; exception when others then raise exception 'INVALID_INPUT' using errcode='22023'; end;
 if jsonb_typeof(d)<>'object' or (select count(*) from jsonb_object_keys(d))<>5 or not d ?& array['id','title','effectiveDate','edition','sections']
 or jsonb_typeof(d->'id')<>'string' or d->>'id'<>(case new.kind when 'service' then 'terms' when 'health' then 'health' when 'marketing' then 'marketing' else 'privacy' end)
 or d->'edition'<>to_jsonb(new.edition) or jsonb_typeof(d->'title')<>'string' or jsonb_typeof(d->'effectiveDate')<>'string' or jsonb_typeof(d->'sections')<>'array' then
  raise exception 'INVALID_INPUT' using errcode='22023';
 end if;
 for s in select value from jsonb_array_elements(d->'sections') loop
  if jsonb_typeof(s)<>'object' or (select count(*) from jsonb_object_keys(s))<>3 or not s ?& array['id','title','paragraphs'] or jsonb_typeof(s->'id')<>'string' or jsonb_typeof(s->'title')<>'string' or jsonb_typeof(s->'paragraphs')<>'array' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  for p in select value from jsonb_array_elements(s->'paragraphs') loop
   if jsonb_typeof(p)<>'string' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  end loop;
 end loop;
 return new;
end; $$;
create trigger s1_document_validate before insert or update or delete on public.consent_documents for each row execute function private.validate_s1_document();

create function private.validate_s1_bundle() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.is_current and (new.published_at is null or new.effective_from>clock_timestamp() or not exists(
 select 1 from public.consent_documents s,public.consent_documents p where s.id=new.service_document_id and p.id=new.privacy_document_id
 and s.kind='service' and p.kind='privacy' and s.is_current and p.is_current and s.published_at<=clock_timestamp() and p.published_at<=clock_timestamp() and s.effective_from<=clock_timestamp() and p.effective_from<=clock_timestamp())) then
 raise exception 'CONSENT_CONFIGURATION_UNAVAILABLE' using errcode='S1006'; end if;
 return new;
end; $$;
create trigger s1_bundle_validate before insert or update on public.terms_versions for each row execute function private.validate_s1_bundle();

create function private.validate_s1_consent_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.source<>'legacy' and new.document_id is null and not(new.action in ('withdraw','decline') and new.version='unversioned-withdrawal') then raise exception 'INVALID_INPUT' using errcode='23514'; end if;
 if new.document_id is not null and not exists(select 1 from public.consent_documents d where d.id=new.document_id and d.kind=new.kind and d.version=new.version) then raise exception 'INVALID_INPUT' using errcode='23514'; end if;
 return new;
end; $$;
create trigger s1_event_validate before insert on public.profile_consents for each row execute function private.validate_s1_consent_event();
create function private.validate_s1_consent_state() returns trigger language plpgsql security definer set search_path='' as $$
declare e public.profile_consents%rowtype; g public.profile_consents%rowtype;
begin
 select * into e from public.profile_consents where id=new.latest_event_id;
 if not found or (e.profile_id,e.kind,e.document_id) is distinct from (new.profile_id,new.kind,new.document_id)
 or new.status<>(case e.action when 'grant' then 'granted' when 'decline' then 'declined' when 'withdraw' then 'withdrawn' else 'expired' end) then raise exception 'INVALID_INPUT' using errcode='23514'; end if;
 if new.granted_event_id is not null then
  select * into g from public.profile_consents where id=new.granted_event_id;
  if not found or g.action<>'grant' or (g.profile_id,g.kind,g.document_id,g.agreed_at) is distinct from (new.profile_id,new.kind,new.document_id,new.granted_at) then raise exception 'INVALID_INPUT' using errcode='23514'; end if;
 end if;
 if new.status='granted' and new.document_id is null and not(new.kind='marketing' and e.source='legacy') then raise exception 'INVALID_INPUT' using errcode='23514'; end if;
 return new;
end; $$;
create trigger s1_state_validate before insert or update on public.profile_consent_states for each row execute function private.validate_s1_consent_state();
-- Latest legacy marketing only; never manufacture new events or health/required approval.
insert into public.profile_consent_states(profile_id,kind,status,document_id,latest_event_id,granted_event_id,granted_at,next_confirmation_at,revision)
select profile_id,kind,case when agreed then 'granted' else 'declined' end,null,id,
 case when agreed then id end,case when agreed then agreed_at end,
 case when agreed then (agreed_at at time zone 'Asia/Seoul'+interval '2 years') at time zone 'Asia/Seoul' end,1
from (select distinct on(profile_id) * from public.profile_consents where kind='marketing' order by profile_id,agreed_at desc,id desc) e;

revoke all on public.consent_documents,public.profile_consent_states,private.consent_requests from public,anon,authenticated,service_role;
revoke all on public.profile_consents,public.terms_versions from public,anon,authenticated,service_role;
grant select on public.consent_documents,public.terms_versions to anon,authenticated;
grant select on public.profile_consents,public.profile_consent_states to authenticated;
create policy consent_documents_public_read on public.consent_documents for select to anon,authenticated using(published_at<=clock_timestamp() and effective_from<=clock_timestamp());
drop policy if exists terms_versions_select_authenticated on public.terms_versions;
create policy terms_versions_public_read on public.terms_versions for select to anon,authenticated using(published_at is not null);
create policy consent_states_select_own on public.profile_consent_states for select to authenticated using(profile_id=auth.uid());
revoke all on function private.validate_s1_document(),private.validate_s1_bundle(),private.validate_s1_consent_event(),private.validate_s1_consent_state() from public,anon,authenticated,service_role;
create function private.s1_guard_consent_history() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- A profile-root CASCADE is the only permitted deletion. The parent is already gone.
 if TG_OP='DELETE' and not exists(select 1 from public.profiles where id=old.profile_id) then return old; end if;
 raise exception 'CONSENT_HISTORY_APPEND_ONLY' using errcode='42501';
end; $$;
create trigger s1_consent_history_append_only before update or delete on public.profile_consents for each row execute function private.s1_guard_consent_history();
create trigger s1_consent_history_no_truncate before truncate on public.profile_consents for each statement execute function private.s1_guard_consent_history();
revoke all on function private.s1_guard_consent_history() from public,anon,authenticated,service_role;
commit;
