import { Send } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import BottomSheet from './BottomSheet';
import { Button } from './Button';
import { formatAmount } from '../../lib/format';
import { s4008Message } from '../../lib/roomSettlementPolicy';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

export function settlementUiError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  const message = error && typeof error === 'object' && 'message' in error ? error.message : undefined;
  if (code === '42501' && message === 'SETTLEMENT_LOCKED_AFTER_PAYMENT') return '이미 송금 완료한 메이트가 있어 금액과 계좌를 바꿀 수 없어요. 기존 정산 내용을 확인해 주세요.';
  if (code === 'S4008' || code === 'SETTLEMENT_REQUIRES_CONFIRMATION') return s4008Message(error, 'settlement');
  if (code === '22P02' || code === '22023') return '입력 내용을 확인하고 다시 시도해 주세요.';
  if (code === 'S1005' || code === 'SETTLEMENT_DISCLOSURE_CLOSED') return '끝난 정산은 되돌릴 수 없어요. 새 정산을 요청해 주세요.';
  if (code === 'S1001') return '현재 약관에 동의한 뒤 다시 이용해 주세요.';
  if (code === 'P0002') return '이 정산의 계좌를 볼 수 없어요.';
  return code === '42501' ? '정산 내용은 만든 사람만 수정할 수 있어요.' : '정산을 변경하지 못했어요. 잠시 후 다시 시도해 주세요.';
}
type ConfirmationProps = {
  recipient: string | null; amount: number; busy: boolean; error?: string | null; onClose: () => void; onConfirm: () => void;
};
/** Phone 563:1936. The chat sheet reuses this content inside its existing modal. */
export function TransferConfirmationContent({ recipient, amount, busy, error, onClose, onConfirm }: ConfirmationProps) {
  return <>
    <View style={styles.icon}><Send size={26} color={colors.selectedText} /></View>
    <Text accessibilityRole="header" style={styles.title}>{recipient ? recipient + '에게 ' : ''}{formatAmount(amount)} 보냈나요?</Text>
    {/* [결정] 직접 누른 '송금했어요'에서도 열리므로 외부 송금 앱 복귀를 추정하지 않는다. */}
    <Text style={styles.note}>보냈다면 완료로 표시할게요.{recipient ? '\n' + recipient + '도 받은 걸 확인할 수 있어요.' : ''}</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <View style={styles.buttons}><Button variant="secondary" label="아직이요" style={styles.button} disabled={busy} onPress={onClose} /><Button label="보냈어요" style={styles.button} loading={busy} onPress={onConfirm} /></View>
  </>;
}
/** Only confirms the user's existing completion mutation. */
export default function TransferConfirmationSheet({ visible, ...props }: ConfirmationProps & { visible: boolean }) {
  return <BottomSheet visible={visible} title="" onClose={() => { if (!props.busy) props.onClose(); }}>
    <TransferConfirmationContent {...props} />
  </BottomSheet>;
}
const styles = StyleSheet.create({
  icon: { width: 56, height: 56, borderRadius: 28, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.selectedBg },
  title: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 29, color: colors.ink, textAlign: 'center' },
  note: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, color: colors.sub, textAlign: 'center' },
  error: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, color: v3FeedbackColors.error, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 8 }, button: { flex: 1 },
});
