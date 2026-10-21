import { Check, MapPin, Search, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../../components/ui/Button';
import { saveStartLocation } from '../../lib/profile';
import { searchPlaces, type Place } from '../../lib/tmap';
import { useNavigation } from '../../navigation/NavigationContext';
import { useMyProfile } from '../../profile/useMyProfile';
import { v3Layout } from '../../theme/scale';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import ProfileFrame, { profileStyles as shared } from './ProfileFrame';
import ProfileOriginMap from './ProfileOriginMap';

/** Phone 530:1736, 601:3541. Existing Tmap search and coordinate-saving API. */
export default function OriginScreen() {
  const { resetTo } = useNavigation();
  const { userId, bundle, reload } = useMyProfile();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [picked, setPicked] = useState<Place | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [focused, setFocused] = useState(false);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [mapRevision, setMapRevision] = useState(0);
  const requestId = useRef(0);
  const savingRef = useRef(false);
  useEffect(() => {
    if (loaded || !bundle) return;
    const saved = bundle.privateProfile;
    setQuery(saved.startLocationName ?? '');
    if (saved.startLocationName && saved.startLat !== null && saved.startLng !== null) setPicked({
      id: 'saved', name: saved.startLocationName, address: saved.startLocationName,
      lat: saved.startLat, lng: saved.startLng, category: '',
    });
    setLoaded(true);
  }, [bundle, loaded]);
  useEffect(() => () => { ++requestId.current; }, []);
  const editQuery = (value: string) => {
    ++requestId.current;
    setSearching(false);
    setQuery(value);
    setPicked(null);
    setMapUnavailable(false);
    setResults([]);
    setSearchError(null);
  };
  const runSearch = async () => {
    if (!query.trim() || searching) return;
    const id = ++requestId.current;
    setSearching(true);
    setSearchError(null);
    try {
      const found = await searchPlaces(query.trim());
      if (id !== requestId.current) return;
      setResults(found);
      if (!found.length) setSearchError('검색 결과가 없어요.');
    } catch (error) {
      if (id !== requestId.current) return;
      setResults([]);
      setSearchError(error instanceof Error ? error.message : '검색에 실패했어요.');
    } finally { if (id === requestId.current) setSearching(false); }
  };
  const save = async () => {
    if (!userId || !loaded || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      // Preserve name-only saving for direct input; only a picked result supplies coordinates.
      const error = await saveStartLocation(userId, picked?.name ?? query, picked);
      if (error) { Alert.alert('저장 실패', error.message); return; }
      reload();
      resetTo('Profile');
    } catch { Alert.alert('저장 실패', '잠시 후 다시 시도해 주세요.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  return <ProfileFrame title="출발지 설정" footer={<PrimaryButton label="이 위치로 저장" disabled={!userId || !loaded} loading={saving} onPress={() => void save()} />}>
    <ScrollView contentContainerStyle={shared.body} keyboardShouldPersistTaps="handled">
      <Text style={shared.intro}>내 출발지를 선택 정보로 저장해요. 현재 공동 식당 추천에는 사용하지 않아요. 검색해서 고르면 좌표까지 저장돼요.</Text>
      <View style={styles.searchGroup}>
        <Text style={shared.label}>출발지 검색</Text>
        <View style={[styles.searchBox, focused && styles.focused]}>
          <Pressable accessibilityRole="button" accessibilityLabel="검색" disabled={!query.trim() || searching} onPress={() => void runSearch()}
            style={({ pressed }) => [shared.iconButton, pressed && shared.pressed]}>
            {searching ? <ActivityIndicator size="small" color={colors.selectedText} /> : <Search size={18} color={colors.sub} aria-hidden={true} />}
          </Pressable>
          <TextInput accessibilityLabel="출발지 검색" style={styles.input} value={query} onChangeText={editQuery}
            placeholder="역 이름이나 주소 검색" placeholderTextColor={colors.sub} returnKeyType="search" onSubmitEditing={() => void runSearch()} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
          <Pressable accessibilityRole="button" accessibilityLabel="검색어 지우기" onPress={() => editQuery('')}
            style={({ pressed }) => [shared.iconButton, pressed && shared.pressed]}><X size={18} color={colors.sub} aria-hidden={true} /></Pressable>
        </View>
      </View>
      <View testID="profile-origin-map" style={styles.map}><ProfileOriginMap key={(picked?.id ?? 'empty') + ':' + mapRevision} onUnavailable={() => setMapUnavailable(true)} marker={picked ? { lat: picked.lat, lng: picked.lng, label: picked.name } : null} />
        {picked && !mapUnavailable ? <View testID="profile-origin-pin" pointerEvents="none" style={styles.centerPin}><MapPin size={28} color={colors.selectedText} fill={colors.selectedBg} aria-hidden={true} /></View> : null}
      </View>
      {searchError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{searchError}</Text> : null}
      {results.length > 0 ? <View testID="profile-origin-results" accessibilityRole="radiogroup" accessibilityLabel="출발지 검색 결과" style={styles.results}>{results.map((place, index) => {
        const selected = picked?.id === place.id;
        return <Pressable key={place.id} accessibilityRole="radio" accessibilityLabel={place.name + ', ' + place.address} accessibilityState={{ checked: selected }} aria-checked={selected}
          onPress={() => { setPicked(place); setQuery(place.name); setMapUnavailable(false); setMapRevision((revision) => revision + 1); }} style={({ pressed }) => [styles.result, index > 0 && styles.divider, pressed && shared.pressed]}>
          <MapPin size={20} color={selected ? colors.selectedText : colors.sub} aria-hidden={true} />
          <View style={shared.grow}><Text style={[styles.resultName, selected && styles.selectedName]} numberOfLines={1}>{place.name}</Text><Text style={shared.sub} numberOfLines={1}>{place.address}</Text></View>
          {selected ? <View style={styles.check}><Check size={14} color={colors.ink} aria-hidden={true} /></View> : null}
        </Pressable>;
      })}</View> : null}
      {picked ? <View style={styles.selectedCard}><MapPin size={18} color={colors.selectedText} aria-hidden={true} />
        <View style={shared.grow}><Text style={styles.selectedLabel}>선택한 위치</Text><Text style={styles.selectedName}>{picked.name}{picked.address !== picked.name ? ' · ' + picked.address : ''}</Text></View>
      </View> : null}
      {/* 기존 출발지 화면에는 현재 위치 기능이 없어 위치 권한 안내/요청을 새로 만들지 않는다. */}
    </ScrollView>
  </ProfileFrame>;
}
const styles = StyleSheet.create({
  searchGroup: { gap: 6 },
  searchBox: { minHeight: v3Layout.fieldHeight, flexDirection: 'row', alignItems: 'center', paddingLeft: 4, paddingRight: 4, gap: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  focused: { borderWidth: 2, borderColor: colors.primary },
  input: { flex: 1, minWidth: 0, height: v3Layout.fieldHeight, padding: 0, fontFamily: fontFamily.body, fontSize: 16, color: colors.ink },
  map: { height: 160, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.mutedBg },
  centerPin: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  results: { paddingVertical: 4, paddingRight: 8, paddingLeft: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  result: { minHeight: 61, paddingVertical: 10, paddingRight: 4, gap: 10, flexDirection: 'row', alignItems: 'center' },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  resultName: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 22, color: colors.ink },
  selectedName: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22, color: colors.selectedText },
  check: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  selectedCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 10, borderRadius: 12, backgroundColor: colors.selectedBg },
  selectedLabel: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 18, color: colors.selectedText },
  error: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 20, color: v3FeedbackColors.error },
});
