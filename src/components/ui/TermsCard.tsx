import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { v3Layout } from '../../theme/scale';
import { Checkbox } from './Checkbox';

export type TermKey = 'service' | 'privacy' | 'health' | 'marketing';
export type TermChoices = { service: boolean; privacy: boolean; health?: boolean; marketing: boolean };

/** 520:1285 / 558:1712. Agreement state is owned by the existing screens. */
export default function TermsCard({ agreed, onChange, disabled = false, reconsent = false, includeOptional = !reconsent, includeHealth = true, onView }: {
  agreed: TermChoices; onChange: (next: TermChoices) => void; disabled?: boolean; reconsent?: boolean; includeOptional?: boolean; includeHealth?: boolean; onView?: (key: TermKey) => void;
}) {
  const allAgreed = agreed.service && agreed.privacy && (!includeOptional || ((!includeHealth || agreed.health === true) && agreed.marketing));
  const terms: { key: TermKey; label: string }[] = reconsent ? [
    { key: 'service', label: '[필수] 서비스 이용약관 동의' },
    { key: 'privacy', label: '[필수] 개인정보 수집 · 이용 동의' },
  ] : [
    { key: 'service', label: '[필수] 서비스 이용약관' },
    { key: 'privacy', label: '[필수] 개인정보 처리방침' },
  ];
  if (includeOptional) {
    if (includeHealth) terms.push({ key: 'health', label: '[선택] 건강 관련 정보(알레르기·식단 제한) 수집·이용' });
    terms.push({ key: 'marketing', label: '[선택] 마케팅 정보 수신' });
  }
  return <View style={styles.card}>
    <Checkbox label={reconsent ? '전체 동의하기' : '전체 동의'} checked={allAgreed} disabled={disabled}
      style={styles.allRow} labelStyle={styles.allLabel}
      onChange={(checked) => onChange({ ...agreed, service: checked, privacy: checked, ...(includeOptional ? { ...(includeHealth ? { health: checked } : {}), marketing: checked } : {}) })} />
    <View style={styles.divider} />
    {terms.map((term) => <View key={term.key} style={styles.termRow}>
      <Checkbox label={term.label} checked={agreed[term.key] === true} disabled={disabled}
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
