-- S1 M2: explicit consent; all mutations serialize on the profile row.
begin;
create function private.s1_lock_profile() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 perform 1 from public.profiles where id=u for update;
 if not found then raise exception 'PROFILE_NOT_READY' using errcode='23503'; end if;
 return u;
end; $$;
create function private.s1_current_bundle() returns public.terms_versions language plpgsql security definer set search_path='' as $$
declare b public.terms_versions%rowtype; begin
 select * into b from public.terms_versions where is_current and published_at<=clock_timestamp() and effective_from<=clock_timestamp();
 if not found or not exists(select 1 from public.consent_documents s,public.consent_documents p where s.id=b.service_document_id and p.id=b.privacy_document_id and s.kind='service' and p.kind='privacy' and s.is_current and p.is_current and s.published_at<=clock_timestamp() and p.published_at<=clock_timestamp() and s.effective_from<=clock_timestamp() and p.effective_from<=clock_timestamp()) then
 raise exception 'CONSENT_CONFIGURATION_UNAVAILABLE' using errcode='S1006'; end if;
 return b;
end; $$;
-- VOLATILE intentionally retained for clock_timestamp and post-lock revocation checks.
create function private.has_current_terms_consent() returns boolean language plpgsql volatile security definer set search_path='' as $$
declare b public.terms_versions%rowtype; k text; e public.profile_consents%rowtype; begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid()) then return false; end if;
 begin b:=private.s1_current_bundle(); exception when sqlstate 'S1006' then return false; end;
 foreach k in array array['service','privacy'] loop
  select * into e from public.profile_consents where profile_id=auth.uid() and kind=k order by agreed_at desc,id desc limit 1;
  if not found or not e.agreed or e.action<>'grant' or e.document_id is distinct from (case k when 'service' then b.service_document_id else b.privacy_document_id end) then return false; end if;
 end loop;
 return true;
end; $$;
create function private.require_current_terms_consent() returns void language plpgsql volatile security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 perform private.s1_current_bundle();
 if not private.has_current_terms_consent() then raise exception 'TERMS_REQUIRED' using errcode='S1001'; end if;
end; $$;
create function private.has_active_health_consent(p_event_id bigint) returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from public.profile_consent_states s where s.profile_id=auth.uid() and s.kind='health' and s.status='granted' and s.granted_event_id=p_event_id and clock_timestamp()<s.valid_until)
$$;
create function private.s1_optional_status(p_kind text) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare s public.profile_consent_states%rowtype; v text; t timestamptz:=clock_timestamp(); r jsonb; begin
 select * into s from public.profile_consent_states where profile_id=auth.uid() and kind=p_kind;
 select version into v from public.consent_documents where id=s.document_id;
 r:=jsonb_build_object('status',case when s.status='granted' and p_kind='health' and t>=s.valid_until then 'expired' else coalesce(s.status,'not_asked') end,'document_version',v,'granted_at',s.granted_at,'revision',coalesce(s.revision,0)::text);
 if p_kind='health' then return r||jsonb_build_object('valid_until',s.valid_until); end if;
 return r||jsonb_build_object('next_confirmation_at',s.next_confirmation_at,'confirmation_due',coalesce(s.status='granted' and t>=s.next_confirmation_at,false),'sending_enabled',false);
end; $$;
create function public.get_consent_manifest() returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare b public.terms_versions%rowtype; d public.consent_documents%rowtype; k text; ds jsonb:='{}'; begin
 b:=private.s1_current_bundle();
 foreach k in array array['service','privacy','health','marketing'] loop
  select * into d from public.consent_documents where kind=k and is_current and published_at<=clock_timestamp() and effective_from<=clock_timestamp();
  if not found or (k='service' and d.id<>b.service_document_id) or (k='privacy' and d.id<>b.privacy_document_id) then raise exception 'CONSENT_CONFIGURATION_UNAVAILABLE' using errcode='S1006'; end if;
  ds:=ds||jsonb_build_object(k,jsonb_build_object('version',d.version,'edition',d.edition,'content_hash',d.content_hash,'canonical_content',d.canonical_content));
 end loop;
 return jsonb_build_object('contract_version',1,'bundle_version',b.version,'effective_from',b.effective_from,'change_summary',b.change_summary,'documents',ds,'server_time',clock_timestamp());
end; $$;
create function public.get_my_consent_status() returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare b public.terms_versions%rowtype; sa boolean; pa boolean; begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'PROFILE_NOT_READY' using errcode='23503'; end if;
 b:=private.s1_current_bundle();
 select coalesce((select agreed and document_id=b.service_document_id from public.profile_consents where profile_id=auth.uid() and kind='service' order by agreed_at desc,id desc limit 1),false) into sa;
 select coalesce((select agreed and document_id=b.privacy_document_id from public.profile_consents where profile_id=auth.uid() and kind='privacy' order by agreed_at desc,id desc limit 1),false) into pa;
 return jsonb_build_object('contract_version',1,'bundle_version',b.version,'required',jsonb_build_object('status',case when sa and pa then 'accepted' else 'required' end,'service_agreed',sa,'privacy_agreed',pa),'health',private.s1_optional_status('health'),'marketing',private.s1_optional_status('marketing'),'server_time',clock_timestamp());
end; $$;
create function private.s1_request(p_request uuid,p_operation text,p_payload jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare h text; old_hash text; old_op text; begin
 if p_request is null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 h:=encode(extensions.digest(convert_to(p_payload::text,'UTF8'),'sha256'),'hex');
 select payload_hash,operation into old_hash,old_op from private.consent_requests where profile_id=auth.uid() and request_id=p_request;
 if found then
  if old_hash<>h or old_op<>p_operation then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='S1007'; end if;
  return true;
 end if;
 insert into private.consent_requests(profile_id,request_id,operation,payload_hash) values(auth.uid(),p_request,p_operation,h);
 return false;
end; $$;
create function private.s1_write_consent(p_kind text,p_action text,p_document uuid,p_request uuid,p_source text) returns void language plpgsql security definer set search_path='' as $$
declare e bigint; t timestamptz:=clock_timestamp(); v text; old_state public.profile_consent_states%rowtype; begin
 select * into old_state from public.profile_consent_states where profile_id=auth.uid() and kind=p_kind;
 select version into v from public.consent_documents where id=p_document;
 if p_kind='health' and (p_action<>'grant' or old_state.status is distinct from 'granted' or t>=old_state.valid_until) then
  delete from public.profile_health_preferences where profile_id=auth.uid();
 end if;
 insert into public.profile_consents(profile_id,kind,version,agreed,agreed_at,document_id,action,source,request_id)
 values(auth.uid(),p_kind,coalesce(v,'unversioned-withdrawal'),p_action='grant',t,p_document,p_action,p_source,p_request) returning id into e;
 insert into public.profile_consent_states(profile_id,kind,status,document_id,latest_event_id,granted_event_id,granted_at,valid_until,next_confirmation_at,revision,updated_at)
 values(auth.uid(),p_kind,case p_action when 'grant' then 'granted' when 'decline' then 'declined' else 'withdrawn' end,p_document,e,
 case when p_action='grant' then e end,case when p_action='grant' then t end,
 case when p_action='grant' and p_kind='health' then (t at time zone 'Asia/Seoul'+interval '1 year') at time zone 'Asia/Seoul' end,
 case when p_action='grant' and p_kind='marketing' then (t at time zone 'Asia/Seoul'+interval '2 years') at time zone 'Asia/Seoul' end,coalesce(old_state.revision,0)+1,t)
 on conflict(profile_id,kind) do update set status=excluded.status,document_id=excluded.document_id,latest_event_id=excluded.latest_event_id,granted_event_id=excluded.granted_event_id,granted_at=excluded.granted_at,valid_until=excluded.valid_until,next_confirmation_at=excluded.next_confirmation_at,revision=excluded.revision,updated_at=excluded.updated_at;
 if p_kind='health' and p_action='grant' then update public.profile_health_preferences set consent_event_id=e where profile_id=auth.uid(); end if;
end; $$;
create function private.s1_record_bundle(p_request_id uuid,p_bundle_version text,p_documents jsonb,p_choices jsonb,p_signup boolean) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare u uuid; manifest jsonb; keys text[]; k text; d uuid; begin
 u:=private.s1_lock_profile();
 keys:=case when p_signup then array['service','privacy','health','marketing'] else array['service','privacy'] end;
 if private.s1_request(p_request_id,case when p_signup then 'signup' else 'required' end,jsonb_build_object('bundle',p_bundle_version,'documents',p_documents,'choices',p_choices)) then return public.get_my_consent_status(); end if;
 if jsonb_typeof(p_documents) is distinct from 'object' or jsonb_typeof(p_choices) is distinct from 'object' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 if (select count(*) from jsonb_object_keys(p_documents))<>cardinality(keys) or (select count(*) from jsonb_object_keys(p_choices))<>cardinality(keys) or not p_documents ?& keys or not p_choices ?& keys or p_choices->'service' is distinct from 'true'::jsonb or p_choices->'privacy' is distinct from 'true'::jsonb then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 manifest:=public.get_consent_manifest();
 if p_bundle_version is distinct from manifest->>'bundle_version' then raise exception 'DOCUMENT_CHANGED' using errcode='S1002'; end if;
 if p_signup and exists(select 1 from public.profile_consents where profile_id=u and kind in ('health','marketing') and source<>'legacy') then raise exception 'REVISION_CONFLICT' using errcode='S1004'; end if;
 foreach k in array keys loop
  if jsonb_typeof(p_choices->k)<>'boolean' or jsonb_typeof(p_documents->k)<>'object' or jsonb_typeof(p_documents->k->'version') is distinct from 'string' or jsonb_typeof(p_documents->k->'content_hash') is distinct from 'string' or (select count(*) from jsonb_object_keys(p_documents->k))<>2 or not (p_documents->k) ?& array['version','content_hash'] then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  if p_documents->k->>'version' is distinct from manifest->'documents'->k->>'version' or p_documents->k->>'content_hash' is distinct from manifest->'documents'->k->>'content_hash' then raise exception 'DOCUMENT_CHANGED' using errcode='S1002'; end if;
 end loop;
 foreach k in array keys loop
  select id into d from public.consent_documents where kind=k and is_current
   and version=manifest->'documents'->k->>'version' and content_hash=manifest->'documents'->k->>'content_hash'
   and published_at<=clock_timestamp() and effective_from<=clock_timestamp() for share;
  if not found then raise exception 'DOCUMENT_CHANGED' using errcode='S1002'; end if;
  perform private.s1_write_consent(k,case when (p_choices->>k)::boolean then 'grant' else 'decline' end,d,p_request_id,case when p_signup then 'signup' else 'reconsent' end);
 end loop;
 return public.get_my_consent_status();
end; $$;
create function public.complete_signup_consents(p_request_id uuid,p_bundle_version text,p_documents jsonb,p_choices jsonb) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
begin return private.s1_record_bundle(p_request_id,p_bundle_version,p_documents,p_choices,true); end; $$;
create function public.record_required_consents(p_request_id uuid,p_bundle_version text,p_documents jsonb,p_choices jsonb) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
begin return private.s1_record_bundle(p_request_id,p_bundle_version,p_documents,p_choices,false); end; $$;
create function public.set_optional_consent(p_request_id uuid,p_kind text,p_action text,p_document_version text,p_content_hash text,p_expected_revision bigint,p_source text) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare d public.consent_documents%rowtype; s public.profile_consent_states%rowtype; r jsonb; replay boolean; begin
 perform private.s1_lock_profile();
 if p_kind is null or p_kind not in ('health','marketing') or p_action is null or p_action not in ('grant','decline','withdraw') or p_source is null or p_source not in ('settings','food_step2') then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 replay:=private.s1_request(p_request_id,'optional',jsonb_build_object('kind',p_kind,'action',p_action,'version',p_document_version,'hash',p_content_hash,'revision',p_expected_revision,'source',p_source));
 if not replay then
  select * into s from public.profile_consent_states where profile_id=auth.uid() and kind=p_kind;
  if p_action='grant' then
   perform private.require_current_terms_consent();
   select * into d from public.consent_documents where kind=p_kind and is_current and published_at<=clock_timestamp() and effective_from<=clock_timestamp();
   if not found then raise exception 'CONSENT_CONFIGURATION_UNAVAILABLE' using errcode='S1006'; end if;
   if p_document_version is distinct from d.version or p_content_hash is distinct from d.content_hash then raise exception 'DOCUMENT_CHANGED' using errcode='S1002'; end if;
   if p_expected_revision is distinct from coalesce(s.revision,0) then raise exception 'REVISION_CONFLICT' using errcode='S1004'; end if;
  else
   select * into d from public.consent_documents where id=s.document_id;
  end if;
  perform private.s1_write_consent(p_kind,p_action,d.id,p_request_id,p_source);
 end if;
 r:=private.s1_optional_status(p_kind);
 return r||jsonb_build_object('kind',p_kind,'valid_until',case when p_kind='health' then r->'valid_until' else 'null'::jsonb end,'next_confirmation_at',case when p_kind='marketing' then r->'next_confirmation_at' else 'null'::jsonb end,'data_deleted',p_kind='health' and r->>'status' in ('declined','withdrawn'),'server_time',clock_timestamp());
end; $$;
create or replace function private.handle_new_user() returns trigger language plpgsql volatile security definer set search_path='' as $$
begin
 insert into public.profiles(id,name,tag) values(new.id,coalesce(nullif(btrim(new.raw_user_meta_data->>'name'),''),'새 사용자'),'user-'||substring(replace(new.id::text,'-','') from 1 for 8)) on conflict(id) do nothing;
 insert into public.profile_private(id) values(new.id) on conflict(id) do nothing;
 insert into public.profile_food_preferences(profile_id) values(new.id) on conflict(profile_id) do nothing;
 return new;
end; $$;
revoke all on function public.get_consent_manifest(),public.get_my_consent_status(),public.complete_signup_consents(uuid,text,jsonb,jsonb),public.record_required_consents(uuid,text,jsonb,jsonb),public.set_optional_consent(uuid,text,text,text,text,bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.get_consent_manifest() to anon,authenticated;
grant execute on function public.get_my_consent_status(),public.complete_signup_consents(uuid,text,jsonb,jsonb),public.record_required_consents(uuid,text,jsonb,jsonb),public.set_optional_consent(uuid,text,text,text,text,bigint,text) to authenticated;
revoke all on function private.s1_lock_profile(),private.s1_current_bundle(),private.has_current_terms_consent(),private.require_current_terms_consent(),private.has_active_health_consent(bigint),private.s1_optional_status(text),private.s1_request(uuid,text,jsonb),private.s1_write_consent(text,text,uuid,uuid,text),private.s1_record_bundle(uuid,text,jsonb,jsonb,boolean),private.handle_new_user() from public,anon,authenticated,service_role;
grant execute on function private.has_current_terms_consent(),private.has_active_health_consent(bigint) to authenticated;
commit;
