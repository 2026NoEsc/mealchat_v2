-- S1 M4: exact visibility keys, owner writes, relation-limited projection.
begin;
create function private.s1_normalize_privacy(p jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare k text; a text; r jsonb:='{}'; v text; begin
 foreach k in array array['birthdate','gender','bio','bank_account','origin'] loop
  a:=case k when 'birthdate' then 'birth' when 'bank_account' then 'account' else k end;
  v:='private';
  if (p->>k='public' or p->>a='public') and (not p ? k or p->>k='public') and (not p ? a or p->>a='public') then v:='public'; end if;
  r:=r||jsonb_build_object(k,v);
 end loop;
 return r;
end; $$;
alter table public.profile_private add column privacy_revision bigint not null default 0 check(privacy_revision>=0);
update public.profile_private set privacy_settings=private.s1_normalize_privacy(privacy_settings),personal_data=(select coalesce(jsonb_object_agg(e.key,e.value),'{}') from jsonb_each(personal_data) e where e.key in ('gender','bio'));
alter table public.profile_private alter column privacy_settings set default '{"birthdate":"private","gender":"private","bio":"private","bank_account":"private","origin":"private"}';
alter table public.profile_private add constraint s1_privacy_shape check(coalesce(jsonb_typeof(privacy_settings)='object' and privacy_settings ?& array['birthdate','gender','bio','bank_account','origin'] and privacy_settings-array['birthdate','gender','bio','bank_account','origin']='{}'::jsonb and privacy_settings->>'birthdate' in ('public','private') and privacy_settings->>'gender' in ('public','private') and privacy_settings->>'bio' in ('public','private') and privacy_settings->>'bank_account' in ('public','private') and privacy_settings->>'origin' in ('public','private'),false));
create function private.s1_valid_personal(p jsonb) returns boolean language sql immutable set search_path='' as $$
 select case when jsonb_typeof(p)='object' then not exists(select 1 from jsonb_each(p) e where e.key not in ('gender','bio') or (e.key='gender' and (jsonb_typeof(e.value)<>'string' or e.value#>>'{}' not in ('male','female','none'))) or (e.key='bio' and (jsonb_typeof(e.value)<>'string' or char_length(e.value#>>'{}')>120))) else false end
$$;
alter table public.profile_private add constraint s1_personal_shape check(coalesce(jsonb_typeof(personal_data)='object' and personal_data-array['gender','bio']='{}'::jsonb and (not personal_data ? 'gender' or (jsonb_typeof(personal_data->'gender')='string' and personal_data->>'gender' in ('male','female','none'))) and (not personal_data ? 'bio' or (jsonb_typeof(personal_data->'bio')='string' and char_length(personal_data->>'bio')<=120)),false));
create function private.validate_s1_profile_private() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not private.s1_valid_personal(new.personal_data) or new.privacy_settings is distinct from private.s1_normalize_privacy(new.privacy_settings) or new.tastes is distinct from '{}'::jsonb or (new.birth_date is not null and (new.birth_date<date '1900-01-01' or new.birth_date>current_date)) then
  raise exception 'INVALID_INPUT' using errcode='22023';
 end if;
 return new;
end; $$;
create trigger s1_profile_private_validate before insert or update of personal_data,privacy_settings,tastes,birth_date on public.profile_private for each row execute function private.validate_s1_profile_private();
revoke all on function private.validate_s1_profile_private() from public,anon,authenticated,service_role;
update public.participants set personal_data='{}',start_location_name=null,start_latitude=null,start_longitude=null;
alter table public.participants add constraint s1_participant_no_private check(personal_data='{}'::jsonb and start_location_name is null and start_latitude is null and start_longitude is null);
revoke update on public.profile_private from public,anon,authenticated,service_role;
revoke update(personal_data,privacy_settings,schedule,push_token,bank_name,account_number,birth_date,tastes,start_location_name,start_latitude,start_longitude,privacy_revision,updated_at,id) on public.profile_private from public,anon,authenticated,service_role;
grant update(personal_data,schedule,push_token,bank_name,account_number,birth_date,start_location_name,start_latitude,start_longitude) on public.profile_private to authenticated;
revoke select on public.participants from public,anon,authenticated;
revoke select(id,room_id,profile_id,name,avatar_color,avatar_url,personal_data,schedule,voted_items,start_location_name,start_latitude,start_longitude,created_at) on public.participants from public,anon,authenticated;
grant select(id,room_id,profile_id,name,avatar_color,avatar_url,schedule,voted_items,created_at) on public.participants to authenticated;
create function public.get_my_profile_visibility() returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare p public.profile_private%rowtype; begin
 perform private.require_current_terms_consent(); select privacy_settings,privacy_revision into p.privacy_settings,p.privacy_revision from public.profile_private where id=auth.uid();
 if not found then raise exception 'PROFILE_NOT_READY' using errcode='23503'; end if;
 return jsonb_build_object('settings',p.privacy_settings,'revision',p.privacy_revision::text);
end; $$;
create function public.set_profile_visibility(p_field text,p_visibility text,p_expected_revision bigint) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare p public.profile_private%rowtype; begin
 perform private.s1_lock_profile(); perform private.require_current_terms_consent();
 if p_field is null or p_field not in ('birthdate','gender','bio','bank_account','origin') or p_visibility is null or p_visibility not in ('public','private') then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 select privacy_settings,privacy_revision into p.privacy_settings,p.privacy_revision from public.profile_private where id=auth.uid() for update;
 if not found then raise exception 'PROFILE_NOT_READY' using errcode='23503'; end if;
 if p_expected_revision is distinct from p.privacy_revision then raise exception 'REVISION_CONFLICT' using errcode='S1004'; end if;
 if p.privacy_settings->>p_field<>p_visibility then update public.profile_private set privacy_settings=jsonb_set(privacy_settings,array[p_field],to_jsonb(p_visibility)),privacy_revision=privacy_revision+1 where id=auth.uid(); end if;
 return public.get_my_profile_visibility();
end; $$;
create function public.get_visible_profile(p_profile_id uuid,p_room_id uuid default null) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare u uuid:=auth.uid(); i jsonb; p public.profile_private%rowtype; rel text; f jsonb:='{}'; mate boolean; begin
 perform private.require_current_terms_consent();
 select jsonb_build_object('id',id,'name',name,'tag',tag,'avatar_color',avatar_color,'avatar_url',avatar_url) into i from public.public_profiles where id=p_profile_id;
 if not found then raise exception 'RESOURCE_NOT_FOUND' using errcode='P0002'; end if;
 select exists(select 1 from public.rooms r join public.participants a on a.room_id=r.id and a.profile_id=u join public.participants b on b.room_id=r.id and b.profile_id=p_profile_id where r.expires_at>clock_timestamp() and (p_room_id is null or r.id=p_room_id)) into mate;
 if p_room_id is not null and not mate then raise exception 'RESOURCE_NOT_FOUND' using errcode='P0002'; end if;
 rel:=case when u=p_profile_id then 'self' when mate then 'room_mate' else 'identity_only' end;
 if rel<>'identity_only' then
  select privacy_settings,birth_date,personal_data,bank_name,account_number into p.privacy_settings,p.birth_date,p.personal_data,p.bank_name,p.account_number from public.profile_private where id=p_profile_id;
  if (rel='self' or p.privacy_settings->>'birthdate'='public') and p.birth_date is not null then f:=f||jsonb_build_object('birthdate',p.birth_date); end if;
  if (rel='self' or p.privacy_settings->>'gender'='public') and p.personal_data ? 'gender' then f:=f||jsonb_build_object('gender',p.personal_data->'gender'); end if;
  if (rel='self' or p.privacy_settings->>'bio'='public') and nullif(p.personal_data->>'bio','') is not null then f:=f||jsonb_build_object('bio',p.personal_data->'bio'); end if;
  if (rel='self' or p.privacy_settings->>'bank_account'='public') and nullif(p.bank_name,'') is not null and nullif(p.account_number,'') is not null then f:=f||jsonb_build_object('bank_account',jsonb_build_object('bank_name',p.bank_name,'account_number',p.account_number)); end if;
 end if;
 return jsonb_build_object('profile',i,'relationship',rel,'fields',f);
end; $$;
revoke all on function private.s1_normalize_privacy(jsonb),private.s1_valid_personal(jsonb),public.get_my_profile_visibility(),public.set_profile_visibility(text,text,bigint),public.get_visible_profile(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.s1_normalize_privacy(jsonb),private.s1_valid_personal(jsonb) to service_role;
grant execute on function public.get_my_profile_visibility(),public.set_profile_visibility(text,text,bigint),public.get_visible_profile(uuid,uuid) to authenticated;
commit;
