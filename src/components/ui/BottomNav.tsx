import { CalendarDays, Home, UserRound } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { v3BottomNavLayout, v3Layout } from '../../theme/scale';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

export type TabKey = 'home' | 'schedule' | 'profile';
export type BottomNavProps = { active: TabKey; onChange: (tab: TabKey) => void };

const TABS: { key: TabKey; label: string }[] = [
  { key: 'home', label: '홈' },
  { key: 'schedule', label: '일정 조율' },
  { key: 'profile', label: '프로필' },
];

function TabIcon({ tab, active }: { tab: TabKey; active: boolean }) {
  const color = active ? colors.selectedText : colors.sub;
  switch (tab) {
    case 'home': return <Home size={24} strokeWidth={2} color={color} />;
    case 'schedule': return <CalendarDays size={24} strokeWidth={2} color={color} />;
    case 'profile': return <UserRound size={24} strokeWidth={2} color={color} />;
  }
}

/** Target: 518:1215. 72 logical units for the tabs, plus the bottom safe area. */
export default function BottomNav({ active, onChange }: BottomNavProps) {
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" style={[styles.container, { paddingBottom: v3BottomNavLayout.paddingBottom + insets.bottom }]}>
      <View style={styles.divider} accessible={false} />
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
            aria-selected={isActive}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
            <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.iconSlot}>
              <TabIcon tab={tab.key} active={isActive} />
            </View>
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', flexDirection: 'row', backgroundColor: colors.surface,
    paddingTop: v3BottomNavLayout.paddingTop, paddingHorizontal: v3BottomNavLayout.paddingHorizontal, paddingBottom: v3BottomNavLayout.paddingBottom },
  divider: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: colors.border },
  tab: {
    flex: 1,
    minWidth: v3Layout.minTouchTarget,
    minHeight: v3BottomNavLayout.tabHeight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 2,
  },
  iconSlot: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 18, color: colors.sub, textAlign: 'center' },
  labelActive: { fontFamily: fontFamily.bold, color: colors.selectedText },
  pressed: { opacity: 0.8 },
});
