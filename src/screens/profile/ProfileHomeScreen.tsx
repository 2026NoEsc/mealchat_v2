import { Check, ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSignOutAction } from '../../auth/useSignOutAction';
import Avatar from '../../components/Avatar';
import FailureCard from '../../components/ui/FailureCard';
import { ListRow } from '../../components/ui/ListRow';
import Toast from '../../components/ui/Toast';
import { formatAccount, formatBirthDate, formatGender } from '../../lib/format';
import { fetchMyFriends } from '../../lib/friends';
import { useNavigation } from '../../navigation/NavigationContext';
import { useMyProfile } from '../../profile/useMyProfile';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import ProfileFrame, { profileStyles as shared } from './ProfileFrame';

/** Phone 530:1403. Completion uses persisted fields, never a fixture count. */
export default function ProfileHomeScreen() {
  const { navigate } = useNavigation();
  const { leave, leaving, toastProps } = useSignOutAction();
  const { status, bundle, userId, reload } = useMyProfile();
  const [friendCount, setFriendCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    setFriendCount(null);
    if (userId) void fetchMyFriends(userId).then(({ data, error }) => {
      if (active && !error) setFriendCount(data?.length ?? 0);
    });
    return () => { active = false; };
  }, [userId]);
  if (status !== 'ready' || !bundle) return <ProfileFrame><ScrollView contentContainerStyle={styles.body}>
    {status === 'error' ? <FailureCard title="프로필을 불러오지 못했어요" onRetry={reload} />
      : <View testID="profile-loading" accessible accessibilityLabel="프로필 불러오는 중" accessibilityState={{ busy: true }} style={styles.skeleton}>
        <View style={styles.skeletonAvatar} /><View style={styles.skeletonLine} /><View style={styles.skeletonLine} />
      </View>}
  </ScrollView></ProfileFrame>;
  const privateProfile = bundle?.privateProfile;
  const account = formatAccount(privateProfile?.bankName, privateProfile?.accountNumber);
  const origin = privateProfile?.startLocationName?.trim();
  const info = [
    { label: '생년월일', value: formatBirthDate(privateProfile?.birthDate) ?? '아직 설정 안 됨' },
    { label: '성별', value: formatGender(privateProfile?.personalData.gender) ?? '아직 설정 안 됨' },
    { label: '송금 계좌', value: account ?? '아직 등록 안 됨', missing: !account },
  ];
  // TODO(서버 단계): 일정 입력 완료를 판단할 계약이 없어 항목과 분모에서 제외한다.
  const steps = [
    ...(privateProfile?.foodProfileAvailable !== false ? [{ label: '음식 취향 매칭', done: privateProfile?.foodProfileCompleted === true, action: '설정하기', onPress: () => navigate('FoodProfile') }] : []),
    { label: '송금 계좌 등록', done: Boolean(account), action: '등록하기', onPress: () => navigate('ProfileEdit') },
    { label: '출발지 설정', done: Boolean(origin), action: '설정하기', onPress: () => navigate('Origin') },
  ];
  const completed = steps.filter((step) => step.done).length;
  const bio = typeof privateProfile?.personalData.bio === 'string' ? privateProfile.personalData.bio : '';
  return <ProfileFrame>
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <View testID="profile-identity-card" style={shared.card}>
        <View style={styles.identity}>
          <Avatar name={bundle?.profile.name ?? '?'} seed={bundle?.profile.id} url={bundle?.profile.avatarUrl} size={64} />
          <View style={shared.grow}><Text style={styles.name}>{bundle?.profile.name ?? '불러오는 중'}</Text><Text style={shared.sub}>{bio || (bundle ? '@' + bundle.profile.tag : '')}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="프로필 수정" onPress={() => navigate('ProfileEdit')}
            style={({ pressed }) => [styles.edit, pressed && shared.pressed]}><Text style={styles.editText}>수정</Text></Pressable>
        </View>
        <View style={styles.info}>{info.map((row) => <View key={row.label} style={styles.infoRow}>
          <Text style={styles.infoLabel}>{row.label}</Text><Text style={[styles.infoValue, row.missing && styles.selected]}>{row.value}</Text>
        </View>)}</View>
      </View>
      <View testID="profile-completion-card" style={[shared.card, styles.completion]}>
        <View style={shared.row}><Text style={styles.completeTitle}>계정 완성하기</Text><Text style={styles.count}>{completed} / {steps.length}</Text></View>
        <View accessible accessibilityRole="progressbar" accessibilityLabel="계정 완성" accessibilityValue={{ min: 0, max: steps.length, now: completed }} style={styles.track}>
          <View style={[styles.fill, { width: `${completed / steps.length * 100}%` }]} />
        </View>
        {steps.map((step) => <View key={step.label} style={styles.task}>
          <View style={[styles.status, step.done && styles.statusDone]}>{step.done ? <Check size={14} color={colors.safeText} aria-hidden={true} /> : null}</View>
          <Text style={[styles.taskLabel, step.done && styles.doneLabel]}>{step.label}</Text>
          {step.done ? <Text style={styles.done}>완료</Text> : <Pressable accessibilityRole="button" accessibilityLabel={step.label + ' ' + step.action} onPress={step.onPress}
            style={({ pressed }) => [styles.taskTouch, pressed && shared.pressed]}><View style={styles.pill}><Text style={styles.count}>{step.action}</Text><ChevronRight size={16} color={colors.selectedText} aria-hidden={true} /></View></Pressable>}
        </View>)}
      </View>
      <View testID="profile-menu-card" style={styles.menu}>
        <ListRow title="내 친구 관리" value={friendCount === null ? undefined : friendCount + '명'} onPress={() => navigate('Friends')} />
        <ListRow title="출발지 설정" value={origin || '아직 설정 안 됨'} onPress={() => navigate('Origin')} />
        <ListRow title="정보 공개 범위" onPress={() => navigate('Privacy')} style={styles.lastRow} />
        <ListRow title="설정" value="약관 · 계정" style={[styles.lastRow, { borderTopWidth: 1, borderTopColor: colors.border }]} onPress={() => navigate('Settings')} />
        <ListRow title="밥약 기록" value="준비 중" onPress={() => navigate('MealHistory')} />
        {privateProfile?.foodProfileAvailable !== false ? <ListRow title="음식 취향 다시 고르기" onPress={() => navigate('FoodProfile')} /> : null}
      </View>
      <View style={styles.accountActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="로그아웃" disabled={leaving} accessibilityState={{ disabled: leaving, busy: leaving }} onPress={() => void leave()}
          style={({ pressed }) => [styles.accountAction, pressed && shared.pressed]}><Text style={shared.sub}>로그아웃</Text></Pressable>
        {/* TODO(서버 단계): 계정 삭제는 기존 준비 중 알림을 유지한다. */}
        <Pressable accessibilityRole="button" accessibilityLabel="계정 삭제" onPress={() => Alert.alert('계정 삭제 준비 중', '본인 재인증과 기록 보존 정책이 준비된 뒤 제공합니다.')}
          style={({ pressed }) => [styles.accountAction, pressed && shared.pressed]}><Text style={styles.delete}>계정 삭제</Text></Pressable>
      </View>
    </ScrollView>
    <Toast {...toastProps} />
  </ProfileFrame>;
}
const styles = StyleSheet.create({
  body: { paddingTop: 4, paddingHorizontal: 20, paddingBottom: 8, gap: 14 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  name: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 28, color: colors.ink, marginBottom: 2 },
  edit: { minWidth: 54, minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  editText: { fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 20, color: colors.ink },
  info: { gap: 6 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  infoLabel: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 22, color: colors.sub },
  infoValue: { flexShrink: 1, textAlign: 'right', fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 22, color: colors.ink },
  selected: { color: colors.selectedText, fontFamily: fontFamily.bold },
  completion: { gap: 10 },
  completeTitle: { flex: 1, fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 24, color: colors.ink },
  count: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 20, color: colors.selectedText },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  task: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  status: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.mutedBg, alignItems: 'center', justifyContent: 'center' },
  statusDone: { backgroundColor: colors.safeBg },
  taskLabel: { flex: 1, fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 22, color: colors.ink },
  doneLabel: { fontFamily: fontFamily.body, color: colors.sub },
  done: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 20, color: colors.safeText },
  taskTouch: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  pill: { minHeight: 32, paddingLeft: 10, paddingRight: 4, gap: 2, borderRadius: 16, backgroundColor: colors.selectedBg, flexDirection: 'row', alignItems: 'center' },
  menu: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, overflow: 'hidden' },
  lastRow: { borderBottomWidth: 0 },
  accountActions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
  accountAction: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  delete: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 20, color: v3FeedbackColors.error },
  skeleton: { borderRadius: 16, padding: 16, gap: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  skeletonAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.mutedBg },
  skeletonLine: { height: 22, borderRadius: 6, backgroundColor: colors.mutedBg },
});
