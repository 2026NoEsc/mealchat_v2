-- S3 M3: authenticated actor limiter, opaque previews and private invite core.
begin;
create function private.s3_code_digest(code text) returns text language sql immutable set search_path='' as $$
 select encode(extensions.digest(convert_to(code,'UTF8'),'sha256'),'hex')
$$;
create function private.s3_random_code() returns text language plpgsql volatile set search_path='' as $$
declare bytes bytea:=extensions.gen_random_bytes(6); code text:=''; i integer; begin
 -- Exactly 32 symbols: each independent byte modulo 32 has no bias.
 for i in 0..5 loop code:=code||substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',get_byte(bytes,i)%32+1,1); end loop;
 return code;
end; $$;
create function private.s3_issue_code(r uuid,initial boolean default false) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare x public.rooms%rowtype; v_code text; generation bigint; t timestamptz:=clock_timestamp(); expiry timestamptz; i integer; begin
 select * into x from public.rooms where id=r;
 if x.stage in('settling','done') then raise exception 'ROOM_MEMBERSHIP_CLOSED' using errcode='S4003',hint='operation=membership'; end if;
 -- Generation one is initial issuance, not a user-requested rotation.
 if not initial and (exists(select 1 from private.s3_invite_codes c where c.room_id=r and c.generation>1 and c.issued_at>t-interval '1 minute')
  or (select count(*) from private.s3_invite_codes c where c.room_id=r and c.generation>1 and c.issued_at>t-interval '24 hours')>=10)
 then raise exception 'INVITE_ROTATION_LIMITED' using errcode='S3005'; end if;
 select coalesce(max(c.generation),0)+1 into generation from private.s3_invite_codes c where c.room_id=r;
 expiry:=least(t+interval '7 days',x.expires_at);
 for i in 1..16 loop
  v_code:=private.s3_random_code();
  if exists(select 1 from private.s3_invite_codes c where c.room_id=r and c.code_digest=private.s3_code_digest(v_code)) then continue; end if;
  begin
   update private.s3_invite_codes set retired_at=t where room_id=r and retired_at is null;
   update public.rooms set code=v_code,s4_revision=s4_revision+case when initial then 0 else 1 end where id=r;
   insert into private.s3_invite_codes(room_id,generation,code_digest,issued_at,expires_at) values(r,generation,private.s3_code_digest(v_code),t,expiry);
   return jsonb_build_object('code',v_code,'generation',generation::text,'expires_at',private.s4_iso(expiry));
  exception when unique_violation then null;
  end;
 end loop;
 raise exception 'INVITE_CODE_GENERATION_FAILED' using errcode='54000';
end; $$;
create function public.rotate_room_invite_code_v1(p_room_id uuid,p_expected_revision bigint,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare x public.rooms%rowtype; payload jsonb; prior jsonb; result jsonb; begin
 x:=private.s4_room(p_room_id,true); payload:=jsonb_build_object('room',p_room_id,'expected',p_expected_revision);
 prior:=private.s3_previous('rotate',payload,p_request_id); if prior is not null then return prior; end if;
 if p_expected_revision is null or p_expected_revision<>x.s4_revision then raise exception 'ROOM_REVISION_CONFLICT' using errcode='S4005'; end if;
 result:=private.s3_issue_code(x.id);
 result:=private.s3_result(x.id)||jsonb_build_object('invite',result);
 -- A replay never stores a second plaintext code: retrieve current projection only
 -- after membership/ownership verification on the next request.
 perform private.s3_remember(x.id,'rotate',payload,p_request_id,result-'invite');
 return result;
end; $$;
create function private.s3_rate_reserve() returns timestamptz language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid(); t timestamptz; limits private.s3_invite_limits%rowtype; retry timestamptz; begin
 perform private.require_current_terms_consent();
 if a is null then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 -- Never acquire the new row's profile FK KEY SHARE before the room lock.
 set constraints private.s3_invite_limits_actor_id_fkey deferred;
 -- Shared across preview/join/legacy code join and all devices/rooms/codes.
 perform pg_advisory_xact_lock(hashtextextended('s3-rate:'||a,0)); t:=clock_timestamp();
 insert into private.s3_invite_limits(actor_id,failure_window,minute_window,day_window,updated_at) values(a,t,t,t,t) on conflict do nothing;
 select * into limits from private.s3_invite_limits where actor_id=a for update;
 if limits.lock_until>t then return limits.lock_until; end if;
 if limits.failure_window<=t-interval '15 minutes' then limits.failure_window:=t; limits.failure_count:=0; end if;
 if limits.minute_window<=t-interval '1 minute' then limits.minute_window:=t; limits.minute_count:=0; end if;
 if limits.day_window<=t-interval '24 hours' then limits.day_window:=t; limits.day_count:=0; end if;
 if limits.minute_count>=30 then retry:=limits.minute_window+interval '1 minute'; end if;
 if limits.day_count>=200 then retry:=greatest(retry,limits.day_window+interval '24 hours'); end if;
 if retry is not null then return retry; end if;
 update private.s3_invite_limits set failure_window=limits.failure_window,failure_count=limits.failure_count,
  minute_window=limits.minute_window,minute_count=limits.minute_count+1,day_window=limits.day_window,day_count=limits.day_count+1,
  lock_until=null,updated_at=t where actor_id=a;
 return null;
end; $$;
create function private.s3_invite_rejected(reason text default 'INVITE_UNAVAILABLE',retry timestamptz default null,count_failure boolean default true)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare t timestamptz:=clock_timestamp(); locked timestamptz; begin
 if count_failure then
  update private.s3_invite_limits set failure_count=failure_count+1,updated_at=t,
   lock_until=case when failure_count+1>=5 then t+interval '15 minutes' else lock_until end
  where actor_id=auth.uid() returning lock_until into locked;
  if locked>t then retry:=locked; reason:='INVITE_RATE_LIMITED'; end if;
 end if;
 return jsonb_build_object('contract_version',1,'outcome','rejected','reason',reason,'retry_at',case when retry is not null then private.s4_iso(retry) end,'server_time',private.s4_iso(t));
end; $$;
create function private.s3_normalize_code(code text) returns text language sql immutable set search_path='' as $$
 select case when octet_length(code)<=64 and upper(btrim(code)) ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$' then upper(btrim(code)) end
$$;
create function public.preview_room_invite_v1(p_code text) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare v_code text; retry timestamptz; x public.rooms%rowtype; c private.s3_invite_codes%rowtype; preview uuid; snap record; members integer; t timestamptz; title text; begin
 retry:=private.s3_rate_reserve(); if retry is not null then return private.s3_invite_rejected('INVITE_RATE_LIMITED',retry,false); end if;
 v_code:=private.s3_normalize_code(p_code);
 -- One statement snapshot for room/member projection. This RPC is VOLATILE:
 -- actor limiter and preview ledger writes must commit even on expected rejection.
 select to_jsonb(r) as room,count(p.profile_id)::integer as members into snap from public.rooms r
 left join public.participants p on p.room_id=r.id where r.code=v_code group by r.id;
 x:=jsonb_populate_record(null::public.rooms,snap.room); members:=snap.members;
 if x.id is null or x.expires_at<=clock_timestamp() or x.stage in('settling','done') then return private.s3_invite_rejected(); end if;
 select * into c from private.s3_invite_codes where room_id=x.id and retired_at is null and code_digest=private.s3_code_digest(v_code);
 if not found or c.expires_at<=clock_timestamp() then return private.s3_invite_rejected(); end if;
 t:=clock_timestamp(); title:=left(regexp_replace(x.title,U&'[[:cntrl:]\200B-\200F\202A-\202E\2060-\2064\FEFF]','','g'),120);
 insert into private.s3_invite_previews(actor_id,room_id,generation,display_revision,created_at,expires_at)
 values(auth.uid(),x.id,c.generation,x.s4_revision,t,t+interval '2 minutes') returning id into preview;
 return jsonb_build_object('contract_version',1,'outcome','preview','preview_id',preview,'title',title,'member_count',members,'can_join',true,
  'code_expires_at',private.s4_iso(least(c.expires_at,x.expires_at)),'preview_expires_at',private.s4_iso(t+interval '2 minutes'),'server_time',private.s4_iso(t));
end; $$;
create function private.s3_join_invite(preview_id uuid,request uuid,legacy_code text default null) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare retry timestamptz; r uuid; x public.rooms%rowtype; p private.s3_invite_previews%rowtype; c private.s3_invite_codes%rowtype;
 v_code text; payload jsonb; prior jsonb; result jsonb; begin
 retry:=private.s3_rate_reserve(); if retry is not null then return private.s3_invite_rejected('INVITE_RATE_LIMITED',retry,false); end if;
 if legacy_code is not null then
  v_code:=private.s3_normalize_code(legacy_code); select id into r from public.rooms where rooms.code=v_code;
 else
  select * into p from private.s3_invite_previews where id=preview_id and actor_id=auth.uid(); r:=p.room_id;
 end if;
 if r is null then return private.s3_invite_rejected(); end if;
 perform pg_advisory_xact_lock(hashtextextended(r::text,0));
 select * into x from public.rooms where id=r for update;
 perform private.require_current_terms_consent();
 if not found or x.id is null or x.expires_at<=clock_timestamp() or x.stage in('settling','done') then
  return private.s3_invite_rejected('INVITE_UNAVAILABLE',null,legacy_code is not null or p.id is null or p.expires_at>clock_timestamp());
 end if;
 perform 1 from public.profiles where id=auth.uid() order by id for update;
 perform private.require_current_terms_consent();
 payload:=jsonb_build_object('preview',preview_id,'code_digest',case when legacy_code is not null then private.s3_code_digest(v_code) end);
 -- Authorized current members may replay; ex-members cannot replay old success.
 if exists(select 1 from public.participants where room_id=r and profile_id=auth.uid()) then
  prior:=private.s3_previous('join',payload,request); if prior is not null then return prior; end if;
 elsif exists(select 1 from private.s3_requests where actor_id=auth.uid() and request_id=request) then return private.s3_invite_rejected();
 end if;
 select * into c from private.s3_invite_codes where room_id=r and retired_at is null;
 if not found or c.expires_at<=clock_timestamp() or (legacy_code is not null and (x.code is distinct from v_code or c.code_digest<>private.s3_code_digest(v_code)))
 then return private.s3_invite_rejected('INVITE_UNAVAILABLE',null,legacy_code is not null or p.id is null or p.expires_at>clock_timestamp()); end if;
 if legacy_code is null then
  select * into p from private.s3_invite_previews where id=preview_id and actor_id=auth.uid() for update;
  -- The initial actor-bound lookup already succeeded. Concurrent expiry purge
  -- is a disappeared preview, not a new code guess.
  if not found then return private.s3_invite_rejected('INVITE_UNAVAILABLE',null,false); end if;
  if p.expires_at<=clock_timestamp() then return private.s3_invite_rejected('INVITE_UNAVAILABLE',null,false); end if;
  if p.generation<>c.generation or p.display_revision<>x.s4_revision then return private.s3_invite_rejected('PREVIEW_STALE',null,false); end if;
 end if;
 if request is null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 if not exists(select 1 from public.participants where room_id=r and profile_id=auth.uid()) then
  perform private.participant_snapshot(r,auth.uid());
  perform private.s3_event(r,'member_joined',auth.uid(),'member-joined:'||request);
 end if;
 result:=private.s3_result(r)||jsonb_build_object('room_id',r,'server_time',private.s4_iso(clock_timestamp()));
 perform private.s3_remember(r,'join',payload,request,result);
 return result;
end; $$;
create function public.join_room_invite_v1(p_preview_id uuid,p_request_id uuid) returns jsonb language sql security definer set search_path='' as $$
 select private.s3_join_invite(p_preview_id,p_request_id)
$$;
revoke all on function private.s3_code_digest(text),private.s3_random_code(),private.s3_issue_code(uuid,boolean),
 private.s3_rate_reserve(),private.s3_invite_rejected(text,timestamptz,boolean),private.s3_normalize_code(text),private.s3_join_invite(uuid,uuid,text),
 public.create_room_v1(text,text,uuid),public.rotate_room_invite_code_v1(uuid,bigint,uuid),public.preview_room_invite_v1(text),public.join_room_invite_v1(uuid,uuid)
 from public,anon,authenticated,service_role;
commit;
