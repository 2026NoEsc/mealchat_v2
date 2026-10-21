import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getConsentAccess, subscribeConsentAccess } from '../consents/access';
import type { MeetingTime } from './meetingTime';
import { previewRoomMeetingTime } from './roomDecisions';

/** Bind counts and revision to one account, room and exact interval; late reads never replace a new choice. */
export function useMeetingTimePreview(roomId: string | null, time: MeetingTime | null, revision: string | undefined) {
  const access = useSyncExternalStore(subscribeConsentAccess, getConsentAccess, getConsentAccess);
  const key = roomId && time && access.state === 'accepted' ? JSON.stringify([access.userId, roomId, time.starts_at, time.ends_at, time.time_zone, revision]) : null;
  const [retry, setRetry] = useState(0);
  const query = useRef({ key, retry });
  if (query.current.key !== key || query.current.retry !== retry) query.current = { key, retry };
  const context = query.current;
  const [snapshot, setSnapshot] = useState<{ context: typeof context; result: Awaited<ReturnType<typeof previewRoomMeetingTime>> } | null>(null);
  const startsAt = time?.starts_at, endsAt = time?.ends_at, zone = time?.time_zone;
  useEffect(() => {
    if (!key || !roomId || !startsAt || !endsAt || !zone) return;
    let active = true;
    void previewRoomMeetingTime(roomId, { starts_at: startsAt, ends_at: endsAt, time_zone: zone }).then(result => {
      if (active) setSnapshot({ context, result });
    });
    return () => { active = false; };
  }, [key, roomId, startsAt, endsAt, zone, retry, context]);
  const result = snapshot?.context === context ? snapshot.result : null;
  return { data: result?.data ?? null, unsupported: result?.unsupported ?? false, error: result?.error ?? null,
    loading: Boolean(key && !result), reload: () => setRetry(value => value + 1) };
}
