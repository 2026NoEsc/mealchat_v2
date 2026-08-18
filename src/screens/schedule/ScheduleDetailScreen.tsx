import { Check, MapPin, Plus, Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/AuthProvider';
import AppHeader from '../../components/AppHeader';
import { fetchMyFriends, type Friend } from '../../lib/friends';
import { CompleteButton } from '../../components/ui/Button';
import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors, shadows } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';
import ScheduleStepHeader from './ScheduleStepHeader';


export default function ScheduleDetailScreen() {
  const insets = useSafeAreaInsets();
  const { navigate } = useNavigation();
  const { user } = useAuth();
  const [name, setName] = useState('');

  const [friends, setFriends] = useState<Friend[]>([]);
  const [picked, setPicked] = useState<string[]>([]);

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

  const toggle = (profileId: string) =>
    setPicked((prev) =>
      prev.includes(profileId) ? prev.filter((id) => id !== profileId) : [...prev, profileId],
    );

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />
      <AppHeader />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <ScheduleStepHeader
          step={1}
          title="어떻게 만날까요?"
          subtitle="구체적인 약속 일정을 정해주세요"
        />

        <View style={styles.nameInput}>
          <TextInput
            style={styles.nameText}
            value={name}
            onChangeText={setName}
            placeholder="약속 이름 ( 예: 점심 번개팅 )"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>밥약 메이트 선택</Text>
            <Search size={s(9)} color={colors.primary} strokeWidth={2.5} />
            <Plus size={s(10)} color={colors.primary} strokeWidth={3} />
          </View>

          {friends.length === 0 ? (
            <Text style={styles.mateEmpty}>
              아직 메이트가 없어요. 프로필 → 내 친구 관리에서 추가할 수 있어요.
            </Text>
          ) : (
            <View style={styles.mateRow}>
              {friends.map((friend) => {
                const on = picked.includes(friend.profileId);
                return (
                  <Pressable
                    key={friend.id}
                    style={styles.mate}
                    onPress={() => toggle(friend.profileId)}>
                    <View
                      style={[
                        styles.mateBox,
                        { backgroundColor: friend.avatarColor },
                        on && styles.mateBoxOn,
                      ]}>
                      <Text style={styles.mateInitial}>
                        {[...friend.name.trim()][0] ?? '?'}
                      </Text>
                    </View>
                    <Text style={[styles.mateName, on && styles.mateNameOn]} numberOfLines={1}>
                      {friend.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>약속 장소</Text>
            <View style={styles.mapChip}>
              <Text style={styles.mapChipText}>지도에서 선택</Text>
            </View>
          </View>

          <View style={styles.searchBox}>
            <Search size={s(8)} color={colors.textMuted} strokeWidth={2} />
            <Text style={styles.searchText}>식당 이름 또는 주소 검색</Text>
          </View>

          <View style={styles.placeRow}>
            <View style={styles.placeIcon}>
              <MapPin size={s(10)} color={colors.primary} strokeWidth={2.5} />
            </View>
            <View style={styles.placeBody}>
              <Text style={styles.placeName}>조선칼국수 하단점</Text>
              <Text style={styles.placeMeta}>부산 사하구 하단동 · 도보 8분</Text>
            </View>
            <View style={styles.placeCheck}>
              <Check size={s(7)} color={colors.textOnAccent} strokeWidth={3} />
            </View>
          </View>

          <Text style={styles.note}>메이트 4명의 중간 지점으로 추천했어요</Text>
        </View>

        <CompleteButton
          label="다음"
          showNext
          style={styles.cta}
          onPress={() => navigate('ScheduleTime', { name: name.trim(), invitees: picked })}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceSunken,
  },
  body: {
    paddingBottom: s(16),
  },
  nameInput: {
    marginTop: s(10),
    marginHorizontal: s(11.5),
    height: s(24),
    borderRadius: s(999),
    backgroundColor: colors.card,
    justifyContent: 'center',
    paddingHorizontal: s(12),
  },
  nameText: {
    paddingVertical: 0,
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    color: colors.textPrimary,
  },
  card: {
    marginTop: s(10),
    marginHorizontal: s(11.5),
    borderRadius: s(10),
    backgroundColor: colors.surface,
    paddingHorizontal: s(10),
    paddingVertical: s(9),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
  },
  cardTitle: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(8.5),
    lineHeight: fs(11),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  mateRow: {
    marginTop: s(9),
    flexDirection: 'row',
    gap: s(8),
  },
  mate: {
    alignItems: 'center',
  },
  mateBox: {
    width: s(30),
    height: s(30),
    borderRadius: s(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  mateImage: {
    width: s(20),
    height: s(24),
  },
  mateName: {
    marginTop: s(3),
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textPrimary,
  },
  mapChip: {
    paddingHorizontal: s(6),
    paddingVertical: s(2),
    borderRadius: s(5),
    backgroundColor: colors.primarySoft,
  },
  mapChipText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    fontWeight: weight.semibold,
    color: colors.primary,
  },
  searchBox: {
    marginTop: s(8),
    height: s(20),
    borderRadius: s(999),
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    paddingHorizontal: s(8),
  },
  searchText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  placeRow: {
    marginTop: s(8),
    height: s(32),
    borderRadius: s(8),
    borderWidth: s(0.8),
    borderColor: colors.primary,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(8),
    gap: s(6),
    ...shadows.card,
  },
  placeIcon: {
    width: s(20),
    height: s(20),
    borderRadius: s(6),
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeBody: {
    flex: 1,
  },
  placeName: {
    fontFamily: fontFamily.body,
    fontSize: fs(7.5),
    lineHeight: fs(10),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  placeMeta: {
    marginTop: s(1),
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
  placeCheck: {
    width: s(13),
    height: s(13),
    borderRadius: s(13),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    marginTop: s(6),
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
  cta: {
    marginTop: s(14),
    marginHorizontal: s(11.5),
  },
});
