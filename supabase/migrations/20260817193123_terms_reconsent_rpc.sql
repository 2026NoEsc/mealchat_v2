-- 기존 사용자에게 현재 약관 동의를 다시 받는 경로.
--
-- 동의 기록을 도입할 때 기존 사용자는 일부러 backfill 하지 않았다. 어떤 버전에
-- 동의했는지 기록이 없는데 created_at 을 동의 시각으로 적으면 없는 동의를 만들어내는
-- 셈이기 때문이다. 대신 로그인 후 현재 버전 동의가 없으면 다시 받는다.
--
-- 클라이언트에는 profile_consents INSERT 권한이 없다. 시각과 버전을 클라이언트가
-- 정하게 두면 법적 기록으로서 의미가 없어지므로, 이 RPC 만 쓰기를 할 수 있다.
-- 사용자가 실제로 고르는 값은 마케팅 수신 여부 하나뿐이라 그것만 인자로 받는다.

create or replace function public.record_terms_consent(marketing_opt_in boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  current_version text;
begin
  if caller is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = caller) then
    raise exception 'Profile provisioning is incomplete' using errcode = '23503';
  end if;

  select terms_version.version
  into current_version
  from public.terms_versions terms_version
  where terms_version.is_current
  limit 1;

  if current_version is null then
    raise exception 'No current terms version is published' using errcode = 'P0002';
  end if;

  /*
   * 필수 동의는 true 로 기록한다. 동의하지 않으면 이 함수를 부를 이유가 없고,
   * 계정을 유지할 수도 없다. agreed_at 은 컬럼 기본값인 서버 시각을 쓴다.
   */
  insert into public.profile_consents (profile_id, kind, version, agreed)
  values
    (caller, 'service', current_version, true),
    (caller, 'privacy', current_version, true),
    (caller, 'marketing', current_version, coalesce(marketing_opt_in, false));

  return current_version;
end;
$$;

revoke all on function public.record_terms_consent(boolean) from public, anon, authenticated;
grant execute on function public.record_terms_consent(boolean) to authenticated;

/*
 * 현재 버전에 동의했는지 한 번에 묻는다. 클라이언트가 terms_versions 와
 * profile_consents 를 각각 읽어 맞춰 보게 하면 판정 기준이 화면마다 갈린다.
 */
create or replace function public.current_terms_consent_status()
returns table (version text, agreed boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    terms_version.version,
    exists (
      select 1
      from public.profile_consents consent
      where consent.profile_id = (select auth.uid())
        and consent.version = terms_version.version
        and consent.kind = 'service'
        and consent.agreed
    ) as agreed
  from public.terms_versions terms_version
  where terms_version.is_current
  limit 1;
$$;

revoke all on function public.current_terms_consent_status() from public, anon, authenticated;
grant execute on function public.current_terms_consent_status() to authenticated;
