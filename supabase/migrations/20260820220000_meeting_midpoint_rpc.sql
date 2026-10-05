-- 약속 장소 추천에 쓸 중간 지점과 취향 집계.
--
-- profile_private 는 본인만 읽는다. 그 정책을 풀지 않고 이 함수만 security definer
-- 로 열어서, 개별 좌표는 절대 client 로 내보내지 않고 "평균 한 점"과 "취향별 인원수"
-- 만 돌려준다. 좌표 하나를 알면 집을 아는 것과 같아서, 집계만 내보내는 것이 요점이다.
--
-- 넣을 수 있는 사람은 두 조건을 모두 만족해야 한다.
--   1) 호출자가 follows 로 연결한 상대일 것 — 모르는 사람 좌표를 캐낼 수 없게 한다.
--   2) 상대가 출발지 공개를 끄지 않았을 것 — 정보 공개 범위 화면의 origin 토글이다.
-- 호출자 본인은 언제나 포함된다.

create or replace function public.meeting_midpoint(target_profiles uuid[] default '{}')
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
    select p.id
    from public.profile_private p
    where p.id = caller

    union

    select p.id
    from public.profile_private p
    join public.follows f
      on f.following_id = p.id
     and f.follower_id = caller
    where p.id = any(coalesce(target_profiles, '{}'::uuid[]))
      -- 저장된 적 없으면 화면 기본값과 같이 공개로 본다
      and coalesce(p.privacy_settings ->> 'origin', 'public') <> 'private'
  ),
  located as (
    select p.start_latitude as lat, p.start_longitude as lng, p.tastes
    from public.profile_private p
    join allowed a on a.id = p.id
    where p.start_latitude is not null
      and p.start_longitude is not null
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

revoke all on function public.meeting_midpoint(uuid[]) from public;
grant execute on function public.meeting_midpoint(uuid[]) to authenticated;

comment on function public.meeting_midpoint(uuid[]) is
  '호출자와 허용된 메이트의 출발지 평균 한 점과 취향 인원수를 돌려준다. 개별 좌표는 내보내지 않는다.';
