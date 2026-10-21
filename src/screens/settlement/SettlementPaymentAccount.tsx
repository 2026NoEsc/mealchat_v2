import { Copy } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { copyToClipboard } from '../../components/ui/CopyButton';
import { notify } from '../../lib/confirm';
import { formatAmount } from '../../lib/format';
import { tossTransferUrl } from '../../lib/tossLink';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { useSettlementPayment, type SettlementPaymentController } from './useSettlementPayment';

export function SettlementPaymentAccountView({ payment, amount, canSend, recipient, disabled = false, completed = false, presentation, onTransferOpened }: {
  payment: SettlementPaymentController; amount: number; canSend: boolean; recipient?: string; disabled?: boolean; completed?: boolean;
  presentation?: 'detail'; onTransferOpened?: () => void;
}) {
  const [busy, setBusy] = useState(false), [feedback, setFeedback] = useState('');
  const locked = useRef(false), mounted = useRef(true);
  const allowed = useRef(!disabled && !completed); allowed.current = !disabled && !completed;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setFeedback(''); }, [payment.contextKey]);
  const act = async (kind: 'copy' | 'send') => {
    if (locked.current || disabled || completed) return;
    locked.current = true; setBusy(true); setFeedback('');
    try {
      // Recheck immediately before giving an account to clipboard/external apps.
      const fresh = await payment.refresh();
      if (!mounted.current || !allowed.current || fresh?.status !== 'open' || !fresh.details) return;
      if (kind === 'copy') {
        await copyToClipboard(`${fresh.details.bankName} ${fresh.details.accountNumber}`);
        if (mounted.current) setFeedback('계좌를 복사했어요');
      } else {
        const url = tossTransferUrl({ bankName: fresh.details.bankName, accountNumber: fresh.details.accountNumber, amount });
        if (!url) { notify('토스로 열 수 없어요', '표시된 계좌를 확인하고 직접 보내 주세요.'); return; }
        await Linking.openURL(url);
        // An opened bank app only opens a question; completion still requires explicit confirmation.
        if (mounted.current && allowed.current) onTransferOpened?.();
      }
    } catch { if (mounted.current) setFeedback(kind === 'copy' ? '복사하지 못했어요. 다시 시도해 주세요.' : '토스를 열지 못했어요. 다시 시도해 주세요.'); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  };
  const details = !completed && payment.status === 'ready' && payment.data?.status === 'open' ? payment.data.details : null;
  if (completed || payment.data?.status === 'completed') return <Text accessibilityLiveRegion="polite" style={styles.note}>정산 계좌 공개가 끝났어요. 계좌를 보거나 송금·복사할 수 없어요.</Text>;
  if (payment.status === 'error') return <View style={styles.group}><Text accessibilityLiveRegion="polite" style={styles.note}>계좌를 확인하지 못했어요. 다시 확인해 주세요.</Text><Button variant="text" label="정산 계좌 다시 확인" onPress={payment.reload} /></View>;
  if (payment.data?.status === 'unavailable') return <Text accessibilityLiveRegion="polite" style={styles.note}>공개된 정산 계좌가 없어요. 정산을 만든 메이트에게 확인해 주세요.</Text>;
  if (!details) return <Text accessibilityLiveRegion="polite" style={styles.note}>정산 계좌를 확인하고 있어요</Text>;
  return <View style={styles.group}>
    <View style={[styles.accountBox, presentation === 'detail' && styles.detailAccount]}><View style={styles.grow}><Text style={styles.note}>{['보낼 곳', recipient, details.accountHolder ? `예금주 ${details.accountHolder}` : null].filter(Boolean).join(' · ')}</Text><Text style={styles.account}>{details.bankName} {details.accountNumber}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="계좌 복사" accessibilityState={{ disabled: disabled || busy }} disabled={disabled || busy} onPress={() => void act('copy')} style={styles.copy}><Copy size={20} color={colors.ink} aria-hidden={true} /></Pressable>
    </View>
    {canSend ? <Button label={presentation === 'detail' ? `토스로 ${formatAmount(amount)} 보내기` : '토스로 보내기'} disabled={disabled || busy} onPress={() => void act('send')} /> : null}
    {feedback ? <Text accessibilityLiveRegion="polite" style={styles.note}>{feedback}</Text> : null}
  </View>;
}
export default function SettlementPaymentAccount({ billId, amount, canSend, recipient, disabled, completed, presentation, onTransferOpened }: {
  billId: string; amount: number; canSend: boolean; recipient?: string; disabled?: boolean; completed?: boolean;
  presentation?: 'detail'; onTransferOpened?: () => void;
}) {
  const payment = useSettlementPayment(billId, !completed);
  return <SettlementPaymentAccountView payment={payment} amount={amount} canSend={canSend} recipient={recipient} disabled={disabled} completed={completed} presentation={presentation} onTransferOpened={onTransferOpened} />;
}
const styles = StyleSheet.create({
  group: { gap: 12 }, grow: { flex: 1, minWidth: 0 },
  note: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 20, color: colors.sub },
  accountBox: { backgroundColor: colors.mutedBg, paddingLeft: 14, paddingRight: 8, paddingVertical: 10, borderRadius: 12, gap: 10, flexDirection: 'row', alignItems: 'center' },
  account: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22, color: colors.ink },
  detailAccount: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  copy: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
