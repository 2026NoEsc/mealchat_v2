import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { roomDecisionErrorMessage } from '../../lib/roomDecisions';
import type { useRoomDecision } from '../../lib/useRoomDecision';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { Button } from './Button';

/** Capability failures are explicit retry states, never evidence of a legacy backend. */
export default function DecisionFailure({ decision }: { decision: Pick<ReturnType<typeof useRoomDecision>, 'mode' | 'error' | 'reload'> & { loading?: boolean } }) {
  return <View style={styles.stack}>{decision.mode === 'unknown' && decision.loading !== false ? <><ActivityIndicator color={colors.primary} /><Text style={styles.note} accessibilityLiveRegion="polite">서버 기능과 밥약 상태를 확인하고 있어요.</Text></>
    : decision.mode === 'unknown' ? <Text style={styles.note} accessibilityRole="alert">밥약 정보를 확인할 수 없어요. 화면을 닫고 다시 열어 주세요.</Text>
    : <><Text style={styles.error} accessibilityRole="alert">{roomDecisionErrorMessage(decision.error)}</Text><Button label="다시 불러오기" onPress={() => void decision.reload(true)} /></>}</View>;
}
/** Keep the last verified content and drafts visible during a transient refresh failure. */
export function DecisionRefreshError({ decision }: { decision: { error: Error | null; reload: () => unknown } }) {
  return decision.error ? <View style={styles.stack}><Text style={styles.error} accessibilityRole="alert">{roomDecisionErrorMessage(decision.error)}</Text><Button label="상태 다시 확인" variant="secondary" onPress={() => void decision.reload()} /></View> : null;
}
const styles = StyleSheet.create({ stack: { gap: 12 }, note: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 21, color: colors.sub }, error: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 21, color: v3FeedbackColors.error } });
