-- Security and authentication foundation for the first Supabase integration.
--
-- The existing schema was created in the Dashboard and has no migration history.
-- This migration deliberately hardens the current public API before any client
-- screen starts querying it. Invitation, settlement participation, and private
-- profile onboarding remain server-controlled follow-up features.
--
-- PREREQUISITE: this file ALTERs tables it does not create, so it only applies to
-- a database that already has the Dashboard-authored schema. A baseline migration
-- (`supabase link` + `supabase db pull`) must land BEFORE this one, otherwise
-- `supabase db push` against a fresh database fails on the first `alter table`.
--
-- KNOWN SCOPE LIMITS after applying this file, all pending follow-up work:
--   * participants has no INSERT grant, so nobody can join a room yet. Rooms can
--     be created but stay empty until the invitation RPC exists.
--   * notifications, scheduled_time, dutch_pay_members and privacy_settings keep
--     RLS enabled with no policy and no grant, i.e. fully closed.
--   * profiles still holds push_token / account / birth date. Splitting those into
--     an owner-only table is a separate migration; for now profiles is
--     select-own-row only and public_profiles carries the shareable fields.

create schema if not exists private;

revoke all on schema private from public;

alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated;

create table if not exists public.public_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  name text not null,
  tag text not null,
  avatar_color text not null default '#23A455',
  avatar_url text,
  updated_at timestamptz not null default now()
);

alter table public.public_profiles enable row level security;

alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists profiles_tag_lower_unique_idx
  on public.profiles (lower(tag));
create unique index if not exists participants_room_profile_unique_idx
  on public.participants (room_id, profile_id)
  where profile_id is not null;
create unique index if not exists follows_pair_unique_idx
  on public.follows (follower_id, following_id);
create unique index if not exists dutch_pay_members_bill_profile_unique_idx
  on public.dutch_pay_members (bill_id, profile_id)
  where profile_id is not null;

-- `add constraint` 에는 if not exists 가 없어서 그대로 두면 재실행이 실패한다.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'follows_no_self_reference'
  ) then
    alter table public.follows
      add constraint follows_no_self_reference check (follower_id <> following_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'dutch_pay_bills_nonnegative_total'
  ) then
    alter table public.dutch_pay_bills
      add constraint dutch_pay_bills_nonnegative_total check (total_amount >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'dutch_pay_bills_positive_split_count'
  ) then
    alter table public.dutch_pay_bills
      add constraint dutch_pay_bills_positive_split_count check (split_count > 0);
  end if;
end;
$$;

create index if not exists calendar_notes_profile_date_idx
  on public.calendar_notes (profile_id, date);
create index if not exists dutch_pay_bills_creator_id_idx
  on public.dutch_pay_bills (creator_id);
create index if not exists dutch_pay_bills_room_id_idx
  on public.dutch_pay_bills (room_id);
create index if not exists dutch_pay_members_profile_id_idx
  on public.dutch_pay_members (profile_id);
create index if not exists follows_following_id_idx
  on public.follows (following_id);
create index if not exists messages_room_created_at_idx
  on public.messages (room_id, created_at);
create index if not exists messages_sender_id_idx
  on public.messages (sender_id);
create index if not exists participants_profile_room_idx
  on public.participants (profile_id, room_id);
create index if not exists rooms_owner_id_idx
  on public.rooms (owner_id);
create index if not exists rooms_memo_author_id_idx
  on public.rooms (memo_author_id);
create index if not exists scheduled_time_room_id_idx
  on public.scheduled_time (room_id);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.sync_public_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.public_profiles (id, name, tag, avatar_color, avatar_url, updated_at)
  values (new.id, new.name, new.tag, new.avatar_color, new.avatar_url, new.updated_at)
  on conflict (id) do update
  set name = excluded.name,
      tag = excluded.tag,
      avatar_color = excluded.avatar_color,
      avatar_url = excluded.avatar_url,
      updated_at = excluded.updated_at;
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, tag)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), '새 사용자'),
    'user-' || substring(replace(new.id::text, '-', '') from 1 for 8)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function private.is_room_member(target_room uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.participants participant
    where participant.room_id = target_room
      and participant.profile_id = (select auth.uid())
  );
$$;

create or replace function private.prepare_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile public.profiles%rowtype;
begin
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

revoke all on function private.touch_updated_at() from public, anon, authenticated;
revoke all on function private.sync_public_profile() from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.prepare_message() from public, anon, authenticated;
revoke all on function private.is_room_member(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_room_member(uuid) to authenticated;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function private.touch_updated_at();

drop trigger if exists profiles_sync_public_profile on public.profiles;
create trigger profiles_sync_public_profile
after insert or update of name, tag, avatar_color, avatar_url on public.profiles
for each row execute function private.sync_public_profile();

insert into public.public_profiles (id, name, tag, avatar_color, avatar_url, updated_at)
select id, name, tag, avatar_color, avatar_url, updated_at
from public.profiles
on conflict (id) do update
set name = excluded.name,
    tag = excluded.tag,
    avatar_color = excluded.avatar_color,
    avatar_url = excluded.avatar_url,
    updated_at = excluded.updated_at;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

insert into public.profiles (id, name, tag)
select
  auth_user.id,
  coalesce(nullif(btrim(auth_user.raw_user_meta_data ->> 'name'), ''), '새 사용자'),
  'user-' || substring(replace(auth_user.id::text, '-', '') from 1 for 8)
from auth.users auth_user
left join public.profiles profile on profile.id = auth_user.id
where profile.id is null;

drop trigger if exists messages_prepare_insert on public.messages;
create trigger messages_prepare_insert
before insert on public.messages
for each row execute function private.prepare_message();

drop policy if exists calendar_notes_write_own on public.calendar_notes;
drop policy if exists calendar_notes_select on public.calendar_notes;
drop policy if exists dutch_pay_bills_modify_creator on public.dutch_pay_bills;
drop policy if exists dutch_pay_bills_insert on public.dutch_pay_bills;
drop policy if exists dutch_pay_bills_select on public.dutch_pay_bills;
drop policy if exists dutch_pay_members_write on public.dutch_pay_members;
drop policy if exists dutch_pay_members_select on public.dutch_pay_members;
drop policy if exists follows_delete_own on public.follows;
drop policy if exists follows_insert on public.follows;
drop policy if exists follows_select on public.follows;
drop policy if exists follows_update_own on public.follows;
drop policy if exists messages_insert_member on public.messages;
drop policy if exists messages_select_member on public.messages;
drop policy if exists notifications_insert_member on public.notifications;
drop policy if exists notifications_select_member on public.notifications;
drop policy if exists participants_delete on public.participants;
drop policy if exists participants_insert_self on public.participants;
drop policy if exists participants_select on public.participants;
drop policy if exists participants_update_self on public.participants;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists rooms_delete_owner on public.rooms;
drop policy if exists rooms_insert on public.rooms;
drop policy if exists rooms_select on public.rooms;
drop policy if exists rooms_update_member on public.rooms;
drop policy if exists scheduled_time_all_member on public.scheduled_time;
drop policy if exists public_profiles_select_authenticated on public.public_profiles;

create policy profiles_select_own
on public.profiles
for select to authenticated
using ((select auth.uid()) = id);

create policy profiles_update_own
on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy public_profiles_select_authenticated
on public.public_profiles
for select to authenticated
using (true);

create policy rooms_select_member_or_owner
on public.rooms
for select to authenticated
using (
  owner_id = (select auth.uid())
  or private.is_room_member(id)
);

create policy rooms_insert_owner
on public.rooms
for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy rooms_update_owner
on public.rooms
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy rooms_delete_owner
on public.rooms
for delete to authenticated
using (owner_id = (select auth.uid()));

create policy participants_select_room_member
on public.participants
for select to authenticated
using (private.is_room_member(room_id));

create policy messages_select_room_member
on public.messages
for select to authenticated
using (private.is_room_member(room_id));

create policy messages_insert_room_member
on public.messages
for insert to authenticated
with check (
  private.is_room_member(room_id)
  and sender_id = (select auth.uid())
);

create policy follows_select_own
on public.follows
for select to authenticated
using (
  follower_id = (select auth.uid())
  or following_id = (select auth.uid())
);

create policy calendar_notes_select_own
on public.calendar_notes
for select to authenticated
using (profile_id = (select auth.uid()));

create policy calendar_notes_insert_own
on public.calendar_notes
for insert to authenticated
with check (profile_id = (select auth.uid()));

create policy calendar_notes_update_own
on public.calendar_notes
for update to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy calendar_notes_delete_own
on public.calendar_notes
for delete to authenticated
using (profile_id = (select auth.uid()));

create policy dutch_pay_bills_select_creator
on public.dutch_pay_bills
for select to authenticated
using (creator_id = (select auth.uid()));

create policy dutch_pay_bills_insert_creator
on public.dutch_pay_bills
for insert to authenticated
with check (creator_id = (select auth.uid()));

create policy dutch_pay_bills_delete_creator
on public.dutch_pay_bills
for delete to authenticated
using (creator_id = (select auth.uid()));

revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;
revoke all privileges on all functions in schema public from public, anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select on public.public_profiles to authenticated;
grant select, insert, update, delete on public.rooms to authenticated;
grant select on public.participants to authenticated;
grant select on public.messages to authenticated;
grant insert (room_id, message) on public.messages to authenticated;
grant select on public.follows to authenticated;
grant select, insert, update, delete on public.calendar_notes to authenticated;
grant select, insert, delete on public.dutch_pay_bills to authenticated;

drop function if exists public.is_bill_creator(uuid);
drop function if exists public.is_bill_participant(uuid);
drop function if exists public.is_room_member(uuid);
