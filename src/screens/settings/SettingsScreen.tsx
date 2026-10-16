import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSignOutAction } from '../../auth/useSignOutAction';
import { ListRow } from '../../components/ui/ListRow';
import Toast from '../../components/ui/Toast';
import { useNavigation } from '../../navigation/NavigationContext';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { appVersion } from './appVersion';
import SettingsFrame from './SettingsFrame';

/** Phone 564:1791. Only existing account operations and local information. */
export default function SettingsScreen() {
  const { navigate } = useNavigation();
  const { leave, leaving, toastProps } = useSignOutAction();
  // TODO(서버 단계): 알림 설정 계약이 없으므로 알림 묶음은 표시하지 않는다.
  // TODO(서버 단계): 앱 안 문의 계약이 없으므로 도움 묶음은 표시하지 않는다.
  // TODO(서버 단계): 계정 삭제 계약이 없으므로 설정의 삭제 행은 표시하지 않는다.
  return <SettingsFrame title="설정">
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.group}>
        <Text style={styles.groupTitle}>정보</Text>
        <View style={styles.card}>
          <ListRow title="서비스 이용약관" onPress={() => navigate('ServiceTerms')} />
          <ListRow title="개인정보 처리방침" onPress={() => navigate('PrivacyPolicy')} />
          <ListRow title="오픈소스 라이선스" onPress={() => navigate('AppInfo')} />
          <ListRow title="앱 버전" value={appVersion} style={styles.lastRow} onPress={() => navigate('AppInfo')} />
        </View>
      </View>
      <View style={styles.group}>
        <Text style={styles.groupTitle}>계정</Text>
        <View style={styles.card}><ListRow title="로그아웃" disabled={leaving} style={styles.lastRow} onPress={() => void leave()} /></View>
      </View>
    </ScrollView>
    <Toast {...toastProps} />
  </SettingsFrame>;
}

const styles = StyleSheet.create({
  body: { paddingTop: 4, paddingHorizontal: 20, paddingBottom: 120, gap: 18 },
  group: { gap: 6 },
  groupTitle: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 20, color: colors.sub },
  card: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  lastRow: { borderBottomWidth: 0 },
});
