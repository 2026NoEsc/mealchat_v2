import { Check, ChevronLeft, MapPin } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TmapMap from '../../components/TmapMap';
import { Button } from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import type { MyLocation } from '../../lib/myLocation';
import { searchPlaces, type Place } from '../../lib/tmap';
import { useNavigation } from '../../navigation/NavigationContext';
import { useTopInset } from '../../theme/insets';
import { v3Layout } from '../../theme/scale';
import { scheduleLayout as layout } from '../../theme/scheduleTokens';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

/** This route returns coordinates to this meeting only; it never writes a profile. */
export default function ScheduleOriginSearchScreen() {
  const { current, goBack, goBackWith } = useNavigation();
  const params = current.params as { origin?: MyLocation } | undefined;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [picked, setPicked] = useState<MyLocation | null>(params?.origin ?? null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const top = useTopInset();
  const insets = useSafeAreaInsets();
  useEffect(() => () => { requestId.current += 1; }, []);
  const search = async () => {
    if (!query.trim()) return;
    const id = ++requestId.current;
    setSearching(true);
    setError(null);
    try {
      const found = await searchPlaces(query.trim());
      if (id !== requestId.current) return;
      setResults(found);
      if (!found.length) setError('검색 결과가 없어요.');
    } catch (cause) {
      if (id !== requestId.current) return;
      setResults([]);
      setError(cause instanceof Error ? cause.message : '검색에 실패했어요.');
    } finally { if (id === requestId.current) setSearching(false); }
  };
  const changeQuery = (value: string) => {
    requestId.current += 1;
    setQuery(value);
    setResults([]);
    setSearching(false);
    setError(null);
  };
  return <View style={styles.screen}>
    <View style={{ height: top }} />
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={goBack} style={styles.back}><ChevronLeft size={24} color={colors.ink} /></Pressable><Text accessibilityRole="header" style={styles.title}>내가 출발하는 곳</Text></View>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={styles.note}>밥약 장소를 고를 때 중간 지점 계산에 써요. 이 밥약에서만 쓰고 프로필에는 저장하지 않아요.</Text>
      <View style={styles.search}><TextField label="출발지 검색" value={query} onChangeText={changeQuery} placeholder="동네나 건물 이름 검색" returnKeyType="search" onSubmitEditing={() => void search()} containerStyle={styles.flex} /><Button label="검색" variant="secondary" loading={searching} disabled={!query.trim()} onPress={() => void search()} /></View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.map}><TmapMap marker={picked ? { lat: picked.lat, lng: picked.lng, label: picked.name } : null} /></View>
      {results.length > 0 ? <View accessibilityRole="radiogroup" accessibilityLabel="출발지 검색 결과" style={styles.results}>
        {results.map((place, index) => {
          const on = picked?.lat === place.lat && picked?.lng === place.lng && picked?.name === place.name;
          return <Pressable key={place.id} accessibilityRole="radio" accessibilityLabel={place.name + ', ' + place.address} accessibilityState={{ checked: on }} aria-checked={on} style={[styles.result, index > 0 && styles.divider]} onPress={() => setPicked({ name: place.name, address: place.address, lat: place.lat, lng: place.lng, fromGps: false })}>
            <MapPin size={20} color={on ? colors.selectedText : colors.sub} /><View style={styles.flex}><Text style={[styles.resultName, on && styles.selectedText]}>{place.name}</Text><Text style={styles.note}>{place.address}</Text></View>
            {on ? <View style={styles.check}><Check size={14} color={colors.onPrimary} strokeWidth={3} /></View> : null}
          </Pressable>;
        })}
      </View> : null}
      {picked ? <View style={styles.picked}><MapPin size={18} color={colors.selectedText} /><View style={styles.flex}><Text style={styles.pickedLabel}>선택한 위치</Text><Text style={styles.pickedName}>{picked.name}</Text><Text style={styles.note}>{picked.address}</Text></View></View> : null}
    </ScrollView>
    <View style={[styles.footer, { paddingBottom: layout.footerBottom + insets.bottom }]}><Button label="이 위치로 정하기" disabled={!picked} onPress={() => { if (picked) goBackWith({ origin: picked, originSource: 'search' }); }} /></View>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, scroll: { flex: 1 }, flex: { flex: 1, minWidth: 0 },
  header: { padding: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { width: v3Layout.minTouchTarget, height: v3Layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 25, color: colors.ink },
  body: { paddingHorizontal: layout.pagePadding, paddingTop: 4, paddingBottom: 20, gap: 14 },
  note: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.sub },
  search: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  map: { height: layout.mapHeight, borderWidth: 1, borderColor: colors.border, borderRadius: layout.cardRadius, overflow: 'hidden', backgroundColor: colors.mutedBg },
  results: { borderWidth: 1, borderColor: colors.border, borderRadius: layout.cardRadius, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: colors.surface },
  result: { minHeight: v3Layout.minTouchTarget, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingRight: 4 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  resultName: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 22, color: colors.ink },
  selectedText: { fontFamily: fontFamily.bold, color: colors.selectedText },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  picked: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: layout.fieldRadius, backgroundColor: colors.selectedBg },
  pickedLabel: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 17, color: colors.selectedText },
  pickedName: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22, color: colors.ink },
  footer: { paddingHorizontal: layout.pagePadding, paddingTop: layout.footerTop },
  error: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: v3FeedbackColors.error },
});
