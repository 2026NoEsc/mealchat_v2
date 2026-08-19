/**
 * 알림 읽음 판정.
 *
 * 읽음 상태는 알림 행이 아니라 사람마다 "언제까지 읽었는지" 한 값으로 둔다
 * (`profile_private.notifications_read_at`). 알림 행은 방 참가자가 함께 보는
 * 것이라 행에 표시를 달면 한 사람이 읽었을 때 모두가 읽은 것이 되어 버린다.
 *
 * supabase 를 import 하지 않는다 — 네이티브 모듈 없이 테스트할 수 있어야 한다.
 */

/** 시각 비교에 필요한 만큼만 요구한다 */
export type ReadableNotice = { createdAt: string };

/**
 * 안 읽은 알림이 있는지.
 *
 * 문자열끼리 비교하지 않는다. Postgres 가 주는 값은 소수 자리와 오프셋 표기가
 * 제각각이라 사전순 비교가 시각 순서와 어긋날 수 있다.
 */
export function hasUnreadNotices(notices: ReadableNotice[], readAt: string | null): boolean {
  if (notices.length === 0) return false;
  if (!readAt) return true;

  const read = Date.parse(readAt);
  /* 저장된 값이 깨졌으면 읽지 않은 것으로 본다 — 알림을 숨기는 쪽이 더 나쁘다 */
  if (Number.isNaN(read)) return true;

  return notices.some((notice) => {
    const created = Date.parse(notice.createdAt);
    return Number.isNaN(created) ? true : created > read;
  });
}
