import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Action, Copy } from '../preview/PreviewUI';
/**
 * Phone 683:18201 / 599:3969. Optional device-location boundary; never requests a real permission by default.
 * [결정] "직접 검색" 버튼은 만들지 않는다. 실제 검색이 없는 동작을 보여 주지 않고 아래 입력란이 그 역할을 한다.
 */
export default function LocalLocationControl({ requestLocation }: { requestLocation?: () => Promise<string> }) {
  const [denied, setDenied] = useState(false), [query, setQuery] = useState(''), [note, setNote] = useState('');
  return <View style={styles.card}><Copy bold>내가 출발하는 곳</Copy><Copy sub>로컬 입력 · 서버 연결 대기. 실제 밥약 생성에는 반영되지 않아요.</Copy>
    <Action secondary label="현재 위치로" onPress={() => { if (!requestLocation) setDenied(true); else void requestLocation().then(setQuery).catch(() => setDenied(true)); }} />
    {denied && <View style={styles.permission}>
      <Copy bold size={15}>위치 권한이 꺼져 있어요</Copy>
      <Copy size={13} sub>현재 위치로 찾으려면 설정에서 위치 권한을 켜 주세요. 역 이름이나 주소로 검색해도 돼요.</Copy>
      <View style={styles.row}><Action secondary label="설정 열기" onPress={() => setNote('기기 설정 연결 대기 · 설정에서 위치 권한을 확인해 주세요.')} /></View>
    </View>}
    <TextInput accessibilityLabel="출발지 직접 입력" value={query} onChangeText={setQuery} placeholder="주소 또는 역 이름" style={styles.input} />
    {!!query.trim() && <View style={styles.selected}><Copy size={12} sub>선택한 위치</Copy><Copy bold>{query.trim()}</Copy></View>}
    {!!note && <Copy>{note}</Copy>}
  </View>;
}
const styles = StyleSheet.create({
  card: { gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E8E3DC', backgroundColor: '#FFFFFF' },
  permission: { gap: 8, padding: 16, borderRadius: 16, backgroundColor: '#FFF3E0' },
  row: { flexDirection: 'row' },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#E8E3DC', borderRadius: 12, padding: 12 },
  selected: { gap: 2, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FF9900', backgroundColor: '#FFF8F0' },
});
