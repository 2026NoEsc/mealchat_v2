import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SignupHeader from '../../components/SignupHeader';
import BankSelect from '../../components/ui/BankSelect';
import { AccentButton } from '../../components/ui/Button';
import TextField, { fieldStyles } from '../../components/ui/TextField';
import { useSignupDraft } from '../../auth/SignupDraftProvider';
import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

/**
 * Figma 회원가입/개인정보 입력 (150:121) — 220 x 486
 * 닉네임 y115·입력 y126 / 이메일 y156·y167 / 비밀번호 y198·y209 /
 * 재확인 y240·y251 / 계좌번호 y283·행 y294 h19 / 생년월일 y322·행 y339 h23 / 버튼 y423
 */
export default function SignupPersonalScreen() {
  const { navigate, goBack } = useNavigation();
  const insets = useSafeAreaInsets();
  const { draft, updateDraft } = useSignupDraft();

  const continueSignup = () => {
    if (!draft.nickname.trim() || !draft.email.trim() || !draft.password) {
      Alert.alert('입력 확인', '닉네임, 이메일, 비밀번호를 입력해 주세요.');
      return;
    }

    if (draft.password !== draft.passwordConfirm) {
      Alert.alert('입력 확인', '비밀번호가 서로 다릅니다.');
      return;
    }

    navigate('SignupCalendar');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <SignupHeader title="개인정보 입력" step={1} stepLabel="개인정보 입력" onBack={goBack} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <TextField
            label="닉네임"
            value={draft.nickname}
            onChangeText={(nickname) => updateDraft({ nickname })}
            containerStyle={styles.firstField}
          />
          <TextField
            label="이메일"
            value={draft.email}
            onChangeText={(email) => updateDraft({ email })}
            keyboardType="email-address"
            autoCapitalize="none"
            containerStyle={styles.field}
          />
          <TextField
            label="비밀번호"
            value={draft.password}
            onChangeText={(password) => updateDraft({ password })}
            secureTextEntry
            containerStyle={styles.field}
          />
          <TextField
            label="비밀번호 재확인"
            value={draft.passwordConfirm}
            onChangeText={(passwordConfirm) => updateDraft({ passwordConfirm })}
            secureTextEntry
            containerStyle={styles.field}
          />

          <Text style={[styles.label, styles.accountLabel]}>계좌번호</Text>
          <View style={styles.accountRow}>
            <View style={styles.bankChip}>
              <BankSelect value={draft.bank} onChange={(bank) => updateDraft({ bank })} />
            </View>
            <TextInput
              style={styles.accountInput}
              value={draft.account}
              onChangeText={(account) => updateDraft({ account })}
              keyboardType="number-pad"
            />
          </View>

          <Text style={[styles.label, styles.birthLabel]}>생년월일</Text>
          <View style={styles.birthRow}>
            <BirthBox
              value={draft.birth.year}
              unit="년"
              onChange={(year) => updateDraft({ birth: { ...draft.birth, year } })}
            />
            <BirthBox
              value={draft.birth.month}
              unit="월"
              onChange={(month) => updateDraft({ birth: { ...draft.birth, month } })}
            />
            <BirthBox
              value={draft.birth.day}
              unit="일"
              onChange={(day) => updateDraft({ birth: { ...draft.birth, day } })}
            />
          </View>

          <AccentButton
            label="다음"
            showNext
            style={styles.cta}
            onPress={continueSignup}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
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
    backgroundColor: colors.surface,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: s(18),
    paddingBottom: s(30),
  },
  firstField: {
    // STEP 라벨 하단(y97) → 닉네임 라벨(y115)
    marginTop: s(18),
  },
  field: {
    // 입력창 하단 → 다음 라벨까지 7~8
    marginTop: s(8),
  },
  label: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(10),
    color: colors.textMuted,
  },
  accountLabel: {
    marginTop: s(9),
  },
  accountRow: {
    marginTop: s(1),
    flexDirection: 'row',
    gap: s(3),
  },
  bankChip: {
    width: s(51),
  },
  bankText: {
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  accountInput: {
    flex: 1,
    minWidth: 0,
    height: s(19),
    borderRadius: s(8),
    backgroundColor: colors.card,
    paddingHorizontal: s(8),
    paddingVertical: 0,
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    color: colors.textPrimary,
  },
  birthLabel: {
    // 계좌 행 하단(y313) → 생년월일 라벨(y322)
    marginTop: s(9),
  },
  birthRow: {
    // 라벨 하단(y332) → 행(y339)
    marginTop: s(7),
    flexDirection: 'row',
    gap: s(9.5),
  },
  birthBox: {
    ...fieldStyles.box,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  birthValue: {
    flex: 1,
    // 웹에서 input 의 기본 min-width 때문에 축소되지 않아 명시한다
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
    // y423, 생년월일 행 하단(y362) 에서 61
    marginTop: s(61),
    marginHorizontal: s(-6),
  },
});
