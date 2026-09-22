-- 가입 전에 이메일이 이미 쓰이는지 물어본다.
--
-- 지금은 가입 요청이 마지막 약관 화면에서야 일어난다. 그래서 이미 가입된
-- 이메일을 적으면 개인정보 → 캘린더 → 취향 → 약관을 다 지나온 뒤에 거절당하고,
-- 처음으로 되돌아가야 했다.
--
-- 주의: Supabase 는 "이 이메일이 가입돼 있나" 를 묻는 공개 API 를 일부러 막아 둔다.
-- 아무나 이메일을 넣어 보며 가입 여부를 캐낼 수 있기 때문이다(가입자 명단 유출).
-- 이 함수를 여는 것은 그 위험을 우리가 떠안는다는 뜻이다. 그래서 최소한으로 만든다.
--
--   - 돌려주는 것은 있다/없다 뿐이다. 이름·가입일·확인 여부는 절대 내보내지 않는다.
--   - 형식이 맞는 이메일만 조회한다. 무작위 문자열로 긁는 것을 조금이라도 줄인다.
--   - auth.users 를 읽어야 하므로 security definer 이고, search_path 를 비워 둔다.
--
-- 그래도 "가입 여부를 알 수 있다" 는 사실 자체는 남는다. 회원가입 화면이 있는
-- 서비스 대부분이 감수하는 수준이라고 보고 연다.

create or replace function public.email_available(candidate text)
returns boolean
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  normalized text := lower(btrim(coalesce(candidate, '')));
begin
  /* 형식이 아니면 조회하지 않는다. "쓸 수 없다" 로 답해 화면이 형식을 먼저 잡게 한다 */
  if normalized !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return false;
  end if;

  return not exists (
    select 1 from auth.users
    where lower(email) = normalized
      and deleted_at is null
  );
end;
$$;

revoke all on function public.email_available(text) from public;
/* 가입은 로그인 전에 일어난다 — anon 도 부를 수 있어야 한다 */
grant execute on function public.email_available(text) to anon, authenticated;

comment on function public.email_available(text) is
  '이메일을 쓸 수 있는지만 돌려준다. 가입 화면의 중복 확인에 쓴다.';
