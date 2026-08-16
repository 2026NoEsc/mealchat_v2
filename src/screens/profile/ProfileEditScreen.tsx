import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppHeader from '../../components/AppHeader';
import BankSelect from '../../components/ui/BankSelect';
import { CompleteButton } from '../../components/ui/Button';
import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

const logo = require('../../../assets/brand/logo-main.png');

/**
 * Figma 프로필/프로필 수정 (309:1086) — 220 x 486
 * 카드 x12 y83 196×330 / 로고 x90 y92 40×40 / 타이틀 y134 /
 * 닉네임 y160·입력 y171 h23 / 이메일 y201·y212 / 비밀번호 y243·y254 /
 * 재확인 y285·y296 / 계좌번호 y328·행 y339 h19 / 생년월일 y368·행 y380 h23
 */
export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const { resetTo } = useNavigation();

  const [nickname, setNickname] = useState('나야나');
  const [email, setEmail] = useState('nayana@gmail.com');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [bank, setBank] = useState<string | null>(null);
  const [account, setAccount] = useState('');
  const [birth, setBirth] = useState({ year: '2002', month: '12', day: '20' });

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />
      <AppHeader />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Image source={logo} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>프로필 수정</Text>

            <Field label="닉네임" value={nickname} onChangeText={setNickname} />
            <Field
              label="이메일"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              label="비밀번호 변경"
              value={password}
              onChangeText={setPassword}
              placeholder="새 비밀번호"
              secureTextEntry
            />
            <Field
              label="비밀번호 재확인"
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              placeholder="새 비밀번호 확인"
              secureTextEntry
            />

            <Text style={styles.label}>계좌번호</Text>
            <View style={styles.accountRow}>
              <View style={styles.bankSlot}>
                <BankSelect value={bank} onChange={setBank} height={24} />
              </View>
              <TextInput
                style={styles.accountInput}
                value={account}
                onChangeText={setAccount}
                placeholder="계좌번호 입력"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
              />
            </View>

            <Text style={styles.label}>생년월일</Text>
            <View style={styles.birthRow}>
              <BirthBox
                value={birth.year}
                unit="년"
                onChange={(v) => setBirth((p) => ({ ...p, year: v }))}
              />
              <BirthBox
                value={birth.month}
                unit="월"
                onChange={(v) => setBirth((p) => ({ ...p, month: v }))}
              />
              <BirthBox
                value={birth.day}
                unit="일"
                onChange={(v) => setBirth((p) => ({ ...p, day: v }))}
              />
            </View>
          </View>

          <CompleteButton
            label="저장하기"
            style={styles.cta}
            onPress={() => resetTo('Profile')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  label,
  ...rest
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={colors.textMuted} {...rest} />
    </>
  );
}

function BirthBox({
  value,
  unit,
  onChange,
}: {
  value: string;
  unit: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.birthBox}>
      <TextInput
        style={styles.birthValue}
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
      />
      <Text style={styles.birthUnit}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceSunken,
  },
  flex: {
    flex: 1,
  },
  body: {
    // 카드 x12 w196
    paddingHorizontal: s(12),
    paddingTop: s(11),
    paddingBottom: s(20),
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: s(10),
    paddingHorizontal: s(6),
    paddingTop: s(9),
    paddingBottom: s(12),
  },
  logo: {
    // x90 y92 40×40 — 카드 기준 중앙
    alignSelf: 'center',
    width: s(40),
    height: s(40),
  },
  title: {
    // y134
    marginTop: s(2),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(11),
    lineHeight: fs(15),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  label: {
    // 첫 라벨 y160, 이후 입력창 하단에서 7
    marginTop: s(7),
    marginBottom: s(1),
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(10),
    color: colors.textMuted,
  },
  input: {
    height: s(23),
    borderRadius: s(9),
    backgroundColor: colors.card,
    paddingHorizontal: s(8),
    paddingVertical: 0,
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  accountRow: {
    flexDirection: 'row',
    gap: s(4),
  },
  bankSlot: {
    width: s(55),
  },
  accountInput: {
    flex: 1,
    minWidth: 0,
    height: s(24),
    borderRadius: s(9),
    backgroundColor: colors.card,
    paddingHorizontal: s(8),
    paddingVertical: 0,
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    color: colors.textPrimary,
  },
  birthRow: {
    flexDirection: 'row',
    gap: s(9),
  },
  birthBox: {
    flex: 1,
    height: s(23),
    borderRadius: s(9),
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(8),
    overflow: 'hidden',
  },
  birthValue: {
    flex: 1,
    minWidth: 0,
    fontFamily: fontFamily.body,
    fontSize: fs(9),
    fontWeight: weight.bold,
    color: colors.textPrimary,
    padding: 0,
  },
  birthUnit: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    color: colors.textMuted,
  },
  cta: {
    marginTop: s(10),
  },
});
