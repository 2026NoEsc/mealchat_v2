import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConsentServerMode } from '../../consents/useConsentGate';
import { privacyNoticeDate, privacyRevisionPublication, shouldShowPrivacyNotice } from '../../legal/privacyRevision';
import { useNavigation } from '../../navigation/NavigationContext';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

/** App-owned placement keeps the HomeScreen ownership boundary intact.
 * Dismissal lasts while this view is mounted; Settings remains a reopening path.
 */
export default function PrivacyNoticeBanner({ publication = privacyRevisionPublication }: { publication?: typeof privacyRevisionPublication }) {
  const { current, navigate } = useNavigation();
  const serverMode = useConsentServerMode();
  const insets = useSafeAreaInsets();
  const [dismissed, setDismissed] = useState(false);
  if (current.name !== 'Home' || dismissed || !shouldShowPrivacyNotice(serverMode, publication)) return null;
  return <View style={[styles.banner, { paddingTop: 8 + insets.top }]} testID="privacy-advance-notice">
    <Pressable accessibilityRole="button" accessibilityLabel="개인정보 처리방침 바뀌는 점 보기" onPress={() => navigate('PrivacyRevision')} style={styles.link}>
      <Text style={styles.text}>개인정보 처리방침이 {privacyNoticeDate(publication)}부터 바뀌어요 · 바뀌는 점 보기</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="개인정보 처리방침 예고 닫기" onPress={() => setDismissed(true)} style={styles.close}>
      <X size={24} color={colors.selectedText} aria-hidden={true} />
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.selectedBg, paddingLeft: 20, paddingRight: 8, paddingVertical: 8 },
  link: { flex: 1, minHeight: 44, justifyContent: 'center', paddingRight: 8 },
  text: { color: colors.selectedText, fontSize: 13, lineHeight: 20, fontFamily: fontFamily.medium },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
