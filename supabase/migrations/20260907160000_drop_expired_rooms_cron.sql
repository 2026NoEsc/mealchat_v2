-- 만료된 방 청소를 크론에서 앱 쪽으로 옮긴다.
--
-- pg_cron 은 프로젝트 설정에 따라 못 쓸 수도 있고, 스케줄이 걸렸는지 앱에서는
-- 확인할 방법이 없다. 실제로 예약이 조용히 실패해도 방이 안 지워지는 것 말고는
-- 증상이 없어서, 문제를 늦게 알아차리게 된다.
--
-- 대신 방 목록을 불러올 때 청소를 한 번 돌린다. 목록을 보는 사람이 있어야
-- 지워지지만, 아무도 안 보는 방이 하루 더 남아 있는 것은 문제가 되지 않는다.
-- 어차피 화면에서는 기한이 지난 방을 이미 걸러서 보여 준다.
--
-- 함수는 그대로 두고 실행 권한만 연다. 사용자 입력을 받지 않고 이미 기한이
-- 지난 행만 지우므로, 아무나 불러도 남의 살아 있는 방은 건드리지 못한다.

do $$
begin
  perform cron.unschedule('delete-expired-rooms')
  where exists (select 1 from cron.job where jobname = 'delete-expired-rooms');
exception when others then
  /* pg_cron 이 없으면 지울 것도 없다 */
  null;
end;
$$;

grant execute on function public.delete_expired_rooms() to authenticated;

comment on function public.delete_expired_rooms is
  '기한이 지난 방을 지운다. 앱이 방 목록을 불러올 때 부른다. 정산 내역은 room_id 가 null 이 되어 남는다.';
