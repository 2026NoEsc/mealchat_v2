import { supabase } from './supabase';

/**
 * 개인 캘린더의 일정과 메모.
 *
 * calendar_notes 는 한 테이블에 둘을 겸한다. 시간(`time`)이 있으면 일정,
 * 없으면 그 날짜에 남긴 메모로 다룬다. baseline 이 그렇게 만들어져 있어
 * 스키마를 바꾸지 않고 그대로 쓴다.
 */
export type CalendarNote = {
  id: string;
  date: string;
  title: string;
  content: string;
  color: string | null;
  time: string | null;
  endTime: string | null;
};

type NoteRow = {
  id: string;
  date: string;
  title: string;
  content: string;
  color: string | null;
  time: string | null;
  end_time: string | null;
};

const SELECT = 'id, date, title, content, color, time, end_time';

function toNote(row: NoteRow): CalendarNote {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    content: row.content,
    color: row.color,
    time: row.time,
    endTime: row.end_time,
  };
}

/** 한 달치를 한 번에 읽는다. 날짜는 `YYYY-MM-DD`. */
export async function fetchMonthNotes(
  year: number,
  month: number,
): Promise<{ data: CalendarNote[] | null; error: Error | null }> {
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('calendar_notes')
    .select(SELECT)
    .gte('date', first)
    .lt('date', nextMonth)
    .order('date', { ascending: true })
    .returns<NoteRow[]>();

  if (error) return { data: null, error };
  return { data: (data ?? []).map(toNote), error: null };
}

export async function createEvent(input: {
  profileId: string;
  date: string;
  title: string;
  time: string;
  endTime: string;
  color: string;
}): Promise<{ data: CalendarNote | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('calendar_notes')
    .insert({
      profile_id: input.profileId,
      date: input.date,
      title: input.title,
      time: input.time,
      end_time: input.endTime,
      color: input.color,
    })
    .select(SELECT)
    .maybeSingle<NoteRow>();

  if (error) return { data: null, error };
  return { data: data ? toNote(data) : null, error: null };
}

export async function updateEvent(
  id: string,
  patch: { title: string; time: string; endTime: string; color: string },
): Promise<Error | null> {
  const { error } = await supabase
    .from('calendar_notes')
    .update({
      title: patch.title,
      time: patch.time,
      end_time: patch.endTime,
      color: patch.color,
    })
    .eq('id', id);
  return error;
}

export async function deleteNote(id: string): Promise<Error | null> {
  const { error } = await supabase.from('calendar_notes').delete().eq('id', id);
  return error;
}

/** 메모는 시간이 없는 항목이다. 날짜당 하나만 두므로 있으면 고치고 없으면 만든다. */
export async function saveMemo(input: {
  profileId: string;
  date: string;
  existingId: string | null;
  content: string;
}): Promise<Error | null> {
  const trimmed = input.content.trim();

  if (input.existingId) {
    if (!trimmed) return deleteNote(input.existingId);
    const { error } = await supabase
      .from('calendar_notes')
      .update({ content: trimmed })
      .eq('id', input.existingId);
    return error;
  }

  if (!trimmed) return null;

  const { error } = await supabase.from('calendar_notes').insert({
    profile_id: input.profileId,
    date: input.date,
    title: '',
    content: trimmed,
  });
  return error;
}
