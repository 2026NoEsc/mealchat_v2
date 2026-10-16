import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { v3Layout } from '../../theme/scale';
import { Checkbox } from './Checkbox';

export type TermKey = 'service' | 'privacy' | 'marketing';
export type TermChoices = Record<TermKey, boolean>;

/** 520:1285 / 558:1712. Agreement state is owned by the existing screens. */
export default function TermsCard({ agreed, onChange, disabled = false, reconsent = false, onView }: {
  agreed: TermChoices; onChange: (next: TermChoices) => void; disabled?: boolean; reconsent?: boolean; onView?: (key: TermKey) => void;
}) {
  const allAgreed = agreed.service && agreed.privacy && agreed.marketing;
  const terms: { key: TermKey; label: string }[] = reconsent ? [
    { key: 'service', label: '[필수] 서비스 이용약관 동의' },
    { key: 'privacy', label: '[필수] 개인정보 수집 · 이용 동의' },
    { key: 'marketing', label: '[선택] 마케팅 정보 수신 동의' },
  ] : [
    { key: 'service', label: '[필수] 서비스 이용약관' },
    { key: 'privacy', label: '[필수] 개인정보 처리방침' },
    { key: 'marketing', label: '[선택] 마케팅 정보 수신' },
  ];
  // TODO(서버 단계): 건강 관련 정보의 별도 선택 동의 항목과 저장 계약을 추가한다.
  return <View style={styles.card}>
    <Checkbox label={reconsent ? '전체 동의하기' : '전체 동의'} checked={allAgreed} disabled={disabled}
      style={styles.allRow} labelStyle={styles.allLabel}
      onChange={(checked) => onChange({ service: checked, privacy: checked, marketing: checked })} />
    <View style={styles.divider} />
    {terms.map((term) => <View key={term.key} style={styles.termRow}>
      <Checkbox label={term.label} checked={agreed[term.key]} disabled={disabled}
        style={styles.term} labelStyle={styles.termLabel} onChange={(checked) => onChange({ ...agreed, [term.key]: checked })} />
      {onView ? <Pressable accessibilityRole="button" accessibilityLabel={`${term.label} 보기`} onPress={() => onView(term.key)}
        style={({ pressed }) => [styles.view, pressed && styles.pressed]}>
        <ChevronRight size={20} color={colors.sub} aria-hidden={true} />
      </Pressable> : null}
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingVertical: 8, paddingLeft: 16, paddingRight: 8 },
  allRow: { paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  allLabel: { flex: 1, fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 24, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.border },
  termRow: { flexDirection: 'row', alignItems: 'center' },
  term: { flex: 1, minWidth: 0, minHeight: 48 },
  view: { width: v3Layout.minTouchTarget, height: v3Layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
  termLabel: { fontSize: 15 },
});
