-- 공개 신원과 개인정보를 분리한다.
--
-- baseline 의 profiles 는 표시용 신원(name, tag, avatar_*)과 개인정보를 한 테이블에
-- 섞어 두고 있었다. profiles_select 가 USING (true) 였을 때는 이게 곧 전체 유출이었다.
-- 하드닝으로 자기 행만 보이게 바뀌어 급한 불은 껐지만, 한 테이블에 섞여 있는 한
-- 정책을 한 번 잘못 넓히면 다시 전부 새어 나간다. 그래서 물리적으로 나눈다.
--
-- 분리 후 세 테이블의 역할:
--   public_profiles  다른 사용자에게 보여도 되는 것만 (이미 존재)
--   profiles         본인 확인용 신원 + 위 테이블의 원본
--   profile_private  본인 외에는 누구에게도 열리지 않는 것
--
-- 개인정보가 별도 컬럼이 아니라 personal_data / privacy_settings JSONB 안에 들어
-- 있어서, 기존 JSONB 는 내용을 잃지 않도록 통째로 옮기고 가입 화면이 모으는 항목만
-- 새 컬럼으로 정규화한다.

create table if not exists public.profile_private (
  id uuid primary key references public.profiles (id) on delete cascade,
  personal_data jsonb not null default '{}'::jsonb,
  privacy_settings jsonb not null default
    '{"gender": "public", "birthdate": "public", "bank_account": "private"}'::jsonb,
  schedule jsonb not null default '{}'::jsonb,
  push_token text,
  bank_name text,
  account_number text,
  birth_date date,
  tastes jsonb not null default '{}'::jsonb,
  start_location_name text,
  start_latitude double precision,
  start_longitude double precision,
  updated_at timestamptz not null default now(),
  constraint profile_private_birth_date_sane
    check (birth_date is null or birth_date between date '1900-01-01' and current_date)
);

alter table public.profile_private enable row level security;

-- 기존 값을 먼저 옮긴다. 아래 drop column 보다 반드시 앞서야 한다.
insert into public.profile_private (
  id, personal_data, privacy_settings, schedule,
  push_token, start_location_name, start_latitude, start_longitude
)
select
  id, personal_data, privacy_settings, schedule,
  push_token, start_location_name, start_latitude, start_longitude
from public.profiles
on conflict (id) do nothing;

alter table public.profiles
  drop column if exists personal_data,
  drop column if exists privacy_settings,
  drop column if exists schedule,
  drop column if exists push_token,
  drop column if exists start_location_name,
  drop column if exists start_latitude,
  drop column if exists start_longitude;

drop trigger if exists profile_private_touch_updated_at on public.profile_private;
create trigger profile_private_touch_updated_at
before update on public.profile_private
for each row execute function private.touch_updated_at();

/*
 * 가입 트리거가 profiles 와 함께 비공개 행도 만든다.
 * 클라이언트에 INSERT 권한을 주지 않으므로 행이 없으면 본인도 자기 정보를 못 넣는다.
 */
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

  insert into public.profile_private (id)
  values (new.id)
  on conflict (id) do nothing;

  select terms_version.version
  into current_version
  from public.terms_versions terms_version
  where terms_version.is_current
  limit 1;

  current_version := coalesce(current_version, 'unversioned');

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

-- 이미 가입한 사용자에게도 빈 비공개 행을 만들어 준다
insert into public.profile_private (id)
select id from public.profiles
on conflict (id) do nothing;

drop policy if exists profile_private_select_own on public.profile_private;
create policy profile_private_select_own
on public.profile_private
for select to authenticated
using (id = (select auth.uid()));

drop policy if exists profile_private_update_own on public.profile_private;
create policy profile_private_update_own
on public.profile_private
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

/*
 * INSERT 와 DELETE 는 주지 않는다. 행의 수명은 profiles 를 따라가고
 * 생성은 트리거가, 삭제는 on delete cascade 가 맡는다.
 */
grant select on public.profile_private to authenticated;
grant update (
  personal_data, privacy_settings, schedule, push_token,
  bank_name, account_number, birth_date, tastes,
  start_location_name, start_latitude, start_longitude
) on public.profile_private to authenticated;

/*
 * 남은 문제, 이번 범위 밖:
 *   participants 는 방 참가 시점의 personal_data / schedule 사본을 갖고 있고
 *   같은 방 멤버 전원에게 보인다. 정산에 계좌가 필요해서 생긴 구조라
 *   무엇을 복사할지 정하는 별도 작업이 필요하다.
 *   dutch_pay_bills 와 notifications 도 계좌번호를 각자 들고 있다.
 */
