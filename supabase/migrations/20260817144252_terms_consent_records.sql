-- Terms-agreement record keeping.
--
-- The signup screen collected consent checkboxes but stored them nowhere, so there
-- was no record of WHICH terms version a user accepted or WHEN. This migration adds
-- a server-written, append-only consent log.
--
-- Trust model: the client cannot be the source of truth for a legal record.
--   * agreed_at always comes from the server clock, never from the client.
--   * the terms version always comes from public.terms_versions, never from the client.
--   * required consents (service, privacy) are recorded as agreed because account
--     creation is impossible without them; the client blocks submission and the
--     server would have no account to attach a "declined" record to.
--   * only the optional marketing opt-in is read from signup metadata, since that is
--     the one value the user genuinely chooses.
--
-- Depends on 20260817131934_security_auth_foundation.sql (private.handle_new_user).

create table if not exists public.terms_versions (
  id bigint generated always as identity primary key,
  version text not null unique,
  effective_from timestamptz not null default now(),
  is_current boolean not null default false
);

alter table public.terms_versions enable row level security;

-- 현재 버전은 언제나 한 개만 존재한다
create unique index if not exists terms_versions_single_current_idx
  on public.terms_versions (is_current)
  where is_current;

insert into public.terms_versions (version, is_current)
select '2026-08-17', true
where not exists (select 1 from public.terms_versions where is_current);

create table if not exists public.profile_consents (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  version text not null,
  agreed boolean not null,
  agreed_at timestamptz not null default now(),
  constraint profile_consents_known_kind check (kind in ('service', 'privacy', 'marketing'))
);

alter table public.profile_consents enable row level security;

/*
 * 동의 이력은 append-only 다. 마케팅 동의 철회도 새 행으로 남기고 기존 행을 고치지 않는다.
 * 따라서 (profile_id, kind) UNIQUE 를 걸지 않는다 — 최신 상태는 agreed_at 으로 판단한다.
 */
create index if not exists profile_consents_profile_kind_idx
  on public.profile_consents (profile_id, kind, agreed_at desc);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_version text;
  marketing_opt_in boolean;
begin
  insert into public.profiles (id, name, tag)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), '새 사용자'),
    'user-' || substring(replace(new.id::text, '-', '') from 1 for 8)
  )
  on conflict (id) do nothing;

  select terms_version.version
  into current_version
  from public.terms_versions terms_version
  where terms_version.is_current
  limit 1;

  -- 버전 행이 없어도 가입 자체를 막지는 않는다
  current_version := coalesce(current_version, 'unversioned');

  -- `->>` 는 키가 없으면 null 이라 잘못된 값으로도 예외가 나지 않는다
  marketing_opt_in := coalesce(
    (new.raw_user_meta_data ->> 'marketing_opt_in') = 'true',
    false
  );

  insert into public.profile_consents (profile_id, kind, version, agreed)
  values
    (new.id, 'service', current_version, true),
    (new.id, 'privacy', current_version, true),
    (new.id, 'marketing', current_version, marketing_opt_in);

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop policy if exists terms_versions_select_authenticated on public.terms_versions;
create policy terms_versions_select_authenticated
on public.terms_versions
for select to authenticated
using (true);

drop policy if exists profile_consents_select_own on public.profile_consents;
create policy profile_consents_select_own
on public.profile_consents
for select to authenticated
using (profile_id = (select auth.uid()));

/*
 * 쓰기 권한은 주지 않는다. 삽입은 SECURITY DEFINER 트리거만 한다.
 * 마케팅 동의 철회는 별도 RPC 로 추가해야 하는 후속 작업이다.
 */
grant select on public.terms_versions to authenticated;
grant select on public.profile_consents to authenticated;

/*
 * 기존 사용자는 의도적으로 backfill 하지 않는다.
 *
 * 이 로그가 생기기 전에 만들어진 계정은 어떤 버전에 동의했는지 기록이 없다.
 * created_at 을 동의 시각으로 적어 넣으면 없는 동의를 만들어내는 셈이라
 * 법적 기록으로서 오히려 위험하다. 행이 없는 상태가 "동의 기록 없음" 이라는
 * 정확한 사실이고, 앱은 현재 버전 동의 행이 없으면 다시 동의를 받아야 한다.
 *
 * 후속 작업: 로그인 후 현재 버전 동의가 없으면 재동의 화면을 띄우고,
 * 그 동의를 기록하는 RPC 를 추가한다 (클라이언트 직접 INSERT 는 계속 막는다).
 */
