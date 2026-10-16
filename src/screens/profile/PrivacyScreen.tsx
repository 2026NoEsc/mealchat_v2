import { Info, Lock } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../../components/ui/Button';
import { Switch } from '../../components/ui/Switch';
import { formatBirthDate, formatGender } from '../../lib/format';
import { savePrivacySettings } from '../../lib/profile';
import { useNavigation } from '../../navigation/NavigationContext';
import { useMyProfile } from '../../profile/useMyProfile';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import ProfileFrame, { profileStyles as shared } from './ProfileFrame';

const INITIAL: Record<string, boolean> = { birth: true, gender: true, bio: false, account: false, origin: true };
type Field = { key: string; label: string; detail: string };

/** Phone 530:1656. Preserve the existing immediate-save contract and key names. */
export default function PrivacyScreen() {
  const { userId, bundle, reload } = useMyProfile();
  const { resetTo } = useNavigation();
  const [values, setValues] = useState(INITIAL);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const locked = useRef(false);
  useEffect(() => {
    if (loaded || !bundle) return;
    const saved = bundle.privateProfile.privacySettings;
    setValues((previous) => Object.fromEntries(Object.entries(previous).map(([key, value]) => [key, saved[key] ? saved[key] === 'public' : value])));
    setLoaded(true);
  }, [bundle, loaded]);
  const profile = bundle?.privateProfile;
  const bio = typeof profile?.personalData.bio === 'string' ? profile.personalData.bio : '';
  const basic = [
    { key: 'birth', label: '생년월일', detail: formatBirthDate(profile?.birthDate) ?? '아직 설정 안 됨' },
    { key: 'gender', label: '성별', detail: formatGender(profile?.personalData.gender) ?? '아직 설정 안 됨' },
    { key: 'bio', label: '한마디 멘트', detail: bio || '아직 설정 안 됨' },
  ];
  const sensitive = [
    { key: 'account', label: '계좌번호', detail: '정산할 때만 정산 참여자에게 보여요' },
    { key: 'origin', label: '출발지 주소', detail: '중간 지점 계산에만 쓰고 보여 주지 않아요' },
  ];
  // TODO(서버 단계): 기존 저장 키 birth/account와 서버 계약 birthdate/bank_account를 정합화하고 실제 타인 공개 제어를 적용한다. 베타 문구는 Figma대로 유지한다.
  const toggle = async (key: string) => {
    if (!userId || !loaded || locked.current) return;
    locked.current = true;
    setSaving(true);
    const previous = values;
    const next = { ...values, [key]: !values[key] };
    setValues(next);
    try {
      const error = await savePrivacySettings(userId, Object.fromEntries(Object.entries(next).map(([name, open]) => [name, open ? 'public' : 'private'])));
      if (error) { Alert.alert('저장 실패', error.message); setValues(previous); return; }
      reload();
    } catch {
      Alert.alert('저장 실패', '잠시 후 다시 시도해 주세요.');
      setValues(previous);
    } finally { locked.current = false; setSaving(false); }
  };
  const renderFields = (fields: Field[]) => fields.map((field, index) => <View key={field.key} style={[styles.row, index > 0 && styles.divider]}>
    <View style={shared.grow}><Text style={styles.rowLabel}>{field.label}</Text><Text style={shared.sub}>{field.detail}</Text></View>
    <Switch accessibilityLabel={field.label} value={values[field.key]} disabled={!loaded || saving} onChange={() => void toggle(field.key)} />
  </View>);
  return <ProfileFrame title="정보 공개 범위" footer={<PrimaryButton label="저장하기" disabled={!loaded || saving} onPress={() => resetTo('Profile')} />}>
    <ScrollView contentContainerStyle={shared.body}>
      <Text style={shared.intro}>밥약 메이트에게 보여 줄 정보를 고르세요.</Text>
      <View testID="profile-privacy-basic" style={styles.card}><Text style={shared.title}>기본 정보</Text>{renderFields(basic)}</View>
      <View testID="profile-privacy-sensitive" style={styles.card}>
        <View style={shared.row}><Lock size={16} color={colors.selectedText} aria-hidden={true} /><Text style={[shared.title, styles.sensitive]}>민감 정보</Text></View>
        {renderFields(sensitive)}
      </View>
      <View style={styles.hint}><Info size={16} color={colors.sub} aria-hidden={true} /><Text style={[shared.sub, shared.grow]}>꺼 둔 정보는 방장에게도 보이지 않아요.</Text></View>
    </ScrollView>
  </ProfileFrame>;
}
const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 4 },
  row: { minHeight: 64, paddingVertical: 10, flexDirection: 'row', gap: 12, alignItems: 'center' },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowLabel: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 22, color: colors.ink },
  sensitive: { color: colors.selectedText },
  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});
