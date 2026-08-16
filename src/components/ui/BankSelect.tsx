import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

/** Figma 은행 선택 드롭다운 (549:3366) — 항목 8개 */
export const BANKS = [
  '국민은행',
  '기업은행',
  '농협',
  '네이버페이',
  '부산은행',
  '우리은행',
  '카카오페이',
  '토스페이',
];

type Props = {
  value: string | null;
  onChange: (bank: string) => void;
  /** 회원가입은 h19, 프로필 수정은 h24 로 쓰인다 */
  height?: number;
};

/**
 * 회원가입 개인정보 입력(150:121)과 프로필 수정(309:1086)이 공유하는 은행 선택.
 * Figma 는 인라인 드롭다운이지만, 목록이 잘리지 않도록 모달로 띄운다.
 */
export default function BankSelect({ value, onChange, height = 19 }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        style={[styles.trigger, { height: s(height) }]}
        onPress={() => setOpen(true)}>
        <Text style={[styles.triggerText, !value && styles.placeholder]} numberOfLines={1}>
          {value ?? '은행 선택'}
        </Text>
        <ChevronDown size={s(7)} color={colors.textMuted} strokeWidth={2.5} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>은행 선택</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {BANKS.map((bank, i) => (
                <Pressable
                  key={bank}
                  style={[styles.option, i > 0 && styles.optionDivided]}
                  onPress={() => {
                    onChange(bank);
                    setOpen(false);
                  }}>
                  <Text style={[styles.optionText, bank === value && styles.optionSelected]}>
                    {bank}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // "카카오페이" 처럼 5글자 은행명이 잘리지 않도록 여백을 최소로 잡는다
    gap: s(2),
    borderRadius: s(8),
    backgroundColor: colors.card,
    paddingHorizontal: s(4),
  },
  triggerText: {
    flexShrink: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  placeholder: {
    fontWeight: weight.regular,
    color: '#5F5E5B',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    width: s(120),
    maxHeight: s(200),
    borderRadius: s(5),
    backgroundColor: colors.card,
    paddingHorizontal: s(10),
    paddingVertical: s(8),
    shadowColor: '#A9A9A9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: s(4),
    elevation: 4,
  },
  sheetTitle: {
    marginBottom: s(4),
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  option: {
    height: s(18),
    justifyContent: 'center',
  },
  optionDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  optionText: {
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: '#999999',
  },
  optionSelected: {
    fontWeight: weight.bold,
    color: colors.primary,
  },
});
