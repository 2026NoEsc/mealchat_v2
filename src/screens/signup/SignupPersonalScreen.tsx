import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { notify } from '../../lib/confirm';
import { checkEmailAvailable, type EmailCheck } from '../../lib/email';
import { isEmailShaped } from '../../lib/emailFormat';
import { confirmProblem, passwordProblem } from '../../lib/password';
import TextField, { fieldStyles } from '../../components/ui/TextField';
import { useSignupDraft } from '../../auth/SignupDraftProvider';
import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

/**
 * Figma 회원가입/개인정보 입력 (150:121) — 220 x 486
 * 닉네임 y115·입력 y126 / 이메일 y156·y167 / 비밀번호 y198·y209 /
 * 재확인 y240·y251 / 계좌번호 y283·행 y294 h19 / 생년월일 y322·행 y339 h23 / 버튼 y423
 */
export default function SignupPersonalScreen() {
  const { navigate, goBack } = useNavigation();
  const insets = useSafeAreaInsets();
  const { draft, updateDraft } = useSignupDraft();

  /*
   * 이메일 중복 확인. 결과는 "확인한 그 이메일" 에만 해당하므로, 글자가 한 자라도
   * 바뀌면 버린다. 안 그러면 다른 주소를 적고도 "사용 가능" 이 남아 있게 된다.
   */
  const [emailCheck, setEmailCheck] = useState<EmailCheck | null>(null);
  const [checkedEmail, setCheckedEmail] = useState('');
  const [checking, setChecking] = useState(false);

  const normalizedEmail = draft.email.trim().toLowerCase();
  const checkFresh = emailCheck !== null && checkedEmail === normalizedEmail;
  const emailOk = checkFresh && emailCheck?.status === 'available';

  const runEmailCheck = async () => {
    if (checking || !normalizedEmail) return;

    setChecking(true);
    const result = await checkEmailAvailable(normalizedEmail);
    setChecking(false);

    setCheckedEmail(normalizedEmail);
    setEmailCheck(result);
  };

  /*
   * 적는 동안 바로 보여 준다. 아직 손도 안 댄 칸에 빨간 글씨를 띄우면 혼내는
   * 것처럼 보이므로, 뭔가 적은 뒤부터 알려 준다.
   */
  const passwordHint = draft.password ? passwordProblem(draft.password) : null;
  const confirmHint = draft.passwordConfirm
    ? confirmProblem(draft.password, draft.passwordConfirm)
    : null;

  const continueSignup = () => {
    if (!draft.nickname.trim() || !draft.email.trim()) {
      notify('입력 확인', '닉네임과 이메일을 입력해 주세요.');
      return;
    }

    /*
     * 실제 가입 요청은 마지막 약관 화면에서 일어난다. 여기서 막지 않으면
     * 캘린더·취향·약관을 다 지나온 뒤에야 비밀번호 때문에 거절당한다.
     */
    if (!isEmailShaped(draft.email)) {
      notify('이메일을 확인해 주세요', '주소 형식이 맞는지 확인해 주세요.');
      return;
    }

    /*
     * 확인을 안 했거나, 확인한 뒤 주소를 고쳤으면 여기서 막는다. 통과시키면
     * 마지막 약관 화면에서야 "이미 가입된 이메일" 로 거절당한다.
     */
    if (!emailOk) {
      notify(
        '이메일 중복 확인이 필요해요',
        checkFresh && emailCheck?.status === 'taken'
          ? '이미 가입된 이메일이에요. 다른 주소를 넣어 주세요.'
          : '이메일 칸 옆 "중복 확인" 을 눌러 주세요.',
      );
      return;
    }

    const badPassword = passwordProblem(draft.password);
    if (badPassword) {
      notify('비밀번호를 확인해 주세요', badPassword);
      return;
    }

    const badConfirm = confirmProblem(draft.password, draft.passwordConfirm);
    if (badConfirm) {
      notify('비밀번호를 확인해 주세요', badConfirm);
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
            placeholder="예: 밀챗"
            containerStyle={styles.firstField}
          />
          <View style={styles.emailRow}>
            <TextField
              label="이메일"
              value={draft.email}
              onChangeText={(email) => updateDraft({ email })}
              placeholder="예: mealchat@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              containerStyle={styles.emailField}
            />
            <Pressable
              style={({ pressed }) => [
                styles.checkButton,
                (checking || !normalizedEmail) && styles.checkButtonOff,
                pressed && styles.checkButtonPressed,
              ]}
              disabled={checking || !normalizedEmail}
              onPress={() => void runEmailCheck()}
              accessibilityRole="button">
              <Text style={styles.checkButtonText}>{checking ? '확인 중' : '중복 확인'}</Text>
            </Pressable>
          </View>
          {checkFresh && emailCheck ? (
            <Text
              style={[styles.hint, emailCheck.status === 'available' && styles.hintOk]}>
              {emailCheck.status === 'available'
                ? '사용할 수 있는 이메일이에요.'
                : emailCheck.status === 'taken'
                  ? '이미 가입된 이메일이에요.'
                  : emailCheck.status === 'invalid'
                    ? '주소 형식을 확인해 주세요.'
                    : `확인하지 못했어요. ${emailCheck.message}`}
            </Text>
          ) : null}
          <TextField
            label="비밀번호"
            value={draft.password}
            onChangeText={(password) => updateDraft({ password })}
            placeholder="8자 이상"
            secureTextEntry
            containerStyle={styles.field}
          />
          {passwordHint ? <Text style={styles.hint}>{passwordHint}</Text> : null}
          <TextField
            label="비밀번호 재확인"
            value={draft.passwordConfirm}
            onChangeText={(passwordConfirm) => updateDraft({ passwordConfirm })}
            placeholder="한 번 더 입력해 주세요"
            secureTextEntry
            containerStyle={styles.field}
          />
          {confirmHint ? (
            <Text style={styles.hint}>{confirmHint}</Text>
          ) : draft.passwordConfirm ? (
            <Text style={[styles.hint, styles.hintOk]}>비밀번호가 일치해요.</Text>
          ) : null}

          <Text style={[styles.label, styles.accountLabel]}>계좌번호</Text>
          <View style={styles.accountRow}>
            <View style={styles.bankChip}>
              <BankSelect value={draft.bank} onChange={(bank) => updateDraft({ bank })} />
            </View>
            <TextInput
              style={styles.accountInput}
              value={draft.account}
              onChangeText={(account) => updateDraft({ account })}
              placeholder="'-' 없이 숫자만"
              placeholderTextColor={colors.placeholder}
              keyboardType="number-pad"
            />
          </View>

          <Text style={[styles.label, styles.birthLabel]}>생년월일</Text>
          <View style={styles.birthRow}>
            <BirthBox
              value={draft.birth.year}
              unit="년"
              placeholder="2003"
              onChange={(year) => updateDraft({ birth: { ...draft.birth, year } })}
            />
            <BirthBox
              value={draft.birth.month}
              unit="월"
              placeholder="10"
              onChange={(month) => updateDraft({ birth: { ...draft.birth, month } })}
            />
            <BirthBox
              value={draft.birth.day}
              unit="일"
              placeholder="29"
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
  placeholder,
  onChange,
}: {
  value: string;
  unit: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.birthBox}>
      <TextInput
        style={styles.birthValue}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        keyboardType="number-pad"
      />
      <Text style={styles.birthUnit}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emailRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: s(4),
  },
  emailField: {
    flex: 1,
    marginTop: s(8),
  },
  /* 입력창과 같은 높이로 맞춰 한 줄로 보이게 한다 */
  checkButton: {
    height: s(23),
    paddingHorizontal: s(8),
    borderRadius: s(9),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButtonOff: {
    opacity: 0.4,
  },
  checkButtonPressed: {
    opacity: 0.85,
  },
  checkButtonText: {
    fontFamily: fontFamily.bold,
    fontSize: fs(6.5),
    color: colors.textOnAccent,
  },
  hint: {
    marginTop: s(2),
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(10),
    color: colors.danger,
  },
  hintOk: {
    color: colors.primary,
  },
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
    fontFamily: fontFamily.bold,
    fontSize: fs(7),
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
    fontFamily: fontFamily.bold,
    fontSize: fs(9),
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
