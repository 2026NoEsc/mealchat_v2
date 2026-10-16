import { StyleSheet, Text, View } from 'react-native';
import type { TmapMapProps } from '../../src/components/TmapMap';
import { v3Colors as colors } from '../../src/theme/tokens';
/** Layout-only map stub. The screenshot never contacts Tmap or reads provider keys. */
export default function ProfileMap({ marker }: TmapMapProps) {
  return <View style={styles.map}><Text style={styles.label}>오프라인 지도 미리보기</Text><Text style={styles.caption}>{marker?.label ?? '위치를 검색해 주세요'}</Text></View>;
}
const styles = StyleSheet.create({
  map: { flex: 1, backgroundColor: colors.mutedBg, alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  label: { fontSize: 12, color: colors.sub }, caption: { fontSize: 12, color: colors.sub },
});
