import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, Smile, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import Avatar from '../../components/Avatar';
import BankSelect from '../../components/ui/BankSelect';
import { PrimaryButton } from '../../components/ui/Button';
import { ListRow } from '../../components/ui/ListRow';
import TextField from '../../components/ui/TextField';
import Toast, { toastLayout, useToast } from '../../components/ui/Toast';
import { removeAvatar, uploadAvatar } from '../../lib/avatar';
import { BIRTH_LENGTH, formatBirthInput, fromBirthDate, type BirthField } from '../../lib/birthDate';
import { saveMyGender, saveMyPrivateProfile, updateMyName, type MyProfileBundle } from '../../lib/profile';
import { useNavigation } from '../../navigation/NavigationContext';
import { useMyProfile } from '../../profile/useMyProfile';
import { v3Layout } from '../../theme/scale';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import ProfileFrame, { profileStyles as shared } from './ProfileFrame';
import { profileLayout } from '../../theme/profileTokens';
import ProfilePhotoSheet from './ProfilePhotoSheet';

type Gender = 'male' | 'female' | 'none';
type EditDraft = { userId: string; nickname: string; bank: string | null; account: string; birth: ReturnType<typeof fromBirthDate>; gender: Gender | null; avatarUrl: string | null };
const PHOTO_DISMISS_TIMEOUT_MS = 1500;
const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: '남성' }, { value: 'female', label: '여성' }, { value: 'none', label: '밝히지 않음' },
];
function savedGender(value: unknown): Gender | null {
  return value === 'male' || value === 'female' || value === 'none' ? value : null;
}

/** Phone 530:1513. Mount the form after loading so edits are not overwritten by effects. */
export default function ProfileEditScreen() {
  const { status, bundle, userId } = useMyProfile();
  if (status !== 'ready' || !bundle || !userId) return <ProfileFrame title="프로필 수정"><Text style={styles.fallback}>{status === 'error' ? '프로필을 불러오지 못했어요.' : '불러오는 중'}</Text></ProfileFrame>;
  return <ProfileEditForm key={userId} userId={userId} bundle={bundle} />;
}
function ProfileEditForm({ userId, bundle }: { userId: string; bundle: MyProfileBundle }) {
  const { current, resetTo, replace, navigate, canGoBack, goBack } = useNavigation();
  const { user } = useAuth();
  // Keep unsaved profile edits in this route only; password values never enter route params.
  const savedDraft = current.params?.profileEditDraft as EditDraft | undefined;
  const draft = savedDraft?.userId === userId ? savedDraft : undefined;
  const [nickname, setNickname] = useState(draft?.nickname ?? bundle.profile.name);
  const [bank, setBank] = useState(draft ? draft.bank : bundle.privateProfile.bankName);
  const [account, setAccount] = useState(draft?.account ?? bundle.privateProfile.accountNumber ?? '');
  const [birth, setBirth] = useState(draft?.birth ?? fromBirthDate(bundle.privateProfile.birthDate));
  const [gender, setGender] = useState(draft ? draft.gender : savedGender(bundle.privateProfile.personalData.gender));
  const [avatarUrl, setAvatarUrl] = useState(draft ? draft.avatarUrl : bundle.profile.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [permissionSource, setPermissionSource] = useState<'album' | 'camera' | null>(null);
  const locked = useRef(false);
  const mounted = useRef(true);
  const pickerDismiss = useRef<((proceed: boolean) => void) | null>(null);
  const pickerDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { showToast, toastProps } = useToast();

  useEffect(() => {
    if (current.params?.passwordChanged !== true) return;
    showToast({ message: '비밀번호를 바꿨어요' });
    replace('ProfileEdit', { ...current.params, passwordChanged: undefined });
  }, [current.params, replace, showToast]);

  const finishPhotoDismiss = () => {
    if (pickerDismissTimer.current) clearTimeout(pickerDismissTimer.current);
    pickerDismissTimer.current = null;
    const finish = pickerDismiss.current;
    pickerDismiss.current = null;
    finish?.(true);
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (pickerDismissTimer.current) clearTimeout(pickerDismissTimer.current);
      pickerDismissTimer.current = null;
      const finish = pickerDismiss.current;
      pickerDismiss.current = null;
      finish?.(false);
    };
  }, []);
  useEffect(() => {
    // Android/web do not implement Modal.onDismiss; wait for the hidden commit.
    if (!photoOpen && Platform.OS !== 'ios') finishPhotoDismiss();
  }, [photoOpen]);

  const pickAvatar = async () => {
    const source = permissionSource;
    if (!source || locked.current) return;
    locked.current = true;
    setUploading(true);
    try {
      // This function is only reachable after the reason sheet's explicit Continue action.
      const permission = source === 'album' ? await ImagePicker.requestMediaLibraryPermissionsAsync() : await ImagePicker.requestCameraPermissionsAsync();
      if (!mounted.current) return;
      if (!permission.granted) {
        Alert.alert('권한 필요', source === 'album' ? '사진을 고르려면 사진 접근 권한이 필요해요.' : '프로필 사진을 찍으려면 카메라 권한이 필요해요.');
        return;
      }
      const dismissed = await new Promise<boolean>((resolve) => {
        pickerDismiss.current = resolve;
        if (Platform.OS === 'ios') pickerDismissTimer.current = setTimeout(() => {
          // A missing native callback must not leave the form locked. Abort rather
          // than present a system picker while the sheet may still be dismissing.
          const finish = pickerDismiss.current;
          pickerDismiss.current = null;
          pickerDismissTimer.current = null;
          finish?.(false);
        }, PHOTO_DISMISS_TIMEOUT_MS);
        setPhotoOpen(false);
      });
      if (!mounted.current) return;
      if (!dismissed) {
        showToast({ message: '사진 선택 화면을 열지 못했어요. 다시 시도해 주세요.' });
        return;
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 };
      const picked = source === 'album' ? await ImagePicker.launchImageLibraryAsync(options) : await ImagePicker.launchCameraAsync(options);
      if (!mounted.current || picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      const { url, error } = await uploadAvatar({ userId, uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' });
      if (error) { Alert.alert('사진 올리기 실패', error.message); return; }
      setAvatarUrl(url);
      showToast({ message: '프로필 사진을 바꿨어요' });
    } catch { Alert.alert('사진 올리기 실패', '사진을 불러오지 못했어요. 다시 시도해 주세요.'); }
    finally { locked.current = false; setUploading(false); setPermissionSource(null); setPhotoOpen(false); }
  };
  const clearAvatar = async () => {
    if (locked.current || !avatarUrl) return;
    locked.current = true;
    setUploading(true);
    try {
      const error = await removeAvatar(userId, avatarUrl);
      if (error) { Alert.alert('사진 삭제 실패', error.message); return; }
      // Avatar already renders the stable default character when url is null.
      setAvatarUrl(null);
      setPhotoOpen(false);
      showToast({ message: '기본 캐릭터로 바꿨어요' });
    } catch { Alert.alert('사진 삭제 실패', '잠시 후 다시 시도해 주세요.'); }
    finally { locked.current = false; setUploading(false); }
  };
  const save = async () => {
    if (locked.current) return;
    if (!nickname.trim()) { Alert.alert('입력 확인', '닉네임을 입력해 주세요.'); return; }
    locked.current = true;
    setSaving(true);
    try {
      const nameError = await updateMyName(userId, nickname);
      const privateError = nameError ? null : await saveMyPrivateProfile(userId, { bank, account, birth });
      const genderError = nameError || privateError || !gender || gender === savedGender(bundle.privateProfile.personalData.gender)
        ? null : await saveMyGender(userId, gender, bundle.privateProfile.personalData.gender);
      const error = nameError ?? privateError ?? genderError;
      if (!mounted.current) return;
      if (error) { Alert.alert('저장 실패', error.message); return; }
      if (current.params?.returnAfterSave === 'settlement' && canGoBack) goBack();
      else resetTo('Profile');
    } catch { if (mounted.current) Alert.alert('저장 실패', '잠시 후 다시 시도해 주세요.'); }
    finally { if (mounted.current) { locked.current = false; setSaving(false); } }
  };
  const closePhoto = () => { if (!uploading) { setPhotoOpen(false); setPermissionSource(null); } };
  const photoActions = [
    { label: '앨범에서 고르기', Icon: ImageIcon, action: () => setPermissionSource('album') },
    { label: '사진 찍기', Icon: Camera, action: () => setPermissionSource('camera') },
    { label: '기본 캐릭터로 바꾸기', Icon: Smile, action: () => void clearAvatar(), disabled: !avatarUrl },
    ...(avatarUrl ? [{ label: '사진 지우기', Icon: Trash2, action: () => void clearAvatar(), danger: true, disabled: false }] : []),
  ];
  return <ProfileFrame title="프로필 수정" footer={<PrimaryButton label="저장하기" loading={saving} disabled={uploading} onPress={() => void save()} />}>
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={styles.photo}>
        <View testID="profile-edit-avatar" style={styles.avatar}>
          <Avatar name={nickname || bundle.profile.name} seed={userId} url={avatarUrl} size={88} />
          <Pressable accessibilityRole="button" accessibilityLabel="프로필 사진 바꾸기" disabled={uploading} onPress={() => setPhotoOpen(true)}
            style={({ pressed }) => [styles.camera, pressed && shared.pressed]}><Camera size={20} color={colors.ink} aria-hidden={true} /></Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="사진 바꾸기" disabled={uploading} onPress={() => setPhotoOpen(true)}
          style={({ pressed }) => [styles.photoTextTouch, pressed && shared.pressed]}><Text style={styles.photoText}>{uploading ? '사진 저장 중' : '사진 바꾸기'}</Text></Pressable>
      </View>
      <TextField label="닉네임" value={nickname} onChangeText={setNickname} />
      <TextField label="이메일" value={user?.email ?? ''} readOnly helper="이메일은 바꿀 수 없어요" autoCapitalize="none" />
      <View style={styles.group}><Text style={shared.label}>성별</Text><View testID="profile-gender-segment" accessibilityRole="radiogroup" accessibilityLabel="성별" style={styles.segment}>
        {GENDERS.map((option) => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label}
          accessibilityState={{ checked: gender === option.value }} aria-checked={gender === option.value}
          onPress={() => setGender(option.value)} style={({ pressed }) => [styles.gender, gender === option.value && styles.genderSelected, pressed && shared.pressed]}>
          <Text style={[styles.genderText, gender === option.value && styles.genderTextSelected]}>{option.label}</Text>
        </Pressable>)}
      </View></View>
      <View style={styles.group}><Text style={shared.label}>생년월일</Text><View style={shared.row}>
        {(['year', 'month', 'day'] as BirthField[]).map((field, index) => <View key={field} style={styles.birthBox}>
          <TextInput accessibilityLabel={'생년월일 ' + ['년', '월', '일'][index]} value={birth[field]} style={styles.birthValue}
            onChangeText={(value) => setBirth((previous) => ({ ...previous, [field]: formatBirthInput(field, value) }))}
            keyboardType="number-pad" maxLength={BIRTH_LENGTH[field]} placeholder={['YYYY', 'MM', 'DD'][index]} placeholderTextColor={colors.sub} />
          <Text style={styles.unit}>{['년', '월', '일'][index]}</Text>
        </View>)}
      </View></View>
      <View style={styles.group}><Text style={shared.label}>송금 계좌</Text><View style={shared.row}>
        <View style={styles.bank}><BankSelect value={bank} onChange={setBank} logicalHeight={52} />
          {!bank ? <View pointerEvents="none" style={styles.bankPlaceholder}><Text style={styles.bankPlaceholderText}>은행 선택</Text></View> : null}
        </View>
        <TextInput accessibilityLabel="계좌번호" value={account} onChangeText={setAccount} placeholder="계좌번호 입력" placeholderTextColor={colors.sub} keyboardType="number-pad" style={styles.account} />
      </View></View>
      <ListRow title="비밀번호 변경" disabled={saving || uploading} onPress={() => {
        if (locked.current) return;
        replace('ProfileEdit', { ...current.params, profileEditDraft: { userId, nickname, bank, account, birth, gender, avatarUrl } satisfies EditDraft });
        navigate('PasswordChange');
      }} style={styles.passwordRow} />
    </ScrollView>
    {/* Keep the native Modal mounted for its iOS dismissal callback. */}
    <ProfilePhotoSheet visible={photoOpen} title={permissionSource ? '사진 접근 안내' : '프로필 사진'} onClose={closePhoto} onDismiss={finishPhotoDismiss}>
      {permissionSource ? <>
        <Text style={shared.intro}>{permissionSource === 'album' ? '프로필 사진을 고르기 위해 앨범 접근 권한이 필요해요. 고른 사진만 프로필에 업로드해요.' : '프로필 사진을 찍기 위해 카메라 권한이 필요해요. 찍은 사진은 확인한 뒤 프로필에 업로드해요.'}</Text>
        <PrimaryButton label="계속" loading={uploading} onPress={() => void pickAvatar()} />
      </> : <View>{photoActions.map(({ label, Icon, action, danger, disabled }) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} disabled={uploading || disabled} accessibilityState={{ disabled: uploading || Boolean(disabled) }} onPress={action}
        style={({ pressed }) => [styles.photoAction, pressed && shared.pressed, disabled && styles.disabled]}>
        <Icon size={22} strokeWidth={2} color={danger ? v3FeedbackColors.error : colors.ink} aria-hidden={true} /><Text style={[styles.photoActionText, danger && styles.danger]}>{label}</Text>
      </Pressable>)}</View>}
    </ProfilePhotoSheet>
    <Toast {...toastProps} bottom={v3Layout.buttonHeight + profileLayout.footerPadding * 2 + toastLayout.gap} />
  </ProfileFrame>;
}
const styles = StyleSheet.create({
  body: { paddingTop: 8, paddingHorizontal: 20, paddingBottom: 108, gap: 16 },
  fallback: { margin: 20, fontFamily: fontFamily.body, fontSize: 14, color: colors.sub },
  photo: { alignItems: 'center', gap: 8 },
  avatar: { width: 88, height: 88 },
  camera: { position: 'absolute', right: -8, bottom: -4, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  photoTextTouch: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  photoText: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 20, color: colors.selectedText },
  group: { gap: 6 },
  segment: { minHeight: 52, padding: 4, gap: 4, flexDirection: 'row', borderRadius: 14, backgroundColor: colors.mutedBg },
  gender: { flex: 1, minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 10, borderWidth: 1.5, borderColor: colors.mutedBg, paddingHorizontal: 2 },
  genderSelected: { backgroundColor: colors.surface, borderColor: colors.primary },
  genderText: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: colors.sub },
  genderTextSelected: { fontFamily: fontFamily.bold, color: colors.ink },
  birthBox: { flex: 1, minWidth: 0, height: v3Layout.fieldHeight, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  birthValue: { flex: 1, minWidth: 0, height: v3Layout.fieldHeight, padding: 0, fontFamily: fontFamily.body, fontSize: 16, color: colors.ink },
  unit: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 22, color: colors.sub },
  bank: { width: 124 },
  bankPlaceholder: { position: 'absolute', left: 14, right: 40, top: 1, bottom: 1, justifyContent: 'center', backgroundColor: colors.surface },
  bankPlaceholderText: { fontFamily: fontFamily.body, fontSize: 16, color: colors.sub },
  account: { flex: 1, minWidth: 0, minHeight: v3Layout.fieldHeight, paddingHorizontal: 14, paddingVertical: 0, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, fontFamily: fontFamily.body, fontSize: 16, color: colors.ink },
  passwordRow: { borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  photoAction: { minHeight: 52, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 14 },
  photoActionText: { fontFamily: fontFamily.medium, fontSize: 16, lineHeight: 24, color: colors.ink },
  danger: { color: v3FeedbackColors.error },
  disabled: { opacity: 0.4 },
});
