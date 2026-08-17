import { ChevronDown, UserMinus } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/AuthProvider';
import AppHeader from '../../components/AppHeader';
import {
  addFriend,
  fetchMyFriends,
  removeFriend,
  searchProfilesByTag,
  type Friend,
} from '../../lib/friends';
import Toggle from '../../components/ui/Toggle';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

/** friends.ts 의 검색 결과 행 */
type SearchedProfile = { id: string; name: string; tag: string; avatar_color: string };

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [friends, setFriends] = useState<Friend[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [candidates, setCandidates] = useState<SearchedProfile[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await fetchMyFriends(userId);
    setFriends(data ?? []);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * 추천 목록을 만들 근거가 없다 — "같은 학과", "2번 함께 먹음" 같은 데이터가
   * 스키마에 없다. 대신 태그나 이름으로 직접 찾게 한다.
   */
  const search = async () => {
    if (!userId) return;
    setBusy(true);
    const { data } = await searchProfilesByTag(keyword, userId);
    setBusy(false);

    const already = new Set(friends.map((friend) => friend.profileId));
    setCandidates((data ?? []).filter((profile) => !already.has(profile.id)));
  };

  const add = async (targetId: string) => {
    if (!userId) return;
    setBusy(true);
    const error = await addFriend(userId, targetId);
    setBusy(false);

    if (error) {
      Alert.alert('추가 실패', error.message);
      return;
    }
    setCandidates((prev) => prev.filter((profile) => profile.id !== targetId));
    void load();
  };

  const remove = async (followId: string) => {
    setBusy(true);
    const error = await removeFriend(followId);
    setBusy(false);

    if (error) {
      Alert.alert('삭제 실패', error.message);
      return;
    }
    void load();
  };

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />
      <AppHeader />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>내 친구 관리</Text>
        <Text style={styles.sub}>함께 밥약을 잡을 메이트 {friends.length}명</Text>

        <View style={styles.card}>
          {friends.length === 0 ? (
            <Text style={styles.empty}>아직 등록된 메이트가 없어요</Text>
          ) : (
            friends.map((friend, i) => (
              <View key={friend.id} style={[styles.row, i > 0 && styles.rowDivided]}>
                <Avatar name={friend.name} color={friend.avatarColor} />
                <View style={styles.rowBody}>
                  <Text style={styles.name}>{friend.name}</Text>
                  <Text style={styles.status}>@{friend.tag}</Text>
                </View>
                <Pressable
                  style={styles.removeButton}
                  hitSlop={s(6)}
                  disabled={busy}
                  onPress={() => void remove(friend.id)}>
                  <UserMinus size={s(9)} color={colors.danger} strokeWidth={2} />
                </Pressable>
              </View>
            ))
          )}
        </View>

        {/* 초대는 별도 화면 대신 이 자리에서 펼쳐지는 토글 목록으로 처리한다 */}
        <Pressable
          style={[styles.inviteToggle, inviteOpen && styles.inviteToggleOpen]}
          onPress={() => setInviteOpen((v) => !v)}>
          <Text style={styles.inviteToggleText}>＋ 메이트 초대</Text>
          <View style={inviteOpen ? styles.chevronOpen : undefined}>
            <ChevronDown size={s(9)} color={colors.textOnAccent} strokeWidth={2.5} />
          </View>
        </Pressable>

        {inviteOpen ? (
          <View style={styles.card}>
            <Text style={styles.inviteHint}>닉네임이나 태그로 찾아서 추가하세요</Text>

            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                value={keyword}
                onChangeText={setKeyword}
                placeholder="닉네임 또는 태그"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                onSubmitEditing={() => void search()}
              />
              <Pressable style={styles.searchButton} disabled={busy} onPress={() => void search()}>
                <Text style={styles.searchButtonText}>찾기</Text>
              </Pressable>
            </View>

            {candidates.length === 0 ? (
              <Text style={styles.inviteHint}>
                {keyword.trim() ? '찾은 사람이 없어요' : ' '}
              </Text>
            ) : (
              candidates.map((person, i) => (
                <View key={person.id} style={[styles.row, i > 0 && styles.rowDivided]}>
                  <Avatar name={person.name} color={person.avatar_color} />
                  <View style={styles.rowBody}>
                    <Text style={styles.name}>{person.name}</Text>
                    <Text style={styles.status}>@{person.tag}</Text>
                  </View>
                  <Toggle value={false} onChange={() => void add(person.id)} size="sm" />
                </View>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** 아바타 업로드가 없어 avatar_color 원에 이름 첫 글자를 넣는다 */
function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <View style={[styles.avatarBox, { backgroundColor: color }]}>
      <Text style={styles.avatarInitial}>{[...name.trim()][0] ?? '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceSunken,
  },
  avatarInitial: {
    fontFamily: fontFamily.body,
    fontSize: fs(11),
    fontWeight: weight.bold,
    color: colors.textOnAccent,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    marginBottom: s(8),
  },
  searchInput: {
    flex: 1,
    height: s(22),
    borderRadius: s(8),
    backgroundColor: colors.surfaceSunken,
    paddingHorizontal: s(8),
    paddingVertical: 0,
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    color: colors.textPrimary,
  },
  searchButton: {
    paddingHorizontal: s(10),
    height: s(22),
    borderRadius: s(8),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: {
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    fontWeight: weight.bold,
    color: colors.textOnAccent,
  },
  body: {
    paddingHorizontal: s(11.5),
    paddingTop: s(10),
    paddingBottom: s(20),
  },
  title: {
    fontFamily: fontFamily.body,
    fontSize: fs(12),
    lineHeight: fs(16),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  sub: {
    marginTop: s(7),
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  card: {
    marginTop: s(7),
    backgroundColor: colors.card,
    borderRadius: s(10),
    paddingHorizontal: s(9),
    paddingVertical: s(4),
  },
  row: {
    height: s(34),
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowDivided: {
    borderTopWidth: s(0.6),
    borderTopColor: colors.border,
  },
  avatarBox: {
    width: s(22),
    height: s(22),
    borderRadius: s(7),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: s(14),
    height: s(17),
  },
  rowBody: {
    flex: 1,
    marginLeft: s(8),
  },
  name: {
    fontFamily: fontFamily.body,
    fontSize: fs(7.5),
    lineHeight: fs(10),
    fontWeight: weight.semibold,
    color: colors.textPrimary,
  },
  status: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
  removeButton: {
    width: s(18),
    height: s(18),
    borderRadius: s(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    paddingVertical: s(14),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    color: colors.textMuted,
  },
  inviteToggle: {
    marginTop: s(10),
    height: s(28),
    borderRadius: s(10),
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(5),
  },
  inviteToggleOpen: {
    borderBottomLeftRadius: s(4),
    borderBottomRightRadius: s(4),
  },
  inviteToggleText: {
    fontFamily: fontFamily.body,
    fontSize: fs(9.5),
    lineHeight: fs(13),
    fontWeight: weight.extrabold,
    color: colors.textOnAccent,
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  inviteHint: {
    marginTop: s(6),
    marginBottom: s(2),
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
});
