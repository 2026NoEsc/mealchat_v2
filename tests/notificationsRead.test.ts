import { hasUnreadNotices } from '../src/lib/notificationsRead';

const at = (iso: string) => ({ createdAt: iso });

describe('hasUnreadNotices', () => {
  it('is false when there is nothing to read', () => {
    expect(hasUnreadNotices([], null)).toBe(false);
    expect(hasUnreadNotices([], '2026-08-20T00:00:00Z')).toBe(false);
  });

  it('treats everything as unread before the first "모두 읽음"', () => {
    expect(hasUnreadNotices([at('2020-01-01T00:00:00Z')], null)).toBe(true);
  });

  it('only counts notices made after the read mark', () => {
    const readAt = '2026-08-20T12:00:00Z';

    expect(hasUnreadNotices([at('2026-08-20T11:59:59Z')], readAt)).toBe(false);
    expect(hasUnreadNotices([at('2026-08-20T12:00:01Z')], readAt)).toBe(true);
  });

  it('does not go by string order', () => {
    /*
     * Postgres 는 소수 자리와 오프셋 표기를 제각각 준다. 문자열로 비교하면
     * "…16:26:38.615356+00:00" 이 "…16:26:39Z" 보다 크다고 나올 수 있다.
     */
    const readAt = '2026-08-19T16:26:39Z';
    const earlier = at('2026-08-19T16:26:38.615356+00:00');

    expect(hasUnreadNotices([earlier], readAt)).toBe(false);
  });

  it('compares across time zone offsets', () => {
    /* 같은 순간을 다르게 적은 것 — 안 읽은 것으로 세면 안 된다 */
    expect(hasUnreadNotices([at('2026-08-20T21:00:00+09:00')], '2026-08-20T12:00:00Z')).toBe(
      false,
    );
    expect(hasUnreadNotices([at('2026-08-20T22:00:00+09:00')], '2026-08-20T12:00:00Z')).toBe(true);
  });

  /* 알림을 숨기는 쪽이 더 나쁘므로 값이 깨졌으면 읽지 않은 것으로 본다 */
  it('falls back to unread when a timestamp cannot be read', () => {
    expect(hasUnreadNotices([at('2026-08-20T12:00:00Z')], '깨진 값')).toBe(true);
    expect(hasUnreadNotices([at('깨진 값')], '2026-08-20T12:00:00Z')).toBe(true);
  });
});
