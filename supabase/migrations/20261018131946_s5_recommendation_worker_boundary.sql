-- S5 F4: user-created tickets, service-only work, no health/origin access.
begin;
create table private.recommendation_requests(
 request_id uuid primary key,caller_id uuid not null references public.profiles(id) on delete cascade,
 room_id uuid not null references public.rooms(id) on delete cascade,purpose text not null check(purpose='places'),
 status text not null default 'pending' check(status in('pending','working','complete','failed')),
 created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,
 context_hash text not null,work_token uuid,result jsonb,result_expires_at timestamptz,
 check(status not in('working','failed') or work_token is not null),
 check(status<>'complete' or (result is not null and result_expires_at is not null and work_token is not null))
);
create index s5_request_caller_time on private.recommendation_requests(caller_id,created_at);
create index s5_request_room_time on private.recommendation_requests(room_id,created_at);
create index s5_request_cleanup_time on private.recommendation_requests(created_at);
alter table private.recommendation_requests enable row level security;
revoke all on private.recommendation_requests from public,anon,authenticated,service_role;

-- Account usage survives room/ticket deletion; no room or ticket foreign key.
create table private.recommendation_usage(
 id bigint generated always as identity primary key,
 caller_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default clock_timestamp()
);
create index s5_usage_caller_time on private.recommendation_usage(caller_id,created_at);
create index s5_usage_cleanup_time on private.recommendation_usage(created_at,id);
alter table private.recommendation_usage enable row level security;
revoke all on private.recommendation_usage from public,anon,authenticated,service_role;
revoke all on sequence private.recommendation_usage_id_seq from public,anon,authenticated,service_role;

create function private.s5_worker() returns void language plpgsql stable set search_path='' as $$
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role') is distinct from 'service_role'
 then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
end; $$;
create function private.s5_lock_members(r uuid) returns void language plpgsql volatile security definer set search_path='' as $$
begin
 perform 1 from public.participants where room_id=r order by id for share;
 perform 1 from public.profiles p where exists(select 1 from public.participants a where a.room_id=r and a.profile_id=p.id) order by p.id for update;
 -- Freeze public catalog and current bundle while the final context/result is committed.
 perform 1 from public.food_profile_catalog_versions order by catalog_version for share;
 perform 1 from public.food_profile_option_catalog order by catalog_version,group_code,code for share;
 perform 1 from public.terms_versions where is_current order by id for share;
 perform 1 from public.consent_documents where is_current order by id for share;
 perform 1 from public.public_meeting_areas a where exists(select 1 from public.room_recommendation_settings s where s.room_id=r and s.public_area_id=a.id) for share;
end; $$;
create function private.s5_context(r uuid) returns text language sql volatile security definer set search_path='' as $$
 select encode(extensions.digest(convert_to(jsonb_build_object(
 'room',(select jsonb_build_array(owner_id,expires_at) from public.rooms where id=r),
 'area',(select to_jsonb(a) from public.room_recommendation_settings s join public.public_meeting_areas a on a.id=s.public_area_id where s.room_id=r),
 'settings',(select to_jsonb(s) from public.room_recommendation_settings s where room_id=r),
 'members',(select jsonb_agg(jsonb_build_array(p.id,p.profile_id,case when f.schema_version=2 and f.completed_at is not null then jsonb_build_object('catalog_version',f.catalog_version,'preferences',f.preferences) end,
 (select jsonb_agg(jsonb_build_array(c.kind,c.document_id,c.id,c.action) order by c.kind) from (select distinct on(kind) kind,document_id,id,action from public.profile_consents where profile_id=p.profile_id and kind in('service','privacy') order by kind,agreed_at desc,id desc) c))
 order by p.id) from public.participants p left join public.profile_food_preferences f on f.profile_id=p.profile_id where p.room_id=r),
 'catalog',(select jsonb_agg(to_jsonb(v) order by catalog_version) from public.food_profile_catalog_versions v),
 'options',(select jsonb_agg(to_jsonb(o) order by catalog_version,group_code,code) from public.food_profile_option_catalog o),
 'terms',(select jsonb_agg(jsonb_build_array(id,service_document_id,privacy_document_id,effective_from) order by id) from public.terms_versions where is_current)
 )::text,'UTF8'),'sha256'),'hex')
$$;
create function private.s5_weights(r uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare chosen text[]; result jsonb; begin
 select public_cuisines into chosen from public.room_recommendation_settings where room_id=r;
 if cardinality(chosen)>0 then
  if not private.s5_codes(private.s5_catalog(),'cuisine',chosen) then raise exception 'CATALOG_CHANGED' using errcode='S5001'; end if;
  return (select jsonb_object_agg(c,1) from unnest(chosen) c);
 end if;
 with selections as (
 select f.profile_id,array(select distinct c from jsonb_array_elements_text(
 (f.preferences->'cuisines')||(f.preferences->'ingredients')||(f.preferences->'forms')||
 case when f.preferences->>'spice' is null then '[]'::jsonb else jsonb_build_array(f.preferences->>'spice') end) c where c<>'any') codes
 from public.participants p join public.profile_food_preferences f on f.profile_id=p.profile_id
 where p.room_id=r and f.schema_version=2 and f.completed_at is not null and private.s5_terms_for(p.profile_id)
 and f.catalog_version=private.s5_catalog() and private.s5_food_valid(f.catalog_version,f.preferences)
 ), weights as(select code,sum(1.0/greatest(cardinality(s.codes),1)) w from selections s cross join unnest(s.codes) code group by code)
 select coalesce(jsonb_object_agg(code,w),'{}') into result from weights;
 return result;
end; $$;
create function private.s5_request_valid(q private.recommendation_requests) returns void language plpgsql volatile security definer set search_path='' as $$
begin
 perform private.s5_room(q.room_id,q.caller_id,false);
 if (q.status<>'complete' and q.expires_at<=clock_timestamp()) or (q.status='complete' and q.result_expires_at<=clock_timestamp()) then raise exception 'RECOMMENDATION_EXPIRED' using errcode='S5004'; end if;
 if q.context_hash is distinct from private.s5_context(q.room_id) then raise exception 'RECOMMENDATION_CONTEXT_CHANGED' using errcode='S5003'; end if;
end; $$;

create function public.begin_room_recommendation_v2(p_room_id uuid,p_request_id uuid,p_purpose text)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare q private.recommendation_requests%rowtype; s public.room_recommendation_settings%rowtype; begin
 perform private.require_current_terms_consent();
 if p_request_id is null or p_room_id is null or p_purpose is null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 if p_purpose<>'places' then raise exception 'CLIENT_UPDATE_REQUIRED' using errcode='S1008'; end if;
 perform private.s5_room(p_room_id,auth.uid(),true); perform private.s5_lock_members(p_room_id);
 perform private.s5_room(p_room_id,auth.uid(),false);
 select * into q from private.recommendation_requests where request_id=p_request_id for update;
 if found then
  if q.caller_id is distinct from auth.uid() then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
  if q.room_id<>p_room_id or q.purpose<>p_purpose then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='S1007'; end if;
  perform private.s5_request_valid(q);
  if q.status='failed' then raise exception 'PLACE_PROVIDER_UNAVAILABLE' using errcode='S5006'; end if;
 else
  select * into s from public.room_recommendation_settings where room_id=p_room_id;
  if s.public_area_id is null or not exists(select 1 from public.public_meeting_areas where id=s.public_area_id and enabled) then raise exception 'LOCATION_SELECTION_REQUIRED' using errcode='S5002'; end if;
  if (select count(*) from private.recommendation_usage where caller_id=auth.uid() and created_at>clock_timestamp()-interval '1 minute')>=5
  or (select count(*) from private.recommendation_usage where caller_id=auth.uid() and created_at>clock_timestamp()-interval '1 day')>=100
  or (select count(*) from private.recommendation_requests where room_id=p_room_id and created_at>clock_timestamp()-interval '1 minute')>=30
  or (select count(*) from private.recommendation_requests where room_id=p_room_id and created_at>clock_timestamp()-interval '1 day')>=1000
  then raise exception 'RECOMMENDATION_RATE_LIMITED' using errcode='S5005'; end if;
  -- The caller profile is already locked; usage and the new ticket commit atomically.
  insert into private.recommendation_usage(caller_id) values(auth.uid());
  insert into private.recommendation_requests(request_id,caller_id,room_id,purpose,context_hash,expires_at)
  values(p_request_id,auth.uid(),p_room_id,p_purpose,private.s5_context(p_room_id),clock_timestamp()+interval '5 minutes') returning * into q;
 end if;
 return jsonb_build_object('contract_version',2,'request_id',q.request_id,'status',q.status,
 'valid_until',case when q.status='complete' then q.result_expires_at else q.expires_at end,'result',case when q.status='complete' then q.result end);
end; $$;
create function public.claim_recommendation_work_v2(p_request_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare q private.recommendation_requests%rowtype; area_json jsonb; weights jsonb; keywords jsonb; token uuid; begin
 perform private.s5_worker();
 select * into q from private.recommendation_requests where request_id=p_request_id;
 if not found then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 perform private.s5_room(q.room_id,q.caller_id,true); perform private.s5_lock_members(q.room_id);
 select * into q from private.recommendation_requests where request_id=p_request_id for update;
 if not found or q.status<>'pending' then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 perform private.s5_request_valid(q);
 weights:=private.s5_weights(q.room_id);
 select coalesce(jsonb_agg(key order by value::numeric desc,key),'[]') into keywords from(select key,value from jsonb_each_text(weights) order by value::numeric desc,key limit 5) x;
 select jsonb_build_object('id',a.id,'label',a.label,'latitude',a.latitude,'longitude',a.longitude,'radius_m',a.radius_m) into area_json
 from public.room_recommendation_settings s join public.public_meeting_areas a on a.id=s.public_area_id where s.room_id=q.room_id and a.enabled;
 if area_json is null then raise exception 'RECOMMENDATION_CONTEXT_CHANGED' using errcode='S5003'; end if;
 token:=gen_random_uuid();
 update private.recommendation_requests set status='working',work_token=token where request_id=p_request_id;
 return jsonb_build_object('contract_version',2,'request_id',p_request_id,'area',area_json,'keywords',keywords,'work_token',token);
end; $$;
-- Terminal Tmap failure: no automatic reuse of a claimed provider request.
create function public.fail_recommendation_work_v2(p_request_id uuid,p_work_token uuid)
returns void language plpgsql volatile security definer set search_path='' as $$
begin
 perform private.s5_worker();
 perform 1 from private.recommendation_requests where request_id=p_request_id and work_token=p_work_token and status in('working','failed') for update;
 if not found or p_work_token is null then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 update private.recommendation_requests set status='failed' where request_id=p_request_id;
end; $$;
create function private.s5_distance(a double precision,b double precision,c double precision,d double precision)
returns double precision language sql immutable set search_path='' as $$
 select 6371000.0*2*asin(sqrt(least(1.0,power(sin(radians(c-a)/2),2)+cos(radians(a))*cos(radians(c))*power(sin(radians(d-b)/2),2))))
$$;
create function public.finalize_recommendation_work_v2(p_request_id uuid,p_work_token uuid,p_candidates jsonb,p_model_ranking jsonb,p_source text)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare q private.recommendation_requests%rowtype; area_row public.public_meeting_areas%rowtype; p jsonb; ids text[]:='{}'; rankings text[]; weights jsonb; recommendations jsonb; response jsonb; expiry timestamptz; begin
 perform private.s5_worker();
 select * into q from private.recommendation_requests where request_id=p_request_id;
 if not found then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 perform private.s5_room(q.room_id,q.caller_id,true); perform private.s5_lock_members(q.room_id);
 select * into q from private.recommendation_requests where request_id=p_request_id for update;
 if not found or q.status<>'working' or p_work_token is null or q.work_token is distinct from p_work_token then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 perform private.s5_request_valid(q);
 if p_source is null or p_source not in('gemini','rules') or p_candidates is null or jsonb_typeof(p_candidates)<>'object'
 or (select count(*) from jsonb_object_keys(p_candidates))<>1 or not p_candidates?'places'
 or jsonb_typeof(p_candidates->'places')<>'array' or jsonb_array_length(p_candidates->'places')>12
 or p_model_ranking is null or jsonb_typeof(p_model_ranking)<>'array' or octet_length(p_candidates::text)>32768 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 select a.* into area_row from public.room_recommendation_settings s join public.public_meeting_areas a on a.id=s.public_area_id where s.room_id=q.room_id and a.enabled;
 for p in select value from jsonb_array_elements(p_candidates->'places') loop
  if jsonb_typeof(p)<>'object' or (select count(*) from jsonb_object_keys(p))<>6 or not p ?& array['id','name','address','latitude','longitude','cuisine_codes']
  or jsonb_typeof(p->'id')<>'string' or p->>'id' !~ '^[A-Za-z0-9_-]{1,80}$'
  or jsonb_typeof(p->'name')<>'string' or char_length(p->>'name') not between 1 and 160
  or jsonb_typeof(p->'address')<>'string' or char_length(p->>'address')>300
  or jsonb_typeof(p->'latitude')<>'number' or jsonb_typeof(p->'longitude')<>'number'
  or jsonb_typeof(p->'cuisine_codes')<>'array' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  if (p->>'latitude')::double precision not between -90 and 90 or (p->>'longitude')::double precision not between -180 and 180
  or private.s5_distance(area_row.latitude,area_row.longitude,(p->>'latitude')::double precision,(p->>'longitude')::double precision)>area_row.radius_m
  or not private.s5_codes(private.s5_catalog(),'cuisine',array(select jsonb_array_elements_text(p->'cuisine_codes'))) then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p->'cuisine_codes') c where jsonb_typeof(c)<>'string') then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  ids:=array_append(ids,p->>'id');
 end loop;
 if cardinality(ids)<>(select count(distinct x) from unnest(ids) x)
 or exists(select 1 from jsonb_array_elements(p_model_ranking) x where jsonb_typeof(x)<>'string') then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 rankings:=array(select jsonb_array_elements_text(p_model_ranking));
 if cardinality(rankings)<>cardinality(ids) or cardinality(rankings)<>(select count(distinct x) from unnest(rankings) x)
 or exists(select 1 from unnest(ids) x where not x=any(rankings)) then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 weights:=private.s5_weights(q.room_id);
 with scored as (
 select p.value obj,coalesce((select sum(coalesce((weights->>code)::numeric,0)) from jsonb_array_elements_text(p.value->'cuisine_codes') code),0) score,
 array_position(rankings,p.value->>'id') model_rank
 from jsonb_array_elements(p_candidates->'places') p
 ), picked as(select obj,row_number() over(order by score desc,model_rank,obj->>'id') rank from scored order by score desc,model_rank,obj->>'id' limit 3)
 select coalesce(jsonb_agg(jsonb_build_object('place_id',obj->>'id','menu_id',null,'place',jsonb_build_object('name',obj->>'name','address',obj->>'address','latitude',obj->'latitude','longitude',obj->'longitude'),
 'rank',rank,'reason_code','PUBLIC_AREA_RECOMMENDATION','evidence_status','unverified') order by rank),'[]') into recommendations from picked;
 expiry:=clock_timestamp()+interval '60 seconds';
 if exists(select 1 from public.rooms where id=q.room_id and expires_at<=expiry) then raise exception 'RECOMMENDATION_CONTEXT_CHANGED' using errcode='S5003'; end if;
 response:=jsonb_build_object('contract_version',2,'request_id',q.request_id,'valid_until',expiry,'source',p_source,
 'area',jsonb_build_object('id',area_row.id,'label',area_row.label,'latitude',area_row.latitude,'longitude',area_row.longitude,'radius_m',area_row.radius_m),
 'places_status',case when jsonb_array_length(recommendations)=0 then 'empty' else 'ready' end,'slots_status','not_requested',
 'place_recommendations',recommendations,'slot_recommendations','[]'::jsonb,'my_health_filter','not_requested');
 update private.recommendation_requests set status='complete',result=response,result_expires_at=expiry where request_id=p_request_id;
 return response;
end; $$;
create function public.validate_my_recommendation_v2(p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare q private.recommendation_requests%rowtype; begin
 perform private.require_current_terms_consent();
 select * into q from private.recommendation_requests where request_id=p_request_id and caller_id=auth.uid();
 if not found then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 -- Point-in-time read: no room advisory lock, member locks or ticket write lock.
 perform private.s5_request_valid(q);
 if q.status<>'complete' then raise exception 'RECOMMENDATION_CONTEXT_CHANGED' using errcode='S5003'; end if;
 return jsonb_build_object('contract_version',2,'status','valid','valid_until',q.result_expires_at);
end; $$;
create function public.cleanup_recommendation_requests_v2(p_limit integer default 1000)
returns integer language plpgsql volatile security definer set search_path='' as $$
declare n integer; m integer; begin
 perform private.s5_worker();
 if p_limit is null or p_limit<1 or p_limit>10000 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 with gone as(select request_id from private.recommendation_requests where created_at<clock_timestamp()-interval '24 hours' order by created_at limit p_limit for update skip locked)
 delete from private.recommendation_requests r using gone where r.request_id=gone.request_id;
 get diagnostics n=row_count;
 with gone as(select id from private.recommendation_usage where created_at<clock_timestamp()-interval '24 hours' order by created_at,id limit (p_limit-n) for update skip locked)
 delete from private.recommendation_usage u using gone where u.id=gone.id;
 get diagnostics m=row_count; return n+m;
end; $$;
revoke all on function private.s5_worker(),private.s5_lock_members(uuid),private.s5_context(uuid),private.s5_weights(uuid),private.s5_request_valid(private.recommendation_requests),
private.s5_distance(double precision,double precision,double precision,double precision),
public.begin_room_recommendation_v2(uuid,uuid,text),public.claim_recommendation_work_v2(uuid),
public.fail_recommendation_work_v2(uuid,uuid),public.finalize_recommendation_work_v2(uuid,uuid,jsonb,jsonb,text),public.validate_my_recommendation_v2(uuid),public.cleanup_recommendation_requests_v2(integer)
from public,anon,authenticated,service_role;
grant execute on function public.begin_room_recommendation_v2(uuid,uuid,text),public.validate_my_recommendation_v2(uuid) to authenticated;
grant execute on function public.claim_recommendation_work_v2(uuid),public.fail_recommendation_work_v2(uuid,uuid),public.finalize_recommendation_work_v2(uuid,uuid,jsonb,jsonb,text),public.cleanup_recommendation_requests_v2(integer) to service_role;
commit;
