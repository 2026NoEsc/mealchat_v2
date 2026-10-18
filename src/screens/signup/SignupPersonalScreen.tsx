import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSignupDraft } from '../../auth/SignupDraftProvider';
import { PENDING_PROFILE_ACCOUNT_MAX_LENGTH } from '../../auth/pendingSignupProfile';
import KeyboardSafeScreen from '../../components/KeyboardSafeScreen';
import { AuthFooter, SignupStepHeader, authStyles } from '../../components/ui/AuthLayout';
import BankSelect from '../../components/ui/BankSelect';
import { PrimaryButton, SecondaryButton } from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import { BIRTH_LENGTH, formatBirthInput, type BirthField } from '../../lib/birthDate';
import { checkEmailAvailable, type EmailCheck } from '../../lib/email';
import { isEmailShaped } from '../../lib/emailFormat';
import { confirmProblem, passwordProblem } from '../../lib/password';
import { useNavigation } from '../../navigation/NavigationContext';
import { v3Layout } from '../../theme/scale';
import { v3Colors as colors, v3Radii } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

/** Phone 519:1262, duplicate-email state 599:4206. Optional private fields stay optional. */
export default function SignupPersonalScreen() {
  const { navigate, goBack } = useNavigation();
  const insets = useSafeAreaInsets();
  const { draft, updateDraft } = useSignupDraft();
  const [emailCheck, setEmailCheck] = useState<EmailCheck | null>(null);
  const [checkedEmail, setCheckedEmail] = useState('');
  const [checking, setChecking] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const normalizedEmail = draft.email.trim().toLowerCase();
  const checkFresh = emailCheck !== null && checkedEmail === normalizedEmail;
  const emailOk = checkFresh && emailCheck?.status === 'available';
  const runEmailCheck = async () => {
    if (checking || !normalizedEmail) return;
    setChecking(true);
    try {
      const result = await checkEmailAvailable(normalizedEmail);
      setCheckedEmail(normalizedEmail);
      setEmailCheck(result);
    } catch {
      setCheckedEmail(normalizedEmail);
      setEmailCheck({ status: 'failed', message: '잠시 후 다시 시도해 주세요.' });
    } finally { setChecking(false); }
  };
  const emailError = checkFresh && emailCheck && emailCheck.status !== 'available'
    ? emailCheck.status === 'taken' ? '이미 가입된 이메일이에요. 다른 주소를 넣거나 로그인해 주세요.'
      : emailCheck.status === 'invalid' ? '주소 형식을 확인해 주세요.' : '확인하지 못했어요. 잠시 후 다시 시도해 주세요.'
    : attempted && !isEmailShaped(draft.email) ? '이메일 주소 형식을 확인해 주세요.'
      : attempted && !emailOk ? '이메일 중복 확인을 해 주세요.' : undefined;
  const passwordError = draft.password || attempted ? passwordProblem(draft.password) ?? undefined : undefined;
  const confirmError = draft.passwordConfirm || attempted ? confirmProblem(draft.password, draft.passwordConfirm) ?? undefined : undefined;
  const continueSignup = () => {
    setAttempted(true);
    if (!draft.nickname.trim() || !isEmailShaped(draft.email) || !emailOk || passwordProblem(draft.password) || confirmProblem(draft.password, draft.passwordConfirm)) return;
    navigate('SignupCalendar');
  };
  return <KeyboardSafeScreen style={[authStyles.screen, { paddingTop: insets.top }]}>
    <SignupStepHeader step={1} title="개인정보 입력" subtitle="닉네임과 이메일을 입력해 주세요. 계좌와 생년월일은 나중에 프로필에서 넣어도 돼요." onBack={goBack} />
    <ScrollView style={authStyles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <TextField label="닉네임" value={draft.nickname} onChangeText={(nickname) => updateDraft({ nickname })} placeholder="예: 밀챗"
        error={attempted && !draft.nickname.trim() ? '닉네임을 입력해 주세요.' : undefined} />
      <View>
          <TextField label="이메일" value={draft.email} onChangeText={(email) => updateDraft({ email })}
            placeholder="예: mealchat@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            error={emailError} inputAction={<SecondaryButton label="중복 확인" style={styles.emailButton} loading={checking} disabled={!normalizedEmail}
              onPress={() => void runEmailCheck()} />} />
        {emailOk ? <View style={styles.success} accessibilityLiveRegion="polite">
          <Check size={16} color={colors.safeText} aria-hidden={true} />
          <Text style={styles.successText}>사용할 수 있는 이메일이에요.</Text>
        </View> : null}
      </View>
      <TextField label="비밀번호" value={draft.password} secureTextEntry autoCapitalize="none" autoCorrect={false} onChangeText={(password) => updateDraft({ password })}
        placeholder="8자 이상" helper="8자 이상" error={passwordError} autoComplete="new-password" />
      <TextField label="비밀번호 재확인" value={draft.passwordConfirm} secureTextEntry autoCapitalize="none" autoCorrect={false} onChangeText={(passwordConfirm) => updateDraft({ passwordConfirm })}
        placeholder="한 번 더 입력해 주세요" error={confirmError} helper={draft.passwordConfirm && !confirmError ? '비밀번호가 일치해요.' : undefined} autoComplete="new-password" />
      <View style={styles.group}>
        <Text style={authStyles.label}>계좌번호 (선택)</Text>
        <View style={styles.row}>
          <View style={styles.bank}><BankSelect value={draft.bank} onChange={(bank) => updateDraft({ bank })} logicalHeight={v3Layout.fieldHeight} /></View>
          <TextInput accessibilityLabel="계좌번호" style={styles.accountInput} value={draft.account}
            onChangeText={(account) => updateDraft({ account: account.slice(0, PENDING_PROFILE_ACCOUNT_MAX_LENGTH) })}
            maxLength={PENDING_PROFILE_ACCOUNT_MAX_LENGTH} placeholder="'-' 없이 숫자만" placeholderTextColor={colors.sub} keyboardType="number-pad" />
        </View>
      </View>
      {/* TODO(서버 단계): 예금주 직접 입력을 저장할 필드와 계약이 생기면 입력칸을 추가한다. */}
      <View style={styles.group}>
        <Text style={authStyles.label}>생년월일 (선택)</Text>
        <View style={styles.row}>
          {(['year', 'month', 'day'] as const).map((field, index) => <BirthBox key={field} field={field} unit={['년', '월', '일'][index]}
            value={draft.birth[field]} onChange={(value) => updateDraft({ birth: { ...draft.birth, [field]: value } })} />)}
        </View>
      </View>
    </ScrollView>
    <AuthFooter><PrimaryButton label="다음" onPress={continueSignup} /></AuthFooter>
  </KeyboardSafeScreen>;
}

function BirthBox({ field, value, unit, onChange }: { field: BirthField; value: string; unit: string; onChange: (value: string) => void }) {
  return <View style={styles.birthBox}>
    <TextInput accessibilityLabel={`생년월일 ${unit}`} style={styles.birthValue} value={value}
      onChangeText={(text) => onChange(formatBirthInput(field, text))} placeholder={field === 'year' ? 'YYYY' : field === 'month' ? 'MM' : 'DD'}
      placeholderTextColor={colors.sub} keyboardType="number-pad" maxLength={BIRTH_LENGTH[field]} />
    <Text style={styles.birthUnit}>{unit}</Text>
  </View>;
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 8, gap: 18 },
  emailButton: { width: 96, height: v3Layout.fieldHeight, paddingHorizontal: 8 },
  success: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  successText: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 20, color: colors.safeText },
  group: { gap: 6 },
  row: { flexDirection: 'row', gap: 8 },
  bank: { width: 112 },
  accountInput: { flex: 1, minWidth: 0, height: v3Layout.fieldHeight, borderRadius: v3Radii.field, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 0, fontFamily: fontFamily.body, fontSize: 16, color: colors.ink },
  birthBox: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', height: v3Layout.fieldHeight, borderRadius: v3Radii.field, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14 },
  birthValue: { flex: 1, minWidth: 0, height: v3Layout.fieldHeight, padding: 0, fontFamily: fontFamily.body, fontSize: 16, color: colors.ink },
  birthUnit: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 22, color: colors.sub },
});
