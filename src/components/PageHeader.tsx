import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { fs412, s412 } from '../theme/scale';
import { colors, shadows } from '../theme/tokens';
import { fontFamily } from '../theme/typography';
import { BellIcon } from './icons';
import { useNotifications } from './NotificationsProvider';

const logo = require('../../assets/brand/logo-main.png');

/**
 * 탭 화면 상단 — Figma Component 4 (2169:785), 412 x 80.
 *
 * MEALCHAT 워드마크를 띄우던 AppHeader 와 달리 로고를 작은 칩으로만 두고,
 * 남는 자리를 그 화면이 쓴다. 홈은 인사를, 일정 조율은 화면 이름을 넣는다.
 *
 * 좌표(412 기준): 로고칩 x18 y15 52.44x49.52 / 글자 x92 / 종 x346.75 y19
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

      <Pressable style={styles.bell} hitSlop={s412(10)} onPress={open}>
        <BellIcon size={s412(37.29)} />
        {hasUnread ? <View style={styles.unreadDot} /> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    /* 상태바(y40) 와 헤더(y46) 사이 한 칸 */
    marginTop: s412(6),
    height: s412(80),
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: s412(18),
    paddingRight: s412(28),
    backgroundColor: colors.card,
    ...shadows.bar,
  },
  logoChip: {
    width: s412(52.44),
    height: s412(49.52),
    borderRadius: s412(5),
    backgroundColor: colors.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: s412(37.34),
    height: s412(37.24),
  },
  body: {
    flex: 1,
    // 로고 칩 오른쪽(x70.44) 에서 글자가 x92 부터 시작한다
    marginLeft: s412(21.56),
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fs412(20),
    lineHeight: fs412(27),
    color: colors.textPrimary,
  },
  /*
   * 종 (2169:791, 37.29 x 38.1). 회색 원 배경은 BellIcon 이 스스로 그린다 —
   * 여기서 원을 또 깔면 아이콘을 줄여야 해서 글리프가 작아진다.
   */
  bell: {
    width: s412(37.29),
    height: s412(38.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  /*
   * 안 읽은 알림 점 (x367 y26 → 종 상자 기준 x20.25 y6.95).
   * 빨강이 아니라 주황이다 — 알림은 경고가 아니다.
   */
  unreadDot: {
    position: 'absolute',
    top: s412(6.95),
    left: s412(20.25),
    width: s412(8),
    height: s412(8),
    borderRadius: s412(999),
    backgroundColor: colors.primaryVivid,
  },
});
