import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fs, s } from '../theme/scale';
import { colors, radii, shadows } from '../theme/tokens';
import { fontFamily, weight } from '../theme/typography';
import { RoomCalendarIcon, RoomChatIcon, RoomMenuIcon } from './icons';

export type RoomCardProps = {
  status: string;
  title: string;
  meta: string;
  unreadCount?: number;
  onPressChat?: () => void;
  onPressMenu?: () => void;
  onPressSchedule?: () => void;
};

/**
 * Figma RoomCard (47:13) — 폭 213
 * 좌측 warning/200 보더 2.484 / 상태 배지 / 미읽음 배지 / 하단 액션 3분할
 */
export default function RoomCard({
  status,
  title,
  meta,
  unreadCount,
  onPressChat,
  onPressMenu,
  onPressSchedule,
}: RoomCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {unreadCount ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{unreadCount}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.meta}>{meta}</Text>

      <View style={styles.actionsRow}>
        <Action label="채팅" onPress={onPressChat}>
          <RoomChatIcon size={s(11.178)} />
        </Action>
        <Action label="메뉴" onPress={onPressMenu}>
          <RoomMenuIcon size={s(11.178)} />
        </Action>
        <Action label="일정" onPress={onPressSchedule}>
          <RoomCalendarIcon size={s(11.178)} />
        </Action>
      </View>
    </View>
  );
}

function Action({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable style={styles.action} onPress={onPress}>
      {children}
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderLeftWidth: s(2.484),
    borderLeftColor: colors.warning200,
    borderRadius: s(radii.card),
    paddingTop: s(9.936),
    paddingBottom: s(7.452),
    paddingHorizontal: s(9.936),
    gap: s(4.968),
    ...shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4.968),
  },
  statusBadge: {
    backgroundColor: colors.warning200,
    paddingHorizontal: s(4.968),
    paddingVertical: s(2.484),
    borderRadius: s(radii.badge),
  },
  statusText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.831),
    lineHeight: fs(9.315),
    color: colors.textOnAccent,
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(9.315),
    lineHeight: fs(12.42),
    fontWeight: weight.semibold,
    color: colors.textPrimary,
  },
  unreadBadge: {
    width: s(13.662),
    height: s(13.662),
    borderRadius: s(radii.pill),
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.831),
    lineHeight: fs(9.315),
    color: colors.textOnAccent,
  },
  meta: {
    fontFamily: fontFamily.body,
    fontSize: fs(7.452),
    lineHeight: fs(9.936),
    color: colors.textMuted,
  },
  actionsRow: {
    flexDirection: 'row',
    borderTopWidth: s(0.621),
    borderTopColor: colors.border,
    paddingTop: s(7.452),
  },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: s(2.484),
  },
  actionLabel: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.21),
    lineHeight: fs(8.073),
    color: colors.textMuted,
  },
});
