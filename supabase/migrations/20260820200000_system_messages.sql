-- 시스템 안내를 채팅에 남긴다.
--
-- "1인당 10,000원 정산 요청을 보냈어요" 같은 줄은 지금까지 화면에만 있었다.
-- messages 가 텍스트 컬럼 하나뿐이라 사용자 말과 구분할 방법이 없어서, 화면에서만
-- 붙였다가 새로고침하면 사라졌다. 방에서 무슨 일이 있었는지가 남지 않는 셈이다.
--
-- kind 컬럼으로 구분한다. 클라이언트에게는 (room_id, message) 만 INSERT 권한이
-- 있으므로 kind 는 손댈 수 없고, 시스템 줄은 아래 RPC 로만 들어간다.

alter table public.messages
  add column if not exists kind text not null default 'user';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'messages_kind_known'
  ) then
    alter table public.messages
      add constraint messages_kind_known check (kind in ('user', 'system'));
  end if;
end $$;

comment on column public.messages.kind is
  'user = 사람이 보낸 말, system = 방에서 일어난 일의 안내. 클라이언트는 설정할 수 없다.';

/*
 * 보낸 사람 정보를 채우는 트리거는 사람 말에만 해당한다. 시스템 줄에 호출자를
 * 적으면 그 사람이 한 말처럼 보인다.
 */
create or replace function private.prepare_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile public.profiles%rowtype;
begin
  if new.kind = 'system' then
    return new;
  end if;

  if (select auth.uid()) is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select *
  into current_profile
  from public.profiles
  where id = (select auth.uid());

  if not found then
    raise exception 'Profile provisioning is incomplete' using errcode = '23503';
  end if;

  new.sender_id = current_profile.id;
  new.sender_name = current_profile.name;
  new.sender_color = current_profile.avatar_color;
  return new;
end;
$$;

/*
 * 방에서 일어난 일을 남긴다.
 *
 * 본문을 인자로 받는다. 사건마다 전용 RPC 를 두는 편이 더 엄격하지만, 같은 방
 * 참가자는 어차피 같은 문장을 일반 메시지로 보낼 수 있어서 막아지는 것이 거의 없다.
 * 시스템 줄로 보이는 것과 사람 말로 보이는 것의 차이뿐이고, 정산·투표의 실제 상태는
 * 채팅이 아니라 각자의 테이블에서 읽는다.
 */
create or replace function public.post_room_system_message(target_room uuid, body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  trimmed text := btrim(body);
  new_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not private.is_room_member(target_room) then
    raise exception 'Only room members can post here' using errcode = '42501';
  end if;

  if trimmed = '' then
    raise exception 'Message must not be empty' using errcode = '22023';
  end if;

  insert into public.messages (room_id, sender_id, sender_name, sender_color, message, kind)
  values (target_room, null, '밀챗', '#FF9900', trimmed, 'system')
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.post_room_system_message(uuid, text) from public, anon, authenticated;
grant execute on function public.post_room_system_message(uuid, text) to authenticated;
