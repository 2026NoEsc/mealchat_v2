-- S4 M2: private decision core and disabled endpoints. M3 alone activates the contract.
begin;
create function private.s4_iso(t timestamptz) returns text language sql stable set search_path='' as $$
 select to_char(t at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
$$;
create function private.s4_slot_start(k text) returns timestamptz language plpgsql stable set search_path='' as $$
declare d date; h integer; begin
 if k is null or k !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}-(1[1-9]|20)$' then return null; end if;
 begin d:=left(k,10)::date; h:=substring(k from 12)::integer;
 exception when others then return null; end;
 if to_char(d,'YYYY-MM-DD')<>left(k,10) then return null; end if;
 return (d+make_interval(hours=>h)) at time zone 'Asia/Seoul';
end; $$;
create function private.s4_slots(s jsonb,expiry timestamptz,t timestamptz) returns text[] language sql stable set search_path='' as $$
 select coalesce(array_agg(distinct x.v order by x.v),'{}'::text[]) from (
 select value#>>'{}' v from jsonb_array_elements(case when jsonb_typeof(s->'slots')='array' then s->'slots' else '[]'::jsonb end) value where jsonb_typeof(value)='string'
 ) x where private.s4_slot_start(x.v)>t and private.s4_slot_start(x.v)+interval '1 hour'<=expiry
$$;
create function private.s4_normalize_slots(keys text[]) returns text[] language plpgsql stable set search_path='' as $$
begin
 if keys is null or coalesce(array_ndims(keys),1)<>1 or octet_length(to_jsonb(keys)::text)>8192 or cardinality(keys)>500 or array_position(keys,null) is not null
 or cardinality(keys)<>(select count(distinct k) from unnest(keys) k) or exists(select 1 from unnest(keys) k where private.s4_slot_start(k) is null)
 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 return array(select k from unnest(keys) k order by k);
end; $$;
create function private.s4_parse_time(value jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare a text; b text; st timestamptz; en timestamptz; pattern text:='^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,6})?(Z|[+-]((0[0-9]|1[0-3]):[0-5][0-9]|14:00))$'; begin
 if value is null or value='null'::jsonb then return null; end if;
 if jsonb_typeof(value)<>'object' or octet_length(value::text)>8192 or (select count(*) from jsonb_object_keys(value))<>3
 or not value ?& array['starts_at','ends_at','time_zone'] or value->>'time_zone' is distinct from 'Asia/Seoul'
 or jsonb_typeof(value->'starts_at')<>'string' or jsonb_typeof(value->'ends_at')<>'string'
 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 a:=value->>'starts_at'; b:=value->>'ends_at';
 if a !~ pattern or b !~ pattern then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 begin
  perform left(a,10)::date; perform left(b,10)::date;
  st:=a::timestamptz; en:=b::timestamptz;
 exception when others then raise exception 'INVALID_INPUT' using errcode='22023'; end;
 return jsonb_build_object('starts_at',private.s4_iso(st),'ends_at',private.s4_iso(en),'time_zone','Asia/Seoul');
end; $$;
create function private.s4_room(r uuid,owner_only boolean default false) returns public.rooms language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare x public.rooms%rowtype; begin
 perform private.require_current_terms_consent();
 if not exists(select 1 from public.rooms a join public.participants p on p.room_id=a.id where a.id=r and p.profile_id=auth.uid() and a.expires_at>clock_timestamp()) then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(r::text,0));
 select * into x from public.rooms where id=r for update;
 if not found then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 -- Room serialization precedes every profile/participant/ledger lock. Sorted profiles agree with S5.
 perform 1 from public.profiles p where exists(select 1 from public.participants m where m.room_id=r and m.profile_id=p.id) order by p.id for update;
 perform private.require_current_terms_consent();
 if x.expires_at<=clock_timestamp() or not exists(select 1 from public.participants where room_id=r and profile_id=auth.uid())
 or (owner_only and x.owner_id is distinct from auth.uid()) then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 return x;
end; $$;
-- Read endpoints share their outer statement snapshot and acquire no advisory/row locks.
create function private.s4_read_room(r uuid) returns public.rooms language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare x public.rooms%rowtype; begin
 perform private.require_current_terms_consent();
 select * into x from public.rooms where id=r;
 if not found or x.expires_at<=clock_timestamp() or not exists(select 1 from public.participants where room_id=r and profile_id=auth.uid()) then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 return x;
end; $$;
create function private.s4_label(value text) returns text language plpgsql immutable set search_path='' as $$
declare normalized text; begin
 if value is null or value ~ '[[:cntrl:]]' or value ~ U&'[\200B-\200C\200E-\200F\202A-\202E\2060-\2064\FEFF]' then raise exception 'CANDIDATE_LABEL_INVALID' using errcode='S4002'; end if;
 normalized:=regexp_replace(value,'^[[:space:]]+|[[:space:]]+$','','g');
 if char_length(normalized) not between 1 and 120 or regexp_replace(normalized,U&'[[:space:]\3164\115F\1160\2800\00AD\034F\200D]','','g')='' then raise exception 'CANDIDATE_LABEL_INVALID' using errcode='S4002'; end if;
 return normalized;
end; $$;
create function private.s4_availability(r uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare expiry timestamptz; t timestamptz:=clock_timestamp(); n integer; done integer; members jsonb; mine text[]; other_keys text[]; begin
 select expires_at into expiry from public.rooms where id=r;
 select count(*) filter(where profile_id is not null),count(*) filter(where profile_id is not null and cardinality(private.s4_slots(schedule,expiry,t))>0),
 coalesce(jsonb_agg(jsonb_build_object('participant_id',id,'name',name,'avatar_color',coalesce(avatar_color,''),'eligible',profile_id is not null,'submitted',profile_id is not null and cardinality(private.s4_slots(schedule,expiry,t))>0) order by created_at,id),'[]') into n,done,members from public.participants where room_id=r;
 select private.s4_slots(schedule,expiry,t) into mine from public.participants where room_id=r and profile_id=auth.uid();
 select coalesce(array_agg(distinct k order by k),'{}') into other_keys from public.participants p cross join lateral unnest(private.s4_slots(p.schedule,expiry,t)) k where p.room_id=r and p.profile_id is not null and p.profile_id<>auth.uid();
 return jsonb_build_object('eligible_count',n,'submitted_count',done,'all_submitted',n>0 and n=done,'members',members,'my_slots',coalesce(mine,'{}'::text[]),'others_slots',other_keys);
end; $$;
create function private.s4_leader(r uuid) returns jsonb language sql stable security definer set search_path='' as $$
 with candidates as(
 select item->>'id' id,ord,(select count(*) from public.participants p where p.room_id=r and p.profile_id is not null and coalesce(p.voted_items,'[]')?(item->>'id')) votes
 from public.rooms a cross join lateral jsonb_array_elements(coalesce(a.voting_items,'[]')) with ordinality v(item,ord)
 where a.id=r and item->>'kind'='menu' and item->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 ),winner as(select * from candidates order by votes desc,ord limit 1),eligible as(select count(*) n from public.participants where room_id=r and profile_id is not null)
 select jsonb_build_object('eligible_count',n,'leading_item_id',case when coalesce(w.votes,0)>0 then w.id end,'leading_votes',coalesce(w.votes,0),'required_votes',n/2+1) from eligible left join winner w on true
$$;
create function private.s4_assert_time(r uuid,value jsonb) returns void language plpgsql volatile security definer set search_path='' as $$
declare st timestamptz:=(value->>'starts_at')::timestamptz; en timestamptz:=(value->>'ends_at')::timestamptz; expiry timestamptz; a timestamp; b timestamp; keys text[]; t timestamptz:=clock_timestamp(); begin
 if value is null then raise exception 'MEETING_TIME_REQUIRED' using errcode='S4007'; end if;
 select expires_at into expiry from public.rooms where id=r;
 a:=st at time zone 'Asia/Seoul'; b:=en at time zone 'Asia/Seoul';
 if st is null or en is null or not isfinite(st) or not isfinite(en) or st<=t or en>expiry or en<=st or a::date<>b::date
 or extract(hour from a)<11 or extract(hour from b)>21 or date_trunc('hour',a)<>a or date_trunc('hour',b)<>b
 or en-st<interval '1 hour' then raise exception 'MEETING_TIME_INVALID' using errcode='S4006'; end if;
 select array_agg(to_char(k at time zone 'Asia/Seoul','YYYY-MM-DD')||'-'||extract(hour from k at time zone 'Asia/Seoul')::integer order by k) into keys from generate_series(st,en-interval '1 hour',interval '1 hour') k;
 if not exists(select 1 from public.participants p where p.room_id=r and p.profile_id is not null and keys<@private.s4_slots(p.schedule,expiry,t)) then raise exception 'MEETING_TIME_INVALID' using errcode='S4006'; end if;
end; $$;
create function private.s4_state(r uuid) returns jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare x public.rooms%rowtype; a jsonb; v jsonb; mt jsonb; begin
 select * into x from public.rooms where id=r;
 a:=private.s4_availability(r); v:=private.s4_leader(r);
 mt:=case when x.meeting_starts_at is not null then jsonb_build_object('starts_at',private.s4_iso(x.meeting_starts_at),'ends_at',private.s4_iso(x.meeting_ends_at),'time_zone',x.meeting_time_zone) end;
 return jsonb_build_object('contract_version',1,'room_id',r,'revision',x.s4_revision::text,'stage',x.stage,'server_time',private.s4_iso(clock_timestamp()),
 'meeting_time',mt,'time_status',case when mt is not null then 'selected' when x.confirmed_slot is not null then 'legacy_unverified' else 'unset' end,
 'legacy_time_label',case when mt is null then x.confirmed_slot end,
 'restaurant',case when x.confirmed_menu is not null then jsonb_build_object('item_id',x.confirmed_menu_item_id,'label',x.confirmed_menu) end,
 'confirmation_status',case when x.appointment_confirmed_at is not null then 'owner_confirmed' when x.stage in('settling','done') then 'legacy_settlement_unverified' when x.stage='confirmed' then 'legacy_confirmed' when x.stage='place' and x.confirmed_menu is not null then 'legacy_partial' else 'none' end,
 'availability',a,'voting',v,
 'permissions',jsonb_build_object('can_submit',x.stage='scheduling' or (x.stage='place' and x.meeting_starts_at is null and x.appointment_confirmed_at is null),'can_select_time',coalesce(x.owner_id=auth.uid(),false) and x.stage in('scheduling','place'),'can_confirm',coalesce(x.owner_id=auth.uid(),false) and x.stage='place' and mt is not null and x.meeting_starts_at>clock_timestamp() and x.meeting_ends_at<=x.expires_at and (v->>'leading_votes')::integer>=(v->>'required_votes')::integer));
end; $$;
create function private.s4_submit_core(r uuid,keys text[]) returns void language plpgsql volatile security definer set search_path='' as $$
declare x public.rooms%rowtype; expiry timestamptz; t timestamptz:=clock_timestamp(); current_keys jsonb; begin
 select * into x from public.rooms where id=r;
 if not (x.stage='scheduling' or (x.stage='place' and x.meeting_starts_at is null and x.appointment_confirmed_at is null)) then raise exception 'ROOM_STAGE_CONFLICT' using errcode='S4003'; end if;
 if exists(select 1 from unnest(keys) k where private.s4_slot_start(k)<=t or private.s4_slot_start(k)+interval '1 hour'>x.expires_at) then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 select schedule->'slots' into current_keys from public.participants where room_id=r and profile_id=auth.uid();
 if current_keys is distinct from to_jsonb(keys) then
 update public.participants set schedule=jsonb_build_object('slots',keys,'submitted_at',private.s4_iso(t)) where room_id=r and profile_id=auth.uid();
 end if;
end; $$;
create function private.s4_select_core(r uuid,value jsonb) returns void language plpgsql volatile security definer set search_path='' as $$
declare x public.rooms%rowtype; begin
 select * into x from public.rooms where id=r;
 if x.stage not in('scheduling','place') then raise exception 'ROOM_STAGE_CONFLICT' using errcode='S4003'; end if;
 if x.stage='scheduling' and (private.s4_availability(r)->>'all_submitted')::boolean is not true then raise exception 'AVAILABILITY_INCOMPLETE' using errcode='S4004'; end if;
 if value is null then
  if x.stage<>'scheduling' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  update public.rooms set stage='place',is_confirmed=false where id=r;
 else
  perform private.s4_assert_time(r,value);
  update public.rooms set meeting_starts_at=(value->>'starts_at')::timestamptz,meeting_ends_at=(value->>'ends_at')::timestamptz,meeting_time_zone='Asia/Seoul',
   meeting_date=((value->>'starts_at')::timestamptz at time zone 'Asia/Seoul')::date,confirmed_slot=private.s4_iso((value->>'starts_at')::timestamptz),confirmed_time_item_id=null,stage='place',is_confirmed=false where id=r;
 end if;
end; $$;
create function private.s4_confirm_core(r uuid,item_id uuid) returns void language plpgsql volatile security definer set search_path='' as $$
declare x public.rooms%rowtype; item jsonb; v jsonb; label text; begin
 select * into x from public.rooms where id=r;
 if x.appointment_confirmed_at is not null then
  if x.confirmed_menu_item_id=item_id then return; end if;
  raise exception 'APPOINTMENT_ALREADY_CONFIRMED' using errcode='S4009';
 end if;
 if x.stage<>'place' then raise exception 'ROOM_STAGE_CONFLICT' using errcode='S4003'; end if;
 if x.meeting_starts_at is null then raise exception 'MEETING_TIME_REQUIRED' using errcode='S4007'; end if;
 perform private.s4_assert_time(r,jsonb_build_object('starts_at',private.s4_iso(x.meeting_starts_at),'ends_at',private.s4_iso(x.meeting_ends_at),'time_zone',x.meeting_time_zone));
 select value into item from jsonb_array_elements(coalesce(x.voting_items,'[]')) value where value->>'id'=item_id::text and value->>'kind'='menu' limit 1;
 v:=private.s4_leader(r);
 if item is null or v->>'leading_item_id' is distinct from item_id::text or (v->>'leading_votes')::integer<(v->>'required_votes')::integer then raise exception 'VOTE_REQUIREMENT_NOT_MET' using errcode='S4008',hint='operation=vote_confirmation'; end if;
 label:=private.s4_label(item->>'label');
 update public.rooms set confirmed_menu_item_id=item_id,confirmed_menu=label,confirmed_menu_at=clock_timestamp(),location_name=label,stage='confirmed',is_confirmed=true,appointment_confirmed_at=clock_timestamp(),appointment_confirmed_by=auth.uid() where id=r;
 insert into public.messages(room_id,sender_id,sender_name,sender_color,message,kind,event_key)
 values(r,null,'밀챗','#FF9900',format('약속을 확정했어요 · %s ~ %s (한국 시간) · %s',to_char(x.meeting_starts_at at time zone 'Asia/Seoul','YYYY-MM-DD HH24:MI'),to_char(x.meeting_ends_at at time zone 'Asia/Seoul','HH24:MI'),label),'system','appointment-confirmed:'||r::text)
 on conflict do nothing;
end; $$;
create function private.s4_execute(op text,r uuid,arg jsonb,expected bigint,request uuid) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare x public.rooms%rowtype; normalized jsonb; digest text; previous private.s4_requests%rowtype; applied bigint; result jsonb; begin
 x:=private.s4_room(r,op<>'submit');
 if request is null or expected is null or expected<0 or arg is null or octet_length(arg::text)>8192 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 normalized:=case op when 'select' then coalesce(private.s4_parse_time(arg),'null'::jsonb) when 'submit' then to_jsonb(private.s4_normalize_slots(array(select jsonb_array_elements_text(arg)))) else arg end;
 digest:=encode(extensions.digest(convert_to(jsonb_build_object('operation',op,'payload',normalized,'revision',expected)::text,'UTF8'),'sha256'),'hex');
 select * into previous from private.s4_requests where actor_id=auth.uid() and request_id=request;
 if found then
  if previous.room_id<>r or previous.operation<>op or previous.payload_hash<>digest then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='S1007'; end if;
  return jsonb_build_object('contract_version',1,'outcome','replayed','applied_revision',previous.applied_revision::text,'state',private.s4_state(r));
 end if;
 if x.s4_revision<>expected then raise exception 'ROOM_REVISION_CONFLICT' using errcode='S4005'; end if;
 -- A validated no-op does not retain a request ID or consume ledger capacity.
 -- Still enforce stage/time restrictions; CAS and retained-ID conflicts were checked above.
 if op='submit' and (select schedule->'slots' from public.participants where room_id=r and profile_id=auth.uid())=normalized then
  perform private.s4_submit_core(r,array(select jsonb_array_elements_text(normalized)));
  return jsonb_build_object('contract_version',1,'outcome','applied','applied_revision',x.s4_revision::text,'state',private.s4_state(r));
 end if;
 -- Room/profile locks serialize submit budgets. Owner decisions cannot be exhausted by submissions.
 -- No participant maximum exists: scale room capacity with the current real membership (floor five).
 if op='submit' and ((select count(*) from private.s4_requests where actor_id=auth.uid() and operation='submit')>=1000
 or (select count(*) from private.s4_requests where room_id=r and operation='submit')>=1000*greatest(5::bigint,(select count(*) from public.participants where room_id=r and profile_id is not null))) then
  raise exception 'REQUEST_LIMIT_REACHED' using errcode='S4011';
 end if;
 if op='submit' then perform private.s4_submit_core(r,array(select jsonb_array_elements_text(normalized)));
 elsif op='select' then perform private.s4_select_core(r,case when normalized='null' then null else normalized end);
 elsif op='confirm' then perform private.s4_confirm_core(r,(normalized#>>'{}')::uuid);
 else raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 select s4_revision into applied from public.rooms where id=r;
 -- Owner no-ops pass authorization, CAS and core validation but retain no request ID.
 if op in('select','confirm') and applied=x.s4_revision then
  return jsonb_build_object('contract_version',1,'outcome','applied','applied_revision',applied::text,'state',private.s4_state(r));
 end if;
 insert into private.s4_requests(actor_id,request_id,room_id,operation,payload_hash,applied_revision) values(auth.uid(),request,r,op,digest,applied) on conflict do nothing;
 if not found then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='S1007'; end if;
 return jsonb_build_object('contract_version',1,'outcome','applied','applied_revision',applied::text,'state',private.s4_state(r));
end; $$;
create function public.get_room_s4_state(p_room_id uuid) returns jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
begin perform private.s4_read_room(p_room_id); return private.s4_state(p_room_id); end; $$;
create function public.submit_room_availability_v1(p_room_id uuid,p_slot_keys text[],p_expected_revision bigint,p_request_id uuid) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
begin
 return private.s4_execute('submit',p_room_id,to_jsonb(p_slot_keys),p_expected_revision,p_request_id);
end; $$;
create function public.select_room_meeting_time_v1(p_room_id uuid,p_time jsonb,p_expected_revision bigint,p_request_id uuid) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
begin return private.s4_execute('select',p_room_id,coalesce(p_time,'null'::jsonb),p_expected_revision,p_request_id); end; $$;
create function public.confirm_room_appointment_v1(p_room_id uuid,p_restaurant_item_id uuid,p_expected_revision bigint,p_request_id uuid) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
begin
 return private.s4_execute('confirm',p_room_id,to_jsonb(p_restaurant_item_id::text),p_expected_revision,p_request_id);
end; $$;
-- Trusted migration catalog only; no runtime dynamic SQL in any endpoint/helper.
do $$ declare f record; begin for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 's4_%' loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.oid::regprocedure); end loop; end; $$;
revoke all on function public.get_room_s4_state(uuid),public.submit_room_availability_v1(uuid,text[],bigint,uuid),public.select_room_meeting_time_v1(uuid,jsonb,bigint,uuid),public.confirm_room_appointment_v1(uuid,uuid,bigint,uuid) from public,anon,authenticated,service_role;
commit;
