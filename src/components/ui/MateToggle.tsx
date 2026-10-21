import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { scheduleLayout as layout } from '../../theme/scheduleTokens';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import Avatar from '../Avatar';

export type MateToggleProps = { name: string; seed?: string; avatarUrl?: string | null; selected: boolean; disabled?: boolean; onChange: (selected: boolean) => void };

/** Figma 598:2362/2369. Default characters come from the existing Avatar component. */
export default function MateToggle({ name, seed, avatarUrl, selected, disabled = false, onChange }: MateToggleProps) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityLabel={name}
      accessibilityState={{ checked: selected, disabled }} aria-checked={selected}
      disabled={disabled} onPress={() => onChange(!selected)}
      style={({ pressed }) => [styles.target, pressed && !disabled && styles.pressed, disabled && styles.disabled]}>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.wrap, selected && styles.selected]}>
        <Avatar name={name} seed={seed} url={avatarUrl} size={layout.avatar} style={styles.avatar} />
        {selected ? <View style={styles.badge}><Check size={12} strokeWidth={3} color={colors.onPrimary} /></View> : null}
      </View>
      <Text numberOfLines={1} style={[styles.name, selected && styles.nameSelected]}>{name}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  target: { width: layout.avatarWrap, minHeight: 79, gap: 4, alignItems: 'center', justifyContent: 'center' },
  wrap: { width: layout.avatarWrap, height: layout.avatarWrap, borderRadius: 28, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  selected: { borderColor: colors.primary },
  avatar: { backgroundColor: colors.mutedBg },
  badge: { position: 'absolute', right: 0, bottom: 0, width: layout.avatarBadge, height: layout.avatarBadge, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  name: { maxWidth: '100%', fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.sub },
  nameSelected: { fontFamily: fontFamily.bold, color: colors.ink },
  pressed: { opacity: 0.8 }, disabled: { opacity: 0.4 },
});
