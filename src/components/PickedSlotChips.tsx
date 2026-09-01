import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { CandidateSlot } from '../screens/schedule/scheduleTypes';
import { fs, s } from '../theme/scale';
import { colors, shadows } from '../theme/tokens';
import { fontFamily, weight } from '../theme/typography';

/**
 * Figma 채팅/일정 패널 (2111:16993) — 선택 요약 카드
 * 카드 w197 radius8 pad 9/8 / 칩 radius5 pad 6/3 / 칩 글자 6.2 semibold
 *
 * 격자만 보면 내가 무엇을 골랐는지 한눈에 안 들어와서, 고른 구간을 문장으로
 * 한 번 더 보여 준다.
 */
export default function PickedSlotChips({ slots }: { slots: CandidateSlot[] }) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>선택한 시간</Text>
        <Text style={styles.count}>{slots.length}개</Text>
      </View>

      {slots.length === 0 ? (
        <Text style={styles.empty}>아직 선택한 시간이 없어요.</Text>
      ) : (
        /*
         * 여러 줄로 쌓으면 고른 개수에 따라 카드 높이가 들쭉날쭉해진다.
         * 한 줄로 두고 넘치는 만큼 옆으로 밀어서 본다.
         */
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipRow}>
          {slots.map((slot) => (
            <View key={slot.id} style={styles.chip}>
              <Text style={styles.chipText}>{slot.label}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: s(8),
    paddingHorizontal: s(9),
    paddingVertical: s(8),
    /*
     * 흰 시트 위의 흰 카드라 경계가 필요하다. 시안은 그림자로 띄웠지만
     * opacity 0.1 짜리 그림자는 웹에서 눈에 잡히지 않아, 테두리를 함께 준다.
     */
    borderWidth: s(0.6),
    borderColor: colors.border,
    ...shadows.button,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(8.5),
    lineHeight: fs(11.5),
    fontWeight: weight.semibold,
    color: colors.textPrimary,
  },
  count: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    fontWeight: weight.semibold,
    color: colors.textMuted,
  },
  empty: {
    marginTop: s(4),
    fontFamily: fontFamily.body,
    fontSize: fs(6.2),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  chipScroll: {
    marginTop: s(4),
    /* 카드 안쪽 여백까지 밀어내서, 넘치는 칩이 카드 끝까지 이어져 보이게 한다 */
    marginHorizontal: -s(9),
  },
  chipRow: {
    paddingHorizontal: s(9),
    gap: s(4),
  },
  chip: {
    paddingHorizontal: s(6),
    paddingVertical: s(3),
    borderRadius: s(5),
    backgroundColor: colors.primarySoft,
  },
  chipText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.2),
    lineHeight: fs(8.5),
    fontWeight: weight.semibold,
    color: colors.primary,
  },
});
