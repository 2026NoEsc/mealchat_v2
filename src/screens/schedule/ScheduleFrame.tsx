import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTopInset } from '../../theme/insets';
import { scheduleLayout as layout } from '../../theme/scheduleTokens';
import { v3Colors as colors } from '../../theme/tokens';
import ScheduleStepHeader from './ScheduleStepHeader';

export default function ScheduleFrame({ step, title, subtitle, onBack, footer, children, bodyGap = layout.sectionGap }: { step: 1 | 2 | 3; title: string; subtitle: string; onBack: () => void; footer: ReactNode; children: ReactNode; bodyGap?: number }) {
  const top = useTopInset();
  const insets = useSafeAreaInsets();
  return <View style={styles.screen}>
    <View style={{ height: top }} />
    <ScheduleStepHeader step={step} title={title} subtitle={subtitle} onBack={onBack} />
    <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.body, { gap: bodyGap }]}>{children}</ScrollView>
    <View style={[styles.footer, { paddingBottom: layout.footerBottom + insets.bottom }]}>{footer}</View>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, scroll: { flex: 1 },
  body: { paddingHorizontal: layout.pagePadding, paddingBottom: 8, gap: layout.sectionGap },
  footer: { paddingHorizontal: layout.pagePadding, paddingTop: layout.footerTop, backgroundColor: colors.bg },
});
