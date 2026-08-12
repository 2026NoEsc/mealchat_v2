import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppHeader from '../components/AppHeader';
import { fs, s } from '../theme/scale';
import { colors } from '../theme/tokens';
import { fontFamily, weight } from '../theme/typography';

/** 아직 Figma 스펙을 옮기지 않은 탭을 위한 임시 화면 */
export default function ComingSoonScreen({ title }: { title: string }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />
      <AppHeader />
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>이 화면은 아직 구현되지 않았습니다.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.card,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(4),
  },
  title: {
    fontFamily: fontFamily.body,
    fontSize: fs(11),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  sub: {
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    color: colors.textMuted,
  },
});
