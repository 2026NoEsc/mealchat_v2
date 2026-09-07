import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  /*
   * 갤럭시의 제스처 바가 탭 위에 겹쳐 앉는다. 탭 높이(38)는 그대로 두고 아래에
   * 시스템 바만큼 덧대서, 글자와 아이콘이 가려지지 않게 한다.
   */
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
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

      {/* 인디케이터는 탭 아래에 붙는다 — 덧댄 시스템 바 영역보다 위 */}
      <View
        style={[
          styles.indicator,
          { left: `${(activeIndex * 100) / TABS.length}%`, bottom: insets.bottom },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    /* 높이 대신 아이템으로 38 을 채운다 — 아래 인셋이 더 붙을 수 있어서다 */
    flexDirection: 'row',
    backgroundColor: colors.surface,
    ...shadows.bar,
  },
  tab: {
    flex: 1,
    height: s(38),
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
    width: `${100 / TABS.length}%`,
    height: s(2),
    borderRadius: s(3),
    backgroundColor: colors.primary,
  },
});
