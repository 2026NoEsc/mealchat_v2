import { Utensils } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { Button } from './Button';

/** Figma 540:1895. Render inside VotingSheet's existing Modal, never a sibling Modal. */
export default function PlanConfirmation({ restaurant, when, memberCount, busy, error, retry, onCancel, onConfirm }: {
  restaurant: string; when: string; memberCount: number; busy: boolean; error: string | null; retry: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return <ScrollView contentContainerStyle={styles.overlay} keyboardShouldPersistTaps="handled">
    <View style={styles.scrim} />
    <View style={styles.dialog} accessibilityViewIsModal aria-modal onAccessibilityEscape={() => { if (!busy) onCancel(); }}>
      {/* TODO(서버 단계): 실제 식당 사진/독립 메뉴 값이 없다. Figma의 예시 고기 사진·삼겹살을 선택 결과로 꾸미지 않는다. */}
      <View style={styles.photo} accessible accessibilityLabel="식당 사진 없음"><Utensils size={32} color={colors.sub} /></View>
      <Text style={styles.title} accessibilityRole="header">{restaurant + '으로'}{"\n"}약속을 확정할까요?</Text>
      <View style={styles.summary}><Text style={styles.value}>{when}</Text><Text style={styles.value}>{memberCount}명</Text></View>
      {/* [결정] 알림 전송 보장을 추측하지 않고 확인되는 정산 진입만 안내한다. */}
      <Text style={styles.note}>확정하면 정산을 시작할 수 있어요.</Text>
      {error ? <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text> : null}
      <View style={styles.buttons}><Button label="다시 볼게요" variant="secondary" disabled={busy} onPress={onCancel} style={styles.button} />
        <Button label={retry ? '다시 확정하기' : '확정하기'} loading={busy} onPress={onConfirm} style={styles.button} /></View>
    </View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  overlay: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.ink, opacity: 0.5 },
  dialog: { width: 340, maxWidth: '100%', borderRadius: 20, backgroundColor: colors.surface, paddingTop: 24, paddingHorizontal: 20, paddingBottom: 20, alignItems: 'center', gap: 14 },
  photo: { width: 72, height: 72, borderRadius: 16, backgroundColor: colors.mutedBg, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.bold, fontSize: 19, lineHeight: 28, color: colors.ink, textAlign: 'center' },
  summary: { alignSelf: 'stretch', paddingHorizontal: 14, paddingVertical: 12, gap: 4, borderRadius: 12, backgroundColor: colors.mutedBg },
  value: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: colors.ink },
  note: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.sub, textAlign: 'center' },
  error: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: v3FeedbackColors.error, textAlign: 'center' },
  buttons: { alignSelf: 'stretch', flexDirection: 'row', gap: 8 },
  button: { flex: 1, paddingHorizontal: 8 },
});
