import LocalLocationControl from './LocalLocationControl';
import { Info, Search } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, BackHandler, Platform, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import MateToggle from '../../components/ui/MateToggle';
import TextField from '../../components/ui/TextField';
import { fetchMyFriends, type Friend } from '../../lib/friends';
import { createRoom, createRoomInvitation } from '../../lib/rooms';
import { isRoomMembershipClosed, membershipClosedMessage } from '../../lib/roomMembership';
import { roomCreationDeadline } from '../../lib/meetingTime';
import { useNavigation } from '../../navigation/NavigationContext';
import { v3Layout } from '../../theme/scale';
import { scheduleLayout as layout } from '../../theme/scheduleTokens';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import ScheduleFrame from './ScheduleFrame';

type Params = { name?: string; invitees?: string[] };

export default function ScheduleDetailScreen() {
  /* 상태바 높이는 insets.top 만으로는 모자란 기기가 있다 */
  const { navigate, goBack, current } = useNavigation();
  const { user } = useAuth();

  /* 뒤로 왔다면 앞서 입력한 값이 params 로 실려 온다 */
  const params = current.params as Params | undefined;

  const [name, setName] = useState(params?.name ?? '');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [picked, setPicked] = useState<string[]>(params?.invitees ?? []);

  const [friendQuery, setFriendQuery] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    void fetchMyFriends(user.id)
      .then(({ data }) => {
        if (active) setFriends(data ?? []);
      })
      .catch(() => {
        if (active) setFriends([]);
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  const toggle = (profileId: string) => {
    setPicked((prev) =>
      prev.includes(profileId) ? prev.filter((id) => id !== profileId) : [...prev, profileId],
    );
  };

  /*
   * 여기서 방을 만든다.
   *
   * 메이트의 가능한 시간은 방이 있어야 모을 수 있다 — 초대도 참가행도 전부
   * 방에 매달려 있다. 그래서 STEP 2 는 "만들어진 방의 조율 화면" 이 되고,
   * 일정을 확정하면 그때 식당 결정 단계로 넘어간다.
   */
  const goNext = async () => {
    if (!user?.id || creating) return;

    setCreating(true);
    try {
      // A creation deadline is not an appointment; keep the existing seven-day policy in KST.
      const deadline = roomCreationDeadline();

      const { roomId, error } = await createRoom({
        ownerId: user.id,
        title: name.trim() || '새 밥약',
        ...deadline,
      });

      if (error || !roomId) {
        Alert.alert('방 만들기 실패', '잠시 후 다시 시도해 주세요.');
        return;
      }

      const failed: string[] = [];
      let membershipClosed = false;
      for (const friendId of picked) {
        const result = await createRoomInvitation(roomId, friendId);
        if (isRoomMembershipClosed(result.error)) { membershipClosed = true; break; }
        if (result.error) failed.push(friendId);
      }

      if (membershipClosed) {
        Alert.alert('초대할 수 없어요', membershipClosedMessage);
        navigate('ChatRoom', { roomId, title: name.trim() });
        return;
      }
      if (failed.length > 0) {
        Alert.alert(
          '일부 초대 실패',
          `${failed.length}명에게 초대 요청을 보내지 못했어요. 방에서 초대 코드를 공유해 주세요.`,
        );
      }

      navigate('ScheduleTime', {
        roomId,
        name: name.trim(),
        invitees: picked,
      });
    } finally {
      setCreating(false);
    }
  };
  const goPrev = useCallback(() => goBack(), [goBack]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { goPrev(); return true; });
    return () => subscription.remove();
  }, [goPrev]);
  const visibleFriends = friends.filter((friend) => friend.name.toLocaleLowerCase().includes(friendQuery.trim().toLocaleLowerCase()));
  return (
    <ScheduleFrame step={1} title="어떻게 만날까요?" subtitle="약속 이름과 함께 먹을 메이트를 정해요. 식당은 방장이 고른 공용 만남 지역에서 찾아요." onBack={goPrev}
      footer={<Button label="다음" loading={creating} disabled={!user?.id || creating} onPress={() => void goNext()} />}>
      <TextField label="약속 이름" value={name} onChangeText={setName} placeholder="예: 오늘 저녁팟" />
      <View style={styles.card}>
        <View style={styles.cardHead}><Text style={styles.cardTitle}>밥약 메이트 선택</Text><Text style={styles.selectedCount}>{picked.length}명 선택</Text></View>
        <View style={styles.searchRow}><View pointerEvents="none" style={styles.searchIcon}><Search size={18} color={colors.sub} /></View><TextField label="메이트 검색" value={friendQuery} onChangeText={setFriendQuery} placeholder="닉네임으로 찾기" containerStyle={styles.flex} style={styles.friendInput} /></View>
        <View style={styles.mates}>{visibleFriends.map((friend) => <MateToggle key={friend.id} name={friend.name} seed={friend.profileId} selected={picked.includes(friend.profileId)} onChange={() => toggle(friend.profileId)} />)}</View>
        {friends.length === 0 ? <Text style={styles.note}>아직 메이트가 없어요. 프로필 → 내 친구 관리에서 추가할 수 있어요.</Text> : visibleFriends.length === 0 ? <Text style={styles.note}>검색 결과가 없어요.</Text> : null}
      </View>
      <LocalLocationControl />
      <View style={styles.hint}><Info size={16} color={colors.sub} /><Text style={[styles.note, styles.flex]}>식당 추천은 개인 출발지 없이 공용 만남 지역을 기준으로 찾아요. 방에서 함께 정할 수 있어요.</Text></View>
    </ScheduleFrame>
  );
}
const styles = StyleSheet.create({
  card: { padding: layout.cardPadding, borderRadius: layout.cardRadius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22, color: colors.ink },
  selectedCount: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 19, color: colors.selectedText },
  searchRow: { position: 'relative' },
  searchIcon: { position: 'absolute', left: 14, bottom: 13, zIndex: 1 },
  friendInput: { minHeight: v3Layout.minTouchTarget, backgroundColor: colors.mutedBg, borderWidth: 0, paddingVertical: 10, paddingLeft: 40, paddingRight: 14 },
  mates: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  note: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.sub },
  hint: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
});
