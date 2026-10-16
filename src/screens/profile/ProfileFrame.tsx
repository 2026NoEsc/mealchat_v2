import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import KeyboardSafeScreen from '../../components/KeyboardSafeScreen';
import AppHeaderConnected from '../../components/ui/AppHeaderConnected';
import { useNavigation } from '../../navigation/NavigationContext';
import { v3Layout } from '../../theme/scale';
import { profileLayout } from '../../theme/profileTokens';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

/** Navigator already renders the profile BottomNav on all five routes. */
export default function ProfileFrame({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { goBack, canGoBack, resetTo } = useNavigation();
  return <KeyboardSafeScreen style={[styles.screen, { paddingTop: insets.top }]}>
    {title ? <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={() => canGoBack ? goBack() : resetTo('Profile')}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
        <ArrowLeft size={24} color={colors.ink} aria-hidden={true} />
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <View style={styles.iconButton} />
    </View> : <AppHeaderConnected />}
    <View style={styles.content}>{children}{footer ? <View style={styles.footer}>{footer}</View> : null}</View>
  </KeyboardSafeScreen>;
}

export const profileStyles = StyleSheet.create({
  body: { paddingTop: 4, paddingHorizontal: 20, paddingBottom: 200, gap: 14 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 16, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  label: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 20, color: colors.sub },
  sub: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 20, color: colors.sub },
  intro: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 22, color: colors.sub },
  title: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22, color: colors.ink },
  iconButton: { width: v3Layout.minTouchTarget, height: v3Layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
});
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, minHeight: 0 },
  header: { minHeight: v3Layout.headerHeight, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: profileStyles.iconButton,
  title: { flex: 1, textAlign: 'center', fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 24, color: colors.ink },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: profileLayout.footerPadding, paddingHorizontal: 20, backgroundColor: colors.bg },
  pressed: profileStyles.pressed,
});
