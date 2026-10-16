import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import licenses from '../../legal/licenses.generated.json';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { appVersion } from './appVersion';
import SettingsFrame from './SettingsFrame';

const logo = require('../../../assets/brand/logo-main.png');

export default function AppInfoScreen() {
  return <SettingsFrame title="앱 정보">
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.hero}>
        <Image source={logo} style={styles.logo} resizeMode="contain" accessible={false} />
        <Text style={styles.brand}>MEALCHAT {appVersion}</Text>
      </View>
      <Text style={styles.heading}>오픈소스 라이선스</Text>
      <View style={styles.card}>
        {licenses.map((entry, index) => <View key={entry.name} testID="license-row" accessible
          accessibilityLabel={[entry.name, entry.version, entry.license].filter(Boolean).join(', ')}
          style={[styles.row, index === licenses.length - 1 && styles.lastRow]}>
          <Text style={styles.name}>{entry.name}</Text><Text style={styles.license}>{entry.license}</Text>
        </View>)}
      </View>
    </ScrollView>
  </SettingsFrame>;
}

const styles = StyleSheet.create({
  body: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  hero: { paddingVertical: 8, gap: 8, alignItems: 'center' },
  logo: { width: 72, height: 72, borderRadius: 18 },
  brand: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 26, color: colors.ink },
  heading: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 20, color: colors.sub },
  card: { paddingVertical: 4, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  row: { minHeight: 50, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  name: { flex: 1, fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 22, color: colors.ink },
  license: { flexShrink: 1, maxWidth: '40%', fontFamily: fontFamily.body, fontSize: 13, lineHeight: 20, color: colors.sub, textAlign: 'right' },
  lastRow: { borderBottomWidth: 0 },
});
