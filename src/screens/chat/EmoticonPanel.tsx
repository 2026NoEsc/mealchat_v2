import { X } from 'lucide-react-native';
import { ImageSourcePropType, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { normalizeStickerId } from '../../lib/emoticon';
import { v3Layout } from '../../theme/scale';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

export type Sticker = { id: string; label: string; source: ImageSourcePropType };

/**
 * Figma 채팅/이모티콘 (555:416) — 4열 × 2행.
 * 패널이 이 목록을 통째로 보여주므로 Figma 의 "전체 보기 →" 는 갈 곳이 없다.
 */
export const STICKERS: Sticker[] = [
  { id: 'dudu-love', label: '두두 하트', source: require('../../../assets/stickers/dudu-love.png') },
  { id: 'moa-sleep', label: '모아 잠', source: require('../../../assets/stickers/moa-sleep.png') },
  { id: 'ttori-receipt', label: '또리 영수증', source: require('../../../assets/stickers/ttori-receipt.png') },
  { id: 'welling-eat', label: '웰링 식사', source: require('../../../assets/stickers/welling-eat.png') },
  { id: 'dudu-shock', label: '두두 놀람', source: require('../../../assets/stickers/dudu-shock.png') },
  { id: 'moa-busy', label: '모아 바쁨', source: require('../../../assets/stickers/moa-busy.png') },
  { id: 'ttori-angry', label: '또리 화남', source: require('../../../assets/stickers/ttori-angry.png') },
  { id: 'welling-full', label: '웰링 배부름', source: require('../../../assets/stickers/welling-full.png') },
];

/**
 * 저장된 이모티콘 이름으로 스티커를 찾는다.
 *
 * 운영 데이터에는 앱에 없는 이름(`welling_thumbs`)도 들어 있다. 예전 클라이언트가
 * 다른 목록을 썼다는 뜻이라, 못 찾는 경우를 정상 경로로 다뤄야 한다.
 */
export function findSticker(id: string): Sticker | null {
  return STICKERS.find((sticker) => sticker.id === normalizeStickerId(id)) ?? null;
}

/**
 * Figma 채팅/이모티콘 (555:416) — 220 x 136
 * 헤더 x10 y9 / 그리드 x10 y26 w200, 칸 h46 radius 8, 스티커 34×34, 간격 7
 * 입력바 위에 붙는 패널이라 화면 하단에 그대로 얹는다.
 */
export default function EmoticonPanel({ onPick, onClose, disabled = false, bottomInset = 0 }: { onPick: (sticker: Sticker) => void; onClose: () => void; disabled?: boolean; bottomInset?: number }) {
  return <View style={[styles.panel, { height: 252 + bottomInset, paddingBottom: 28 + bottomInset }]}>
    <View style={styles.header}><Text style={styles.title}>이모티콘</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="이모티콘 닫기" onPress={onClose} style={styles.close}><X size={20} color={colors.ink} /></Pressable>
    </View>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.grid} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {[STICKERS.slice(0, 4), STICKERS.slice(4)].map((row, rowIndex) => <View key={rowIndex} style={styles.row}>{row.map((sticker) =>
        <Pressable key={sticker.id} accessibilityRole="button" accessibilityLabel={sticker.label + ' 이모티콘 보내기'} accessibilityState={{ disabled }} disabled={disabled}
          style={[styles.cell, disabled && styles.disabled]} onPress={() => onPick(sticker)}>
          <Image source={sticker.source} style={styles.sticker} resizeMode="contain" accessible={false} />
        </Pressable>)}</View>)}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  panel: { height: 252, flexShrink: 0, backgroundColor: colors.surface, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, gap: 12 },
  header: { minHeight: v3Layout.minTouchTarget, flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22, color: colors.ink },
  close: { width: v3Layout.minTouchTarget, height: v3Layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  grid: { gap: 12 },
  row: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, minWidth: v3Layout.minTouchTarget, height: 72, borderRadius: 14, backgroundColor: colors.mutedBg, alignItems: 'center', justifyContent: 'center', padding: 6 },
  disabled: { opacity: 0.4 },
  sticker: { width: 60, height: 60, backgroundColor: colors.surface },
});
