import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { v3Layout } from '../../theme/scale';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

/** Phone handoff: 519:1229 top bar, 519:1262 signup header and shared footer. */
export function AuthTopBar({ title, onBack }: { title?: string; onBack?: () => void }) {
  return <View style={authStyles.topBar}>
    {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={onBack}
      style={({ pressed }) => [authStyles.iconButton, pressed && authStyles.pressed]}>
      <ArrowLeft size={24} color={colors.ink} aria-hidden={true} />
    </Pressable> : <View style={authStyles.iconButton} />}
    <Text accessibilityRole="header" style={authStyles.barTitle}>{title}</Text>
    <View style={authStyles.iconButton} />
  </View>;
}

export function SignupStepHeader({ step, title, subtitle, onBack }: {
  step: number; title: string; subtitle: string; onBack: () => void;
}) {
  return <View style={styles.signupHeader}>
    <View style={styles.stepRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={onBack}
        style={({ pressed }) => [authStyles.iconButton, pressed && authStyles.pressed]}>
        <ArrowLeft size={24} color={colors.ink} aria-hidden={true} />
      </Pressable>
      <Text style={styles.step}>STEP {step} / 4</Text>
    </View>
    <View style={styles.progress} accessibilityRole="progressbar" accessibilityLabel="회원가입 진행"
      accessibilityValue={{ min: 1, max: 4, now: step }}>
      {[1, 2, 3, 4].map((part) => <View key={part} style={[styles.progressPart, part <= step && styles.progressActive]} />)}
    </View>
    <View style={styles.signupTitle}>
      <Text accessibilityRole="header" style={authStyles.title}>{title}</Text>
      <Text style={authStyles.subtitle}>{subtitle}</Text>
    </View>
  </View>;
}

export function AuthFooter({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[authStyles.footer, { paddingBottom: Math.max(24, insets.bottom) }]}>{children}</View>;
}

/** Existing bundled wordmark font; no separate wordmark bitmap is in assets. */
export function BrandWordmark({ loading = false }: { loading?: boolean }) {
  return <Text accessibilityLabel="MealChat" allowFontScaling={false} numberOfLines={1}
    style={[styles.wordmark, loading && styles.loadingWordmark]}>MEALCHAT</Text>;
}

export const authStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  title: { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 30, color: colors.ink },
  subtitle: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 22, color: colors.sub },
  helper: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 20, color: colors.sub },
  label: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 20, color: colors.sub },
  topBar: { minHeight: v3Layout.headerHeight, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconButton: { width: v3Layout.minTouchTarget, height: v3Layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  barTitle: { flex: 1, textAlign: 'center', fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 24, color: colors.ink },
  footer: { backgroundColor: colors.bg, paddingTop: 12, paddingHorizontal: 20, paddingBottom: 24, gap: 4 },
  iconBadge: { width: 56, height: 56, borderRadius: 20, backgroundColor: colors.selectedBg, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
});

const styles = StyleSheet.create({
  signupHeader: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  stepRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  step: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 20, color: colors.selectedText },
  progress: { flexDirection: 'row', gap: 6 },
  progressPart: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressActive: { backgroundColor: colors.primary },
  signupTitle: { paddingTop: 8, gap: 6 },
  wordmark: { width: 160, height: 34, fontSize: 32, lineHeight: 34, fontFamily: fontFamily.wordmark, color: colors.ink, textAlign: 'center' },
  loadingWordmark: { width: 150, height: 32, fontSize: 30, lineHeight: 32 },
});
