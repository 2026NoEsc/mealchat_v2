import { ChevronDown, UserMinus } from 'lucide-react-native';
import { useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppHeader from '../../components/AppHeader';
import Toggle from '../../components/ui/Toggle';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

const moa = require('../../../assets/brand/moa.png');
const dudu = require('../../../assets/brand/dudu.png');
const ddori = require('../../../assets/brand/ddori.png');
const welling = require('../../../assets/brand/welling2.png');

type Person = {
  id: string;
  name: string;
  status: string;
  avatar: ImageSourcePropType;
  tint: string;
  friend: boolean;
};

const PEOPLE: Person[] = [
  { id: 'dudu', name: '두두', status: '온라인', avatar: dudu, tint: '#FFE7CA', friend: true },
  { id: 'ddori', name: '또리', status: '3시간 전', avatar: ddori, tint: '#EBF4FF', friend: true },
  { id: 'welling', name: '웰링', status: '온라인', avatar: welling, tint: '#DCF8F2', friend: true },
  { id: 'moa', name: '모아', status: '어제', avatar: moa, tint: '#F2DBFF', friend: true },
  { id: 'nabi', name: '나비', status: '같은 학과', avatar: ddori, tint: '#FFE7CA', friend: false },
  { id: 'kkomi', name: '꼬미', status: '같은 동아리', avatar: welling, tint: '#EBF4FF', friend: false },
  { id: 'bami', name: '바미', status: '2번 함께 먹음', avatar: dudu, tint: '#DCF8F2', friend: false },
];

/**
 * 내 친구 관리.
 *
 * ⚠️ Figma 에 대응 화면이 없어 앱의 기존 표현(프로필 카드 · 채팅방 멤버 행)을
 * 조합해 구성한 화면이다. 디자인이 나오면 좌표 기준으로 다시 맞춰야 한다.
 */
export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const [people, setPeople] = useState(PEOPLE);
  const [inviteOpen, setInviteOpen] = useState(false);

  const friends = people.filter((p) => p.friend);
  const candidates = people.filter((p) => !p.friend);

  const setFriend = (id: string, friend: boolean) =>
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, friend } : p)));

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
                <Avatar person={friend} />
                <View style={styles.rowBody}>
                  <Text style={styles.name}>{friend.name}</Text>
                  <Text style={styles.status}>{friend.status}</Text>
                </View>
                <Pressable
                  style={styles.removeButton}
                  hitSlop={s(6)}
                  onPress={() => setFriend(friend.id, false)}>
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
            <Text style={styles.inviteHint}>
              {candidates.length > 0
                ? '토글을 켜면 바로 메이트로 추가돼요'
                : '초대할 수 있는 사람을 모두 추가했어요'}
            </Text>

            {candidates.map((person, i) => (
              <View key={person.id} style={[styles.row, i > 0 && styles.rowDivided]}>
                <Avatar person={person} />
                <View style={styles.rowBody}>
                  <Text style={styles.name}>{person.name}</Text>
                  <Text style={styles.status}>{person.status}</Text>
                </View>
                <Toggle
                  value={person.friend}
                  onChange={(next) => setFriend(person.id, next)}
                  size="sm"
                />
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Avatar({ person }: { person: Person }) {
  return (
    <View style={[styles.avatarBox, { backgroundColor: person.tint }]}>
      <Image source={person.avatar} style={styles.avatar} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceSunken,
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
