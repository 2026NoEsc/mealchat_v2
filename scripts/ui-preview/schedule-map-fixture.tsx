import { MapPin } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { v3Colors as colors } from '../../src/theme/tokens';
import { fontFamily } from '../../src/theme/typography';
export default function MapFixture() { return <View style={styles.map}><MapPin size={28} color={colors.selectedText} /><Text style={styles.label}>오프라인 지도 미리보기</Text></View>; }
const styles = StyleSheet.create({ map: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.mutedBg }, label: { fontFamily: fontFamily.body, fontSize: 13, color: colors.sub } });
