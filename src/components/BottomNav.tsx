import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fs, s } from '../theme/scale';
import { colors, shadows } from '../theme/tokens';
import { fontFamily } from '../theme/typography';
import { CalendarIcon, HomeIcon, ProfileIcon } from './icons';

export type TabKey = 'home' | 'schedule' | 'profile';

/* 채팅방은 홈에 합쳤다 — 시안 2154:584 부터 탭이 셋이다 */
const TABS: { key: TabKey; label: string }[] = [
  { key: 'home', label: '홈' },
  { key: 'schedule', label: '일정 조율' },
  { key: 'profile', label: '프로필' },
];

function TabIcon({ tab, active }: { tab: TabKey; active: boolean }) {
  const color = active ? colors.primary : colors.textPrimary;
  const size = s(14);

  switch (tab) {
    case 'home':
      return <HomeIcon size={size} color={color} />;
    case 'schedule':
      return <CalendarIcon size={size} color={color} />;
    case 'profile':
      return <ProfileIcon size={s(13)} color={color} />;
  }
}

/**
 * Figma BottomNav1 (2154:584) — 220 x 38
 * 탭 3개 균등 배치, 활성 탭 하단에 1/3 폭 오렌지 인디케이터
 */
export default function BottomNav({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  const activeIndex = TABS.findIndex((t) => t.key === active);

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable key={tab.key} style={styles.tab} onPress={() => onChange(tab.key)}>
            <View style={styles.iconSlot}>
              <TabIcon tab={tab.key} active={isActive} />
            </View>
            <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}

      <View
        style={[
          styles.indicator,
          { left: `${(activeIndex * 100) / TABS.length}%` },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: s(38),
    flexDirection: 'row',
    backgroundColor: colors.surface,
    ...shadows.bar,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
  },
  iconSlot: {
    height: s(14),
    marginTop: s(6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: s(3),
    fontFamily: fontFamily.regular,
    fontSize: fs(8),
    lineHeight: fs(10),
    color: colors.textPrimary,
    textAlign: 'center',
  },
  labelActive: {
    color: colors.primary,
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    width: `${100 / TABS.length}%`,
    height: s(2),
    borderRadius: s(3),
    backgroundColor: colors.primary,
  },
});
