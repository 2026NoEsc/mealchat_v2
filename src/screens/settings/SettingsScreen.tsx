import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSignOutAction } from '../../auth/useSignOutAction';
import { ListRow } from '../../components/ui/ListRow';
import Toast from '../../components/ui/Toast';
import { useNavigation } from '../../navigation/NavigationContext';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { appVersion } from './appVersion';
import { useConsentServerMode } from '../../consents/useConsentGate';
import { shouldShowPrivacyNotice } from '../../legal/privacyRevision';
import SettingsFrame from './SettingsFrame';

/** Phone 564:1791. Only existing account operations and local information. */
export default function SettingsScreen() {
  const { navigate } = useNavigation();
  const serverMode = useConsentServerMode();
  const { leave, leaving, toastProps } = useSignOutAction();
  // TODO(서버 단계): 알림 설정 계약이 없으므로 알림 묶음은 표시하지 않는다.
  // TODO(서버 단계): 앱 안 문의 계약이 없으므로 도움 묶음은 표시하지 않는다.
  // S1 9.9: 계정 삭제는 S2 미구현 안내로만 연결하며 실제 삭제 요청은 보내지 않는다.
  return <SettingsFrame title="설정">
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.group}>
        <Text style={styles.groupTitle}>정보</Text>
        <View style={styles.card}>
          <ListRow title="서비스 이용약관" onPress={() => navigate('ServiceTerms')} />
          <ListRow title="개인정보 처리방침" onPress={() => navigate('PrivacyPolicy')} />
          {shouldShowPrivacyNotice(serverMode) ? <ListRow title="개인정보 처리방침 개정 예고" value="바뀌는 점 보기" onPress={() => navigate('PrivacyRevision')} /> : null}
          <ListRow title="오픈소스 라이선스" onPress={() => navigate('AppInfo')} />
          <ListRow title="앱 버전" value={appVersion} style={styles.lastRow} onPress={() => navigate('AppInfo')} />
        </View>
      </View>
      <View style={styles.group}>
        <Text style={styles.groupTitle}>동의</Text>
        <View style={styles.card}><ListRow title="선택 동의" value="건강정보 · 마케팅" style={styles.lastRow} onPress={() => navigate('OptionalConsents')} /></View>
      </View>
      <View style={styles.group}>
        <Text style={styles.groupTitle}>계정</Text>
        <View style={styles.card}><ListRow title="로그아웃" disabled={leaving} onPress={() => void leave()} />
          <ListRow title="계정 삭제" style={styles.lastRow} onPress={() => navigate('AccountDeletion')} /></View>
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
