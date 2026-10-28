-- S5 F3: explicit public meeting area; never reads private origin or health.
begin;
create table public.public_meeting_areas(
 id text primary key check(id ~ '^[a-z][a-z0-9_-]{0,63}$'),label text not null check(char_length(label) between 1 and 80),
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 radius_m integer not null check(radius_m between 100 and 2000),enabled boolean not null default true,
 revision bigint not null default 0 check(revision>=0)
);
-- Production regions require a reviewed data seed. Only the LOCAL seed supplies a dev example.
create table public.room_recommendation_settings(
 room_id uuid primary key references public.rooms(id) on delete cascade,
 public_area_id text references public.public_meeting_areas,
 public_cuisines text[] not null default '{}',revision bigint not null default 0 check(revision>=0),
 updated_at timestamptz not null default clock_timestamp()
);
create function private.s5_terms_for(u uuid) returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from public.terms_versions t where t.is_current and t.published_at<=clock_timestamp() and t.effective_from<=clock_timestamp()
 and not exists(select 1 from unnest(array['service','privacy']) k where not exists(
 select 1 from (select e.document_id,e.action,e.agreed from public.profile_consents e where e.profile_id=u and e.kind=k order by e.agreed_at desc,e.id desc limit 1) latest
 where latest.agreed and latest.action='grant' and latest.document_id=case k when 'service' then t.service_document_id else t.privacy_document_id end)))
$$;
create function private.s5_room_visible(r uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.rooms x join public.participants p on p.room_id=x.id
 where x.id=r and x.expires_at>clock_timestamp() and p.profile_id=auth.uid())
$$;
create function private.s5_room(r uuid,u uuid,p_lock boolean) returns public.rooms language plpgsql volatile security definer set search_path='' as $$
declare x public.rooms%rowtype; begin
 if u is null or not exists(select 1 from public.rooms a join public.participants p on p.room_id=a.id
 where a.id=r and a.expires_at>clock_timestamp() and p.profile_id=u) then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 if p_lock then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(r::text,0));
  select * into x from public.rooms where id=r for update;
 else select * into x from public.rooms where id=r;
 end if;
 if not found or x.expires_at<=clock_timestamp() or not exists(select 1 from public.participants where room_id=r and profile_id=u) then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 perform private.s1_current_bundle();
 if not private.s5_terms_for(u) then raise exception 'TERMS_REQUIRED' using errcode='S1001'; end if;
 return x;
end; $$;
create function public.get_public_meeting_areas_v2() returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
begin
 perform private.require_current_terms_consent();
 return jsonb_build_object('contract_version',2,'areas',coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',label,'latitude',latitude,'longitude',longitude,'radius_m',radius_m) order by id)
 from public.public_meeting_areas where enabled),'[]'));
end; $$;
create function public.get_room_recommendation_settings_v2(p_room_id uuid) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare s public.room_recommendation_settings%rowtype; a jsonb; begin
 perform private.require_current_terms_consent();
 perform private.s5_room(p_room_id,auth.uid(),false);
 select * into s from public.room_recommendation_settings where room_id=p_room_id;
 select jsonb_build_object('id',id,'label',label,'latitude',latitude,'longitude',longitude,'radius_m',radius_m) into a
 from public.public_meeting_areas where id=s.public_area_id and enabled;
 return jsonb_build_object('contract_version',2,'public_area_id',s.public_area_id,'area',a,'public_cuisines',coalesce(s.public_cuisines,'{}'::text[]),'revision',coalesce(s.revision,0)::text);
end; $$;
create function public.set_room_recommendation_area_v2(p_room_id uuid,p_public_area_id text,p_expected_revision bigint)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare x public.rooms%rowtype; s public.room_recommendation_settings%rowtype; begin
 perform private.require_current_terms_consent();
 x:=private.s5_room(p_room_id,auth.uid(),true);
 if x.owner_id is distinct from auth.uid() then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 if p_expected_revision is null or p_expected_revision<0 or not exists(select 1 from public.public_meeting_areas where id=p_public_area_id and enabled) then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 select * into s from public.room_recommendation_settings where room_id=p_room_id for update;
 if p_expected_revision is distinct from coalesce(s.revision,0) then raise exception 'REVISION_CONFLICT' using errcode='S1004'; end if;
 insert into public.room_recommendation_settings(room_id,public_area_id,revision) values(p_room_id,p_public_area_id,coalesce(s.revision,0)+1)
 on conflict(room_id) do update set public_area_id=excluded.public_area_id,revision=excluded.revision,updated_at=clock_timestamp();
 return public.get_room_recommendation_settings_v2(p_room_id);
end; $$;
create function public.set_room_public_cuisines_v2(p_room_id uuid,p_cuisines text[],p_expected_revision bigint)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare x public.rooms%rowtype; s public.room_recommendation_settings%rowtype; begin
 perform private.require_current_terms_consent();
 x:=private.s5_room(p_room_id,auth.uid(),true);
 if x.owner_id is distinct from auth.uid() then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 if p_expected_revision is null or p_expected_revision<0 or cardinality(p_cuisines)>7 or not private.s5_codes(private.s5_catalog(),'cuisine',p_cuisines) then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 select * into s from public.room_recommendation_settings where room_id=p_room_id for update;
 if p_expected_revision is distinct from coalesce(s.revision,0) then raise exception 'REVISION_CONFLICT' using errcode='S1004'; end if;
 insert into public.room_recommendation_settings(room_id,public_cuisines,revision) values(p_room_id,p_cuisines,coalesce(s.revision,0)+1)
 on conflict(room_id) do update set public_cuisines=excluded.public_cuisines,revision=excluded.revision,updated_at=clock_timestamp();
 return public.get_room_recommendation_settings_v2(p_room_id);
end; $$;
alter table public.public_meeting_areas enable row level security;
alter table public.room_recommendation_settings enable row level security;
revoke all on public.public_meeting_areas,public.room_recommendation_settings from public,anon,authenticated,service_role;
grant select on public.public_meeting_areas,public.room_recommendation_settings to authenticated;
create policy s5_area_read on public.public_meeting_areas for select to authenticated using(enabled);
create policy s5_settings_read on public.room_recommendation_settings for select to authenticated using(private.s5_room_visible(room_id));
create policy s5_area_terms on public.public_meeting_areas as restrictive for all to authenticated using((select private.has_current_terms_consent())) with check((select private.has_current_terms_consent()));
create policy s5_settings_terms on public.room_recommendation_settings as restrictive for all to authenticated using((select private.has_current_terms_consent())) with check((select private.has_current_terms_consent()));
revoke all on function private.s5_terms_for(uuid),private.s5_room_visible(uuid),private.s5_room(uuid,uuid,boolean),
public.get_public_meeting_areas_v2(),public.get_room_recommendation_settings_v2(uuid),public.set_room_recommendation_area_v2(uuid,text,bigint),public.set_room_public_cuisines_v2(uuid,text[],bigint)
from public,anon,authenticated,service_role;
grant execute on function private.s5_room_visible(uuid),public.get_public_meeting_areas_v2(),public.get_room_recommendation_settings_v2(uuid),
public.set_room_recommendation_area_v2(uuid,text,bigint),public.set_room_public_cuisines_v2(uuid,text[],bigint) to authenticated;
commit;
