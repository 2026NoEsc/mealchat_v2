-- HELD: whole M5 activation, including D10/D11, by the user's explicit decision.
-- Never run as part of db push. Requires approval for this exact external change.
-- Operator must SET the following non-secret evidence references in this session:
-- mealchat.s3.beta_artifact_sha256 (64 hex), mealchat.s3.beta_version (versionCode),
-- mealchat.s3.transition_at (approved fixed UTC deadline, at most seven days away),
-- mealchat.s3.scheduler_observed_after (start of the verified scheduler observation).
-- mealchat.s3.expected_inventory (exact JSON object returned by section 15 Q1 /
-- private.s3_inventory_counts(); all eleven counts, no omitted keys, including
-- invalid_code_rooms and duplicate_normalized_code_rooms).
-- Evidence references do not replace artifact review, remote approval or advisors.
begin;
do $$ declare deadline timestamptz; observed timestamptz; begin
 if current_setting('mealchat.s3.beta_artifact_sha256',true) is null
  or current_setting('mealchat.s3.beta_artifact_sha256',true) !~ '^[0-9a-f]{64}$'
  or coalesce(current_setting('mealchat.s3.beta_version',true),'') !~ '^[1-9][0-9]*$'
 then raise exception 'S3_BETA_EVIDENCE_REQUIRED'; end if;
 deadline:=nullif(current_setting('mealchat.s3.transition_at',true),'')::timestamptz;
 observed:=nullif(current_setting('mealchat.s3.scheduler_observed_after',true),'')::timestamptz;
 if deadline is null or not isfinite(deadline) or deadline<=clock_timestamp() or deadline>clock_timestamp()+interval '7 days'
  then raise exception 'S3_APPROVED_FIXED_TRANSITION_REQUIRED'; end if;
 if observed is null or not isfinite(observed) or observed>clock_timestamp() then raise exception 'S3_SCHEDULER_OBSERVATION_REQUIRED'; end if;
 if (select activated_at is not null from private.s3_worker_control where singleton) then raise exception 'S3_ALREADY_ACTIVATED'; end if;
 if to_regprocedure('cron.schedule(text,text,text)') is null then raise exception 'S3_PG_CRON_REQUIRED'; end if;
 if (select count(*) from cron.job where jobname in('s3-room-expiry-v1','s3-transfer-expiry-v1','s3-ephemeral-purge-v1'))<>3
 then raise exception 'S3_SCHEDULER_IDENTITY_REQUIRED'; end if;
 if exists(select 1 from (values
  ('s3-room-expiry-v1','* * * * *',$job$select private.run_s3_job_v1('rooms');$job$),
  ('s3-transfer-expiry-v1','* * * * *',$job$select private.run_s3_job_v1('transfers');$job$),
  ('s3-ephemeral-purge-v1','*/5 * * * *',$job$select private.run_s3_job_v1('purge');$job$)
 ) expected(name,schedule,command) where not exists(select 1 from cron.job j where j.jobname=expected.name
  and j.schedule=expected.schedule and j.command=expected.command and j.username='postgres'
  and j.database=current_database() and j.active
  and exists(select 1 from cron.job_run_details d where d.jobid=j.jobid and d.status='succeeded' and d.start_time>=observed)
  and (select d.status from cron.job_run_details d where d.jobid=j.jobid order by d.runid desc limit 1)='succeeded'
  and not exists(select 1 from cron.job_run_details d where d.jobid=j.jobid and d.status='failed' and d.start_time>=observed)))
 then raise exception 'S3_SCHEDULER_SUCCESS_EVIDENCE_REQUIRED'; end if;
end; $$;
-- D8: no DELETE, no original-anchor fabrication, no expiry extension.
-- SRE blocks legacy INSERT/UPDATE before inventory and row scan. Maintenance
-- window required. Never wait on advisory locks while holding this table lock.
lock table public.rooms in share row exclusive mode;
do $$ declare expected jsonb; actual jsonb; begin
 expected:=nullif(current_setting('mealchat.s3.expected_inventory',true),'')::jsonb;
 actual:=private.s3_inventory_counts();
 if expected is null or expected is distinct from actual then
  raise exception 'S3_INVENTORY_COUNT_MISMATCH' using detail=jsonb_build_object('expected',expected,'actual',actual)::text;
 end if;
end; $$;
-- Advisory locks remain until COMMIT. Review total_rooms against shared lock
-- capacity and other traffic; see S3-A-REPORT.md. An atomic cutover is not an
-- unbounded batch job. Lock exhaustion rolls back D8 + grants + capability.
do $$ declare r uuid; x public.rooms%rowtype; t timestamptz:=clock_timestamp(); cap timestamptz; base timestamptz; expiry timestamptz;
 transition timestamptz:=current_setting('mealchat.s3.transition_at')::timestamptz; begin
 for r in select id from public.rooms where lifecycle_version is null order by id loop
  if not pg_try_advisory_xact_lock(hashtextextended(r::text,0)) then raise exception 'S3_D8_WRITER_BUSY'; end if;
  select * into x from public.rooms where id=r for update;
  if not found or x.lifecycle_version is not null then continue; end if;
  base:=case when isfinite(x.created_at) and x.created_at<=t then x.created_at+interval '7 days' else transition end;
  cap:=case when x.appointment_confirmed_at is not null then
    case when isfinite(x.created_at) and isfinite(x.appointment_confirmed_at) and x.appointment_confirmed_at between x.created_at and t then x.appointment_confirmed_at+interval '30 days' else transition end
   else base end;
  if x.stage='done' and isfinite(x.settled_at) and x.settled_at between x.created_at and t then cap:=least(cap,x.settled_at+interval '24 hours'); end if;
  expiry:=case when x.expires_at='-infinity'::timestamptz then least(t,cap) else least(x.expires_at,cap) end;
  update public.rooms set lifecycle_version=1,base_expires_at=base,hard_expires_at=cap,expires_at=expiry where id=r;
  insert into private.s3_invite_codes(room_id,generation,code_digest,issued_at,expires_at)
   values(r,1,private.s3_code_digest(x.code),t,least(expiry,t+interval '7 days')) on conflict do nothing;
 end loop;
 update public.room_invitations i set expires_at=least(i.expires_at,r.expires_at,t+interval '7 days') from public.rooms r where i.room_id=r.id and i.status='pending';
end; $$;
create trigger s3_expiry_guard before insert or update on public.rooms for each row execute function private.s3_expiry_guard();
create trigger s3_display_revision before update on public.rooms for each row execute function private.s3_display_revision();
create trigger s3_stage_guard before update on public.rooms for each row execute function private.s3_stage_guard();

create or replace function public.leave_room(target_room uuid) returns text language plpgsql security definer set search_path='' as $$
declare x public.rooms%rowtype; begin
 perform private.require_current_terms_consent();
 if not exists(select 1 from public.rooms r join public.participants p on p.room_id=r.id where r.id=target_room and p.profile_id=auth.uid() and r.expires_at>clock_timestamp()) then return 'gone'; end if;
 x:=private.s4_room(target_room,true); perform private.s3_guard(x);
 perform private.s3_expire_transfers(target_room,'room_closed'); delete from public.rooms where id=target_room; return 'deleted';
end; $$;
create or replace function public.join_room_by_code(room_code text) returns uuid language plpgsql security definer set search_path='' as $$
declare result jsonb; begin
 result:=private.s3_join_invite(null,gen_random_uuid(),room_code);
 -- Legacy UUID contract cannot express the envelope: rejection is a committed
 -- NULL, never an exception that would roll back the shared failure counter.
 return (result->>'room_id')::uuid;
end; $$;
create or replace function public.accept_room_invitation(target_invitation uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.room_invitations%rowtype; x public.rooms%rowtype; r uuid; begin
 perform private.require_current_terms_consent();
 select room_id into r from public.room_invitations where id=target_invitation and invitee_id=auth.uid();
 if r is null then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(r::text,0));
 select * into x from public.rooms where id=r for update;
 perform 1 from public.profiles where id=auth.uid() order by id for update;
 select * into invitation from public.room_invitations where id=target_invitation for update;
 perform private.require_current_terms_consent();
 if invitation.invitee_id is distinct from auth.uid() then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 if x.id is null or x.expires_at<=clock_timestamp() then
  update public.room_invitations set status='expired',responded_at=coalesce(responded_at,clock_timestamp()) where id=target_invitation and status='pending'; return null;
 end if;
 if x.stage in('settling','done') then raise exception 'ROOM_MEMBERSHIP_CLOSED' using errcode='S4003',hint='operation=membership'; end if;
 if invitation.status='accepted' then
  return case when exists(select 1 from public.participants where room_id=r and profile_id=auth.uid()) then r end;
 end if;
 if invitation.status<>'pending' then return null; end if;
 if invitation.expires_at<=clock_timestamp() then
  update public.room_invitations set status='expired',responded_at=clock_timestamp() where id=target_invitation; return null;
 end if;
 perform private.participant_snapshot(r,auth.uid());
 update public.room_invitations set status='accepted',responded_at=clock_timestamp() where id=target_invitation; return r;
end; $$;
create or replace function public.create_room_invitation(
  target_room uuid,
  invitee_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target public.rooms%rowtype;
  existing_invitation uuid;
  new_invitation uuid;
  issued_at timestamptz;
begin
  perform private.require_current_terms_consent();
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if $2 = caller then
    raise exception 'You cannot invite yourself' using errcode = '22023';
  end if;

  -- 생성·수락·코드 참가·퇴장과 모두 같은 방 잠금을 쓴다. 대상자별 잠금을
  -- 따로 잡으면 create/accept가 반대 순서로 잠길 수 있으므로 사용하지 않는다.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_room::text, 0)
  );
  perform private.require_current_terms_consent();

  -- advisory lock 아래에서 방·만료·멤버십·대상 참가 상태·pending을 다시
  -- 검사한다. 수락이나 퇴장과 경쟁해도 즉시 참가 초대로 바뀌지 않는다.
  if not private.is_room_member(target_room) then
    raise exception 'Only room members can invite' using errcode = '42501';
  end if;

  select * into target
  from public.rooms
  where id = target_room
  for update;
  if not found then
    perform private.require_current_terms_consent();
    raise exception 'Room no longer exists' using errcode = 'P0002';
  end if;
  perform private.require_current_terms_consent();

  if target.expires_at <= clock_timestamp() then
    raise exception 'This invite has expired' using errcode = 'P0002';
  end if;

  -- 기존 제품의 메이트 관계 범위는 유지한다. 관계 없는 임의 계정 초대는 허용하지 않는다.

  if target.stage in ('settling','done') then
    raise exception 'ROOM_MEMBERSHIP_CLOSED' using errcode='S4003',hint='operation=membership';
  end if;

  if not exists (
    select 1
    from public.follows follow
    where follow.follower_id = caller
      and follow.following_id = $2
  ) then
    raise exception 'You can only invite your mates' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = $2) then
    raise exception 'That profile no longer exists' using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.participants participant
    where participant.room_id = target_room
    and participant.profile_id = $2
  ) then
    raise exception 'That person is already in this room' using errcode = '23505';
  end if;

  perform 1 from public.profiles where id in(caller,$2) order by id for update;
  perform private.require_current_terms_consent();

  update public.room_invitations invitation
  set status = 'expired', responded_at = coalesce(invitation.responded_at, clock_timestamp())
  where invitation.room_id = target_room
    and invitation.invitee_id = $2
    and invitation.status = 'pending'
    and invitation.expires_at <= clock_timestamp();

  select invitation.id into existing_invitation
  from public.room_invitations invitation
  where invitation.room_id = target_room
    and invitation.invitee_id = $2
    and invitation.status = 'pending'
    and invitation.expires_at > clock_timestamp();

  if existing_invitation is not null then
    -- 같은 요청의 재시도는 기존 pending 초대를 돌려줘서 중복을 만들지 않는다.
    return existing_invitation;
  end if;

  issued_at := clock_timestamp();
  insert into public.room_invitations (
    room_id, inviter_id, invitee_id, room_title, status, expires_at, created_at
  )
  values (
    target_room, caller, $2, target.title, 'pending', least(issued_at+interval '7 days',target.expires_at), issued_at
  )
  returning id into new_invitation;

  return new_invitation;
end;
$$;
revoke all on function public.create_room_invitation(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.create_room_invitation(uuid,uuid) to authenticated;

create or replace function public.delete_expired_rooms() returns integer language plpgsql security definer set search_path='' as $$
begin perform private.require_current_terms_consent(); return 0; end; $$;
-- Table and column privileges are independent. Neither is sufficient alone.
revoke insert,update,delete on public.rooms,public.participants from public,anon,authenticated,service_role;
revoke insert(code,title,meeting_date,expires_at,owner_id,is_confirmed,confirmed_slot,color,location_name) on public.rooms from public,anon,authenticated,service_role;
drop policy rooms_insert_owner on public.rooms;
create policy rooms_insert_owner on public.rooms for insert to authenticated with check(false);
revoke all on function public.post_room_system_message(uuid,text) from public,anon,authenticated,service_role;
revoke insert,update,delete on public.messages from public,anon,authenticated,service_role;
revoke insert(kind,event_key,sender_id,sender_name,sender_color,lifecycle_actor_id,lifecycle_event_type),update(kind,event_key,sender_id,sender_name,sender_color,lifecycle_actor_id,lifecycle_event_type) on public.messages from public,anon,authenticated,service_role;
grant insert(room_id,message) on public.messages to authenticated;
drop policy messages_insert_room_member on public.messages;
create policy messages_insert_room_member on public.messages for insert to authenticated with check(
 private.is_room_member(room_id) and sender_id=auth.uid() and kind='user' and event_key is null and lifecycle_actor_id is null and lifecycle_event_type is null);
revoke all on function public.leave_room(uuid),public.join_room_by_code(text),public.accept_room_invitation(uuid),public.delete_expired_rooms() from public,anon,authenticated,service_role;
grant execute on function public.leave_room(uuid),public.join_room_by_code(text),public.accept_room_invitation(uuid),public.delete_expired_rooms() to authenticated;
grant select(lifecycle_actor_id,lifecycle_event_type,event_key) on public.messages to authenticated;
grant execute on function public.get_room_lifecycle_v1(uuid),public.create_room_v1(text,text,uuid),public.leave_room_member_v1(uuid,bigint,uuid),public.close_room_v1(uuid,bigint,uuid),
 public.request_room_owner_transfer_v1(uuid,uuid,boolean,bigint,uuid),public.respond_room_owner_transfer_v1(uuid,boolean,bigint,uuid),public.cancel_room_owner_transfer_v1(uuid,bigint,uuid),
 public.rotate_room_invite_code_v1(uuid,bigint,uuid),public.preview_room_invite_v1(text),public.join_room_invite_v1(uuid,uuid) to authenticated;
-- Activation and deletion admission are separate operator steps.
update private.s3_worker_control set activated_at=clock_timestamp() where singleton;
-- Public probe is created LAST, in the same transaction as the full cutover.
create function public.get_s3_capabilities() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_current_terms_consent();
 return jsonb_build_object('contract_version',1,'member_leave',true,'owner_transfer',true,'invite_preview',true,'invite_limits',true,'bounded_expiry',true,'invite_links',false);
end; $$;
revoke all on function public.get_s3_capabilities() from public,anon,authenticated,service_role;
grant execute on function public.get_s3_capabilities() to authenticated;
commit;
