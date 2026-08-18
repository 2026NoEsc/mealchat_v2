import { Search } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppHeader from '../../components/AppHeader';
import TmapMap from '../../components/TmapMap';
import { CompleteButton } from '../../components/ui/Button';
import { saveStartLocation } from '../../lib/profile';
import { searchPlaces, type Place } from '../../lib/tmap';
import { useNavigation } from '../../navigation/NavigationContext';
import { useMyProfile } from '../../profile/useMyProfile';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

/**
 * Figma 프로필/지도 위치 지정 (256:2333) — 220 x 486
 * body x11.5 y82 w197 / 검색창 y118 h26 / 지도 y154 h186 / 선택 카드 y347 h51 /
 * 저장 버튼 y405 h28
 *
 * 지도 렌더링은 아직 없다. Figma 원본도 회색 격자 플레이스홀더이고,
 * 지도 SDK 는 플랫폼 분기가 필요해 다음 단계로 미뤘다. 대신 Tmap POI 검색으로
 * 좌표를 확보해 `start_latitude/longitude` 까지 저장한다.
 */
export default function OriginScreen() {
  const insets = useSafeAreaInsets();
  const { resetTo } = useNavigation();
  const { userId, bundle, reload } = useMyProfile();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [picked, setPicked] = useState<Place | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  /** 응답이 순서를 뒤바꿔 도착해도 마지막 입력의 결과만 반영한다 */
  const requestId = useRef(0);

  useEffect(() => {
    if (loaded || !bundle) return;
    const saved = bundle.privateProfile;
    setQuery(saved.startLocationName ?? '');
    if (saved.startLocationName && saved.startLat !== null && saved.startLng !== null) {
      setPicked({
        id: 'saved',
        name: saved.startLocationName,
        address: saved.startLocationName,
        lat: saved.startLat,
        lng: saved.startLng,
      });
    }
    setLoaded(true);
  }, [bundle, loaded]);

  const runSearch = async () => {
    const keyword = query.trim();
    if (!keyword) return;

    const id = ++requestId.current;
    setSearching(true);
    setSearchError(null);

    try {
      const found = await searchPlaces(keyword);
      if (id !== requestId.current) return;
      setResults(found);
      if (found.length === 0) setSearchError('검색 결과가 없어요.');
    } catch (error) {
      if (id !== requestId.current) return;
      setResults([]);
      setSearchError(error instanceof Error ? error.message : '검색에 실패했어요.');
    } finally {
      if (id === requestId.current) setSearching(false);
    }
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    // 검색으로 고른 장소여야 좌표가 있다. 직접 입력한 글자는 이름만 저장된다.
    const error = await saveStartLocation(userId, picked?.name ?? query, picked);
    setSaving(false);

    if (error) {
      Alert.alert('저장 실패', error.message);
      return;
    }
    reload();
    resetTo('Profile');
  };

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />
      <AppHeader />

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>출발지 설정</Text>
        <Text style={styles.sub}>중간 지점 계산에 사용됩니다</Text>

        <View style={styles.searchBox}>
          <Search size={s(8)} color={colors.textMuted} strokeWidth={2.5} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="주소 또는 장소 검색"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            onSubmitEditing={() => void runSearch()}
          />
          <Pressable
            style={styles.searchButton}
            disabled={searching || !query.trim()}
            onPress={() => void runSearch()}>
            {searching ? (
              <ActivityIndicator size="small" color={colors.textOnAccent} />
            ) : (
              <Text style={styles.searchButtonText}>검색</Text>
            )}
          </Pressable>
        </View>

        {searchError ? <Text style={styles.searchError}>{searchError}</Text> : null}

        <View style={styles.map}>
          <TmapMap
            marker={picked ? { lat: picked.lat, lng: picked.lng, label: picked.name } : null}
          />
        </View>

        {results.length > 0 ? (
          <View style={styles.results}>
            {results.map((place) => {
              const selected = picked?.lat === place.lat && picked?.lng === place.lng;
              return (
                <Pressable
                  key={place.id}
                  style={[styles.result, selected && styles.resultSelected]}
                  onPress={() => {
                    setPicked(place);
                    setQuery(place.name);
                  }}>
                  <Text style={styles.resultName} numberOfLines={1}>
                    {place.name}
                  </Text>
                  <Text style={styles.resultAddress} numberOfLines={1}>
                    {place.address}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>선택한 위치</Text>
          <Text style={styles.cardAddress}>
            {picked?.name ?? query.trim() ?? '아직 설정하지 않았어요'}
          </Text>
          <Text style={styles.cardDetail}>
            {picked
              ? picked.address
              : '검색해서 고르면 좌표까지 저장돼요 — 중간 지점 계산에 필요해요'}
          </Text>
        </View>

        <CompleteButton
          label={saving ? '저장 중' : '이 위치로 저장'}
          style={styles.cta}
          disabled={saving || (!picked && !query.trim())}
          onPress={() => void save()}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceSunken,
  },
  body: {
    paddingHorizontal: s(11.5),
    paddingTop: s(10),
    paddingBottom: s(20),
  },
  title: {
    fontFamily: fontFamily.body,
    fontSize: fs(12),
    lineHeight: fs(16),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  sub: {
    marginTop: s(7),
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  searchBox: {
    // y118 h26
    marginTop: s(7),
    height: s(26),
    borderRadius: s(13),
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    paddingLeft: s(11),
    paddingRight: s(3),
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    color: colors.textPrimary,
  },
  searchButton: {
    width: s(34),
    height: s(20),
    borderRadius: s(10),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: {
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(9),
    fontWeight: weight.bold,
    color: colors.textOnAccent,
  },
  searchError: {
    marginTop: s(6),
    marginLeft: s(4),
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.danger,
  },
  results: {
    // 지도 아래에 붙는 목록 — 높이는 항목 수에 맡긴다
    marginTop: s(7),
    borderRadius: s(8),
    backgroundColor: colors.card,
    paddingHorizontal: s(9),
    paddingVertical: s(4),
  },
  result: {
    paddingVertical: s(7),
    borderBottomWidth: s(0.6),
    borderBottomColor: colors.border,
  },
  resultSelected: {
    backgroundColor: '#FFF5EB',
    borderRadius: s(6),
    paddingHorizontal: s(6),
    marginHorizontal: s(-6),
    borderBottomColor: 'transparent',
  },
  resultName: {
    fontFamily: fontFamily.body,
    fontSize: fs(7.5),
    lineHeight: fs(10),
    fontWeight: weight.semibold,
    color: colors.textPrimary,
  },
  resultAddress: {
    marginTop: s(2),
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
  map: {
    // y154 h186
    marginTop: s(10),
    height: s(186),
    borderRadius: s(8),
    backgroundColor: '#E8EBE6',
    overflow: 'hidden',
  },
  card: {
    // y347 h51
    marginTop: s(7),
    backgroundColor: colors.card,
    borderRadius: s(10),
    paddingHorizontal: s(9),
    paddingVertical: s(8),
  },
  cardLabel: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  cardAddress: {
    marginTop: s(3),
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    lineHeight: fs(11),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  cardDetail: {
    marginTop: s(3),
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  cta: {
    marginTop: s(7),
  },
});
