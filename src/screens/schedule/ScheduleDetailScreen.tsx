import { Crosshair, Info, MapPin, Search } from 'lucide-react-native';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import MateToggle from '../../components/ui/MateToggle';
import TextField from '../../components/ui/TextField';
import { fetchMyFriends, type Friend } from '../../lib/friends';
import { locateMe, LocationDeniedError, type MyLocation } from '../../lib/myLocation';
import { createRoom, createRoomInvitation } from '../../lib/rooms';
import { useNavigation } from '../../navigation/NavigationContext';
import { useMyProfile } from '../../profile/useMyProfile';
import { v3Layout } from '../../theme/scale';
import { scheduleLayout as layout } from '../../theme/scheduleTokens';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import ScheduleFrame from './ScheduleFrame';
import { clearSettingsDraft, saveSettingsDraft, takeSettingsDraft, type OriginSource } from '../../lib/scheduleDraft';

type Params = { name?: string; invitees?: string[]; origin?: MyLocation; originSource?: OriginSource };

export default function ScheduleDetailScreen() {
  /* 상태바 높이는 insets.top 만으로는 모자란 기기가 있다 */
  const { navigate, goBack, current } = useNavigation();
  const { user } = useAuth();
  const { bundle } = useMyProfile();

  /* 뒤로 왔다면 앞서 입력한 값이 params 로 실려 온다 */
  const params = current.params as Params | undefined;

  const [name, setName] = useState(params?.name ?? '');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [picked, setPicked] = useState<string[]>(params?.invitees ?? []);

  const [origin, setOrigin] = useState<MyLocation | null>(params?.origin ?? null);
  const [originSource, setOriginSource] = useState<OriginSource>(params?.originSource ?? (params?.origin?.fromGps ? 'gps' : 'search'));
  const draftTouched = useRef(false);
  const [locating, setLocating] = useState(false);
  const [originError, setOriginError] = useState<string | null>(null);

  const [friendQuery, setFriendQuery] = useState('');
  const [permissionDenied, setPermissionDenied] = useState<'requestable' | 'blocked' | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user?.id || params?.name !== undefined || params?.invitees || params?.origin) return;
    let active = true;
    void takeSettingsDraft(user.id).then(draft => {
      if (!active || !draft || draftTouched.current) return;
      setName(draft.name); setPicked(draft.invitees); setOrigin(draft.origin); setOriginSource(draft.originSource);
    }).catch(() => { /* Current inputs remain usable if local storage is unavailable. */ });
    return () => { active = false; };
  }, [user?.id, params?.name, params?.invitees, params?.origin]);

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

  /*
   * 아무것도 고르지 않았으면 프로필의 사는 곳에서 시작한다. 사용자가 이미
   * 고른 값이 있으면 건드리지 않는다 — 저장된 값이 선택을 덮으면 안 된다.
   */
  useEffect(() => {
    if (origin) return;
    const profile = bundle?.privateProfile;
    if (profile?.startLat == null || profile.startLng == null || !Number.isFinite(profile.startLat) || !Number.isFinite(profile.startLng)) return;

    setOriginSource('profile');
    setOrigin({
      name: profile.startLocationName?.trim() || '사는 곳',
      address: '',
      lat: profile.startLat,
      lng: profile.startLng,
      fromGps: false,
    });
  }, [bundle, origin]);

  const applyCurrentLocation = useCallback(async () => {
    setLocating(true);
    setOriginError(null);
    setPermissionDenied(null);
    try {
      setOrigin(await locateMe());
      setOriginSource('gps');
      draftTouched.current = true;

    } catch (error) {
      if (error instanceof LocationDeniedError) {
        const permission = await Location.getForegroundPermissionsAsync().catch(() => null);
        setPermissionDenied(permission?.canAskAgain === false ? 'blocked' : 'requestable');
      }
      setOriginError(
        error instanceof LocationDeniedError
          ? null
          : '현재 위치를 잡지 못했어요. 직접 검색으로 정할 수 있어요.',
      );
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !permissionDenied) return;
      void Location.getForegroundPermissionsAsync().then((permission) => {
        if (active && permission.status === 'granted') void applyCurrentLocation();
      }).catch(() => { /* 권한을 읽지 못하면 안내와 직접 검색을 유지한다. */ });
    });
    return () => { active = false; subscription.remove(); };
  }, [permissionDenied, applyCurrentLocation]);

  const openSettings = async () => {
    if (user?.id) {
      try { await saveSettingsDraft(user.id, { name, invitees: picked, origin, originSource }); }
      catch { setOriginError('입력을 임시 저장하지 못했어요. 앱이 다시 시작되면 입력이 사라질 수 있어요.'); }
    }
    try { await Linking.openSettings(); }
    catch { setOriginError('설정을 열지 못했어요. 기기 설정에서 위치 권한을 켜 주세요.'); }
  };

  const toggle = (profileId: string) => {
    draftTouched.current = true;
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
    if (!origin || !user?.id) return;

    setCreating(true);
    try {
      /* 조율이 끝나기 전에는 언제 만날지 모른다 — 넉넉히 잡고 확정 때 좁힌다 */
      const until = new Date();
      until.setDate(until.getDate() + 7);
      const meetingDate = until.toISOString().slice(0, 10);

      const { roomId, error } = await createRoom({
        ownerId: user.id,
        title: name.trim() || '새 밥약',
        meetingDate,
        expiresAt: new Date(`${meetingDate}T23:59:59`).toISOString(),
      });

      if (error || !roomId) {
        Alert.alert('방 만들기 실패', error?.message ?? '잠시 후 다시 시도해 주세요.');
        return;
      }

      void clearSettingsDraft(user.id).catch(() => {});
      const failed: string[] = [];
      for (const friendId of picked) {
        const result = await createRoomInvitation(roomId, friendId);
        if (result.error) failed.push(friendId);
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
        origin, originSource,
      });
    } finally {
      setCreating(false);
    }
  };
  const openSearch = () => { draftTouched.current = true; navigate('ScheduleOriginSearch', { name, invitees: picked, origin, originSource }); };
  const goPrev = useCallback(() => { if (user?.id) void clearSettingsDraft(user.id).catch(() => {}); goBack(); }, [user?.id, goBack]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { goPrev(); return true; });
    return () => subscription.remove();
  }, [goPrev]);
  const visibleFriends = friends.filter((friend) => friend.name.toLocaleLowerCase().includes(friendQuery.trim().toLocaleLowerCase()));
  return (
    <ScheduleFrame step={1} title="어떻게 만날까요?" subtitle="약속 이름과 함께 먹을 메이트, 내가 출발할 곳을 정해요." onBack={goPrev}
      footer={<Button label="다음" loading={creating} disabled={!origin || creating} onPress={() => void goNext()} />}>
      <TextField label="약속 이름" value={name} onChangeText={value => { draftTouched.current = true; setName(value); }} placeholder="예: 오늘 저녁팟" />
      <View style={styles.card}>
        <View style={styles.cardHead}><Text style={styles.cardTitle}>밥약 메이트 선택</Text><Text style={styles.selectedCount}>{picked.length}명 선택</Text></View>
        <View style={styles.searchRow}><View pointerEvents="none" style={styles.searchIcon}><Search size={18} color={colors.sub} /></View><TextField label="메이트 검색" value={friendQuery} onChangeText={setFriendQuery} placeholder="닉네임으로 찾기" containerStyle={styles.flex} style={styles.friendInput} /></View>
        <View style={styles.mates}>{visibleFriends.map((friend) => <MateToggle key={friend.id} name={friend.name} seed={friend.profileId} selected={picked.includes(friend.profileId)} onChange={() => toggle(friend.profileId)} />)}</View>
        {friends.length === 0 ? <Text style={styles.note}>아직 메이트가 없어요. 프로필 → 내 친구 관리에서 추가할 수 있어요.</Text> : visibleFriends.length === 0 ? <Text style={styles.note}>검색 결과가 없어요.</Text> : null}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>내가 출발하는 곳</Text>
        <Text style={styles.note}>이번 밥약의 중간 지점 계산에 써요. 프로필 출발지는 바꾸지 않아요.</Text>
        <View style={styles.originButtons}>
          <Pressable accessibilityRole="button" accessibilityLabel="현재 위치로" accessibilityState={{ disabled: locating, busy: locating }} disabled={locating} onPress={() => void applyCurrentLocation()} style={[styles.originButton, styles.gps]}><Crosshair size={18} color={colors.selectedText} /><Text style={styles.gpsText}>{locating ? '확인하는 중' : '현재 위치로'}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="직접 검색" onPress={openSearch} style={styles.originButton}><Search size={18} color={colors.ink} /><Text style={styles.originButtonText}>직접 검색</Text></Pressable>
        </View>
        {permissionDenied ? <View style={styles.permission}>
          <Text style={styles.cardTitle}>위치 권한이 꺼져 있어요</Text>
          <Text style={styles.note}>{permissionDenied === 'blocked' ? '현재 위치로 찾으려면 설정에서 위치 권한을 켜 주세요. 직접 검색으로도 정할 수 있어요.' : '위치 권한을 다시 요청할 수 있어요. 직접 검색으로도 정할 수 있어요.'}</Text>
          <Button label={permissionDenied === 'blocked' ? '설정 열기' : '권한 다시 요청'} variant="secondary" onPress={() => { if (permissionDenied === 'blocked') void openSettings(); else void applyCurrentLocation(); }} />
        </View> : null}
        {originError ? <Text accessibilityRole="alert" style={styles.error}>{originError}</Text> : null}
        {origin ? <View style={styles.picked}><MapPin size={18} color={colors.selectedText} /><View style={styles.flex}><Text style={styles.originName}>{origin.name}</Text><Text style={styles.originMeta}>{originSource === 'profile' ? '프로필 출발지' : origin.address || (origin.fromGps ? 'GPS로 잡은 위치' : '직접 고른 위치')}</Text></View></View> : null}
      </View>
      <View style={styles.hint}><Info size={16} color={colors.sub} /><Text style={[styles.note, styles.flex]}>식당은 다음 단계에서 메이트들의 중간 지점으로 추천해 드려요.</Text></View>
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
  originButtons: { flexDirection: 'row', gap: 8 },
  originButton: { flex: 1, minHeight: v3Layout.minTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: layout.fieldRadius },
  originButtonText: { fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 20, color: colors.ink },
  gps: { backgroundColor: colors.selectedBg, borderColor: colors.primary },
  gpsText: { fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 20, color: colors.selectedText },
  picked: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: layout.fieldRadius, backgroundColor: colors.mutedBg },
  originName: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 22, color: colors.ink },
  originMeta: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 17, color: colors.sub },
  permission: { padding: 16, borderRadius: layout.fieldRadius, backgroundColor: colors.selectedBg, gap: 8 },
  error: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: v3FeedbackColors.error },
  hint: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
});
