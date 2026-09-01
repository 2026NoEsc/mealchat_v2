import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cellKey, HOURS, isPastCell, type DayItem } from '../lib/scheduleSlots';
import { fs, s } from '../theme/scale';
import { colors, shadows } from '../theme/tokens';
import { fontFamily, weight } from '../theme/typography';

/**
 * Figma 채팅/일정 패널 (2111:16888) 안의 격자 — 220 프레임 기준
 * 카드 w197 radius8 pad 9/8 gap4 / 시각 라벨 w20 / 칸 h13 radius3 / 열 간격 2
 *
 * 일정 추가 STEP 2 와 방의 일정 조율 시트가 같은 격자를 쓴다. 한쪽만 고치면
 * 두 화면이 어긋나므로 한 곳에 둔다.
 */
export default function AvailabilityGrid({
  days,
  picked,
  onToggle,
}: {
  days: DayItem[];
  picked: Set<string>;
  onToggle: (date: string, hour: number) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.label} />

        {days.map((day) => (
          <View key={day.date} style={styles.col}>
            <Text style={[styles.head, day.label === '일' && styles.sunday]}>
              {day.day}
              {day.label}
            </Text>
          </View>
        ))}
      </View>

      {HOURS.map((hour) => (
        <View key={hour} style={styles.row}>
          <Text style={styles.label}>{hour}</Text>

          {days.map((day) => {
            const on = picked.has(cellKey(day.date, hour));
            /* 지난 시각은 고를 수 없다 — 눌러도 반응하지 않는다 */
            const past = isPastCell(day.date, hour);

            return (
              <View key={day.date} style={styles.col}>
                <Pressable
                  disabled={past}
                  style={[styles.cell, on && styles.cellOn, past && styles.cellPast]}
                  onPress={() => onToggle(day.date, hour)}
                />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: s(8),
    paddingHorizontal: s(9),
    paddingVertical: s(8),
    /*
     * 흰 시트 위의 흰 카드라 경계가 필요하다. 시안은 그림자로 띄웠지만
     * opacity 0.1 짜리 그림자는 웹에서 눈에 잡히지 않아, 테두리를 함께 준다.
     */
    borderWidth: s(0.6),
    borderColor: colors.border,
    ...shadows.button,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: s(2),
  },
  col: {
    flex: 1,
    paddingHorizontal: s(1),
  },
  label: {
    width: s(20),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(5.6),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
  head: {
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(5.6),
    lineHeight: fs(8),
    fontWeight: weight.semibold,
    color: colors.textMuted,
  },
  sunday: {
    color: colors.danger,
  },
  cell: {
    height: s(13),
    borderRadius: s(3),
    backgroundColor: colors.surface,
    borderWidth: s(0.5),
    borderColor: colors.border,
  },
  cellOn: {
    backgroundColor: colors.primary,
    /* 채운 칸은 테두리를 지운다 — 시안에서 선택 칸에는 border 가 없다 */
    borderColor: colors.primary,
  },
  cellPast: {
    opacity: 0.25,
  },
});
