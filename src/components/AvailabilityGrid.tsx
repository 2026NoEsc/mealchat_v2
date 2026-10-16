import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { cellKey, HOURS, isPastCell, type DayItem } from '../lib/scheduleSlots';
import { fs, s, v3Layout } from '../theme/scale';
import { colors, shadows, v3Colors } from '../theme/tokens';
import TimeCell from './ui/TimeCell';
import { scheduleLayout as layout } from '../theme/scheduleTokens';
import { fontFamily } from '../theme/typography';

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
  others,
  onToggle,
  variant = 'legacy',
}: {
  variant?: 'legacy' | 'v3';
  days: DayItem[];
  picked: Set<string>;
  /** 다른 사람이 고른 칸 — 회색으로 겹쳐 보인다 */
  others?: Set<string>;
  onToggle: (date: string, hour: number) => void;
}) {
  if (variant === 'v3') return <V3AvailabilityGrid days={days} picked={picked} others={others} onToggle={onToggle} />;
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
            const key = cellKey(day.date, hour);
            const on = picked.has(key);
            /* 내 선택이 우선이다 — 겹치면 주황으로 보여야 내가 골랐다는 걸 안다 */
            const shared = !on && Boolean(others?.has(key));
            /* 지난 시각은 고를 수 없다 — 눌러도 반응하지 않는다 */
            const past = isPastCell(day.date, hour);

            return (
              <View key={day.date} style={styles.col}>
                <Pressable
                  disabled={past}
                  style={[
                    styles.cell,
                    shared && styles.cellShared,
                    on && styles.cellOn,
                    past && styles.cellPast,
                  ]}
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
    fontFamily: fontFamily.semibold,
    fontSize: fs(5.6),
    lineHeight: fs(8),
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
  cellShared: {
    backgroundColor: colors.cellOthers,
    borderColor: colors.cellOthers,
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

/** The chat sheet keeps the legacy default; only the new meeting opts into v3. */
function V3AvailabilityGrid({ days, picked, others, onToggle }: { days: DayItem[]; picked: Set<string>; others?: Set<string>; onToggle: (date: string, hour: number) => void }) {
  const { width } = useWindowDimensions();
  const [viewport, setViewport] = useState(Math.max(0, width - 2 * layout.pagePadding - 22));
  const cellWidth = Math.max(v3Layout.minTouchTarget, Math.min(layout.timeWidth, (viewport - layout.timeLabel - 4 * days.length) / Math.max(1, days.length)));
  const minimum = layout.timeLabel + days.length * (cellWidth + 4);
  const now = new Date();
  const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  return <View style={v3Styles.card}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} onLayout={event => setViewport(event.nativeEvent.layout.width)} contentContainerStyle={[v3Styles.content, { minWidth: minimum }]}>
      <View style={v3Styles.table}>
        <View style={v3Styles.row}><View style={v3Styles.labelSlot} />{days.map(day => <View key={day.date} style={[v3Styles.day, { width: cellWidth }]}><Text style={v3Styles.head}>{day.day} {day.label}</Text><Text style={v3Styles.today}>{day.date === today ? '오늘' : ' '}</Text></View>)}</View>
        {HOURS.map(hour => <View key={hour} style={v3Styles.row}>
          <Text style={v3Styles.label}>{hour}</Text>
          {days.map(day => {
            const key = cellKey(day.date, hour);
            const on = picked.has(key);
            const shared = Boolean(others?.has(key));
            const past = isPastCell(day.date, hour);
            // TODO(서버 단계): othersSlots는 메이트의 '가능' 칸이다. 바쁜 시간으로 바꾸거나 선택을 금지하지 않는다.
            return <TimeCell key={key} state={on ? 'mine' : shared ? 'shared' : 'free'} shared={shared} width={cellWidth} disabled={past}
              label={day.month + '월 ' + day.day + '일 ' + hour + '시 ~ ' + (hour + 1) + '시' + (on ? ', 내가 가능' : '') + (shared ? ', 메이트 가능' : '') + (day.date === today ? ', 오늘' : '') + (past ? ', 지난 시간' : '')}
              onPress={() => onToggle(day.date, hour)} />;
          })}
        </View>)}
      </View>
    </ScrollView>
  </View>;
}
const v3Styles = StyleSheet.create({
  card: { width: '100%', minWidth: 0, borderWidth: 1, borderColor: v3Colors.border, borderRadius: layout.cardRadius, paddingLeft: 8, paddingRight: 12, paddingVertical: 12, backgroundColor: v3Colors.surface },
  content: { flexGrow: 1 }, table: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  labelSlot: { width: layout.timeLabel }, day: { alignItems: 'center' },
  head: { fontFamily: fontFamily.bold, fontSize: 12, lineHeight: 17, color: v3Colors.sub },
  today: { fontFamily: fontFamily.bold, fontSize: 11, lineHeight: 16, color: v3Colors.selectedText },
  label: { width: layout.timeLabel, textAlign: 'center', fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17, color: v3Colors.sub },
});
