import { StyleSheet, Text, View } from 'react-native';
import BottomSheet from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

type StatusConfirmationProps = {
  kind: 'finish' | 'undo' | 'requester-undo' | null; busy: boolean; error: string | null; onClose: () => void; onConfirm: () => void;
};
export function SettlementStatusConfirmationContent({ kind, busy, error, onClose, onConfirm }: StatusConfirmationProps) {
  return <>
    <Text style={styles.note}>{kind === 'finish' ? '모두 완료하면 되돌릴 수 없고 계좌 공개가 끝나요. 마지막 메이트가 보냈는지 확인해 주세요.' : kind === 'requester-undo' ? '선택한 메이트를 다시 대기 상태로 표시해요.' : '대기로 바꾸면 아직 보내지 않은 상태로 보여요. 실제 송금은 취소되지 않아요.'}</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <View style={styles.buttons}><Button variant="secondary" label="그대로 둘게요" disabled={busy} onPress={onClose} style={styles.button} /><Button label={kind === 'finish' ? '모두 완료로 표시' : '대기로 바꾸기'} loading={busy} onPress={onConfirm} style={styles.button} /></View>
  </>;
}
export default function SettlementStatusConfirmationSheet(props: StatusConfirmationProps) {
  const { kind, busy, onClose } = props;
  return <BottomSheet visible={kind !== null} title={kind === 'finish' ? '모두 완료로 표시할까요?' : kind === 'requester-undo' ? '완료 표시를 취소할까요?' : '송금 완료 표시를 되돌릴까요?'} onClose={() => { if (!busy) onClose(); }}>
    <SettlementStatusConfirmationContent {...props} />
  </BottomSheet>;
}
const styles = StyleSheet.create({
  note: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 21, color: colors.sub },
  error: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 21, color: v3FeedbackColors.error },
  buttons: { flexDirection: 'row', gap: 8 }, button: { flex: 1 },
});
