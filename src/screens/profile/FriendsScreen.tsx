import { Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import Avatar from '../../components/Avatar';
import { SecondaryButton } from '../../components/ui/Button';
import Toast, { useToast } from '../../components/ui/Toast';
import { notify } from '../../lib/confirm';
import { addFriend, fetchMyFriends, removeFriend, searchProfilesByTag, type Friend } from '../../lib/friends';
import { v3Layout } from '../../theme/scale';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import ProfileFrame, { profileStyles as shared } from './ProfileFrame';

type Candidate = { id: string; name: string; tag: string; avatar_color: string };

/** Phone 530:1594, 601:2884/2954/3028. No new server contract. */
export default function FriendsScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const revision = useRef(0);
  const searchRevision = useRef(0);
  const active = useRef(true);
  const { showToast, dismissToast, toastProps } = useToast();

  const load = useCallback(async () => {
    if (!userId) return;
    const version = ++revision.current;
    const { data, error } = await fetchMyFriends(userId);
    if (!active.current || version !== revision.current) return;
    setLoadError(error?.message ?? null);
    if (!error) setFriends(data ?? []);
  }, [userId]);
  useEffect(() => {
    const loadVersion = revision;
    const searchVersion = searchRevision;
    active.current = true;
    void load();
    return () => { active.current = false; ++loadVersion.current; ++searchVersion.current; };
  }, [load]);

  const search = async () => {
    if (!userId || locked.current || !keyword.trim()) return;
    const version = ++searchRevision.current;
    locked.current = true;
    setBusy(true);
    try {
      const { data, error } = await searchProfilesByTag(keyword, userId);
      if (!active.current || version !== searchRevision.current) return;
      if (error) { notify('검색하지 못했어요', error.message); return; }
      const already = new Set(friends.map((friend) => friend.profileId));
      setCandidates((data ?? []).filter((person) => !already.has(person.id)));
      setSearched(true);
    } finally { locked.current = false; if (active.current) setBusy(false); }
  };

  const add = async (person: Candidate) => {
    if (!userId || locked.current) return;
    locked.current = true;
    setBusy(true);
    dismissToast();
    try {
      const error = await addFriend(userId, person.id);
      if (!active.current) return;
      if (error) { notify('추가 실패', error.message); return; }
      setCandidates((previous) => previous.filter((item) => item.id !== person.id));
      setSearched(false);
      await load();
      if (active.current) showToast({ message: person.name + '님을 메이트로 추가했어요' });
    } finally { locked.current = false; if (active.current) setBusy(false); }
  };

  const remove = async (friend: Friend) => {
    if (!userId || locked.current) return;
    locked.current = true;
    setBusy(true);
    dismissToast();
    ++revision.current;
    setFriends((previous) => previous.filter((item) => item.id !== friend.id));
    try {
      // Persist immediately: termination during the undo window leaves no pending delete.
      // Undo inserts a new follows row, so reload its new id before allowing another delete.
      const error = await removeFriend(friend.id);
      if (!active.current) return;
      if (error) {
        notify('삭제 실패', error.message);
        await load();
        return;
      }
      showToast({
        message: friend.name + '님을 메이트에서 뺐어요. 되돌리기는 마지막 삭제만 가능해요',
        actionLabel: '되돌리기',
        onAction: async () => {
          if (locked.current || !active.current) return;
          locked.current = true;
          setBusy(true);
          try {
            // TODO(서버 단계): addFriend가 role을 mate로 고정한다. 다른 role의 삭제 복구에는 기존 role 보존 계약이 필요하다.
            const restoreError = await addFriend(userId, friend.profileId);
            if (!active.current) return;
            if (restoreError) notify('복구 실패', restoreError.message);
            await load();
          } finally { locked.current = false; if (active.current) setBusy(false); }
        },
      });
    } finally { locked.current = false; if (active.current) setBusy(false); }
  };

  return <ProfileFrame title="내 친구 관리">
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={shared.row}>
        <View style={styles.searchBox}><Search size={18} color={colors.sub} aria-hidden={true} />
          <TextInput accessibilityLabel="닉네임 또는 유저 코드" style={styles.input} value={keyword}
            onChangeText={(text) => { setKeyword(text); ++searchRevision.current; setCandidates([]); setSearched(false); }}
            placeholder="닉네임 또는 @user-코드" placeholderTextColor={colors.sub} autoCapitalize="none" returnKeyType="search" onSubmitEditing={() => void search()} />
        </View>
        <SecondaryButton label="찾기" style={styles.searchButton} loading={busy} disabled={!keyword.trim()} onPress={() => void search()} />
      </View>
      <Text style={shared.sub}>닉네임이나 @로 시작하는 유저 코드로 찾아서 추가하세요.</Text>
      {searched && candidates.length === 0 ? <View style={styles.result}><Text style={shared.sub}>찾은 사람이 없어요</Text></View> : null}
      {candidates.map((person) => <View key={person.id} style={styles.result}>
        <Avatar name={person.name} seed={person.id} size={44} />
        <View style={shared.grow}><Text style={shared.title}>{person.name}</Text><Text style={shared.sub}>@{person.tag}</Text></View>
        <SecondaryButton label="추가" accessibilityLabel={person.name + ' 메이트 추가'} style={styles.addButton} disabled={busy} onPress={() => void add(person)} />
      </View>)}
      <View testID="profile-mates-card" style={styles.card}>
        <Text style={styles.heading}>메이트 {friends.length}명</Text>
        {loadError ? <Text style={styles.empty}>친구 목록을 불러오지 못했어요: {loadError}</Text>
          : friends.length === 0 ? <Text style={styles.empty}>아직 등록된 메이트가 없어요</Text>
          : friends.map((friend) => <View key={friend.id} style={styles.mate}>
            <Avatar name={friend.name} seed={friend.profileId} size={44} />
            <View style={shared.grow}><Text style={shared.title}>{friend.name}</Text><Text style={shared.sub}>@{friend.tag}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel={friend.name + ' 삭제'} accessibilityState={{ disabled: busy }} disabled={busy}
              onPress={() => void remove(friend)} style={({ pressed }) => [shared.iconButton, pressed && shared.pressed]}><X size={18} color={colors.sub} aria-hidden={true} /></Pressable>
          </View>)}
      </View>
      {/* TODO(서버 단계): 함께 먹은 횟수·학과는 제공되지 않아 기존 유저 코드만 표시한다. */}
      {/* TODO(서버 단계): 초대 공유 계약이 없어 메이트 초대 버튼은 표시하지 않는다. */}
    </ScrollView>
    <Toast {...toastProps} />
  </ProfileFrame>;
}
const styles = StyleSheet.create({
  body: { paddingTop: 8, paddingHorizontal: 20, paddingBottom: 120, gap: 14 },
  searchBox: { flex: 1, minWidth: 0, minHeight: v3Layout.fieldHeight, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, gap: 6, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minWidth: 0, height: v3Layout.fieldHeight, padding: 0, fontFamily: fontFamily.body, fontSize: 16, color: colors.ink },
  searchButton: { width: 72, paddingHorizontal: 8 },
  result: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.surface },
  addButton: { width: 72, minHeight: 44, paddingVertical: 8, paddingHorizontal: 8 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingTop: 8, paddingRight: 8, paddingBottom: 8, paddingLeft: 16 },
  heading: { paddingVertical: 8, fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22, color: colors.ink },
  mate: { minHeight: v3Layout.rowHeight, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 12 },
  empty: { paddingVertical: 16, fontFamily: fontFamily.body, fontSize: 13, lineHeight: 20, color: colors.sub },
});
