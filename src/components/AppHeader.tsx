import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { fs, s } from '../theme/scale';
import { colors, radii, shadows } from '../theme/tokens';
import { fontFamily, weight } from '../theme/typography';
import { BellIcon } from './icons';
import { useNotifications } from './NotificationsProvider';

const logo = require('../../assets/brand/logo-main.png');

/**
 * Figma AppHeader (46:22) — 220 x 42
 * 로고 칩 #E6E6E6 / 워드마크 #FF9900 12px / 우측 알림 벨
 *
 * 벨은 화면마다 배선하지 않고 [NotificationsProvider](./NotificationsProvider.tsx) 에
 * 직접 연결되므로, 헤더를 놓는 것만으로 모든 화면에서 알림이 열린다.
 */
export default function AppHeader() {
  const { hasUnread, open: onPressBell } = useNotifications();

  return (
    <View style={styles.container}>
      <View style={styles.logoChip} />
      <Image source={logo} style={styles.logo} resizeMode="cover" />
      <Text style={styles.wordmark}>MEALCHAT</Text>

      <Pressable style={styles.bell} onPress={onPressBell} hitSlop={s(6)}>
        <BellIcon size={s(20)} />
        {hasUnread ? <View style={styles.unreadDot} /> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: s(42),
    backgroundColor: colors.surface,
    ...shadows.bar,
    zIndex: 2,
  },
  logoChip: {
    position: 'absolute',
    left: s(12.94),
    top: s(8),
    width: s(26.88),
    height: s(27),
    borderRadius: s(radii.chip),
    backgroundColor: colors.surfaceStrong,
  },
  logo: {
    position: 'absolute',
    left: s(15.93),
    top: s(11),
    width: s(19.91),
    height: s(19.85),
  },
  wordmark: {
    position: 'absolute',
    left: s(45.78),
    top: s(11),
    height: s(20),
    fontFamily: fontFamily.wordmark,
    fontSize: fs(12),
    lineHeight: fs(20),
    fontWeight: weight.extrabold,
    color: colors.primary,
    letterSpacing: fs(-0.1),
  },
  bell: {
    position: 'absolute',
    left: s(185.16),
    top: s(10),
    width: s(19.91),
    height: s(20),
  },
  unreadDot: {
    position: 'absolute',
    right: s(-0.5),
    top: s(-0.5),
    width: s(5.5),
    height: s(5.5),
    borderRadius: s(5.5),
    backgroundColor: colors.primary,
  },
});
