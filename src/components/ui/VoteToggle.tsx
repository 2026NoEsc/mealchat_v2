import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text } from 'react-native';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
/** Figma 597:2243/2247. A vote is independently reversible, so use a checkbox. */
export default function VoteToggle({ label, selected, disabled = false, onPress, hint }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void; hint?: string }) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label + ' 투표'} accessibilityState={{ checked: selected, disabled }} aria-checked={selected}
    accessibilityHint={hint ?? (selected ? '다시 누르면 투표를 취소해요' : '이 식당에 투표해요')} disabled={disabled} onPress={onPress}
    style={[styles.button, selected && styles.selected, disabled && styles.disabled]}>
    <Check size={18} color={selected ? colors.onPrimary : colors.sub} strokeWidth={3} />
    <Text style={[styles.label, selected && styles.on]}>{selected ? '투표함' : '투표'}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { width: 56, height: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary }, disabled: { opacity: 0.4 },
  label: { fontFamily: fontFamily.bold, fontSize: 12, lineHeight: 18, color: colors.sub }, on: { color: colors.onPrimary },
});
