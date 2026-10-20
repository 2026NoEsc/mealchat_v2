-- S4 M3: replace all user decision writers, connect revisions, then expose capability atomically.
begin;
create function private.s4_room_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.stage,new.owner_id,new.expires_at,new.voting_items,new.meeting_starts_at,new.meeting_ends_at,new.meeting_time_zone,new.confirmed_slot,new.confirmed_time_item_id,new.confirmed_menu_item_id,new.confirmed_menu,new.confirmed_menu_at,new.appointment_confirmed_at,new.appointment_confirmed_by,new.is_confirmed,new.location_name)
 is distinct from (old.stage,old.owner_id,old.expires_at,old.voting_items,old.meeting_starts_at,old.meeting_ends_at,old.meeting_time_zone,old.confirmed_slot,old.confirmed_time_item_id,old.confirmed_menu_item_id,old.confirmed_menu,old.confirmed_menu_at,old.appointment_confirmed_at,old.appointment_confirmed_by,old.is_confirmed,old.location_name)
 or new.s4_revision is distinct from old.s4_revision then new.s4_revision:=old.s4_revision+1; else new.s4_revision:=old.s4_revision; end if;
 return new;
end; $$;
create trigger s4_room_revision before update on public.rooms for each row execute function private.s4_room_revision();
create function private.s4_participant_revision() returns trigger language plpgsql security definer set search_path='' as $$
declare r uuid; key bigint; begin
 r:=case when tg_op='DELETE' then old.room_id else new.room_id end;
 if tg_op='UPDATE' and (new.room_id,new.profile_id,new.schedule,new.voted_items) is not distinct from (old.room_id,old.profile_id,old.schedule,old.voted_items) then return null; end if;
 if tg_op='UPDATE' and new.room_id<>old.room_id then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 -- Owner bootstrap is inside a newly inserted, externally invisible room transaction.
 if tg_op='INSERT' and pg_trigger_depth()>1 and exists(select 1 from public.rooms where id=r and owner_id=new.profile_id and s4_revision=0) then return null; end if;
 -- Never acquire an advisory lock from an already-locked participant row.
 -- User/service mutation paths must have acquired it before touching this row.
 key:=hashtextextended(r::text,0);
 if current_setting('role',true) in('authenticated','service_role') and exists(select 1 from public.rooms where id=r)
 and not exists(select 1 from pg_locks where locktype='advisory' and pid=pg_backend_pid() and granted and mode='ExclusiveLock' and classid::bigint=((key>>32)&4294967295) and objid::bigint=(key&4294967295) and objsubid=1)
 then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 update public.rooms set s4_revision=s4_revision+1 where id=r;
 return null;
end; $$;
create trigger s4_participant_revision after insert or update or delete on public.participants for each row execute function private.s4_participant_revision();
create function private.s4_vote_stage(x public.rooms,kind text) returns void language plpgsql set search_path='' as $$
begin
 if kind is null or kind not in('menu','time') then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 if x.appointment_confirmed_at is not null or not ((kind='menu' and x.stage='place') or (kind='time' and x.stage='scheduling')) then raise exception 'ROOM_STAGE_CONFLICT' using errcode='S4003'; end if;
end; $$;
create or replace function public.add_voting_item(target_room uuid,item_kind text,item_label text) returns uuid language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare x public.rooms%rowtype; label text; new_id uuid:=gen_random_uuid(); begin
 x:=private.s4_room(target_room,false); perform private.s4_vote_stage(x,item_kind);
 label:=private.s4_label(item_label);
 if (select count(*) from jsonb_array_elements(coalesce(x.voting_items,'[]')) v where v->>'kind'=item_kind)>=30 then raise exception 'CANDIDATE_LIMIT_REACHED' using errcode='S4001'; end if;
 if exists(select 1 from jsonb_array_elements(coalesce(x.voting_items,'[]')) v where v->>'kind'=item_kind and lower(v->>'label')=lower(label)) then raise exception 'CANDIDATE_ALREADY_EXISTS' using errcode='23505'; end if;
 update public.rooms set voting_items=coalesce(voting_items,'[]')||jsonb_build_object('id',new_id,'kind',item_kind,'label',label,'created_by',auth.uid(),'created_at',clock_timestamp()) where rooms.id=target_room;
 return new_id;
end; $$;
create or replace function public.remove_voting_item(target_room uuid,item_id uuid) returns boolean language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare x public.rooms%rowtype; item jsonb; begin
 x:=private.s4_room(target_room,false);
 select v into item from jsonb_array_elements(coalesce(x.voting_items,'[]')) v where v->>'id'=item_id::text limit 1;
 if item is null then
  if x.stage not in('scheduling','place') then raise exception 'ROOM_STAGE_CONFLICT' using errcode='S4003'; end if;
  return false;
 end if;
 perform private.s4_vote_stage(x,item->>'kind');
 if x.owner_id is distinct from auth.uid() and item->>'created_by' is distinct from auth.uid()::text then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 update public.rooms set voting_items=(select coalesce(jsonb_agg(v),'[]') from jsonb_array_elements(coalesce(x.voting_items,'[]')) v where v->>'id'<>item_id::text) where id=target_room;
 update public.participants set voted_items=coalesce(voted_items,'[]')-item_id::text where room_id=target_room and coalesce(voted_items,'[]')?item_id::text;
 return true;
end; $$;
create or replace function public.toggle_vote(target_room uuid,item_id uuid) returns boolean language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare x public.rooms%rowtype; kind text; old_votes jsonb; voted boolean; begin
 x:=private.s4_room(target_room,false);
 select v->>'kind' into kind from jsonb_array_elements(coalesce(x.voting_items,'[]')) v where v->>'id'=item_id::text limit 1;
 if kind is null then raise exception 'OPTION_NOT_FOUND' using errcode='P0002'; end if;
 perform private.s4_vote_stage(x,kind);
 select coalesce(voted_items,'[]') into old_votes from public.participants where room_id=target_room and profile_id=auth.uid() for update;
 if not found then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
 voted:=old_votes?item_id::text;
 update public.participants set voted_items=case when voted then old_votes-item_id::text else old_votes||to_jsonb(item_id::text) end where room_id=target_room and profile_id=auth.uid();
 return not voted;
end; $$;
create or replace function public.confirm_room_vote(target_room uuid,item_id uuid) returns void language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare x public.rooms%rowtype; kind text; begin
 x:=private.s4_room(target_room,true);
 select v->>'kind' into kind from jsonb_array_elements(coalesce(x.voting_items,'[]')) v where v->>'id'=item_id::text limit 1;
 if kind='time' then raise exception 'LEGACY_RESELECTION_REQUIRED' using errcode='S4010'; end if;
 if kind is distinct from 'menu' then raise exception 'VOTE_REQUIREMENT_NOT_MET' using errcode='S4008',hint='operation=vote_confirmation'; end if;
 perform private.s4_confirm_core(target_room,item_id);
end; $$;
create or replace function public.advance_room_stage(target_room uuid,next_stage text) returns text language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare x public.rooms%rowtype; begin
 x:=private.s4_room(target_room,true);
 if next_stage='place' then
  if x.stage='place' then return x.stage; end if;
  perform private.s4_select_core(target_room,null);
 elsif next_stage='confirmed' then
  if x.appointment_confirmed_at is not null then return x.stage; end if;
  if x.stage<>'place' then raise exception 'ROOM_STAGE_CONFLICT' using errcode='S4003'; end if;
  if x.confirmed_menu_item_id is null then raise exception 'LEGACY_RESELECTION_REQUIRED' using errcode='S4010'; end if;
  perform private.s4_confirm_core(target_room,x.confirmed_menu_item_id);
 elsif next_stage in('settling','done','scheduling') then raise exception 'ROOM_STAGE_CONFLICT' using errcode='S4003';
 else raise exception 'INVALID_INPUT' using errcode='22023'; end if;
 return (select stage from public.rooms where id=target_room);
end; $$;
create or replace function public.set_my_availability(target_room uuid,slot_keys text[] default '{}') returns void language plpgsql security definer set search_path='' set timezone='UTC' as $$
begin perform private.s4_room(target_room,false); perform private.s4_submit_core(target_room,private.s4_normalize_slots(coalesce(slot_keys,'{}'))); end; $$;
create or replace function public.room_availability_status(target_room uuid)
returns table(participant_id uuid,name text,avatar_color text,submitted boolean,my_slots jsonb)
language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare expiry timestamptz; t timestamptz; begin
 perform private.s4_read_room(target_room); select expires_at into expiry from public.rooms where id=target_room; t:=clock_timestamp();
 return query select p.id,p.name,p.avatar_color,cardinality(private.s4_slots(p.schedule,expiry,t))>0,
 case when p.profile_id=auth.uid() then to_jsonb(private.s4_slots(p.schedule,expiry,t)) else '[]'::jsonb end from public.participants p where p.room_id=target_room and p.profile_id is not null order by p.created_at,p.id;
end; $$;
create or replace function public.room_availability_cells(target_room uuid) returns jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare a jsonb; begin perform private.s4_read_room(target_room); a:=private.s4_availability(target_room); return a->'others_slots'; end; $$;
-- All original INSERT checks are retained, with draft-only creation added.
drop policy rooms_insert_owner on public.rooms;
create policy rooms_insert_owner on public.rooms for insert to authenticated with check(
 owner_id=(select auth.uid()) and stage='scheduling' and not is_confirmed and confirmed_slot is null
 and meeting_starts_at is null and meeting_ends_at is null and meeting_time_zone is null and s4_revision=0 and appointment_confirmed_at is null and appointment_confirmed_by is null
 and voting_items='[]'::jsonb and confirmed_menu is null and confirmed_menu_at is null and confirmed_menu_item_id is null and confirmed_time_item_id is null and ai_recommendations is null and latitude is null and longitude is null and memo is null and memo_visibility='public' and memo_author_id is null);
revoke update,delete on public.rooms from public,anon,authenticated;
revoke insert,update,delete on public.participants from public,anon,authenticated;
revoke update(schedule,voted_items) on public.participants from public,anon,authenticated;
grant select(meeting_starts_at,meeting_ends_at,meeting_time_zone,s4_revision,appointment_confirmed_at,appointment_confirmed_by) on public.rooms to authenticated;
revoke all on function private.s4_room_revision(),private.s4_participant_revision(),private.s4_vote_stage(public.rooms,text) from public,anon,authenticated,service_role;
create function public.get_s4_capabilities() returns jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
begin perform private.require_current_terms_consent(); return jsonb_build_object('contract_version',1,'atomic_confirmation',true,'structured_meeting_time',true,'owner_confirmation',true,'availability_stage_guard',true,'time_zones',jsonb_build_array('Asia/Seoul'),'requires_time_for_confirmation',true); end; $$;
revoke all on function public.get_s4_capabilities(),public.get_room_s4_state(uuid),public.submit_room_availability_v1(uuid,text[],bigint,uuid),public.select_room_meeting_time_v1(uuid,jsonb,bigint,uuid),public.confirm_room_appointment_v1(uuid,uuid,bigint,uuid),
 public.add_voting_item(uuid,text,text),public.remove_voting_item(uuid,uuid),public.toggle_vote(uuid,uuid),public.confirm_room_vote(uuid,uuid),public.advance_room_stage(uuid,text),public.set_my_availability(uuid,text[]),public.room_availability_status(uuid),public.room_availability_cells(uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.get_s4_capabilities(),public.get_room_s4_state(uuid),public.submit_room_availability_v1(uuid,text[],bigint,uuid),public.select_room_meeting_time_v1(uuid,jsonb,bigint,uuid),public.confirm_room_appointment_v1(uuid,uuid,bigint,uuid),
 public.add_voting_item(uuid,text,text),public.remove_voting_item(uuid,uuid),public.toggle_vote(uuid,uuid),public.confirm_room_vote(uuid,uuid),public.advance_room_stage(uuid,text),public.set_my_availability(uuid,text[]),public.room_availability_status(uuid),public.room_availability_cells(uuid) to authenticated;
create or replace function public.join_room_by_code(room_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
set timezone='UTC'
as $$
declare
  caller uuid := (select auth.uid());
  target public.rooms%rowtype;
begin
  perform private.require_current_terms_consent();
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select * into target
  from public.rooms
  where code = btrim(room_code);

  if not found then
    raise exception 'Invalid invite code' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target.id::text, 0)
  );
  perform private.require_current_terms_consent();

  -- 잠금 대기 중 방이 삭제되었거나 만료된 경우를 다시 확인한다.
  select * into target
  from public.rooms
  where id = target.id
  for update;
  if not found or target.expires_at <= clock_timestamp() then
    perform private.require_current_terms_consent();
    raise exception 'This invite has expired' using errcode = 'P0002';
  end if;
  perform private.require_current_terms_consent();


  if target.stage in ('settling','done') then
    raise exception 'ROOM_MEMBERSHIP_CLOSED' using errcode='S4003',hint='operation=membership';
  end if;

  perform 1 from public.profiles where id=caller for update;
  perform private.require_current_terms_consent();
  perform private.participant_snapshot(target.id, caller);
  return target.id;
end;
$$;

create or replace function public.accept_room_invitation(target_invitation uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
set timezone='UTC'
as $$
declare
  caller uuid := (select auth.uid());
  invitation public.room_invitations%rowtype;
  target public.rooms%rowtype;
begin
  perform private.require_current_terms_consent();
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select * into invitation
  from public.room_invitations
  where id = target_invitation;

  if not found then
    raise exception 'Invitation no longer exists' using errcode = 'P0002';
  end if;

  -- 첫 조회는 advisory key만 얻기 위한 비잠금 조회다. 그 전에 대상자 일치를
  -- 확인해 UUID를 아는 제3자가 방 잠금이나 만료 상태를 관측·변경하지 못하게 한다.
  if invitation.invitee_id <> caller then
    raise exception 'Only the invited person can accept this invitation' using errcode = '42501';
  end if;

  -- join/leave/create settlement와 같은 방 잠금을 먼저 잡고, 그 뒤 초대 행을 잠근다.
  -- 이 순서로 pending 재초대와 수락이 서로 반대 순서의 잠금을 기다리지 않는다.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(invitation.room_id::text, 0)
  );
  perform private.require_current_terms_consent();

  select * into invitation
  from public.room_invitations
  where id = target_invitation
  for update;
  if not found then
    perform private.require_current_terms_consent();
    raise exception 'Invitation no longer exists' using errcode = 'P0002';
  end if;
  perform private.require_current_terms_consent();

  if invitation.invitee_id <> caller then
    raise exception 'Only the invited person can accept this invitation' using errcode = '42501';
  end if;

  -- 두 번 눌러도 한 번만 참가행을 만든다. 첫 수락의 결과를 그대로 돌려준다.
  select * into target
  from public.rooms
  where id = invitation.room_id
  for update;
  if not found or target.expires_at <= clock_timestamp() then
    perform private.require_current_terms_consent();
    update public.room_invitations
    set status = 'expired', responded_at = coalesce(responded_at, clock_timestamp())
    where id = invitation.id
      and status = 'pending';
    return null;
  end if;
  perform private.require_current_terms_consent();


  if target.stage in ('settling','done') then
    raise exception 'ROOM_MEMBERSHIP_CLOSED' using errcode='S4003',hint='operation=membership';
  end if;

  if invitation.status = 'accepted' then
    return invitation.room_id;
  end if;

  if invitation.status <> 'pending' then
    return null;
  end if;

  if invitation.expires_at <= clock_timestamp() then
    update public.room_invitations
    set status = 'expired', responded_at = coalesce(responded_at, clock_timestamp())
    where id = invitation.id;
    return null;
  end if;

  -- 수락 전에는 participants 행이 없으므로 rooms/messages/participants RLS가 모두 닫힌다.
  -- snapshot 은 프로필 표시값을 서버에서 읽고 UNIQUE 제약으로 중복 행을 막는다.
  perform 1 from public.profiles where id=caller for update;
  perform private.require_current_terms_consent();
  perform private.participant_snapshot(invitation.room_id, caller);

  update public.room_invitations
  set status = 'accepted', responded_at = clock_timestamp()
  where id = invitation.id;

  return invitation.room_id;
end;
$$;

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

  insert into public.room_invitations (
    room_id, inviter_id, invitee_id, room_title, status, expires_at
  )
  values (
    target_room, caller, $2, target.title, 'pending', target.expires_at
  )
  returning id into new_invitation;

  return new_invitation;
end;
$$;

revoke all on function public.join_room_by_code(text),public.accept_room_invitation(uuid),public.create_room_invitation(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.join_room_by_code(text),public.accept_room_invitation(uuid),public.create_room_invitation(uuid,uuid) to authenticated;
-- Existing S5 response/ACL unchanged; discard results whose S4 decision context changed.
create or replace function private.s5_context(r uuid) returns text language sql volatile security definer set search_path='' as $$
 select encode(extensions.digest(convert_to(jsonb_build_object(
 'room',(select jsonb_build_array(owner_id,expires_at,stage,meeting_starts_at,meeting_ends_at,meeting_time_zone,appointment_confirmed_at) from public.rooms where id=r),
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

commit;
