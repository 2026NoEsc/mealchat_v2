-- 알림 읽음 상태를 서버에 남긴다.
--
-- 지금까지 "모두 읽음" 은 그 세션의 메모리에만 있었다. 앱을 다시 켜면 벨의 점이
-- 다시 붙고, 알림이 하나라도 있는 한 영원히 붙어 있는다. 점이 항상 켜져 있으면
-- 사람들은 곧 그것을 보지 않게 된다.
--
-- 읽음 표시를 notifications 행에 달 수는 없다. 그 행은 방 참가자 전원이 함께 보는
-- 것이라, 한 사람이 읽었다고 모두가 읽은 것이 되어 버린다. 사람마다 따로 필요하다.
--
-- 알림별 읽음 테이블을 새로 만드는 방법도 있지만, 화면에는 "모두 읽음" 하나뿐이고
-- 알림 하나씩 읽는 UI 가 없다. 그래서 사람마다 "언제까지 읽었는지" 한 값만 둔다.
-- 그 시각보다 뒤에 만들어진 알림이 안 읽은 것이다. 나중에 알림별 읽음이 필요해지면
-- 그때 테이블을 만들고 이 값은 초기값으로 쓰면 된다.

alter table public.profile_private
  add column if not exists notifications_read_at timestamptz;

comment on column public.profile_private.notifications_read_at is
  '이 시각 이후에 만들어진 알림이 안 읽은 것이다. null 이면 아직 아무것도 읽지 않았다.';

-- 본인 행만 UPDATE 할 수 있다는 정책은 그대로 두고 컬럼 권한만 넓힌다.
grant update (notifications_read_at) on public.profile_private to authenticated;
