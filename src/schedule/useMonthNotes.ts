import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { fetchMonthNotes, type CalendarNote } from '../lib/calendarNotes';
import type { PersonalEvent } from '../screens/schedule/PersonalEventSheet';

type Status = 'loading' | 'ready' | 'error';

export function useMonthNotes(year: number, month: number) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [notes, setNotes] = useState<CalendarNote[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    if (!userId) {
      setNotes([]);
      setStatus('loading');
      return;
    }

    let active = true;
    setStatus('loading');

    void fetchMonthNotes(year, month)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setNotes([]);
          setStatus('error');
          return;
        }
        setNotes(data ?? []);
        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setNotes([]);
        setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [userId, year, month, reloadToken]);

  return { notes, status, reload };
}

/**
 * calendar_notes 한 테이블이 일정과 메모를 겸한다. 시간이 있으면 일정,
 * 없으면 그 날짜의 메모다. 화면은 둘을 따로 쓰므로 여기서 갈라 놓는다.
 */
export function groupNotes(notes: CalendarNote[]) {
  const eventsByDay: Record<number, PersonalEvent[]> = {};
  const memosByDay: Record<number, string> = {};
  const memoIdByDay: Record<number, string> = {};

  for (const note of notes) {
    const day = Number(note.date.slice(8, 10));
    if (!Number.isInteger(day)) continue;

    if (note.time) {
      const list = eventsByDay[day] ?? [];
      list.push({
        id: note.id,
        title: note.title,
        time: `${note.time} ~ ${note.endTime ?? ''}`.trim(),
        color: note.color ?? '#5B9BD5',
      });
      eventsByDay[day] = list;
      continue;
    }

    memosByDay[day] = note.content;
    memoIdByDay[day] = note.id;
  }

  return { eventsByDay, memosByDay, memoIdByDay };
}
