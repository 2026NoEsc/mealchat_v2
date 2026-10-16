import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions } from 'react-native';

import { s, v3Layout } from '../../theme/scale';
import { v3Colors as colors, v3Radii } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { authStyles } from './AuthLayout';
import BottomSheet from './BottomSheet';
import TextField from './TextField';

/** Display names only; existing profile contract stores the selected string. */
export const BANKS = [
  '국민은행', '기업은행', '농협', '신한은행', '우리은행', '하나은행', 'SC제일은행', '한국씨티은행',
  '산업은행', '수협은행', '부산은행', '경남은행', '광주은행', '전북은행', '제주은행', '아이엠뱅크',
  '우체국', '새마을금고', '신협', '저축은행', '카카오뱅크', '케이뱅크', '토스뱅크',
  '미래에셋증권', '삼성증권', '한국투자증권', 'NH투자증권', 'KB증권', '키움증권',
  '신한투자증권', '하나증권', '대신증권', '메리츠증권', '유안타증권', '토스증권',
  '카카오페이증권', '네이버페이', '카카오페이', '토스페이',
];

type Props = { value: string | null; onChange: (bank: string) => void; height?: number; logicalHeight?: number; fontSize?: number };

export default function BankSelect({ value, onChange, height = 19, logicalHeight, fontSize = 16 }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const window = useWindowDimensions();
  const normalized = query.replace(/\s/g, '').toLowerCase();
  const options = BANKS.filter((bank) => bank.replace(/\s/g, '').toLowerCase().includes(normalized));
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`은행 선택${value ? `, ${value}` : ''}`}
      accessibilityState={{ expanded: open }} onPress={() => { setQuery(''); setOpen(true); }}
      style={({ pressed }) => [styles.trigger, { height: Math.max(v3Layout.minTouchTarget, logicalHeight ?? s(height)) }, pressed && authStyles.pressed]}>
      <Text numberOfLines={1} style={[styles.triggerText, { fontSize }, !value && styles.placeholder]}>{value ?? '은행'}</Text>
      <ChevronDown size={18} color={colors.sub} aria-hidden={true} />
    </Pressable>
    {open ? <BottomSheet visible title="은행·증권사 선택" onClose={() => setOpen(false)}>
      <TextField label="은행·증권사 검색" value={query} onChangeText={setQuery} placeholder="이름으로 검색해 주세요" autoFocus />
      <ScrollView style={{ maxHeight: window.height / 2 }} keyboardShouldPersistTaps="handled">
        {options.length === 0 ? <Text style={authStyles.subtitle}>검색 결과가 없어요.</Text> : null}
        {options.map((bank) => <Pressable key={bank} accessibilityRole="button" accessibilityLabel={bank}
          accessibilityState={{ selected: bank === value }} onPress={() => { onChange(bank); setOpen(false); }}
          style={({ pressed }) => [styles.option, bank === value && styles.selected, pressed && authStyles.pressed]}>
          <Text style={[styles.optionText, bank === value && styles.selectedText]}>{bank}</Text>
        </Pressable>)}
      </ScrollView>
    </BottomSheet> : null}
  </>;
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderRadius: v3Radii.field, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14 },
  triggerText: { flexShrink: 1, fontFamily: fontFamily.body, color: colors.ink },
  placeholder: { color: colors.sub },
  option: { minHeight: v3Layout.rowHeight, paddingHorizontal: 14, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  optionText: { fontFamily: fontFamily.body, fontSize: 16, lineHeight: 24, color: colors.ink },
  selected: { backgroundColor: colors.selectedBg },
  selectedText: { fontFamily: fontFamily.bold, color: colors.selectedText },
});
