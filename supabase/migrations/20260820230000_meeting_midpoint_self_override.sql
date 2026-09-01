-- 중간 지점 계산에 "이번 약속에만 쓸 내 위치" 를 받는다.
--
-- 20260820220000 은 항상 저장된 사는 곳을 썼다. 그런데 일정 추가 STEP 1 에서
-- 현재 위치(GPS)나 다른 곳을 골라 잡을 수 있어야 한다 — 회사에서 밥약을 잡는데
-- 집 주소로 중간 지점이 계산되면 안 된다. 그렇다고 프로필의 사는 곳을 덮으면
-- 한 번 다른 데서 잡은 것 때문에 기본 출발지가 바뀌어 버린다. 그래서 저장하지
-- 않고 이 호출에만 쓰는 좌표를 인자로 받는다.
--
-- 인자를 더하면 예전 함수와 오버로드가 되어 한 개만 넘긴 호출이 모호해지므로
-- 먼저 지운다.
drop function if exists public.meeting_midpoint(uuid[]);

create or replace function public.meeting_midpoint(
  target_profiles uuid[] default '{}',
  self_latitude double precision default null,
  self_longitude double precision default null
)
returns table (
  latitude double precision,
  longitude double precision,
  -- 좌표를 실제로 보탠 사람 수. 화면에서 "n명 기준" 으로 쓴다.
  contributor_count integer,
  -- {"korean": 2, "meat": 1, ...} — 좋아요를 누른 인원수
  taste_counts jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'authentication required';
  end if;

  return query
  with allowed as (
    -- 호출자가 follows 로 연결한 상대만. 모르는 사람 좌표를 캐낼 수 없게 한다.
    select p.id
    from public.profile_private p
    join public.follows f
      on f.following_id = p.id
     and f.follower_id = caller
    where p.id = any(coalesce(target_profiles, '{}'::uuid[]))
      and p.id <> caller
      -- 저장된 적 없으면 화면 기본값과 같이 공개로 본다
      and coalesce(p.privacy_settings ->> 'origin', 'public') <> 'private'
  ),
  mate_rows as (
    select p.start_latitude as lat, p.start_longitude as lng, p.tastes
    from public.profile_private p
    join allowed a on a.id = p.id
  ),
  self_row as (
    -- 넘어온 좌표가 있으면 그것을 쓰고, 없으면 저장된 사는 곳으로 떨어진다
    select
      coalesce(self_latitude, p.start_latitude) as lat,
      coalesce(self_longitude, p.start_longitude) as lng,
      p.tastes
    from public.profile_private p
    where p.id = caller
  ),
  located as (
    select lat, lng, tastes from mate_rows where lat is not null and lng is not null
    union all
    select lat, lng, tastes from self_row where lat is not null and lng is not null
  ),
  liked as (
    select t.key as taste_key
    from located
    cross join lateral jsonb_each(coalesce(located.tastes, '{}'::jsonb)) as t(key, value)
    where t.value = 'true'::jsonb
  ),
  taste_agg as (
    select jsonb_object_agg(g.taste_key, g.cnt) as counts
    from (select liked.taste_key, count(*) as cnt from liked group by liked.taste_key) g
  )
  select
    avg(located.lat)::double precision,
    avg(located.lng)::double precision,
    count(*)::integer,
    coalesce((select counts from taste_agg), '{}'::jsonb)
  from located
  having count(*) > 0;
end;
$$;

revoke all on function public.meeting_midpoint(uuid[], double precision, double precision) from public;
grant execute on function public.meeting_midpoint(uuid[], double precision, double precision) to authenticated;

comment on function public.meeting_midpoint(uuid[], double precision, double precision) is
  '호출자와 허용된 메이트의 출발지 평균 한 점과 취향 인원수를 돌려준다. self 좌표를 넘기면 저장된 사는 곳 대신 그 값을 쓴다. 개별 좌표는 내보내지 않는다.';
