import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppHeader from '../../components/AppHeader';
import { CompleteButton } from '../../components/ui/Button';
import { useNavigation } from '../../navigation/NavigationContext';
import {
  buildNextDays,
  cellKey,
  HOURS,
  isPastCell,
  toSlots,
} from '../../lib/scheduleSlots';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';
import ScheduleStepHeader from './ScheduleStepHeader';
import type { SchedulePlace } from './scheduleTypes';

type Params = {
  name?: string;
  invitees?: string[];
  place?: SchedulePlace;
};

export default function ScheduleTimeScreen() {
  const insets = useSafeAreaInsets();
  const { navigate, current } = useNavigation();

  const params = current.params as Params | undefined;

  const name = params?.name ?? '';
  const invitees = params?.invitees ?? [];
  const place = params?.place;

  const days = useMemo(() => buildNextDays(5), []);

  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(),
  );

  const toggle = (date: string, hour: number) => {
    if (isPastCell(date, hour)) {
      return;
    }

    setPicked((prev) => {
      const next = new Set(prev);
      const k = cellKey(date, hour);

      if (next.has(k)) {
        next.delete(k);
      } else {
        next.add(k);
      }

      return next;
    });
  };

  const slots = toSlots(picked, days);

  const goRecommend = () => {
    if (!place || slots.length === 0) {
      return;
    }

    navigate('ScheduleRecommend', {
      name,
      invitees,
      place,
      slots,
    });
  };

  return (
    <View style={styles.screen}>
      <View
        style={{
          height: insets.top,
          backgroundColor: colors.surface,
        }}
      />

      <AppHeader />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <ScheduleStepHeader
          step={2}
          title="언제 만날까요?"
          subtitle="가능한 시간을 탭해서 표시해 주세요"
        />

        <View style={styles.card}>
          <View style={styles.headRow}>
            <View style={styles.hourLabel} />

            {days.map((day) => (
              <View key={day.date} style={styles.col}>
                <Text
                  style={[
                    styles.headText,
                    day.label === '일' &&
                      styles.sunday,
                  ]}
                >
                  {day.month}/{day.day}·{day.label}
                </Text>
              </View>
            ))}
          </View>

          {HOURS.map((hour) => (
            <View key={hour} style={styles.gridRow}>
              <Text style={styles.hourLabel}>
                {hour}
              </Text>

              {days.map((day) => {
                const k = cellKey(
                  day.date,
                  hour,
                );

                const on = picked.has(k);
                const disabled = isPastCell(
                  day.date,
                  hour,
                );

                return (
                  <View
                    key={day.date}
                    style={styles.col}
                  >
                    <Pressable
                      disabled={disabled}
                      style={[
                        styles.cell,
                        on && styles.cellOn,
                        disabled &&
                          styles.cellDisabled,
                      ]}
                      onPress={() =>
                        toggle(day.date, hour)
                      }
                    />
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <Text style={styles.pickedTitle}>
          선택한 시간 {slots.length}개
        </Text>

        <View style={styles.chipRow}>
          {slots.length === 0 ? (
            <Text style={styles.emptyText}>
              아직 선택한 시간이 없어요.
            </Text>
          ) : (
            slots.map((slot) => (
              <View
                key={slot.id}
                style={styles.chip}
              >
                <Text style={styles.chipText}>
                  {slot.label}
                </Text>
              </View>
            ))
          )}
        </View>

        <CompleteButton
          label="AI 추천 받기"
          showNext
          disabled={
            slots.length === 0 || !place
          }
          style={styles.cta}
          onPress={goRecommend}
        />
      </ScrollView>
    </View>
  );
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
    fontSize: fs(5.5),
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

  cellDisabled: {
    opacity: 0.25,
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

  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },

  cta: {
    marginTop: s(14),
    marginHorizontal: s(11.5),
  },
});