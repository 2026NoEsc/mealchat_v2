import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { fs, s } from '../theme/scale';
import { colors, shadows } from '../theme/tokens';
import { fontFamily } from '../theme/typography';
import { BellIcon } from './icons';
import { useNotifications } from './NotificationsProvider';

const logo = require('../../assets/brand/logo-main.png');

/**
 * 탭 화면 상단 — Figma Component 4 (2154:681 / 2159:895), 220 x 42.
 *
 * MEALCHAT 워드마크를 띄우던 AppHeader 와 달리 로고를 작은 칩으로만 두고,
 * 남는 자리를 그 화면이 쓴다. 홈은 인사를, 일정 조율은 화면 이름을 넣는다.
 */
export default function PageHeader({
  title,
  children,
}: {
  /** 한 줄짜리 화면 이름. 두 줄 이상이 필요하면 children 을 쓴다. */
  title?: string;
  children?: ReactNode;
}) {
  const { hasUnread, open } = useNotifications();

  return (
    <View style={styles.header}>
      <View style={styles.logoChip}>
        <Image source={logo} style={styles.logo} resizeMode="contain" />
      </View>

      <View style={styles.body}>
        {title ? <Text style={styles.title}>{title}</Text> : children}
      </View>

      <Pressable style={styles.bell} hitSlop={s(6)} onPress={open}>
        <BellIcon size={s(20)} />
        {hasUnread ? <View style={styles.unreadDot} /> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: s(42),
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: s(9),
    paddingRight: s(12),
    backgroundColor: colors.surface,
    ...shadows.bar,
  },
  logoChip: {
    width: s(28),
    height: s(26),
    borderRadius: s(5),
    backgroundColor: colors.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: s(20),
    height: s(20),
  },
  body: {
    flex: 1,
    // 로고 칩 오른쪽(x37) 에서 글자가 x45 부터 시작한다
    marginLeft: s(8),
  },
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: fs(10),
    lineHeight: fs(13.5),
    color: colors.textPrimary,
  },
  bell: {
    width: s(20),
    height: s(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: s(6),
    height: s(6),
    borderRadius: s(999),
    backgroundColor: colors.danger,
  },
});
