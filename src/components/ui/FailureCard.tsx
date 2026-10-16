import { WifiOff } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { Button } from './Button';

/** Figma 563:2130: common retry state, measured at 412 logical units. */
export default function FailureCard({ title, onRetry, reason = '인터넷 연결을 확인하고 다시 시도해 주세요.', icon }: { title: string; onRetry: () => void; reason?: string; icon?: ReactNode }) {
  return <View style={styles.card} accessibilityLiveRegion="polite">
    <View style={styles.icon}>{icon ?? <WifiOff size={26} color={colors.sub} />}</View>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.reason}>{reason}</Text>
    <Button label="다시 시도" onPress={onRetry} style={styles.button} />
  </View>;
}
const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 28, gap: 12, alignItems: 'center' },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.mutedBg, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 25, color: colors.ink, textAlign: 'center' },
  reason: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, color: colors.sub, textAlign: 'center' },
  button: { alignSelf: 'stretch' },
});
