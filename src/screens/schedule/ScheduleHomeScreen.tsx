import { ChevronLeft, ChevronRight, Lock, Pencil, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import AppHeader from '../../components/AppHeader';
import { Button } from '../../components/ui/Button';
import { Switch } from '../../components/ui/Switch';
import { buildWeeksOf, columnOfIn, daysInMonth, shiftMonth, todayParts, WEEKDAYS } from '../../lib/calendar';
import { createEvent, deleteNote, saveMemo as saveMemoNote, updateEvent } from '../../lib/calendarNotes';
import { useNavigation } from '../../navigation/NavigationContext';
import { groupNotes, useMonthNotes } from '../../schedule/useMonthNotes';
import { subscribeRoomLifecycle } from '../../lib/roomLifecycle';
import { useTopInset } from '../../theme/insets';
import { v3Layout } from '../../theme/scale';
import { scheduleColors, scheduleLayout as layout } from '../../theme/scheduleTokens';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import PersonalEventSheet, { type PersonalEvent, type PersonalEventTab } from './PersonalEventSheet';
import { canMoveCalendarMonth, earliestCalendarMonth } from './scheduleState';

export default function ScheduleHomeScreen() {
  /* 상태바 높이는 insets.top 만으로는 모자란 기기가 있다 */
  const topInset = useTopInset();
  const { navigate } = useNavigation();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  /* 상수로 박아 두면 다음 달에 앱을 열어도 지난 달이 나온다 */
  const [today] = useState(todayParts);
  const [month, setMonth] = useState({ year: today.year, month: today.month });
  const [selected, setSelected] = useState(today.day);
  const weeks = buildWeeksOf(month.year, month.month);
  const earliestMonth = earliestCalendarMonth(user?.created_at);
  const previousAllowed = canMoveCalendarMonth(month, -1, earliestMonth);
  const [autoSync, setAutoSync] = useState(true);

  /**
   * 달을 옮긴다. 고른 날이 새 달에 없으면 그 달의 마지막 날로 당긴다.
   *
   * 그냥 두면 8월 31일을 고른 채 9월로 넘어갔을 때 "9월 31일" 이 헤더에 뜨고,
   * 그 날짜로 일정을 만들면 서버가 `date/time field value out of range` 로 거절한다.
   * 달력 격자에는 그런 칸이 없으니 사용자는 무엇이 잘못됐는지 알 수도 없다.
   */
  const goMonth = (delta: number) =>
    setMonth((current) => {
      if (!canMoveCalendarMonth(current, delta, earliestMonth)) return current;
      const next = shiftMonth(current.year, current.month, delta);
      setSelected((day) => Math.min(day, daysInMonth(next.year, next.month)));
      return next;
    });

  const { notes, status, reload } = useMonthNotes(month.year, month.month);
  const { eventsByDay, memosByDay, memoIdByDay } = groupNotes(notes);
  useEffect(() => {
    return subscribeRoomLifecycle(() => {
      reload();
    });
  }, [reload]);

  /*
   * session 은 시트를 열 때만 증가한다. 시트 안의 입력 폼은 이 값으로 초기화되고,
   * 닫을 때는 값이 그대로라 Modal 이 살아 있어 닫힘 애니메이션이 끊기지 않는다.
   */
  const [sheet, setSheet] = useState<{ open: boolean; session: number; editing: PersonalEvent | null; tab: PersonalEventTab }>({ open: false, session: 0, editing: null, tab: 'event' });
  const openSheet = (editing: PersonalEvent | null = null, tab: PersonalEventTab = 'event') =>
    setSheet((prev) => ({ open: true, session: prev.session + 1, editing, tab }));

  const events = eventsByDay[selected] ?? [];
  const memo = memosByDay[selected] ?? '';
  const dateOf = (day: number) =>
    `${month.year}-${String(month.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  /** 저장에 성공했을 때만 true — 실패하면 시트가 열린 채로 남는다 */
  const saveEvent = async (event: PersonalEvent): Promise<boolean> => {
    if (!userId) return false;
    try {
      const [start, end] = event.time.split('~').map((part) => part.trim());
      /* id 가 서버에 있는 것이면 수정, 시트가 만든 임시 id 면 새로 만든다 */
      const existing = events.some((item) => item.id === event.id);

      const error = existing
        ? await updateEvent(event.id, {
            title: event.title,
            time: start,
            endTime: end,
            color: event.color,
          })
        : (
            await createEvent({
              profileId: userId,
              date: dateOf(selected),
              title: event.title,
              time: start,
              endTime: end,
              color: event.color,
            })
          ).error;

      if (error) {
        Alert.alert('저장 실패', error.message);
        return false;
      }
      reload();
      return true;
    } catch {
      Alert.alert('저장 실패', '일정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
      return false;
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      const error = await deleteNote(id);
      if (error) {
        Alert.alert('삭제 실패', error.message);
        return false;
      }
      reload();
      return true;
    } catch {
      Alert.alert('삭제 실패', '일정을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.');
      return false;
    }
  };

  const saveMemo = async (next: string): Promise<boolean> => {
    if (!userId) return false;
    try {
      const error = await saveMemoNote({
        profileId: userId,
        date: dateOf(selected),
        existingId: memoIdByDay[selected] ?? null,
        content: next,
      });
      if (error) {
        Alert.alert('저장 실패', error.message);
        return false;
      }
      reload();
      return true;
    } catch {
      Alert.alert('저장 실패', '메모를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
      return false;
    }
  };

  return (
    <View style={styles.screen}>
      <View style={{ height: topInset }} />
      <AppHeader />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text accessibilityRole="header" style={styles.title}>내 캘린더</Text>
          <View style={styles.syncRow}>
            <Text style={styles.syncLabel}>구글 자동 연동</Text>
            {/* TODO(서버 단계): 실제 구글 연동·동기화 계약. 기존 로컬 boolean만 유지한다. */}
            <Switch value={autoSync} onChange={setAutoSync} accessibilityLabel="구글 자동 연동" />
          </View>
        </View>
        <View style={styles.calendar}>
          <View style={styles.monthRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="이전 달" accessibilityState={{ disabled: !previousAllowed }} disabled={!previousAllowed} style={[styles.arrow, !previousAllowed && styles.disabled]} onPress={() => goMonth(-1)}><ChevronLeft size={20} color={colors.ink} /></Pressable>
            <Text style={styles.month}>{month.year}년 {month.month}월</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="다음 달" style={styles.arrow} onPress={() => goMonth(1)}><ChevronRight size={20} color={colors.ink} /></Pressable>
          </View>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((day, index) => <View key={day} style={styles.weekdayCell}><Text style={[styles.weekday, dayColor(index)]}>{day}</Text></View>)}
          </View>
          {weeks.map((week, index) => <View key={index} style={styles.weekRow}>
            {week.map((day, column) => {
              if (day === null) return <View key={column} style={styles.dayCell} />;
              const on = day === selected;
              const isToday = day === today.day && month.year === today.year && month.month === today.month;
              const list = eventsByDay[day] ?? [];
              return <Pressable key={column} accessibilityRole="button" accessibilityLabel={month.month + '월 ' + day + '일, 일정 ' + list.length + '개'} accessibilityState={{ selected: on }} style={styles.dayCell} onPress={() => setSelected(day)}>
                <View style={[styles.dayNumber, isToday && styles.today, on && styles.selected]}>
                  <Text style={[styles.day, dayColor(column), on && styles.selectedText]}>{day}</Text>
                </View>
                <View style={styles.dots}>{list.slice(0, 3).map((event) => <View key={event.id} style={[styles.dot, { backgroundColor: event.color }]} />)}</View>
              </Pressable>;
            })}
          </View>)}
        </View>
        <View style={styles.dayHeader}>
          <Text style={styles.dayTitle}>{month.month}월 {selected}일 ({WEEKDAYS[columnOfIn(month.year, month.month, selected)]}) 일정 {events.length}개</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="일정 추가" style={styles.add} onPress={() => openSheet()}><Plus size={16} color={colors.selectedText} /><Text style={styles.addText}>일정 추가</Text></Pressable>
        </View>
        {status === 'loading' ? <Text style={styles.empty}>불러오는 중...</Text>
          : status === 'error' ? <View style={styles.emptyCard}><Text style={styles.empty}>일정을 불러오지 못했어요</Text><Button label="다시 시도" variant="secondary" onPress={reload} /></View>
          : events.length === 0 ? <View style={[styles.emptyCard, styles.noEvents]}><Text style={styles.emptyTitle}>등록된 일정이 없어요</Text><Text style={styles.emptyHint}>일정을 추가하거나 새 밥약을 잡아 보세요.</Text></View>
          : events.map((event) => <View key={event.id} style={styles.eventRow}>
            <View style={[styles.eventBar, { backgroundColor: event.color }]} />
            <View style={styles.eventBody}><Text style={styles.eventTitle}>{event.title}</Text><Text style={styles.eventTime}>{event.time.replace('~', '–')} · {event.device ? '기기' : '직접'}</Text></View>
            {event.device ? <View style={styles.arrow} accessible accessibilityLabel="기기 일정, 수정 불가"><Lock size={18} color={colors.sub} /></View>
              : <Pressable accessibilityRole="button" accessibilityLabel={event.title + ' 일정 수정'} style={styles.arrow} onPress={() => openSheet(event)}><Pencil size={18} color={colors.sub} /></Pressable>}
          </View>)}
        {memo ? <Pressable accessibilityRole="button" accessibilityLabel="약속 메모 수정" style={styles.memo} onPress={() => openSheet(null, 'memo')}><Text style={styles.empty}>{memo}</Text></Pressable> : null}
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityLabel="새 밥약" style={styles.fab} onPress={() => navigate('ScheduleDetail')}><Plus size={22} color={colors.onPrimary} /><Text style={styles.fabLabel}>새 밥약</Text></Pressable>
      <PersonalEventSheet visible={sheet.open} session={sheet.session} year={month.year} month={month.month} day={selected}
        editing={sheet.editing} memo={memo} initialTab={sheet.tab} onClose={() => setSheet((prev) => ({ ...prev, open: false }))}
        onSave={saveEvent} onSaveMemo={saveMemo} onDelete={deleteEvent} />
    </View>
  );
}
function dayColor(column: number) { return column === 0 ? styles.sunday : column === 6 ? styles.saturday : undefined; }
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: layout.pagePadding, paddingBottom: 150, gap: 14 },
  titleRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 4 },
  title: { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 32, color: colors.ink },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  syncLabel: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 19, color: colors.sub },
  calendar: { borderWidth: 1, borderColor: colors.border, borderRadius: layout.cardRadius, backgroundColor: colors.surface, padding: layout.calendarPadding, paddingBottom: layout.calendarPadding + layout.calendarRowGap, gap: layout.calendarRowGap },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { width: v3Layout.minTouchTarget, height: v3Layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  month: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 23, color: colors.ink },
  weekRow: { flexDirection: 'row' },
  weekdayCell: { flex: 1, height: layout.calendarWeekday, alignItems: 'center', justifyContent: 'center' },
  weekday: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 17, color: colors.sub },
  dayCell: { flex: 1, minWidth: 0, height: layout.calendarDay, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayNumber: { width: layout.calendarNumber, height: layout.calendarNumber, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  today: { backgroundColor: colors.mutedBg }, selected: { backgroundColor: colors.primary },
  day: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, color: colors.ink },
  selectedText: { color: colors.onPrimary, fontFamily: fontFamily.bold },
  sunday: { color: v3FeedbackColors.error }, saturday: { color: scheduleColors.saturday },
  dots: { flexDirection: 'row', gap: 2, height: layout.dot },
  dot: { width: layout.dot, height: layout.dot, borderRadius: 2 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dayTitle: { flex: 1, fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 23, color: colors.ink },
  add: { minHeight: v3Layout.minTouchTarget, borderRadius: 18, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.selectedBg },
  addText: { fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 20, color: colors.selectedText },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 12, paddingRight: 4, paddingVertical: 12, borderWidth: 1, borderColor: colors.border, borderRadius: layout.fieldRadius, backgroundColor: colors.surface },
  eventBar: { width: 4, height: 36, borderRadius: 2 }, eventBody: { flex: 1 },
  eventTitle: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22, color: colors.ink },
  eventTime: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.sub },
  emptyCard: { padding: layout.cardPadding, borderWidth: 1, borderColor: colors.border, borderRadius: layout.fieldRadius, backgroundColor: colors.surface, gap: 8 },
  noEvents: { paddingHorizontal: 16, paddingVertical: 20, alignItems: 'center', gap: 4 },
  emptyTitle: { fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 20, color: colors.ink, textAlign: 'center' },
  emptyHint: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17, color: colors.sub, textAlign: 'center' },
  empty: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.sub },
  memo: { minHeight: v3Layout.minTouchTarget, padding: 12, backgroundColor: colors.selectedBg, borderRadius: layout.fieldRadius },
  fab: { position: 'absolute', right: layout.pagePadding, bottom: layout.pagePadding, height: 56, paddingHorizontal: 20, borderRadius: 28, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary },
  fabLabel: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 24, color: colors.onPrimary },
});
