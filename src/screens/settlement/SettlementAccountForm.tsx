import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import BankSelect from '../../components/ui/BankSelect';
import { Button } from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

export type SettlementAccountDraft = { bank: string; account: string; holder: string };
/** Phone 590:1869. Transient form only; no account or holder enters route params. */
export default function SettlementAccountForm({ onClose, onOpenProfile, onDraft }: { onClose: () => void; onOpenProfile: () => void; onDraft?: (draft: SettlementAccountDraft) => void }) {
  const [bank, setBank] = useState<string | null>(null);
  const [account, setAccount] = useState(''), [holder, setHolder] = useState('');
  const [attempted, setAttempted] = useState(false), [prepared, setPrepared] = useState(false);
  const accountValid = /^\d{6,20}$/.test(account);
  const submit = () => { setAttempted(true); if (bank && accountValid && holder.trim()) { setPrepared(true); onDraft?.({ bank, account, holder: holder.trim() }); } };
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
    <Text style={styles.note}>정산을 받을 계좌를 입력해 주세요. 예금주까지 저장하는 기능은 연결 대기 중이에요.</Text>
    <View style={styles.field}><Text style={styles.label}>은행</Text><BankSelect value={bank} onChange={value => { setBank(value); setPrepared(false); }} logicalHeight={52} />
      {attempted && !bank && <Text accessibilityRole="alert" style={styles.error}>은행을 선택해 주세요.</Text>}</View>
    <TextField label="계좌번호" value={account} onChangeText={value => { setAccount(value.replace(/[^0-9]/g, '').slice(0, 20)); setPrepared(false); }} maxLength={20} keyboardType="number-pad" placeholder="숫자만 입력해 주세요"
      error={attempted && !accountValid ? '계좌번호를 6~20자리 숫자로 입력해 주세요.' : undefined} />
    <TextField label="예금주" value={holder} onChangeText={value => { setHolder(value); setPrepared(false); }} maxLength={50} placeholder="예금주 이름" error={attempted && !holder.trim() ? '예금주를 입력해 주세요.' : undefined} />
    {prepared && <Text accessibilityLiveRegion="polite" style={styles.note}>계좌 입력 준비 완료 · 아직 저장되지 않았어요. 이 초안은 실제 정산에 반영되지 않아요.</Text>}
    <Button label="계좌 입력 준비" onPress={submit} />
    <Button variant="secondary" label="기존 프로필에서 계좌 등록" onPress={onOpenProfile} />
    <Button variant="text" label="정산으로 돌아가기" onPress={onClose} />
  </ScrollView>;
}
const styles = StyleSheet.create({
  body: { gap: 16, paddingBottom: 20 }, field: { gap: 6 },
  label: { fontFamily: fontFamily.medium, fontSize: 14, color: colors.ink },
  note: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 21, color: colors.sub },
  error: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: v3FeedbackColors.error },
});
