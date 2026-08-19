import { Clock, Lock, Pencil, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/AuthProvider';
import AppHeader from '../../components/AppHeader';
import {
  buildWeeksOf,
  columnOfIn,
  daysInMonth,
  shiftMonth,
  todayParts,
  WEEKDAYS,
} from '../../lib/calendar';
import { createEvent, deleteNote, saveMemo as saveMemoNote, updateEvent } from '../../lib/calendarNotes';
import { groupNotes, useMonthNotes } from '../../schedule/useMonthNotes';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';
import { EventSheet, MemoSheet, type PersonalEvent } from './PersonalEventSheet';

/**
 * Figma 일정 조율 (309:1077) — 220 x 486
 * 타이틀 y79 / 서브 y102 / 캘린더 카드 x8 y116 206×325.8 /
 * 주 행 y37.4 부터 28.83 간격 / 구분선 y181.6 / 일정 행 y208.2 부터 28.8 간격
 */
export default function ScheduleHomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  /* 상수로 박아 두면 다음 달에 앱을 열어도 지난 달이 나온다 */
  const [today] = useState(todayParts);
  const [month, setMonth] = useState({ year: today.year, month: today.month });
  const [selected, setSelected] = useState(today.day);
  const weeks = buildWeeksOf(month.year, month.month);
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
      const next = shiftMonth(current.year, current.month, delta);
      setSelected((day) => Math.min(day, daysInMonth(next.year, next.month)));
      return next;
    });

  const { notes, status, reload } = useMonthNotes(month.year, month.month);
  const { eventsByDay, memosByDay, memoIdByDay } = groupNotes(notes);

  /*
   * session 은 시트를 열 때만 증가한다. 시트 안의 입력 폼은 이 값으로 초기화되고,
   * 닫을 때는 값이 그대로라 Modal 이 살아 있어 닫힘 애니메이션이 끊기지 않는다.
   */
  const [eventSheet, setEventSheet] = useState<{
    open: boolean;
    session: number;
    editing: PersonalEvent | null;
  }>({ open: false, session: 0, editing: null });
  const [memoSheet, setMemoSheet] = useState({ open: false, session: 0 });

  const openEventSheet = (editing: PersonalEvent | null) =>
    setEventSheet((prev) => ({ open: true, session: prev.session + 1, editing }));
  const openMemoSheet = () =>
    setMemoSheet((prev) => ({ open: true, session: prev.session + 1 }));

  const events = eventsByDay[selected] ?? [];
  const memo = memosByDay[selected] ?? '';
  /** 점은 일정 데이터에서 파생한다 — 하드코딩하면 추가/삭제와 어긋난다 */
  const dotted = new Set(
    Object.entries(eventsByDay)
      .filter(([, list]) => list.length > 0)
      .map(([day]) => Number(day)),
  );

  const dateOf = (day: number) =>
    `${month.year}-${String(month.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  /** 저장에 성공했을 때만 true — 실패하면 시트가 열린 채로 남는다 */
  const saveEvent = async (event: PersonalEvent): Promise<boolean> => {
    if (!userId) return false;
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
  };

  const deleteEvent = async (id: string) => {
    const error = await deleteNote(id);
    if (error) {
      Alert.alert('삭제 실패', error.message);
      return;
    }
    reload();
  };

  const saveMemo = async (next: string): Promise<boolean> => {
    if (!userId) return false;
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
  };

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />
      <AppHeader />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>실시간 캘린더 조율</Text>

        <View style={styles.subRow}>
          <Text style={styles.sub}>구체적인 약속 일정을 정해주세요</Text>
          <Text style={styles.syncLabel}>자동 연동</Text>
          <Pressable
            style={[styles.toggle, autoSync && styles.toggleOn]}
            onPress={() => setAutoSync((v) => !v)}>
            <View style={[styles.knob, autoSync && styles.knobOn]} />
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.nav}>
            <Pressable hitSlop={s(8)} onPress={() => goMonth(-1)}>
              <Text style={styles.navArrow}>‹</Text>
            </Pressable>
            <Text style={styles.navMonth}>
              {month.year}년 {month.month}월
            </Text>
            <Pressable hitSlop={s(8)} onPress={() => goMonth(1)}>
              <Text style={styles.navArrow}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((d, i) => (
              <View key={d} style={styles.cell}>
                <Text style={[styles.weekday, dayColor(i)]}>{d}</Text>
              </View>
            ))}
          </View>

          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((day, di) => {
                if (day === null) return <View key={di} style={styles.cell} />;
                const isSelected = day === selected;
                const isToday =
                  day === today.day &&
                  month.year === today.year &&
                  month.month === today.month;
                return (
                  <Pressable
                    key={di}
                    style={[
                      styles.cell,
                      isToday && styles.cellToday,
                      isSelected && styles.cellSelected,
                    ]}
                    onPress={() => setSelected(day)}>
                    <Text style={[styles.day, dayColor(di)]}>{day}</Text>
                    {dotted.has(day) ? <View style={styles.dot} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.dayHeader}>
            <Text style={styles.dayTitle}>
              {month.month}월 {selected}일 (
              {WEEKDAYS[columnOfIn(month.year, month.month, selected)]}) 일정
            </Text>
            {/* 캘린더 기본 기능 — 개인 일정을 이 날짜에 직접 추가한다 */}
            <Pressable
              style={styles.addButton}
              onPress={() => openEventSheet(null)}>
              <Plus size={s(7)} color={colors.textOnAccent} strokeWidth={3} />
              <Text style={styles.addText}>일정 추가</Text>
            </Pressable>
          </View>

          {status === 'loading' ? (
            <Text style={styles.emptyText}>불러오는 중...</Text>
          ) : status === 'error' ? (
            /* 못 불러온 것을 "없다" 고 적으면 사용자가 자기 일정이 지워진 줄 안다 */
            <Text style={styles.emptyText}>일정을 불러오지 못했어요</Text>
          ) : events.length === 0 ? (
            <Text style={styles.emptyText}>등록된 일정이 없어요</Text>
          ) : (
            events.map((event) => (
              <View key={event.id} style={styles.eventRow}>
                <View style={[styles.eventBar, { backgroundColor: event.color }]} />
                <View style={styles.eventBody}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <View style={styles.eventTimeRow}>
                    <Clock size={s(6.5)} color={colors.textMuted} strokeWidth={2} />
                    <Text style={styles.eventTime}>{event.time}</Text>
                  </View>
                </View>

                {event.device ? (
                  <View style={styles.deviceChip}>
                    <Lock size={s(6)} color={colors.textMuted} strokeWidth={2} />
                    <Text style={styles.deviceText}>기기</Text>
                  </View>
                ) : (
                  <Pressable
                    style={styles.editButton}
                    onPress={() => openEventSheet(event)}>
                    <Pencil size={s(7.5)} color={colors.textMuted} strokeWidth={2} />
                  </Pressable>
                )}
              </View>
            ))
          )}

          <Pressable style={styles.memoBox} onPress={openMemoSheet}>
            <Text style={[styles.memoText, !!memo && styles.memoTextFilled]}>
              {memo || '＋ 이 날짜에 약속 메모 남기기'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <EventSheet
        visible={eventSheet.open}
        session={eventSheet.session}
        year={month.year}
        month={month.month}
        day={selected}
        editing={eventSheet.editing}
        // editing 을 남겨둬야 닫히는 동안 제목·버튼이 그대로 보인다
        onClose={() => setEventSheet((prev) => ({ ...prev, open: false }))}
        onSave={saveEvent}
        onDelete={(id) => void deleteEvent(id)}
      />

      <MemoSheet
        visible={memoSheet.open}
        session={memoSheet.session}
        year={month.year}
        month={month.month}
        day={selected}
        memo={memo}
        onClose={() => setMemoSheet((prev) => ({ ...prev, open: false }))}
        onSave={saveMemo}
      />
    </View>
  );
}

/** 일요일 빨강 / 토요일 파랑 */
function dayColor(columnIndex: number) {
  if (columnIndex === 0) return styles.sunday;
  if (columnIndex === 6) return styles.saturday;
  return null;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceSunken,
  },
  body: {
    paddingBottom: s(16),
  },
  title: {
    // x14 y79 h24
    marginTop: s(7),
    marginLeft: s(14),
    fontFamily: fontFamily.body,
    fontSize: fs(14),
    lineHeight: fs(24),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: s(15),
    marginRight: s(15),
  },
  sub: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  syncLabel: {
    marginRight: s(3),
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  toggle: {
    width: s(14),
    height: s(8),
    borderRadius: s(8),
    backgroundColor: colors.surfaceStrong,
    justifyContent: 'center',
    paddingHorizontal: s(1),
  },
  toggleOn: {
    backgroundColor: colors.textPrimary,
  },
  knob: {
    width: s(6),
    height: s(6),
    borderRadius: s(6),
    backgroundColor: colors.card,
  },
  knobOn: {
    alignSelf: 'flex-end',
  },
  card: {
    // x8 y116 w206
    marginTop: s(5),
    marginHorizontal: s(8),
    borderRadius: s(12),
    backgroundColor: colors.card,
    paddingHorizontal: s(7.2),
    paddingTop: s(7.2),
    paddingBottom: s(9),
  },
  nav: {
    height: s(11),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navArrow: {
    width: s(10),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(10),
    lineHeight: fs(11),
    color: colors.textPrimary,
  },
  navMonth: {
    fontFamily: fontFamily.body,
    fontSize: fs(9),
    lineHeight: fs(11),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  weekRow: {
    flexDirection: 'row',
    marginTop: s(4.8),
  },
  cell: {
    // 24.02 셀 + 2.4 간격 → flex 로 균등 분배
    flex: 1,
    height: s(24.02),
    marginHorizontal: s(1.2),
    borderRadius: s(6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 오늘 — Figma 가 [3, 18] 을 연한 배경으로 강조하던 자리를 실제 정보로 쓴다 */
  cellToday: {
    backgroundColor: '#FFF5EB',
  },
  cellSelected: {
    borderWidth: s(1.2),
    borderColor: colors.primary,
  },
  weekday: {
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  day: {
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    lineHeight: fs(10),
    color: colors.textPrimary,
  },
  sunday: {
    color: '#F5556B',
  },
  saturday: {
    color: '#3BA3F5',
  },
  dot: {
    marginTop: s(1),
    width: s(2.4),
    height: s(2.4),
    borderRadius: s(2.4),
    backgroundColor: '#5B9BD5',
  },
  divider: {
    // y181.6
    marginTop: s(4.5),
    height: s(1),
    backgroundColor: colors.border,
  },
  dayHeader: {
    // y187.4 h16
    marginTop: s(4.8),
    height: s(16),
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayTitle: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(8.5),
    lineHeight: fs(11),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  addButton: {
    width: s(54),
    height: s(14),
    borderRadius: s(7),
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(3),
  },
  addText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    fontWeight: weight.bold,
    color: colors.textOnAccent,
  },
  eventRow: {
    // y208.2 부터 28.8 간격, 높이 24
    marginTop: s(4.8),
    height: s(24),
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventBar: {
    width: s(2.5),
    height: s(17),
    borderRadius: s(2),
  },
  eventBody: {
    flex: 1,
    marginLeft: s(6),
  },
  eventTitle: {
    fontFamily: fontFamily.body,
    fontSize: fs(7.5),
    lineHeight: fs(10),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  eventTimeRow: {
    marginTop: s(1),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(2.5),
  },
  eventTime: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
  editButton: {
    width: s(14),
    height: s(14),
    borderRadius: s(14),
    borderWidth: s(0.6),
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceChip: {
    height: s(11),
    paddingHorizontal: s(4),
    borderRadius: s(5),
    backgroundColor: colors.surfaceSunken,
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(2),
  },
  deviceText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
  memoBox: {
    // y294.6 h24
    marginTop: s(4.8),
    height: s(24),
    borderRadius: s(6),
    borderWidth: s(0.8),
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: s(10),
    marginBottom: s(2),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  memoTextFilled: {
    color: colors.textPrimary,
  },
  memoText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
});
