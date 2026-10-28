-- Aggregate attendance preview, sharing the exact range validation with the writer.
begin;
create function private.s4_time_keys(value jsonb,expiry timestamptz,t timestamptz) returns text[]
language plpgsql stable set search_path='' as $$
declare st timestamptz:=(value->>'starts_at')::timestamptz; en timestamptz:=(value->>'ends_at')::timestamptz;
 a timestamp; b timestamp; keys text[]; begin
 if value is null then raise exception 'MEETING_TIME_REQUIRED' using errcode='S4007'; end if;
 a:=st at time zone 'Asia/Seoul'; b:=en at time zone 'Asia/Seoul';
 if st is null or en is null or not isfinite(st) or not isfinite(en) or st<=t or en>expiry or en<=st or a::date<>b::date
 or extract(hour from a)<11 or extract(hour from b)>21 or date_trunc('hour',a)<>a or date_trunc('hour',b)<>b
 or en-st<interval '1 hour' then raise exception 'MEETING_TIME_INVALID' using errcode='S4006'; end if;
 select array_agg(to_char(k at time zone 'Asia/Seoul','YYYY-MM-DD')||'-'||extract(hour from k at time zone 'Asia/Seoul')::integer order by k)
 into keys from generate_series(st,en-interval '1 hour',interval '1 hour') k;
 return keys;
end; $$;
revoke all on function private.s4_time_keys(jsonb,timestamptz,timestamptz) from public,anon,authenticated,service_role;

create or replace function private.s4_assert_time(r uuid,value jsonb) returns void
language plpgsql volatile security definer set search_path='' as $$
declare expiry timestamptz; keys text[]; t timestamptz:=clock_timestamp(); begin
 select expires_at into expiry from public.rooms where id=r;
 keys:=private.s4_time_keys(value,expiry,t);
 if not exists(select 1 from public.participants p where p.room_id=r and p.profile_id is not null and keys<@private.s4_slots(p.schedule,expiry,t))
 then raise exception 'MEETING_TIME_INVALID' using errcode='S4006'; end if;
end; $$;
revoke all on function private.s4_assert_time(uuid,jsonb) from public,anon,authenticated,service_role;

create function public.preview_room_meeting_time_v1(p_room_id uuid,p_starts_at text,p_ends_at text,p_time_zone text) returns jsonb
language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare x public.rooms%rowtype; value jsonb; keys text[]; t timestamptz:=clock_timestamp(); eligible bigint; available bigint; begin
 -- Shared read boundary enforces current consent, expiry and actual membership without locks.
 x:=private.s4_read_room(p_room_id);
 value:=private.s4_parse_time(jsonb_build_object('starts_at',p_starts_at,'ends_at',p_ends_at,'time_zone',p_time_zone));
 keys:=private.s4_time_keys(value,x.expires_at,t);
 select count(*),count(*) filter(where keys<@private.s4_slots(p.schedule,x.expires_at,t)) into eligible,available
 from public.participants p where p.room_id=p_room_id and p.profile_id is not null;
 return jsonb_build_object('eligible_count',eligible,'available_count',available,'all_available',eligible>0 and eligible=available,'revision',x.s4_revision::text);
end; $$;
revoke all on function public.preview_room_meeting_time_v1(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.preview_room_meeting_time_v1(uuid,text,text,text) to authenticated;
commit;
