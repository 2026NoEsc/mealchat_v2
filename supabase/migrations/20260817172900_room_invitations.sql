-- 초대 코드로 방에 참가하는 경로.
--
-- 하드닝 마이그레이션이 participants 직접 INSERT 를 없앴다. 그 전에는
-- participants_insert_self 가 WITH CHECK (true) 라서, 누구나 아무 방에나 자기 행을
-- 넣어 멤버 판정을 통과하고 메시지·계좌 알림까지 볼 수 있었다. 그래서 직접 INSERT
-- 대신 코드와 만료를 서버에서 검증하는 RPC 하나만 남긴다.
--
-- 이 함수는 SECURITY DEFINER 지만 Security Advisor 가 지적했던 것들과 다르다.
-- 그쪽은 anon 에게까지 EXECUTE 가 열려 있었고, 이 함수는 authenticated 에게만 주며
-- 내부에서 auth.uid() 를 직접 확인하고 search_path 를 비운다.

create or replace function private.participant_snapshot(target_room uuid, target_profile uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  source public.profiles%rowtype;
begin
  select * into source from public.profiles where id = target_profile;
  if not found then
    raise exception 'Profile provisioning is incomplete' using errcode = '23503';
  end if;

  -- participants 는 표시용 필드를 비정규화해서 갖고 있고 name 은 기본값 없는 NOT NULL 이다
  insert into public.participants (room_id, profile_id, name, avatar_color, avatar_url)
  values (target_room, source.id, source.name, source.avatar_color, source.avatar_url)
  on conflict do nothing;
end;
$$;

/*
 * 방을 만든 사람은 자동으로 참가자가 된다.
 * 이게 없으면 rooms_insert_owner 로 방은 만들어도 참가자가 0 명이라
 * 정작 방장이 메시지를 못 보내는 상태가 된다.
 */
create or replace function private.add_room_owner_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is null then
    return new;
  end if;

  perform private.participant_snapshot(new.id, new.owner_id);
  return new;
end;
$$;

drop trigger if exists rooms_add_owner_participant on public.rooms;
create trigger rooms_add_owner_participant
after insert on public.rooms
for each row execute function private.add_room_owner_participant();

/*
 * 초대 코드로 참가한다.
 *
 * rooms.code 는 baseline 에서 이미 UNIQUE 라 정확히 한 방으로만 해석된다.
 * 대소문자는 구분한다. 대소문자 무시로 바꾸려면 lower(code) UNIQUE 인덱스가
 * 먼저 필요한데, 기존 코드끼리 충돌하면 그 인덱스 생성이 실패하므로 별도 작업이다.
 */
create or replace function public.join_room_by_code(room_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target public.rooms%rowtype;
begin
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select * into target
  from public.rooms
  where code = btrim(room_code);

  if not found then
    raise exception 'Invalid invite code' using errcode = 'P0002';
  end if;

  if target.expires_at <= now() then
    raise exception 'This invite has expired' using errcode = 'P0002';
  end if;

  perform private.participant_snapshot(target.id, caller);
  return target.id;
end;
$$;

revoke all on function private.participant_snapshot(uuid, uuid) from public, anon, authenticated;
revoke all on function private.add_room_owner_participant() from public, anon, authenticated;
revoke all on function public.join_room_by_code(text) from public, anon, authenticated;
grant execute on function public.join_room_by_code(text) to authenticated;

/*
 * 나가기. 참가는 RPC 로만 되지만 나가는 것은 자기 행을 지우는 일이라
 * 정책만으로 충분하다. 방장을 포함해 남을 내보내는 기능은 아직 없다.
 */
drop policy if exists participants_delete_own on public.participants;
create policy participants_delete_own
on public.participants
for delete to authenticated
using (profile_id = (select auth.uid()));

grant delete on public.participants to authenticated;
