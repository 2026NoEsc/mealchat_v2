import { ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { v3Layout } from '../../theme/scale';
import { scheduleLayout as layout } from '../../theme/scheduleTokens';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

export default function ScheduleStepHeader({ step, title, subtitle, onBack }: { step: 1 | 2 | 3; title: string; subtitle: string; onBack: () => void }) {
  return <View style={styles.header}>
    <View style={styles.top}>
      <View style={styles.left}><Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={onBack} style={styles.back}><ChevronLeft size={24} color={colors.ink} /></Pressable><Text style={styles.name}>새 밥약</Text></View>
      <Text style={styles.step}>STEP {step} / 3</Text>
    </View>
    <View accessibilityLabel={'3단계 중 ' + step + '단계'} style={styles.progress}>
      {[1, 2, 3].map((segment) => <View key={segment} style={[styles.segment, segment <= step && styles.complete]} />)}
    </View>
    <View style={styles.titles}><Text accessibilityRole="header" style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></View>
  </View>;
}
const styles = StyleSheet.create({
  header: { paddingTop: 8, paddingBottom: 16, paddingHorizontal: layout.pagePadding, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  left: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  back: { width: v3Layout.minTouchTarget, height: v3Layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 25, color: colors.ink },
  step: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 19, color: colors.selectedText },
  progress: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  complete: { backgroundColor: colors.primary },
  titles: { paddingTop: 6, gap: 4 },
  title: { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 32, color: colors.ink },
  subtitle: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, color: colors.sub },
});
