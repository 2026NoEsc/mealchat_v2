import { Info, Lock } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, TextButton } from '../../components/ui/Button';
import { Switch } from '../../components/ui/Switch';
import { formatBirthDate, formatGender } from '../../lib/format';
import { fetchProfileVisibility, setProfileVisibility } from '../../lib/profile';
import { getConsentServerMode } from '../../lib/consents';
import { consentErrorMessage, type ProfileVisibility, type VisibilityField } from '../../consents/contracts';
import { useNavigation } from '../../navigation/NavigationContext';
import { useMyProfile } from '../../profile/useMyProfile';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import ProfileFrame, { profileStyles as shared } from './ProfileFrame';

type Field = { key: VisibilityField; label: string; detail: string };

/** Phone 530:1656, S1 canonical keys and server revision; no bulk JSON overwrite. */
export default function PrivacyScreen() {
  const { userId, bundle } = useMyProfile();
  const legacy = getConsentServerMode() === 'legacy';
  const { resetTo } = useNavigation();
  const [data, setData] = useState<ProfileVisibility | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const locked = useRef(false);
  const conflictOwner = useRef<string | null>(null);
  const mounted = useRef(true);
  const currentUserId = useRef(userId); currentUserId.current = userId;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true; setData(null); setOwnerId(null);
    if (conflictOwner.current !== userId) { conflictOwner.current = null; setError(''); }
    locked.current = false; setSaving(false);
    if (!userId || legacy) return;
    void fetchProfileVisibility().then(result => {
      if (!active) return;
      setData(result.data);
      setOwnerId(userId);
      if (result.error || !result.data) setError('공개 설정을 불러오지 못했어요. 다시 시도해 주세요.');
    }).catch(() => { if (active) setError('공개 설정을 불러오지 못했어요. 다시 시도해 주세요.'); });
    return () => { active = false; };
  }, [userId, attempt, legacy]);
  const profile = bundle?.privateProfile;
  const bio = typeof profile?.personalData.bio === 'string' ? profile.personalData.bio : '';
  const basic: Field[] = [
    { key: 'birthdate', label: '생년월일', detail: formatBirthDate(profile?.birthDate) ?? '아직 설정 안 됨' },
    { key: 'gender', label: '성별', detail: formatGender(profile?.personalData.gender) ?? '아직 설정 안 됨' },
    { key: 'bio', label: '한마디 멘트', detail: bio || '아직 설정 안 됨' },
  ];
  const sensitive: Field[] = [
    { key: 'bank_account', label: '프로필 계좌번호', detail: '켜면 같은 유효한 밥약의 현재 메이트에게 프로필 계좌를 보여요.' },
    { key: 'origin', label: '출발지 계산 사용', detail: '서버 계산에만 쓰며 출발지 원문과 좌표는 메이트에게 보여 주지 않아요.' },
  ];
  const toggle = async (key: VisibilityField) => {
    if (legacy || !userId || ownerId !== userId || !data || locked.current) return;
    locked.current = true;
    setSaving(true);
    const previous = data;
    const visibility = data.settings[key] === 'public' ? 'private' : 'public';
    setData({ ...data, settings: { ...data.settings, [key]: visibility } }); setError('');
    try {
      const result = await setProfileVisibility(key, visibility, previous.revision);
      if (!mounted.current || currentUserId.current !== userId) return;
      if (result.error || !result.data) {
        setData(previous); setError(consentErrorMessage(result.error));
        if ((result.error as { code?: string } | null)?.code === 'S1004') { conflictOwner.current = userId; setAttempt(value => value + 1); }
        return;
      }
      setData(result.data);
      conflictOwner.current = null;
    } catch {
      if (mounted.current && currentUserId.current === userId) { setError('저장하지 못했어요. 다시 시도해 주세요.'); setData(previous); }
    } finally { if (mounted.current && currentUserId.current === userId) { locked.current = false; setSaving(false); } }
  };
  const renderFields = (fields: Field[]) => fields.map((field, index) => <View key={field.key} style={[styles.row, index > 0 && styles.divider]}>
    <View style={shared.grow}><Text style={styles.rowLabel}>{field.label}</Text><Text style={shared.sub}>{field.detail}</Text></View>
    <Switch accessibilityLabel={field.label} value={ownerId === userId && data?.settings[field.key] === 'public'} disabled={ownerId !== userId || !data || saving} onChange={() => void toggle(field.key)} />
  </View>);
  return <ProfileFrame title="정보 공개 범위" footer={<PrimaryButton label="저장하기" disabled={ownerId !== userId || !data || saving} onPress={() => resetTo('Profile')} />}>
    <ScrollView contentContainerStyle={shared.body}>
      <Text style={shared.intro}>유효한 밥약에 함께 참여한 현재 메이트에게 보여 줄 정보를 고르세요. 친구라는 이유만으로는 공개되지 않아요.</Text>
      {legacy ? <Text accessibilityLiveRegion="polite" style={shared.sub}>곧 이용할 수 있어요. 공개 범위 설정이 준비되면 변경할 수 있어요. 아래 항목은 아직 서버 설정을 불러오지 않은 상태예요.</Text> : !data && !error ? <Text accessibilityLiveRegion="polite" style={shared.sub}>공개 설정을 불러오고 있어요</Text> : null}
      {error ? <><Text accessibilityRole="alert" style={[shared.sub, { color: v3FeedbackColors.error }]}>{error}</Text><TextButton label="공개 설정 다시 불러오기" onPress={() => setAttempt(value => value + 1)} /></> : null}
      <View testID="profile-privacy-basic" style={styles.card}><Text style={shared.title}>기본 정보</Text>{renderFields(basic)}</View>
      <View testID="profile-privacy-sensitive" style={styles.card}>
        <View style={shared.row}><Lock size={16} color={colors.selectedText} aria-hidden={true} /><Text style={[shared.title, styles.sensitive]}>계좌·계산 사용</Text></View>
        {renderFields(sensitive)}
      </View>
      <View style={styles.hint}><Info size={16} color={colors.sub} aria-hidden={true} /><Text style={[shared.sub, shared.grow]}>꺼 둔 정보는 방장에게도 보이지 않아요.</Text></View>
      <Text style={shared.sub}>프로필 계좌를 비공개로 바꿔도 이미 요청한 미완료 정산의 계좌는 고정 참여자와 생성자에게 보여요. 정산 계좌 공개는 이 스위치와 별개예요.</Text>
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
