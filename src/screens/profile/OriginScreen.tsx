import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppHeader from '../../components/AppHeader';
import { CompleteButton } from '../../components/ui/Button';
import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

type Place = { address: string; detail: string };

/** 검색어에 따라 보여줄 후보 — 실제 지오코딩 대신 쓰는 목업 데이터 */
const PLACES: Place[] = [
  { address: '부산 사하구 낙동대로550번길 37', detail: '동아대학교 승학캠퍼스 근처' },
  { address: '부산 사하구 하단동 1234-5', detail: '하단역 2번 출구' },
  { address: '부산 서구 구덕로 225', detail: '동아대학교 부민캠퍼스' },
];

/**
 * Figma 프로필/지도 위치 지정 (256:2333) — 220 x 486
 * body x11.5 y82 w197 / 검색창 y118 h26 / 지도 y154 h186 / 선택 카드 y347 h51 /
 * 저장 버튼 y405 h28
 *
 * ⚠️ Figma 의 지도 영역은 회색 격자 플레이스홀더다. 실제 지도 SDK 는 아직 미정이라
 * 원본 그대로 격자로 두고, 핀을 눌러 후보 위치를 바꾸도록 했다.
 */
export default function OriginScreen() {
  const insets = useSafeAreaInsets();
  const { resetTo } = useNavigation();

  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(0);

  const place = PLACES[picked];

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />
      <AppHeader />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
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
          />
        </View>

        {/* Figma 원본과 동일한 격자 플레이스홀더 */}
        <View style={styles.map}>
          <View style={[styles.gridLine, styles.gridV]} />
          <View style={[styles.gridLine, styles.gridH]} />

          <Pressable
            style={styles.pin}
            onPress={() => setPicked((p) => (p + 1) % PLACES.length)}>
            <Text style={styles.pinIcon}>📍</Text>
            <View style={styles.pinPill}>
              <Text style={styles.pinText}>여기로 지정</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>선택한 위치</Text>
          <Text style={styles.cardAddress}>{place.address}</Text>
          <Text style={styles.cardDetail}>{place.detail}</Text>
        </View>

        <CompleteButton
          label="이 위치로 저장"
          style={styles.cta}
          onPress={() => resetTo('Profile')}
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
    paddingHorizontal: s(11),
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    color: colors.textPrimary,
  },
  map: {
    // y154 h186
    marginTop: s(10),
    height: s(186),
    borderRadius: s(8),
    backgroundColor: '#E8EBE6',
    overflow: 'hidden',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: '#DADDD7',
  },
  gridV: {
    left: '49.5%',
    top: 0,
    bottom: 0,
    width: s(1.5),
  },
  gridH: {
    top: '49.5%',
    left: 0,
    right: 0,
    height: s(1.5),
  },
  pin: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: s(-22),
    marginTop: s(-18.5),
    width: s(44),
    alignItems: 'center',
  },
  pinIcon: {
    fontSize: fs(14),
    lineHeight: fs(20),
  },
  pinPill: {
    marginTop: s(2),
    height: s(15),
    paddingHorizontal: s(6),
    borderRadius: s(8),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(9),
    fontWeight: weight.bold,
    color: colors.textOnAccent,
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
