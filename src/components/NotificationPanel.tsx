import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fs, s } from '../theme/scale';
import { colors } from '../theme/tokens';
import { fontFamily, weight } from '../theme/typography';

const FILTERS = ['전체', '일정', '정산', '메이트'] as const;
type Filter = (typeof FILTERS)[number];

type Notice = {
  title: string;
  body: string;
  time: string;
  unread?: boolean;
  kind: Exclude<Filter, '전체'> | '메뉴';
};

const NOTICES: Notice[] = [
  {
    title: '일정이 확정됐어요!',
    body: '회사 팀 점심 / 8월 15일 18:30',
    time: '방금 전',
    unread: true,
    kind: '일정',
  },
  {
    title: 'N빵 정산 요청이 도착했어요!',
    body: '모아님이 12,000원을 요청했어요.',
    time: '1시간 전',
    unread: true,
    kind: '정산',
  },
  {
    title: '새 메이트가 들어왔어요',
    body: '두두님이 오늘 점심팟에 참여했어요.',
    time: '3시간 전',
    kind: '메이트',
  },
  {
    title: '방이 곧 사라져요',
    body: '오늘 점심팟 / 12시간 남음',
    time: '어제',
    kind: '일정',
  },
  {
    title: '메뉴 투표가 시작됐어요',
    body: '또리님이 메뉴 투표를 열었어요.',
    time: '어제',
    kind: '메뉴',
  },
];

/**
 * Figma 알림 패널 (549:3408) — 196 x 350 오버레이
 * 타이틀 y12 / 필터 y37 h22 / 행 y68·112·156·200·244 (h39, 간격 5) / 안내문 y333
 */
export default function NotificationPanel({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('전체');

  const visible = filter === '전체' ? NOTICES : NOTICES.filter((n) => n.kind === filter);

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      {/* 헤더(높이 42) 바로 아래에 패널이 걸리도록 배치 */}
      <View style={[styles.panel, { marginTop: insets.top + s(48) }]}>
        <View style={styles.header}>
          <Text style={styles.title}>알림</Text>
          <Pressable onPress={onClose} hitSlop={s(8)}>
            <Text style={styles.readAll}>모두 읽음</Text>
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = f === filter;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {visible.map((n) => (
            <View key={n.title} style={[styles.row, n.unread && styles.rowUnread]}>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{n.title}</Text>
                <Text style={styles.rowSub}>{n.body}</Text>
              </View>
              <Text style={styles.rowTime}>{n.time}</Text>
              {n.unread ? <View style={styles.dot} /> : <View style={styles.dotSpacer} />}
            </View>
          ))}

          <Text style={styles.footer}>최근 30일의 알림을 보여드려요</Text>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    // AppHeader 가 zIndex 2 이므로 그 위로 올린다
    zIndex: 10,
  },
  panel: {
    // 220 프레임 안에서 폭 196 (좌우 12)
    width: s(196),
    height: s(350),
    borderRadius: s(10),
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: s(14),
    paddingRight: s(14),
    paddingTop: s(12),
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(11),
    lineHeight: fs(16),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  readAll: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    fontWeight: weight.semibold,
    color: colors.primary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: s(5),
    paddingHorizontal: s(8),
    // 타이틀 하단(y28) → 필터(y37)
    marginTop: s(9),
  },
  chip: {
    width: s(41),
    height: s(22),
    borderRadius: s(11),
    borderWidth: s(0.6),
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: '#FFF6EC',
  },
  chipText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    fontWeight: weight.medium,
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: weight.bold,
  },
  list: {
    paddingHorizontal: s(7),
    // 필터 하단(y59) → 첫 행(y68)
    paddingTop: s(9),
    paddingBottom: s(12),
    gap: s(5),
  },
  row: {
    height: s(39),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: s(8),
    borderWidth: s(0.6),
    borderColor: colors.border,
    paddingHorizontal: s(15),
  },
  rowUnread: {
    borderColor: colors.primary,
    borderWidth: s(1),
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: fontFamily.body,
    fontSize: fs(7.5),
    lineHeight: fs(12),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  rowSub: {
    fontFamily: fontFamily.body,
    fontSize: fs(5.5),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
  rowTime: {
    fontFamily: fontFamily.body,
    fontSize: fs(5.5),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
  dot: {
    marginLeft: s(4),
    width: s(6),
    height: s(6),
    borderRadius: s(6),
    backgroundColor: colors.primary,
  },
  dotSpacer: {
    marginLeft: s(4),
    width: s(6),
  },
  footer: {
    marginTop: s(10),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
});
