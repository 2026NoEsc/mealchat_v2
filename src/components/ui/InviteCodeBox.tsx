import { StyleSheet, Text, View } from 'react-native';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import CopyButton from './CopyButton';

/** Phone 528:1491 and 528:1536: the real room code is always copyable. */
export default function InviteCodeBox({ code, loading = false }: { code: string | null; loading?: boolean }) {
  return <View style={styles.box}><View style={styles.body}>
    <Text style={styles.label}>초대 코드</Text>
    <Text selectable={!loading} accessibilityLabel={loading ? '초대 코드 불러오는 중' : undefined} style={styles.code}>{loading ? '••••••' : code || '코드를 불러오지 못했어요'}</Text>
  </View>{code && !loading ? <CopyButton text={code} accessibilityLabel="초대 코드 복사" failureHint="초대 코드를 길게 눌러 직접 복사해 주세요" /> : null}</View>;
}
const styles = StyleSheet.create({
  box: { backgroundColor: colors.mutedBg, borderRadius: 12, paddingLeft: 16, paddingRight: 8, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  body: { flex: 1, minWidth: 0 },
  label: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 18, color: colors.sub },
  code: { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 32, letterSpacing: 3, color: colors.selectedText, flexShrink: 1 },
});
