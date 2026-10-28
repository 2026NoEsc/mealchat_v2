import { Bell } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { v3Layout } from '../../theme/scale';
import { v3Colors as colors } from '../../theme/tokens';

const logo = require('../../../assets/brand/logo-main.png');
const wordmarkHeader = require('../../../assets/brand/wordmark-header.png');

/** [결정] AppHeader.md:15 규격에 따른 알림 점 색상 토큰 (#D93025) */
export const NOTIFICATION_DOT_COLOR = '#D93025';
export const appHeaderTokens = { notificationDot: NOTIFICATION_DOT_COLOR };

export type AppHeaderProps = { hasUnread?: boolean; onPressBell: () => void };

/** Target: 518:1286. Safe-area top belongs to the containing screen. */
export function AppHeader({ hasUnread = false, onPressBell }: AppHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.brand} accessible accessibilityRole="header" accessibilityLabel="MealChat">
        <Image source={logo} style={styles.logo} resizeMode="contain" accessible={false} />
        {/* [결정] AppHeader.md / 518:1289 규격에 따라 주황 워드마크 이미지(92×20) 적용 */}
        <Image source={wordmarkHeader} style={styles.wordmark} resizeMode="contain" accessible={false} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hasUnread ? '알림, 읽지 않은 알림 있음' : '알림'}
        onPress={onPressBell}
        style={({ pressed }) => [styles.bell, pressed && styles.pressed]}>
        <View accessible={false} importantForAccessibility="no-hide-descendants">
          <Bell size={24} color={colors.ink} />
          {hasUnread ? <View style={styles.unreadDot} /> : null}
        </View>
      </Pressable>
      <View style={styles.divider} accessible={false} />
    </View>
  );
}

export default AppHeader;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: v3Layout.headerHeight,
    paddingLeft: 20,
    paddingRight: 8,
    paddingVertical: 8,
    backgroundColor: colors.bg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  divider: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, backgroundColor: colors.border },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  logo: { width: 32, height: 32, borderRadius: 8 },
  wordmark: { width: 92, height: 20 },
  bell: { width: v3Layout.minTouchTarget, height: v3Layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  /* [결정] AppHeader.md:15 규격에 따라 알림 미확인 점 색상을 NOTIFICATION_DOT_COLOR(#D93025)로 지정 */
  unreadDot: { position: 'absolute', right: 0, top: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: NOTIFICATION_DOT_COLOR },
  pressed: { opacity: 0.8 },
});
