-- P0 containment: 현재 앱 호출부가 없는 정밀 위치 midpoint RPC를 즉시 닫는다.
-- 함수 정의는 보존하므로, 제품 권한을 별도로 확정한 뒤에만 새 migration으로 재도입할 수 있다.
-- 이 파일은 초대/정산/채팅 변경에 의존하지 않도록 의도적으로 revoke 하나만 둔다.

-- baseline snapshot에는 이 함수를 담지 못했지만 운영 DB에는 존재한다. 새 로컬 DB를
-- 처음부터 재구성할 때도 migration이 멈추지 않게 존재할 때만 revoke한다.
do $$
begin
  if to_regprocedure('public.meeting_midpoint(uuid[], double precision, double precision)') is not null then
    execute 'revoke all on function public.meeting_midpoint(uuid[], double precision, double precision) from public, anon, authenticated';
  end if;
end;
$$;
