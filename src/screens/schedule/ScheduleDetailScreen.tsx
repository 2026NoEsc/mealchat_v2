import { Crosshair, MapPin, Plus, Search } from 'lucide-react-native';
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
import { LocationDeniedError, locateMe, type MyLocation } from '../../lib/myLocation';
import { searchPlaces, type Place } from '../../lib/tmap';
import { useNavigation } from '../../navigation/NavigationContext';
import { useMyProfile } from '../../profile/useMyProfile';
import { fs, s } from '../../theme/scale';
import { colors, shadows } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';
import ScheduleStepHeader from './ScheduleStepHeader';

const toMyLocation = (place: Place): MyLocation => ({
  name: place.name,
  address: place.address,
  lat: place.lat,
  lng: place.lng,
  fromGps: false,
});

/** STEP 2 에서 뒤로 돌아올 때 되돌려받는 값 */
type Params = {
  name?: string;
  invitees?: string[];
  origin?: MyLocation;
};

/**
 * Figma 일정 조율/일정 추가/디테일 선택 (309:1065) — STEP 1
 *
 * 약속 이름 → 밥약 메이트 선택 → 내 위치.
 *
 * 식당은 여기서 정하지 않는다. 어디서 먹을지는 메이트들의 중간 지점과 취향,
 * 시간대별 참석 인원까지 봐야 나오는 값이라 AI 추천 단계의 몫이다. 여기서
 * 잡는 것은 그 계산에 들어갈 "내가 출발하는 곳" 하나다.
 */
export default function ScheduleDetailScreen() {
  const insets = useSafeAreaInsets();
  const { navigate, goBack, current } = useNavigation();
  const { user } = useAuth();
  const { bundle } = useMyProfile();

  /* 뒤로 왔다면 앞서 입력한 값이 params 로 실려 온다 */
  const params = current.params as Params | undefined;

  const [name, setName] = useState(params?.name ?? '');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [picked, setPicked] = useState<string[]>(params?.invitees ?? []);

  const [origin, setOrigin] = useState<MyLocation | null>(params?.origin ?? null);
  const [locating, setLocating] = useState(false);
  const [originError, setOriginError] = useState<string | null>(null);

  /* 직접 검색은 필요할 때만 연다 — 기본은 저장된 사는 곳이나 현재 위치다 */
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  /** 늦게 도착한 응답이 최신 결과를 덮지 않게 한다 */
  const requestId = useRef(0);

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

  /*
   * 아무것도 고르지 않았으면 프로필의 사는 곳에서 시작한다. 사용자가 이미
   * 고른 값이 있으면 건드리지 않는다 — 저장된 값이 선택을 덮으면 안 된다.
   */
  useEffect(() => {
    if (origin) return;
    const profile = bundle?.privateProfile;
    if (!profile?.startLat || !profile?.startLng) return;

    setOrigin({
      name: profile.startLocationName?.trim() || '사는 곳',
      address: '',
      lat: profile.startLat,
      lng: profile.startLng,
      fromGps: false,
    });
  }, [bundle, origin]);

  const applyCurrentLocation = async () => {
    setLocating(true);
    setOriginError(null);
    try {
      setOrigin(await locateMe());
      setSearchOpen(false);
    } catch (error) {
      setOriginError(
        error instanceof LocationDeniedError
          ? error.message
          : '현재 위치를 잡지 못했어요. 직접 검색으로 정할 수 있어요.',
      );
    } finally {
      setLocating(false);
    }
  };

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
            {/* 돋보기는 친구 검색이 생길 때 배선한다 — 지금은 아직 눌러도 아무 일 없다 */}
            <Search size={s(9)} color={colors.primary} strokeWidth={2.5} />
            <Pressable onPress={() => navigate('Friends')} hitSlop={s(8)}>
              <Plus size={s(10)} color={colors.primary} strokeWidth={3} />
            </Pressable>
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
                      <Text style={styles.mateInitial}>{[...friend.name.trim()][0] ?? '?'}</Text>
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
            <Text style={styles.cardTitle}>내 위치</Text>
            <Pressable
              style={styles.mapChip}
              onPress={() => {
                setSearchOpen((prev) => !prev);
                setResults([]);
                setSearchError(null);
              }}>
              <Text style={styles.mapChipText}>{searchOpen ? '닫기' : '직접 검색'}</Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.gpsRow}
            disabled={locating}
            onPress={() => void applyCurrentLocation()}>
            {locating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Crosshair size={s(9)} color={colors.primary} strokeWidth={2.5} />
            )}
            <Text style={styles.gpsText}>
              {locating ? '현재 위치를 확인하는 중' : '현재 위치로 잡기'}
            </Text>
          </Pressable>

          {originError ? <Text style={styles.searchError}>{originError}</Text> : null}

          {searchOpen ? (
            <>
              <View style={styles.searchBox}>
                <Search size={s(8)} color={colors.textMuted} strokeWidth={2} />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="동네나 건물 이름 검색"
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

              {results.map((found) => (
                <Pressable
                  key={found.id}
                  style={[styles.placeRow, styles.placeRowIdle]}
                  onPress={() => {
                    setOrigin(toMyLocation(found));
                    setResults([]);
                    setQuery('');
                    setSearchOpen(false);
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
            </>
          ) : null}

          {origin && !searchOpen ? (
            <View style={styles.placeRow}>
              <View style={styles.placeIcon}>
                <MapPin size={s(10)} color={colors.primary} strokeWidth={2.5} />
              </View>
              <View style={styles.placeBody}>
                <Text style={styles.placeName} numberOfLines={1}>
                  {origin.name}
                </Text>
                <Text style={styles.placeMeta} numberOfLines={1}>
                  {origin.address || (origin.fromGps ? 'GPS 로 잡은 위치' : '')}
                </Text>
              </View>
            </View>
          ) : null}

          <Text style={styles.note}>
            {origin
              ? '식당은 다음 단계에서 메이트들의 중간 지점으로 추천해 드려요'
              : '출발할 곳을 잡아 주세요. 중간 지점 계산에만 쓰고 저장하지 않아요'}
          </Text>
        </View>

        <CompleteButton
          label="다음"
          showNext
          disabled={!origin}
          style={styles.cta}
          onPress={() =>
            navigate('ScheduleTime', {
              name: name.trim(),
              invitees: picked,
              origin: origin ?? undefined,
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
  gpsRow: {
    marginTop: s(8),
    height: s(20),
    borderRadius: s(999),
    borderWidth: s(0.8),
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(5),
  },
  gpsText: {
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    fontWeight: weight.bold,
    color: colors.primary,
  },
  /* 고르지 않은 추천은 테두리를 죽여서, 지금 잡힌 한 곳이 드러나게 한다 */
  placeRowIdle: {
    borderColor: colors.border,
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
