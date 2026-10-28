import { localMealExamples } from './localMealExamples';
import { useNavigation } from '../../navigation/NavigationContext';
import { Button } from '../../components/ui/Button';
import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { Image, type ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Avatar from '../../components/Avatar';
import { notify } from '../../lib/confirm';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import SettingsFrame from '../settings/SettingsFrame';

/** Presentation data only; production has no history/receipt service yet. */
export type MealRecord = {
  id: string; title: string; date: string; dateLabel: string; time: string; place: string;
  photo: ImageSourcePropType; mates: { name: string; photo?: ImageSourcePropType }[];
  amount: number; share: number; settling?: boolean;
  items: { name: string; quantity: number; amount: number }[];
};
export function RecordMates({ mates, size = 22 }: { mates: MealRecord['mates']; size?: number }) {
  return <View style={historyStyles.row}>{mates.map((mate, index) => <View key={index} style={{ marginLeft: index ? -6 : 0, borderWidth: 2, borderColor: colors.surface, borderRadius: size / 2 }}>
    {mate.photo ? <Image source={mate.photo} style={{ width: size - 4, height: size - 4, borderRadius: size / 2 }} resizeMode="contain" accessible={false} /> : <Avatar name={mate.name} size={size - 4} />}
  </View>)}</View>;
}
/** Phone 542:1534. Fixtures are supplied by the isolated preview, never by routes. */
export default function MealHistoryScreen({ records = [], onOpen }: { records?: MealRecord[]; onOpen?: (record: MealRecord) => void }) {
  const { navigate } = useNavigation();
  const [examples, setExamples] = useState(false);
  if (examples) records = localMealExamples;
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState('');
  const months = [...new Set(records.map(record => record.date.slice(0, 7)))];
  const visible = records.filter(record => (!month || record.date.startsWith(month)) &&
    [record.title, record.place, ...record.mates.map(mate => mate.name)].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <SettingsFrame title="밥약 기록"><ScrollView contentContainerStyle={historyStyles.body} keyboardShouldPersistTaps="handled">
    <Button variant="text" label={examples ? "로컬 예시 닫기" : "로컬 예시 기록 보기"} onPress={() => setExamples(!examples)} />
    {examples && <Text style={historyStyles.sub}>로컬 예시 · 실제 내역이 아니에요.</Text>}
    <Text style={historyStyles.sub}>{records.length ? `함께 먹은 밥약 ${records.length}번의 영수증이 모여 있어요.` : '밥약 기록과 영수증 보관 기능을 준비하고 있어요.'}</Text>
    <View style={historyStyles.search}><Search size={18} color={colors.sub} /><TextInput accessibilityLabel="밥약 기록 검색" placeholder="약속 이름, 장소, 메이트 검색" placeholderTextColor={colors.sub} value={query} onChangeText={setQuery} style={historyStyles.input} /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {['', ...months].map((value, index) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={value ? `${value.slice(0, 4)}년 ${Number(value.slice(5))}월` : '전체'} accessibilityState={{ selected: month === value }} onPress={() => setMonth(value)} style={[historyStyles.filter, month === value && historyStyles.selected]}><Text style={[historyStyles.filterText, month === value && historyStyles.selectedText]}>{value ? `${index === 1 ? value.slice(0, 4) + '년 ' : ''}${Number(value.slice(5))}월` : '전체'}</Text></Pressable>)}
    </ScrollView>
    {visible.map(record => <Pressable key={record.id} accessibilityRole="button" accessibilityLabel={record.title + ' 영수증 보기'} onPress={() => onOpen ? onOpen(record) : examples ? navigate('MealReceipt', { exampleId: record.id }) : notify('영수증 준비 중', '기록 보관 서비스가 아직 연결되지 않았어요.')} style={historyStyles.record}>
      <Image source={record.photo} style={historyStyles.photo} resizeMode="cover" accessible={false} />
      <View style={historyStyles.grow}><Text style={historyStyles.title}>{record.title}</Text><Text style={historyStyles.caption}>{record.dateLabel} · {record.place}</Text><RecordMates mates={record.mates} /></View>
      <View><Text style={historyStyles.caption}>내 몫{record.settling ? ' · 정산 중' : ''}</Text><Text style={historyStyles.amount}>{record.share.toLocaleString('ko-KR')}원</Text></View>
    </Pressable>)}
    {!visible.length ? <View style={historyStyles.empty}><Text style={historyStyles.title}>{records.length ? '검색 결과가 없어요' : '아직 표시할 기록이 없어요'}</Text><Text style={historyStyles.sub}>{records.length ? '다른 이름이나 월을 골라 보세요.' : '기록 보관이 연결되면 이곳에서 확인할 수 있어요.'}</Text></View> : null}
  </ScrollView></SettingsFrame>;
}
export const historyStyles = StyleSheet.create({
  body: { paddingTop: 4, paddingHorizontal: 20, paddingBottom: 120, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center' }, grow: { flex: 1, minWidth: 0, gap: 3 },
  sub: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 21, color: colors.sub },
  caption: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 18, color: colors.sub },
  title: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 23, color: colors.ink },
  amount: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22, color: colors.ink, textAlign: 'right' },
  search: { height: 48, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, minWidth: 0, fontFamily: fontFamily.body, fontSize: 15, color: colors.ink, height: 48 },
  filter: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center' },
  selected: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.selectedBg },
  filterText: { fontFamily: fontFamily.medium, fontSize: 14, color: colors.ink }, selectedText: { fontFamily: fontFamily.bold, color: colors.selectedText },
  record: { padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12 },
  photo: { width: 72, height: 72, borderRadius: 12 }, empty: { padding: 24, borderRadius: 16, backgroundColor: colors.surface, gap: 12 },
});
