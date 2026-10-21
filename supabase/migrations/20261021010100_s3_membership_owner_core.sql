-- S3 M2. New endpoints remain inaccessible until the reviewed activation.
-- SQLSTATE registry: S3001 unfinished, S3002 owner-transfer-required,
-- S3003 transfer-unavailable, S3004 transfer-pending, S3005 invite-rotation-limit.
begin;
create function private.s3_unfinished(r uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.dutch_pay_bills b where b.room_id=r and (
  not exists(select 1 from public.dutch_pay_members m where m.bill_id=b.id)
  or exists(select 1 from public.dutch_pay_members m where m.bill_id=b.id and m.is_completed is not true)))
$$;
create function private.s3_guard(x public.rooms,transfer boolean default false) returns void language plpgsql stable set search_path='' as $$
begin
 if private.s3_unfinished(x.id) then raise exception 'ROOM_HAS_UNFINISHED_SETTLEMENT' using errcode='S3001'; end if;
 if x.stage='settling' or (transfer and x.stage not in('scheduling','place','confirmed'))
 then raise exception 'ROOM_STAGE_CONFLICT' using errcode='S4003'; end if;
end; $$;
create function private.s3_event(r uuid,event text,actor uuid,key text) returns void language plpgsql security definer set search_path='' as $$
declare body text; scoped_key text; begin
 body:=case event
  when 'member_joined' then '새 메이트가 방에 들어왔어요.'
  when 'member_left' then '방을 나갔어요.' when 'member_left_confirmed' then '방을 나갔어요. 이후 새 정산에 포함되지 않아요.'
  when 'owner_transfer_pending' then '방장 넘기기를 요청했어요. 대상 메이트는 방 상세정보에서 확인해 주세요.'
  when 'owner_transfer_accepted' then '방장이 바뀌었어요.' when 'owner_transfer_declined' then '방장 넘기기 요청을 거절했어요.'
  when 'owner_transfer_cancelled' then '방장 넘기기 요청을 취소했어요.' when 'owner_transfer_expired' then '방장 넘기기 요청이 만료됐어요.' end;
 if body is null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 -- The caller holds the room lock. Coalesce noisy announcements after ten per
 -- room/actor/minute; mutations/replay receipts and terminal transfer facts stay
 -- authoritative. Accepted/declined/expired events are never suppressed.
 if event in('member_joined','member_left','member_left_confirmed','owner_transfer_pending','owner_transfer_cancelled')
  and (select count(*) from public.messages m where m.room_id=r and m.lifecycle_actor_id=actor
   and m.created_at>clock_timestamp()-interval '1 minute'
   and m.lifecycle_event_type in('member_joined','member_left','member_left_confirmed','owner_transfer_pending','owner_transfer_cancelled'))>=10
 then return; end if;
 scoped_key:=split_part(key,':',1)||':'||r||':'||coalesce(actor::text,'server')||':'||substr(key,strpos(key,':')+1);
 insert into public.messages(room_id,sender_id,sender_name,sender_color,message,kind,event_key,lifecycle_actor_id,lifecycle_event_type)
 values(r,null,'밀챗','#FF9900',body,'system',scoped_key,actor,event) on conflict do nothing;
end; $$;
-- The caller already holds room advisory + room row; never lock a bill first.
create function private.s3_expire_transfers(r uuid,reason text,actor uuid default null) returns integer language plpgsql security definer set search_path='' as $$
declare t private.s3_transfer_requests%rowtype; n integer:=0; live boolean; begin
 select expires_at>clock_timestamp() into live from public.rooms where id=r;
 for t in select * from private.s3_transfer_requests where room_id=r and status='pending' and (
  reason in('room_closed','settlement_started','owner_unavailable') or
  (reason='ttl' and expires_at<=clock_timestamp()) or (reason='target_left' and target_profile_id=actor)) order by id for update
 loop
  update private.s3_transfer_requests set status='expired',responded_at=clock_timestamp(),terminal_reason=reason where id=t.id;
  if live and reason<>'room_closed' then
   perform private.s3_event(r,'owner_transfer_expired',null,'owner-transfer:'||t.id||':expired');
   update public.rooms set s4_revision=s4_revision+1 where id=r;
  end if;
  n:=n+1;
 end loop;
 return n;
end; $$;
create function private.s3_result(r uuid,outcome text default 'applied') returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('contract_version',1,'outcome',outcome,'applied_revision',s4_revision::text) from public.rooms where id=r
$$;
create function private.s3_remember(r uuid,op text,payload jsonb,request uuid,result jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into private.s3_requests(actor_id,request_id,room_id,operation,payload_hash,applied_revision,result)
 values(auth.uid(),request,r,op,encode(extensions.digest(convert_to(payload::text,'UTF8'),'sha256'),'hex'),(result->>'applied_revision')::bigint,result);
exception when unique_violation then raise exception 'REQUEST_PAYLOAD_CONFLICT' using errcode='S1007';
end; $$;
create function private.s3_previous(op text,payload jsonb,request uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare prior private.s3_requests%rowtype; begin
 if request is null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 select * into prior from private.s3_requests where actor_id=auth.uid() and request_id=request;
 if not found then return null; end if;
 if prior.operation<>op or prior.payload_hash<>encode(extensions.digest(convert_to(payload::text,'UTF8'),'sha256'),'hex') then raise exception 'REQUEST_PAYLOAD_CONFLICT' using errcode='S1007'; end if;
 return prior.result||jsonb_build_object('outcome','replayed');
end; $$;
create function public.get_room_lifecycle_v1(p_room_id uuid) returns jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare x public.rooms%rowtype; unfinished boolean; pending boolean; reason text; owner boolean; transfer jsonb; invite jsonb; begin
 x:=private.s4_read_room(p_room_id); owner:=x.owner_id is not distinct from auth.uid(); unfinished:=private.s3_unfinished(x.id);
 pending:=exists(select 1 from private.s3_transfer_requests where room_id=x.id and status='pending' and expires_at>clock_timestamp());
 reason:=case when unfinished then 'ROOM_HAS_UNFINISHED_SETTLEMENT' when x.stage='settling' then 'ROOM_STAGE_CONFLICT' when owner and pending then 'TRANSFER_ALREADY_PENDING' when owner then 'OWNER_TRANSFER_REQUIRED' end;
 select jsonb_build_object('id',t.id,'from_owner_id',t.from_owner_id,'target_profile_id',t.target_profile_id,'leave_after_accept',t.leave_after_accept,
  'status',case when t.status='pending' and (t.expires_at<=clock_timestamp() or t.from_owner_id is null or t.target_profile_id is null) then 'expired' else t.status end,
  'expires_at',private.s4_iso(t.expires_at),'terminal_reason',t.terminal_reason) into transfer
 from private.s3_transfer_requests t where t.room_id=x.id and auth.uid() in(t.from_owner_id,t.target_profile_id) order by t.created_at desc,t.id desc limit 1;
 if x.stage not in('settling','done') then
  select jsonb_build_object('code',x.code,'generation',generation::text,'expires_at',private.s4_iso(least(expires_at,x.expires_at))) into invite
  from private.s3_invite_codes where room_id=x.id and retired_at is null and expires_at>clock_timestamp();
 end if;
 return jsonb_build_object('contract_version',1,'room_id',x.id,'stage',x.stage,'revision',x.s4_revision::text,
  'server_time',private.s4_iso(clock_timestamp()),'expires_at',private.s4_iso(x.expires_at),'invite',invite,
  'can_leave',not owner and not unfinished and x.stage<>'settling',
  'can_close',owner and not unfinished and x.stage<>'settling',
  'can_transfer',owner and not unfinished and not pending and x.stage in('scheduling','place','confirmed') and exists(select 1 from public.participants where room_id=x.id and profile_id is not null and profile_id<>auth.uid()),
  'reason',reason,'transfer',transfer);
end; $$;
create function private.s3_member_mutation(op text,r uuid,target uuid,leave_after boolean,transfer_id uuid,accept boolean,expected bigint,request uuid)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare x public.rooms%rowtype; t private.s3_transfer_requests%rowtype; payload jsonb; prior jsonb; result jsonb; new_transfer uuid; issued_at timestamptz; begin
 -- Nonlocking transfer lookup obtains only the serialization key, never authority.
 if transfer_id is not null then select room_id into r from private.s3_transfer_requests where id=transfer_id; end if;
 if r is null then perform private.require_current_terms_consent(); raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 x:=private.s4_room(r,op in('close','request_transfer','cancel_transfer'));
 if op in('respond_transfer','cancel_transfer') then
  select * into t from private.s3_transfer_requests where id=transfer_id and room_id=r for update;
  if not found or (op='respond_transfer' and t.target_profile_id is distinct from auth.uid())
   or (op='cancel_transfer' and t.from_owner_id is distinct from auth.uid()) then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 end if;
 payload:=jsonb_build_object('room',r,'target',target,'leave_after',leave_after,'transfer',transfer_id,'accept',accept,'expected',expected);
 prior:=private.s3_previous(op,payload,request); if prior is not null then return prior; end if;
 if expected is null or expected<>x.s4_revision then raise exception 'ROOM_REVISION_CONFLICT' using errcode='S4005'; end if;
 if op='leave' then
  if x.owner_id is not distinct from auth.uid() then raise exception 'OWNER_TRANSFER_REQUIRED' using errcode='S3002'; end if;
  perform private.s3_guard(x);
  perform private.s3_expire_transfers(r,'target_left',auth.uid());
  delete from public.participants where room_id=r and profile_id=auth.uid();
  perform private.s3_event(r,case when x.stage='confirmed' then 'member_left_confirmed' else 'member_left' end,auth.uid(),'member-left:'||request);
 elsif op='close' then
  perform private.s3_guard(x);
  perform private.s3_expire_transfers(r,'room_closed');
  delete from public.rooms where id=r;
  return jsonb_build_object('contract_version',1,'outcome','applied','applied_revision',(x.s4_revision+1)::text);
 elsif op='request_transfer' then
  perform private.s3_guard(x,true);
  if target is null or target=auth.uid() or leave_after is null or not exists(select 1 from public.participants where room_id=r and profile_id=target)
  then raise exception 'TRANSFER_UNAVAILABLE' using errcode='S3003'; end if;
  perform private.s3_expire_transfers(r,'ttl');
  if exists(select 1 from private.s3_transfer_requests where room_id=r and status='pending') then raise exception 'TRANSFER_ALREADY_PENDING' using errcode='S3004'; end if;
  issued_at:=clock_timestamp();
  insert into private.s3_transfer_requests(room_id,from_owner_id,target_profile_id,leave_after_accept,created_at,expires_at,request_id)
  values(r,auth.uid(),target,leave_after,issued_at,least(issued_at+interval '24 hours',x.expires_at),request) returning id into new_transfer;
  perform private.s3_event(r,'owner_transfer_pending',auth.uid(),'owner-transfer:'||new_transfer||':pending');
  update public.rooms set s4_revision=s4_revision+1 where id=r;
 elsif op in('respond_transfer','cancel_transfer') then
  if t.status<>'pending' then raise exception 'TRANSFER_UNAVAILABLE' using errcode='S3003'; end if;
  if t.expires_at<=clock_timestamp() then
   perform private.s3_expire_transfers(r,'ttl');
   result:=private.s3_result(r,'expired'); perform private.s3_remember(r,op,payload,request,result); return result;
  end if;
  if t.from_owner_id is distinct from x.owner_id or t.from_owner_id is null or t.target_profile_id is null
   or not exists(select 1 from public.participants where room_id=r and profile_id=t.from_owner_id)
   or not exists(select 1 from public.participants where room_id=r and profile_id=t.target_profile_id) then
   perform private.s3_expire_transfers(r,'owner_unavailable');
   result:=private.s3_result(r,'expired'); perform private.s3_remember(r,op,payload,request,result); return result;
  end if;
  if x.stage in('settling','done') or private.s3_unfinished(r) then
   perform private.s3_expire_transfers(r,'settlement_started');
   result:=private.s3_result(r,'expired'); perform private.s3_remember(r,op,payload,request,result); return result;
  end if;
  update private.s3_transfer_requests set status=case when op='cancel_transfer' then 'cancelled' when accept then 'accepted' else 'declined' end,
   responded_at=clock_timestamp(),terminal_reason=case when op='cancel_transfer' then 'owner_cancelled' end where id=t.id returning * into t;
  if t.status='accepted' then
   update public.rooms set owner_id=t.target_profile_id where id=r;
   if t.leave_after_accept then
    delete from public.participants where room_id=r and profile_id=t.from_owner_id;
    perform private.s3_event(r,case when x.stage='confirmed' then 'member_left_confirmed' else 'member_left' end,t.from_owner_id,'member-left:'||t.request_id);
   end if;
  else update public.rooms set s4_revision=s4_revision+1 where id=r;
  end if;
  perform private.s3_event(r,'owner_transfer_'||t.status,auth.uid(),'owner-transfer:'||t.id||':'||t.status);
 else raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 result:=private.s3_result(r)||case when new_transfer is null then '{}'::jsonb else jsonb_build_object('transfer_id',new_transfer) end;
 perform private.s3_remember(r,op,payload,request,result);
 return result;
end; $$;
create function public.leave_room_member_v1(p_room_id uuid,p_expected_revision bigint,p_request_id uuid) returns jsonb language sql security definer set search_path='' as $$
 select private.s3_member_mutation('leave',p_room_id,null,null,null,null,p_expected_revision,p_request_id)
$$;
create function public.close_room_v1(p_room_id uuid,p_expected_revision bigint,p_request_id uuid) returns jsonb language sql security definer set search_path='' as $$
 select private.s3_member_mutation('close',p_room_id,null,null,null,null,p_expected_revision,p_request_id)
$$;
create function public.request_room_owner_transfer_v1(p_room_id uuid,p_target_profile_id uuid,p_leave_after_accept boolean,p_expected_revision bigint,p_request_id uuid) returns jsonb language sql security definer set search_path='' as $$
 select private.s3_member_mutation('request_transfer',p_room_id,p_target_profile_id,p_leave_after_accept,null,null,p_expected_revision,p_request_id)
$$;
create function public.respond_room_owner_transfer_v1(p_transfer_id uuid,p_accept boolean,p_expected_revision bigint,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_accept is null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 return private.s3_member_mutation('respond_transfer',null,null,null,p_transfer_id,p_accept,p_expected_revision,p_request_id);
end; $$;
create function public.cancel_room_owner_transfer_v1(p_transfer_id uuid,p_expected_revision bigint,p_request_id uuid) returns jsonb language sql security definer set search_path='' as $$
 select private.s3_member_mutation('cancel_transfer',null,null,null,p_transfer_id,null,p_expected_revision,p_request_id)
$$;
create function public.create_room_v1(p_title text,p_color text,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare prior private.s3_create_tombstones%rowtype; x public.rooms%rowtype; r uuid; payload text; code text; t timestamptz; result jsonb; i integer; begin
 perform private.require_current_terms_consent();
 if auth.uid() is null then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 if p_request_id is null or p_title is null or char_length(btrim(p_title)) not between 1 and 120 or p_title ~ '[[:cntrl:]]'
  or p_color is null or p_color !~ '^#[0-9a-fA-F]{6}$' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 payload:=private.s3_code_digest(jsonb_build_object('title',btrim(p_title),'color',p_color)::text);
 -- No existing room is touched here; serialize this actor/request before create.
 perform pg_advisory_xact_lock(hashtextextended('s3-create:'||auth.uid()||':'||p_request_id,0));
 perform private.require_current_terms_consent();
 select * into prior from private.s3_create_tombstones where actor_id=auth.uid() and request_id=p_request_id;
 if found then
  if prior.payload_hash<>payload then raise exception 'REQUEST_PAYLOAD_CONFLICT' using errcode='S1007'; end if;
  x:=private.s4_room(prior.room_id,false);
  return private.s3_result(x.id,'replayed')||jsonb_build_object('room_id',x.id,'code',x.code,'expires_at',private.s4_iso(x.expires_at));
 end if;
 t:=clock_timestamp();
 for i in 1..16 loop
  code:=private.s3_random_code();
  begin
   insert into public.rooms(code,title,color,meeting_date,expires_at,owner_id,created_at,lifecycle_version,base_expires_at,hard_expires_at)
   values(code,btrim(p_title),p_color,(t at time zone 'Asia/Seoul')::date,t+interval '7 days',auth.uid(),t,1,t+interval '7 days',t+interval '7 days') returning id into r;
   exit;
  exception when unique_violation then null; end;
 end loop;
 if r is null then raise exception 'INVITE_CODE_GENERATION_FAILED' using errcode='54000'; end if;
 -- Owner bootstrap remains the existing server-owned trigger.
 insert into private.s3_invite_codes(room_id,generation,code_digest,issued_at,expires_at) values(r,1,private.s3_code_digest(code),t,t+interval '7 days');
 insert into private.s3_create_tombstones(actor_id,request_id,payload_hash,room_id) values(auth.uid(),p_request_id,payload,r);
 select * into x from public.rooms where id=r;
 result:=private.s3_result(r)||jsonb_build_object('room_id',r,'code',x.code,'expires_at',private.s4_iso(x.expires_at));
 return result;
end; $$;

revoke all on function private.s3_unfinished(uuid),private.s3_guard(public.rooms,boolean),private.s3_event(uuid,text,uuid,text),
 private.s3_expire_transfers(uuid,text,uuid),private.s3_result(uuid,text),private.s3_remember(uuid,text,jsonb,uuid,jsonb),private.s3_previous(text,jsonb,uuid),
 private.s3_member_mutation(text,uuid,uuid,boolean,uuid,boolean,bigint,uuid),
 public.create_room_v1(text,text,uuid),public.get_room_lifecycle_v1(uuid),public.leave_room_member_v1(uuid,bigint,uuid),public.close_room_v1(uuid,bigint,uuid),
 public.request_room_owner_transfer_v1(uuid,uuid,boolean,bigint,uuid),public.respond_room_owner_transfer_v1(uuid,boolean,bigint,uuid),public.cancel_room_owner_transfer_v1(uuid,bigint,uuid)
 from public,anon,authenticated,service_role;
commit;
