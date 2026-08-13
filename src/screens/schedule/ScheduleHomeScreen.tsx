import { Clock, Lock, Pencil, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppHeader from '../../components/AppHeader';
import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** Figma 캘린더의 2026년 8월 — 1일이 목요일 열(index 3)부터 시작한다 */
const WEEKS: (number | null)[][] = [
  [null, null, null, 1, 2, 3, 4],
  [5, 6, 7, 8, 9, 10, 11],
  [12, 13, 14, 15, 16, 17, 18],
  [19, 20, 21, 22, 23, 24, 25],
  [26, 27, 28, 29, 30, 31, null],
];

/** 연한 배경으로 강조된 날 */
const TINTED = [3, 18];
/** 일정이 있어 점이 찍힌 날 */
const DOTTED = [19, 23, 24, 30];

type Event = {
  title: string;
  time: string;
  color: string;
  /** 기기 캘린더에서 동기화된 일정 — 편집 대신 잠금 칩 */
  device?: boolean;
};

const EVENTS: Event[] = [
  { title: '알바', time: '18:00 ~ 22:00', color: '#5B9BD5' },
  { title: 'CCrate 중간발표', time: '12:00 ~ 13:00', color: '#B483C8' },
  { title: 'MedEve 스터디', time: '09:00 ~ 10:30', color: '#9C9C9C', device: true },
];

/**
 * Figma 일정 조율 (309:1077) — 220 x 486
 * 타이틀 y79 / 서브 y102 / 캘린더 카드 x8 y116 206×325.8 /
 * 주 행 y37.4 부터 28.83 간격 / 구분선 y181.6 / 일정 행 y208.2 부터 28.8 간격
 */
export default function ScheduleHomeScreen() {
  const insets = useSafeAreaInsets();
  const { navigate } = useNavigation();
  const [selected, setSelected] = useState(25);
  const [autoSync, setAutoSync] = useState(true);

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
            <Pressable hitSlop={s(8)}>
              <Text style={styles.navArrow}>‹</Text>
            </Pressable>
            <Text style={styles.navMonth}>2026년 8월</Text>
            <Pressable hitSlop={s(8)}>
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

          {WEEKS.map((week, wi) => (
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
                    {DOTTED.includes(day) ? <View style={styles.dot} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.dayHeader}>
            <Text style={styles.dayTitle}>8월 13일 (목) 일정</Text>
            <Pressable style={styles.addButton} onPress={() => navigate('ScheduleDetail')}>
              <Plus size={s(7)} color={colors.textOnAccent} strokeWidth={3} />
              <Text style={styles.addText}>일정 추가</Text>
            </Pressable>
          </View>

          {EVENTS.map((event) => (
            <View key={event.title} style={styles.eventRow}>
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
                <Pressable style={styles.editButton}>
                  <Pencil size={s(7.5)} color={colors.textMuted} strokeWidth={2} />
                </Pressable>
              )}
            </View>
          ))}

          <Pressable style={styles.memoBox}>
            <Text style={styles.memoText}>＋ 이 날짜에 약속 메모 남기기</Text>
          </Pressable>
        </View>
      </ScrollView>
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
  memoText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
});
