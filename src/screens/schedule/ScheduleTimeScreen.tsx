import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppHeader from '../../components/AppHeader';
import { CompleteButton } from '../../components/ui/Button';
import { weekdayOf } from '../../lib/calendar';
import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';
import ScheduleStepHeader from './ScheduleStepHeader';

/** 요일은 실제 달력에서 파생한다 ([lib/calendar](../../lib/calendar.ts)) */
const DAYS = [13, 14, 15, 16, 17].map((day) => ({ day, label: weekdayOf(day) }));

const HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

/** 마지막 구간을 닫기 위한 경계값 — 칩 라벨의 끝 시각으로도 쓰인다 */
const END_HOUR = HOURS[HOURS.length - 1] + 1;

const key = (dayIndex: number, hour: number) => `${dayIndex}-${hour}`;

/** Figma 기본 선택 상태 — 15일 18~20, 16일 12~14, 17일 19~21 */
const INITIAL = new Set([
  key(2, 18), key(2, 19),
  key(3, 12), key(3, 13),
  key(4, 19), key(4, 20),
]);

/**
 * Figma 일정 조율/일정 추가/시간 선택 (160:733) — STEP 2
 * 요일 × 시간 그리드를 탭해 가능한 시간을 표시하고 AI 추천으로 넘어간다.
 */
export default function ScheduleTimeScreen() {
  const insets = useSafeAreaInsets();
  const { navigate, current } = useNavigation();
  const params = current.params as { name?: string; invitees?: string[] } | undefined;
  const name = params?.name;
  const invitees = params?.invitees;
  const [picked, setPicked] = useState<Set<string>>(INITIAL);

  const toggle = (dayIndex: number, hour: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      const k = key(dayIndex, hour);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const chips = toChips(picked);

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />
      <AppHeader />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <ScheduleStepHeader
          step={2}
          title="언제 만날까요?"
          subtitle="가능한 시간을 탭해서 표시해 주세요"
        />

        <View style={styles.card}>
          <View style={styles.headRow}>
            <View style={styles.hourLabel} />
            {DAYS.map((d) => (
              <View key={d.day} style={styles.col}>
                <Text style={[styles.headText, d.label === '일' && styles.sunday]}>
                  {d.day}·{d.label}
                </Text>
              </View>
            ))}
          </View>

          {HOURS.map((hour) => (
            <View key={hour} style={styles.gridRow}>
              <Text style={styles.hourLabel}>{hour}</Text>
              {DAYS.map((d, i) => {
                const on = picked.has(key(i, hour));
                return (
                  <View key={d.day} style={styles.col}>
                    <Pressable
                      style={[styles.cell, on && styles.cellOn]}
                      onPress={() => toggle(i, hour)}
                    />
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <Text style={styles.pickedTitle}>선택한 시간 {chips.length}개</Text>

        <View style={styles.chipRow}>
          {chips.map((chip) => (
            <View key={chip} style={styles.chip}>
              <Text style={styles.chipText}>{chip}</Text>
            </View>
          ))}
        </View>

        <CompleteButton
          label="AI 추천 받기"
          showNext
          disabled={chips.length === 0}
          style={styles.cta}
          onPress={() => navigate('ScheduleRecommend', { name, invitees })}
        />
      </ScrollView>
    </View>
  );
}

/** 선택된 셀을 요일별 연속 구간으로 묶어 "15(금)18~20" 형태의 칩으로 만든다 */
function toChips(picked: Set<string>) {
  const chips: string[] = [];

  DAYS.forEach((d, dayIndex) => {
    let start: number | null = null;

    HOURS.concat(END_HOUR).forEach((hour) => {
      const on = picked.has(key(dayIndex, hour));
      if (on && start === null) start = hour;
      if (!on && start !== null) {
        chips.push(`${d.day}(${d.label})${start}~${hour}`);
        start = null;
      }
    });
  });

  return chips;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceSunken,
  },
  body: {
    paddingBottom: s(16),
  },
  card: {
    marginTop: s(10),
    marginHorizontal: s(11.5),
    borderRadius: s(10),
    backgroundColor: colors.card,
    paddingHorizontal: s(8),
    paddingVertical: s(8),
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: s(4),
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: s(2),
  },
  hourLabel: {
    width: s(14),
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
  col: {
    flex: 1,
    paddingHorizontal: s(1.5),
  },
  headText: {
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    fontWeight: weight.semibold,
    color: colors.textPrimary,
  },
  sunday: {
    color: colors.primary,
  },
  cell: {
    height: s(13),
    borderRadius: s(4),
    backgroundColor: colors.surface,
  },
  cellOn: {
    backgroundColor: colors.primary,
  },
  pickedTitle: {
    marginTop: s(10),
    marginLeft: s(11.5),
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    lineHeight: fs(11),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  chipRow: {
    marginTop: s(5),
    marginHorizontal: s(11.5),
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(4),
  },
  chip: {
    paddingHorizontal: s(6),
    paddingVertical: s(3),
    borderRadius: s(5),
    backgroundColor: colors.primarySoft,
  },
  chipText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    fontWeight: weight.semibold,
    color: colors.primary,
  },
  cta: {
    marginTop: s(14),
    marginHorizontal: s(11.5),
  },
});
