import { Clock, Lock, Pencil, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppHeader from '../../components/AppHeader';
import { buildWeeksOf, columnOfIn, MONTH, shiftMonth, WEEKDAYS, YEAR } from '../../lib/calendar';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';
import { EventSheet, MemoSheet, type PersonalEvent } from './PersonalEventSheet';

/** 연한 배경으로 강조된 날 (Figma 표현 유지) */
const TINTED = [3, 18];

/**
 * 날짜별 일정. 13일은 Figma 원본이고, 나머지는 Figma 에서 점이 찍혀 있던
 * 19·23·24·30 일을 채운 것이다. 점은 이 데이터에서 파생된다.
 */
const INITIAL_EVENTS: Record<number, PersonalEvent[]> = {
  13: [
    { id: 'a', title: '알바', time: '18:00 ~ 22:00', color: '#5B9BD5' },
    { id: 'b', title: 'CCrate 중간발표', time: '12:00 ~ 13:00', color: '#B483C8' },
    { id: 'c', title: 'MedEve 스터디', time: '09:00 ~ 10:30', color: '#9C9C9C', device: true },
  ],
  19: [{ id: 'd', title: '알바', time: '18:00 ~ 22:00', color: '#5B9BD5' }],
  23: [{ id: 'e', title: '가족 모임', time: '12:00 ~ 15:00', color: '#04CDA3' }],
  24: [
    { id: 'f', title: '알바', time: '18:00 ~ 22:00', color: '#5B9BD5' },
    { id: 'g', title: '치과', time: '10:00 ~ 11:00', color: '#9C9C9C', device: true },
  ],
  30: [{ id: 'h', title: '동아리 정기모임', time: '19:00 ~ 21:00', color: '#B483C8' }],
};

/**
 * Figma 일정 조율 (309:1077) — 220 x 486
 * 타이틀 y79 / 서브 y102 / 캘린더 카드 x8 y116 206×325.8 /
 * 주 행 y37.4 부터 28.83 간격 / 구분선 y181.6 / 일정 행 y208.2 부터 28.8 간격
 */
export default function ScheduleHomeScreen() {
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState({ year: YEAR, month: MONTH });
  const [selected, setSelected] = useState(13);
  /** 일정 데이터는 기준 달(2026년 8월)에만 있다 */
  const isBaseMonth = month.year === YEAR && month.month === MONTH;
  const weeks = buildWeeksOf(month.year, month.month);
  const [autoSync, setAutoSync] = useState(true);

  const [eventsByDay, setEventsByDay] = useState(INITIAL_EVENTS);
  const [memosByDay, setMemosByDay] = useState<Record<number, string>>({});

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

  const events = isBaseMonth ? eventsByDay[selected] ?? [] : [];
  const memo = isBaseMonth ? memosByDay[selected] ?? '' : '';
  /** 점은 일정 데이터에서 파생한다 — 하드코딩하면 추가/삭제와 어긋난다 */
  const dotted = new Set(
    (isBaseMonth ? Object.entries(eventsByDay) : [])
      .filter(([, list]) => list.length > 0)
      .map(([day]) => Number(day)),
  );

  const saveEvent = (event: PersonalEvent) =>
    setEventsByDay((prev) => {
      const list = prev[selected] ?? [];
      const exists = list.some((e) => e.id === event.id);
      return {
        ...prev,
        [selected]: exists ? list.map((e) => (e.id === event.id ? event : e)) : [...list, event],
      };
    });

  const deleteEvent = (id: string) =>
    setEventsByDay((prev) => ({
      ...prev,
      [selected]: (prev[selected] ?? []).filter((e) => e.id !== id),
    }));

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
            <Pressable hitSlop={s(8)} onPress={() => setMonth((m) => shiftMonth(m.year, m.month, -1))}>
              <Text style={styles.navArrow}>‹</Text>
            </Pressable>
            <Text style={styles.navMonth}>
              {month.year}년 {month.month}월
            </Text>
            <Pressable hitSlop={s(8)} onPress={() => setMonth((m) => shiftMonth(m.year, m.month, 1))}>
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
                return (
                  <Pressable
                    key={di}
                    style={[
                      styles.cell,
                      TINTED.includes(day) && styles.cellTinted,
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

          {events.length === 0 ? (
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
        day={selected}
        editing={eventSheet.editing}
        // editing 을 남겨둬야 닫히는 동안 제목·버튼이 그대로 보인다
        onClose={() => setEventSheet((prev) => ({ ...prev, open: false }))}
        onSave={saveEvent}
        onDelete={deleteEvent}
      />

      <MemoSheet
        visible={memoSheet.open}
        session={memoSheet.session}
        day={selected}
        memo={memo}
        onClose={() => setMemoSheet((prev) => ({ ...prev, open: false }))}
        onSave={(next) => setMemosByDay((prev) => ({ ...prev, [selected]: next }))}
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
  cellTinted: {
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
