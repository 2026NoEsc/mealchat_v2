import { ImageSourcePropType, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

export type Sticker = { id: string; source: ImageSourcePropType };

/** Figma 채팅/이모티콘 (555:416) — 4열 × 2행 */
export const STICKERS: Sticker[] = [
  { id: 'dudu-love', source: require('../../../assets/stickers/dudu-love.png') },
  { id: 'moa-sleep', source: require('../../../assets/stickers/moa-sleep.png') },
  { id: 'ttori-receipt', source: require('../../../assets/stickers/ttori-receipt.png') },
  { id: 'welling-eat', source: require('../../../assets/stickers/welling-eat.png') },
  { id: 'dudu-shock', source: require('../../../assets/stickers/dudu-shock.png') },
  { id: 'moa-busy', source: require('../../../assets/stickers/moa-busy.png') },
  { id: 'ttori-angry', source: require('../../../assets/stickers/ttori-angry.png') },
  { id: 'welling-full', source: require('../../../assets/stickers/welling-full.png') },
];

/**
 * Figma 채팅/이모티콘 (555:416) — 220 x 136
 * 헤더 x10 y9 / 그리드 x10 y26 w200, 칸 h46 radius 8, 스티커 34×34, 간격 7
 * 입력바 위에 붙는 패널이라 화면 하단에 그대로 얹는다.
 */
export default function EmoticonPanel({ onPick }: { onPick: (sticker: Sticker) => void }) {
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>이모티콘</Text>
        <Text style={styles.more}>전체 보기 →</Text>
      </View>

      <View style={styles.grid}>
        {STICKERS.map((sticker) => (
          <Pressable key={sticker.id} style={styles.cell} onPress={() => onPick(sticker)}>
            <Image source={sticker.source} style={styles.sticker} resizeMode="contain" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    height: s(136),
    backgroundColor: colors.card,
    paddingHorizontal: s(10),
    paddingTop: s(9),
    borderTopWidth: s(0.6),
    borderTopColor: colors.border,
  },
  header: {
    height: s(10),
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(7.5),
    lineHeight: fs(10),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  more: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    fontWeight: weight.semibold,
    color: colors.primary,
  },
  grid: {
    // 헤더 하단(y19) → 그리드(y26)
    marginTop: s(7),
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(7),
  },
  cell: {
    // 4열: (200 - 7*3) / 4 = 44.75
    width: s(44.75),
    height: s(46),
    borderRadius: s(8),
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sticker: {
    width: s(34),
    height: s(34),
  },
});
