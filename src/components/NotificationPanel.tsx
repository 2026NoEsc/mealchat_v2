import { CalendarDays, Receipt, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatAmount, relativeTime } from '../lib/format';
import { hasUnreadNotices } from '../lib/notificationsRead';
import type { RoomNotification } from '../lib/settlements';
import { useTopInset } from '../theme/insets';
import { v3Layout } from '../theme/scale';
import { v3Colors as colors, v3FeedbackColors } from '../theme/tokens';
import { fontFamily } from '../theme/typography';

const FILTERS = ['전체', '일정', '정산', '메이트'] as const;
type Filter = (typeof FILTERS)[number];

/**
 * [결정] title/message 텍스트 매칭은 사용자 정의 방 이름(예: '정산 모임')을 오분류하므로,
 * 구조적 신호(amount > 0 또는 settlementId 존재)로만 정산을 판정한다.
 * TODO(서버 단계): 알림 종류 컬럼 및 메이트 이벤트가 생기면 분류를 교체한다 (메이트 탭은 빈 상태 유지).
 */
export function noticeKind(notice: RoomNotification): Exclude<Filter, '전체'> {
  return (notice.amount > 0 || Boolean(notice.settlementId)) ? '정산' : '일정';
}

/** [결정] 구조적 신호 기반: 정산 알림은 Receipt, 그 외(일정 등)는 CalendarDays */
export function noticeIcon(notice: RoomNotification) {
  return (notice.amount > 0 || Boolean(notice.settlementId)) ? Receipt : CalendarDays;
}

/** Figma 521:1513 / 599:2425 / 599:2587: top panel, single filter and per-date unread state. */
export default function NotificationPanel({ notices, allRead, readAt, onClose, onMarkAllRead, onPressNotice }: {
  notices: RoomNotification[]; allRead: boolean; readAt?: string | null;
  onClose: () => void; onMarkAllRead?: () => void; onPressNotice?: (notice: RoomNotification) => void;
}) {
  const topInset = useTopInset();
  const [filter, setFilter] = useState<Filter>('전체');
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => { const animation = Animated.timing(slide, { toValue: 1, duration: 180, useNativeDriver: false }); animation.start(); return () => animation.stop(); }, [slide]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => subscription.remove();
  }, [onClose]);
  const visible = filter === '전체' ? notices : notices.filter((notice) => noticeKind(notice) === filter);
  return <View style={styles.overlay} accessibilityViewIsModal onAccessibilityEscape={onClose}>
    <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="알림 패널 닫기" />
    <Animated.View testID="notification-panel" style={[styles.panel, { paddingTop: topInset + 8, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] }]}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>알림</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="모두 읽음" accessibilityState={{ disabled: allRead || !onMarkAllRead }} disabled={allRead || !onMarkAllRead} onPress={onMarkAllRead} style={styles.readButton}>
          <Text style={[styles.readAll, allRead && styles.readDisabled]}>모두 읽음</Text>
        </Pressable>
        <Pressable style={styles.close} accessibilityRole="button" accessibilityLabel="알림 닫기" onPress={onClose}><X size={24} color={colors.ink} /></Pressable>
      </View>
      <View style={styles.filters} accessibilityRole="radiogroup" accessibilityLabel="알림 분류">
        {/* Chip's checkbox semantics and check icon differ from this single-choice filter. */}
        {FILTERS.map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityLabel={item + ' 알림'} accessibilityState={{ checked: filter === item }} onPress={() => setFilter(item)} style={styles.filterTarget}>
          <View style={[styles.chip, filter === item && styles.chipSelected]}><Text style={[styles.chipLabel, filter === item && styles.chipLabelSelected]}>{item}</Text></View>
        </Pressable>)}
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {visible.length === 0 ? <Text style={styles.empty}>{filter === '메이트' ? '아직 메이트 알림이 없어요' : notices.length === 0 ? '아직 알림이 없어요' : '이 분류에는 알림이 없어요'}</Text> : visible.map((notice) => {
          const unread = !allRead && (readAt === undefined || hasUnreadNotices([notice], readAt));
          const Icon = noticeIcon(notice);
          const actionable = Boolean(onPressNotice && (notice.roomId?.trim() || notice.settlementId));
          const label = [unread ? '안 읽음' : '읽음', notice.title, notice.message, ...(notice.amount > 0 ? [formatAmount(notice.amount)] : []), relativeTime(notice.createdAt)].join(', ');
          const body = <>
            {unread ? <View pointerEvents="none" style={styles.unreadBackground} /> : null}
            <View style={[styles.icon, !unread && styles.readIcon]}><Icon size={20} color={unread ? colors.selectedText : colors.sub} /></View>
            <View style={styles.body}><Text style={[styles.rowTitle, unread && styles.bold]}>{notice.title}</Text><Text style={styles.rowSub}>{notice.amount > 0 ? notice.message + ' ' + formatAmount(notice.amount) : notice.message}</Text></View>
            <View style={styles.meta}><Text style={styles.time}>{relativeTime(notice.createdAt)}</Text>{unread ? <View style={styles.dot} accessible={false} /> : null}</View>
          </>;
          const rowStyle = styles.row;
          return actionable ? <Pressable key={notice.id} accessibilityRole="button" accessibilityLabel={label} onPress={() => onPressNotice?.(notice)} style={rowStyle}>{body}</Pressable>
            : <View key={notice.id} accessible accessibilityLabel={label} style={rowStyle}>{body}</View>;
        })}
        {/* [결정] 서버 조회(src/lib/settlements.ts:208-211)는 기간 없이 최신 30건이므로 '최근 알림을 보여드려요' 유지. 서버가 30일 범위를 보장하면 Figma 원문 '최근 30일의 알림을 보여드려요'로 교체 예정 */}
        <Text style={styles.footer}>최근 알림을 보여드려요</Text>
      </ScrollView>
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.ink, opacity: 0.5 },
  panel: { width: '100%', maxHeight: '90%', paddingBottom: 8, backgroundColor: colors.surface, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 8 },
  title: { flex: 1, fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 29, color: colors.ink },
  readButton: { minHeight: v3Layout.minTouchTarget, paddingHorizontal: 8, justifyContent: 'center' },
  readAll: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: colors.selectedText },
  readDisabled: { opacity: 0.4 },
  close: { width: v3Layout.minTouchTarget, height: v3Layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  filterTarget: { minHeight: v3Layout.minTouchTarget, justifyContent: 'center', flexShrink: 1 },
  chip: { height: 36, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  chipSelected: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.selectedBg },
  chipLabel: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: colors.ink },
  chipLabelSelected: { fontFamily: fontFamily.bold, color: colors.selectedText },
  scroll: { flexGrow: 0, flexShrink: 1 },
  row: { paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: v3Layout.minTouchTarget },
  // 55% selectedBg on the white panel reproduces Figma's untokenized #FFF8EE.
  unreadBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.selectedBg, opacity: 0.55 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.selectedBg, alignItems: 'center', justifyContent: 'center' },
  readIcon: { backgroundColor: colors.mutedBg },
  body: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 22, color: colors.ink },
  bold: { fontFamily: fontFamily.bold },
  rowSub: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.sub },
  meta: { gap: 8, alignItems: 'flex-end' },
  time: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 18, color: colors.sub },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: v3FeedbackColors.error },
  empty: { paddingHorizontal: 20, paddingVertical: 28, textAlign: 'center', fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, color: colors.sub },
  footer: { paddingHorizontal: 20, paddingVertical: 12, textAlign: 'center', fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.sub },
});
