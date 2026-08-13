import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppHeader from '../../components/AppHeader';
import { CompleteButton } from '../../components/ui/Button';
import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors, shadows } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

type Pick = {
  rank: string;
  when: string;
  score: number;
  attend: string;
  travel: string;
  place: string;
};

const PICKS: Pick[] = [
  {
    rank: '1순위',
    when: '8월 15일 (금) 18:30',
    score: 92,
    attend: '4 / 4명 참석 • ☀ 맑음',
    travel: '평균 이동 18분',
    place: '조선칼국수 하단점',
  },
  {
    rank: '2순위',
    when: '8월 16일 (토) 12:00',
    score: 78,
    attend: '3 / 4명 참석 • ⛅ 흐림',
    travel: '평균 이동 24분',
    place: '버거킹 하단점',
  },
  {
    rank: '3순위',
    when: '8월 21일 (목) 19:00',
    score: 61,
    attend: '3 / 4명 참석 • 🌧 비',
    travel: '평균 이동 31분',
    place: '한솥도시락 하단점',
  },
];

/**
 * Figma 일정 조율/일정 추가/AI 추천 TOP3 (159:491)
 * 카드 x11.5 w197 / y142·226·310 / 확정 버튼 y394
 */
export default function ScheduleRecommendScreen() {
  const insets = useSafeAreaInsets();
  const { navigate, current } = useNavigation();
  const name = (current.params as { name?: string } | undefined)?.name;
  const [selected, setSelected] = useState(0);

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />
      <AppHeader />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>AI 맞춤 추천</Text>
          <Text style={styles.basis}>4명 기준</Text>
        </View>

        {PICKS.map((pick, i) => {
          const on = i === selected;
          return (
            <Pressable
              key={pick.rank}
              style={[styles.card, on && styles.cardOn]}
              onPress={() => setSelected(i)}>
              <View style={styles.cardHead}>
                <View style={[styles.rankChip, on && styles.rankChipOn]}>
                  <Text style={[styles.rankText, on && styles.rankTextOn]}>{pick.rank}</Text>
                </View>
                <Text style={styles.when}>{pick.when}</Text>
                <Text style={[styles.score, on && styles.scoreOn]}>{pick.score}%</Text>
              </View>

              <View style={styles.bar}>
                <View
                  style={[styles.barFill, on && styles.barFillOn, { width: `${pick.score}%` }]}
                />
              </View>

              <Text style={styles.meta}>{pick.attend}</Text>
              <Text style={styles.meta}>{pick.travel}</Text>
              <Text style={styles.place}>{pick.place}</Text>
            </Pressable>
          );
        })}

        <CompleteButton
          label={`${PICKS[selected].rank}로 확정하기`}
          showNext
          style={styles.cta}
          onPress={() => navigate('ScheduleConfirmed', { pick: PICKS[selected], name })}
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
  titleRow: {
    // y103
    marginTop: s(9),
    marginHorizontal: s(11.5),
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(12),
    lineHeight: fs(16),
    fontWeight: weight.extrabold,
    color: colors.textPrimary,
  },
  basis: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  card: {
    // w197, px9 py8, gap4
    marginTop: s(12),
    marginHorizontal: s(11.5),
    borderRadius: s(8),
    backgroundColor: colors.card,
    borderWidth: s(0.6),
    borderColor: colors.border,
    paddingHorizontal: s(9),
    paddingVertical: s(8),
    gap: s(4),
    ...shadows.button,
  },
  cardOn: {
    borderWidth: s(1),
    borderColor: colors.primary,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
  },
  rankChip: {
    paddingHorizontal: s(5),
    paddingVertical: s(2),
    borderRadius: s(4),
    backgroundColor: colors.surfaceSunken,
  },
  rankChipOn: {
    backgroundColor: colors.primary,
  },
  rankText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.3),
    lineHeight: fs(9),
    fontWeight: weight.semibold,
    color: '#696969',
  },
  rankTextOn: {
    color: colors.textOnAccent,
  },
  when: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    lineHeight: fs(11),
    fontWeight: weight.semibold,
    color: colors.textPrimary,
  },
  score: {
    fontFamily: fontFamily.body,
    fontSize: fs(9.5),
    lineHeight: fs(13),
    fontWeight: weight.extrabold,
    color: colors.textMuted,
  },
  scoreOn: {
    color: colors.primary,
  },
  bar: {
    height: s(3),
    borderRadius: s(999),
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  barFill: {
    height: s(3),
    borderRadius: s(999),
    backgroundColor: '#B4B2A8',
  },
  barFillOn: {
    backgroundColor: colors.primary,
  },
  meta: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(8.5),
    color: '#696969',
  },
  place: {
    marginTop: s(3),
    fontFamily: fontFamily.body,
    fontSize: fs(7.2),
    lineHeight: fs(10),
    fontWeight: weight.semibold,
    color: colors.textPrimary,
  },
  cta: {
    // y394
    marginTop: s(16),
    marginHorizontal: s(11.5),
  },
});
