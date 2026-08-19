import { Check, MapPin, Plus, Search } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/AuthProvider';
import AppHeader from '../../components/AppHeader';
import { CompleteButton } from '../../components/ui/Button';
import { fetchMyFriends, type Friend } from '../../lib/friends';
import { searchPlaces, type Place } from '../../lib/tmap';
import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors, shadows } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';
import type { SchedulePlace } from './scheduleTypes';
import ScheduleStepHeader from './ScheduleStepHeader';

/** Tmap 검색 결과를 다음 단계로 넘길 형태로 옮긴다 */
const toSchedulePlace = (place: Place): SchedulePlace => ({
  name: place.name,
  address: place.address,
  latitude: place.lat,
  longitude: place.lng,
});

/** STEP 2 에서 뒤로 돌아올 때 되돌려받는 값 */
type Params = {
  name?: string;
  invitees?: string[];
  place?: SchedulePlace;
};

export default function ScheduleDetailScreen() {
  const insets = useSafeAreaInsets();
  const { navigate, goBack, current } = useNavigation();
  const { user } = useAuth();

  /* 뒤로 왔다면 앞서 입력한 값이 params 로 실려 온다 */
  const params = current.params as Params | undefined;

  const [name, setName] = useState(params?.name ?? '');

  const [friends, setFriends] = useState<Friend[]>([]);
  const [picked, setPicked] = useState<string[]>(params?.invitees ?? []);

  const [query, setQuery] = useState(params?.place?.name ?? '');
  const [results, setResults] = useState<Place[]>([]);
  const [place, setPlace] = useState<SchedulePlace | null>(params?.place ?? null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  /** 늦게 도착한 응답이 최신 결과를 덮지 않게 한다 */
  const requestId = useRef(0);

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

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    void fetchMyFriends(user.id)
      .then(({ data }) => {
        if (active) setFriends(data ?? []);
      })
      .catch(() => {
        if (active) setFriends([]);
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  const toggle = (profileId: string) =>
    setPicked((prev) =>
      prev.includes(profileId) ? prev.filter((id) => id !== profileId) : [...prev, profileId],
    );

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />
      <AppHeader />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <ScheduleStepHeader
          step={1}
          title="어떻게 만날까요?"
          subtitle="구체적인 약속 일정을 정해주세요"
          onBack={goBack}
        />

        <View style={styles.nameInput}>
          <TextInput
            style={styles.nameText}
            value={name}
            onChangeText={setName}
            placeholder="약속 이름 ( 예: 점심 번개팅 )"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>밥약 메이트 선택</Text>
            <Search size={s(9)} color={colors.primary} strokeWidth={2.5} />
            <Plus size={s(10)} color={colors.primary} strokeWidth={3} />
          </View>

          {friends.length === 0 ? (
            <Text style={styles.mateEmpty}>
              아직 메이트가 없어요. 프로필 → 내 친구 관리에서 추가할 수 있어요.
            </Text>
          ) : (
            <View style={styles.mateRow}>
              {friends.map((friend) => {
                const on = picked.includes(friend.profileId);
                return (
                  <Pressable
                    key={friend.id}
                    style={styles.mate}
                    onPress={() => toggle(friend.profileId)}>
                    <View
                      style={[
                        styles.mateBox,
                        { backgroundColor: friend.avatarColor },
                        on && styles.mateBoxOn,
                      ]}>
                      <Text style={styles.mateInitial}>
                        {[...friend.name.trim()][0] ?? '?'}
                      </Text>
                    </View>
                    <Text style={[styles.mateName, on && styles.mateNameOn]} numberOfLines={1}>
                      {friend.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>약속 장소</Text>
            <View style={styles.mapChip}>
              <Text style={styles.mapChipText}>지도에서 선택</Text>
            </View>
          </View>

          <View style={styles.searchBox}>
            <Search size={s(8)} color={colors.textMuted} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="식당 이름 또는 주소 검색"
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

          {/* 결과를 고르면 목록을 닫고 고른 한 건만 남긴다 */}
          {results.map((found) => (
            <Pressable
              key={found.id}
              style={styles.placeRow}
              onPress={() => {
                setPlace(toSchedulePlace(found));
                setResults([]);
                setQuery(found.name);
              }}>
              <View style={styles.placeIcon}>
                <MapPin size={s(10)} color={colors.primary} strokeWidth={2.5} />
              </View>
              <View style={styles.placeBody}>
                <Text style={styles.placeName} numberOfLines={1}>
                  {found.name}
                </Text>
                <Text style={styles.placeMeta} numberOfLines={1}>
                  {found.address}
                </Text>
              </View>
            </Pressable>
          ))}

          {place && results.length === 0 ? (
            <View style={styles.placeRow}>
              <View style={styles.placeIcon}>
                <MapPin size={s(10)} color={colors.primary} strokeWidth={2.5} />
              </View>
              <View style={styles.placeBody}>
                <Text style={styles.placeName} numberOfLines={1}>
                  {place.name}
                </Text>
                <Text style={styles.placeMeta} numberOfLines={1}>
                  {place.address}
                </Text>
              </View>
              <View style={styles.placeCheck}>
                <Check size={s(7)} color={colors.textOnAccent} strokeWidth={3} />
              </View>
            </View>
          ) : null}

          <Text style={styles.note}>
            {!place
              ? '검색해서 약속 장소를 골라 주세요'
              : picked.length > 0
                ? `메이트 ${picked.length}명과 이 장소에서 만나요`
                : '이 장소로 약속을 잡아요'}
          </Text>
        </View>

        <CompleteButton
          label="다음"
          showNext
          disabled={!place}
          style={styles.cta}
          onPress={() =>
            navigate('ScheduleTime', {
              name: name.trim(),
              invitees: picked,
              place: place ?? undefined,
            })
          }
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
    paddingBottom: s(16),
  },
  nameInput: {
    marginTop: s(10),
    marginHorizontal: s(11.5),
    height: s(24),
    borderRadius: s(999),
    backgroundColor: colors.card,
    justifyContent: 'center',
    paddingHorizontal: s(12),
  },
  nameText: {
    paddingVertical: 0,
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    color: colors.textPrimary,
  },
  card: {
    marginTop: s(10),
    marginHorizontal: s(11.5),
    borderRadius: s(10),
    backgroundColor: colors.surface,
    paddingHorizontal: s(10),
    paddingVertical: s(9),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
  },
  cardTitle: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(8.5),
    lineHeight: fs(11),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  mateRow: {
    marginTop: s(9),
    flexDirection: 'row',
    gap: s(8),
  },
  mate: {
    alignItems: 'center',
  },
  mateBox: {
    width: s(30),
    height: s(30),
    borderRadius: s(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* 고른 메이트는 테두리로 표시한다 — 아바타 이미지가 아직 없어 색 원에 첫 글자다 */
  mateBoxOn: {
    borderWidth: s(2),
    borderColor: colors.primary,
  },
  mateInitial: {
    fontFamily: fontFamily.body,
    fontSize: fs(13),
    fontWeight: weight.bold,
    color: colors.textOnAccent,
  },
  mateName: {
    marginTop: s(3),
    maxWidth: s(34),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textPrimary,
  },
  mateNameOn: {
    fontWeight: weight.bold,
    color: colors.primary,
  },
  mateEmpty: {
    marginTop: s(10),
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(10),
    color: colors.textMuted,
  },
  mapChip: {
    paddingHorizontal: s(6),
    paddingVertical: s(2),
    borderRadius: s(5),
    backgroundColor: colors.primarySoft,
  },
  mapChipText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    fontWeight: weight.semibold,
    color: colors.primary,
  },
  searchBox: {
    marginTop: s(8),
    height: s(20),
    borderRadius: s(999),
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    paddingLeft: s(8),
    // 검색 버튼이 안쪽에 들어가므로 오른쪽은 좁게 잡는다
    paddingRight: s(3),
  },
  searchInput: {
    flex: 1,
    // 웹에서 flex:1 만으로는 기본 입력 폭이 남아 넘친다
    minWidth: 0,
    paddingVertical: 0,
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textPrimary,
  },
  searchButton: {
    width: s(30),
    height: s(14),
    borderRadius: s(7),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    fontWeight: weight.bold,
    color: colors.textOnAccent,
  },
  searchError: {
    marginTop: s(5),
    marginLeft: s(2),
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.danger,
  },
  placeRow: {
    marginTop: s(8),
    height: s(32),
    borderRadius: s(8),
    borderWidth: s(0.8),
    borderColor: colors.primary,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(8),
    gap: s(6),
    ...shadows.card,
  },
  placeIcon: {
    width: s(20),
    height: s(20),
    borderRadius: s(6),
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeBody: {
    flex: 1,
  },
  placeName: {
    fontFamily: fontFamily.body,
    fontSize: fs(7.5),
    lineHeight: fs(10),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  placeMeta: {
    marginTop: s(1),
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
  placeCheck: {
    width: s(13),
    height: s(13),
    borderRadius: s(13),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    marginTop: s(6),
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
  cta: {
    marginTop: s(14),
    marginHorizontal: s(11.5),
  },
});
