import { CalendarDays, MapPin, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/AuthProvider';
import AppHeader from '../../components/AppHeader';
import { CompleteButton } from '../../components/ui/Button';
import type { MyLocation } from '../../lib/myLocation';
import { createRoom, inviteFriendToRoom } from '../../lib/rooms';
import { seedVotingOptions } from '../../lib/voting';
import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors, shadows } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';
import type { CandidateSlot } from './scheduleTypes';

const moa = require('../../../assets/brand/moa.png');

type Params = {
  name?: string;
  invitees?: string[];
  /** STEP 1 에서 잡은 내 위치 */
  origin?: MyLocation;
  /** STEP 2 에서 고른 내가 가능한 시간 */
  slots?: CandidateSlot[];
  /** 뒤로 갈 때 STEP 2 에 돌려줄 격자 선택 */
  picked?: string[];
};

/**
 * STEP 3 — 방 만들기.
 *
 * 여기서 일정을 확정하지 않는다. 방을 만들고 메이트를 초대한 뒤, 방 안의
 * 일정 조율 투표로 각자 가능한 시간을 모은다. AI 추천은 그 결과가 쌓인 뒤에
 * 돌려야 의미가 있다 — 아무도 답하지 않은 상태에서 낸 추천은 참석 여부가
 * 아니라 "저장된 개인 일정과 안 겹치는 후보" 일 뿐이다.
 */
export default function ScheduleConfirmedScreen() {
  const insets = useSafeAreaInsets();

  const { navigate, goBackWith, current } = useNavigation();

  const { user } = useAuth();

  const params = current.params as Params | undefined;

  const title = params?.name || '새 밥약';
  const invitees = params?.invitees ?? [];
  const origin = params?.origin;
  const slots = params?.slots ?? [];
  const picked = params?.picked ?? [];

  const [creating, setCreating] = useState(false);

  const goPrev = () => goBackWith({ name: title, invitees, origin, picked });

  const openRoom = async () => {
    if (!user?.id) {
      Alert.alert('로그인 필요', '로그인 정보를 확인해 주세요.');
      return;
    }

    if (slots.length === 0) {
      Alert.alert('시간 정보 없음', '가능한 시간을 먼저 골라 주세요.');
      return;
    }

    setCreating(true);

    try {
      /*
       * 아직 언제 만날지 정해지지 않았다. 방이 사라지는 기준으로 쓸 날짜가
       * 필요해서 후보 중 가장 늦은 날을 쓴다 — 조율이 끝나기 전에 방이
       * 없어지면 안 된다.
       */
      const lastDate = slots.reduce(
        (latest, slot) => (slot.date > latest ? slot.date : latest),
        slots[0].date,
      );

      const { roomId, error } = await createRoom({
        ownerId: user.id,
        title,
        meetingDate: lastDate,
        expiresAt: new Date(`${lastDate}T23:59:59`).toISOString(),
      });

      if (error || !roomId) {
        Alert.alert('방 만들기 실패', error?.message ?? '잠시 후 다시 시도해 주세요.');
        return;
      }

      const failed: string[] = [];

      for (const friendId of invitees) {
        const result = await inviteFriendToRoom(roomId, friendId);
        if (result.error) failed.push(friendId);
      }

      if (failed.length > 0) {
        Alert.alert(
          '일부 초대 실패',
          `${failed.length}명을 넣지 못했어요. 방에서 초대 코드를 공유해 주세요.`,
        );
      }

      /*
       * 내가 고른 시간을 일정 조율 투표의 첫 후보로 올린다. 빈 방에서 각자
       * 후보를 만들어 넣게 두면 아무도 시작하지 않는다.
       */
      await seedVotingOptions(
        roomId,
        'time',
        slots.map((slot) => slot.label),
      );

      navigate('ChatRoom', { roomId, title, openSheet: 'schedule' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />

      <AppHeader />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={moa} style={styles.heroImage} resizeMode="contain" />
        </View>

        <Text style={styles.title}>거의 다 됐어요!</Text>

        <Text style={styles.subtitle}>방을 만들고 가능한 시간을 모아 볼까요</Text>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{title}</Text>
          </View>

          <InfoRow
            icon={<CalendarDays size={s(9)} color={colors.primary} strokeWidth={2} />}
            text={`내가 가능한 시간 ${slots.length}개`}
          />

          <InfoRow
            icon={<Users size={s(9)} color={colors.primary} strokeWidth={2} />}
            text={
              invitees.length > 0
                ? `메이트 ${invitees.length}명 초대`
                : '초대 코드로 나중에 부를 수 있어요'
            }
          />

          <InfoRow
            icon={<MapPin size={s(9)} color={colors.primary} strokeWidth={2} />}
            text={origin ? `내 출발지 · ${origin.name}` : '출발지 미설정'}
          />

          <Text style={styles.reason}>
            식당은 메이트들이 시간을 고른 뒤 방에서 AI 추천을 받아요.
          </Text>
        </View>

        <Text style={styles.note}>
          방을 만들면 고른 시간이 일정 조율 투표에 올라가고, 메이트들이 가능한 시간을
          고를 수 있어요.
        </Text>

        <CompleteButton
          label={creating ? '방 만드는 중' : '밥약 방 만들기'}
          showNext
          style={styles.cta}
          disabled={creating || slots.length === 0}
          onPress={() => void openRoom()}
        />

        <Text style={styles.backLink} onPress={goPrev}>
          시간 다시 고르기
        </Text>
      </ScrollView>
    </View>
  );
}

function InfoRow({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <View style={styles.infoRow}>
      {icon}

      <Text style={styles.infoText}>
        {text}
      </Text>
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

  hero: {
    marginTop: s(20),
    alignSelf: 'center',
    width: s(56),
    height: s(56),
    borderRadius: s(14),
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroImage: {
    width: s(34),
    height: s(40),
  },

  title: {
    marginTop: s(10),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(13),
    lineHeight: fs(17),
    fontWeight: weight.extrabold,
    color: colors.textPrimary,
  },

  subtitle: {
    marginTop: s(3),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },

  card: {
    marginTop: s(14),
    marginHorizontal: s(11.5),
    borderRadius: s(10),
    borderWidth: s(0.8),
    borderColor: colors.primary,
    backgroundColor: colors.card,
    paddingHorizontal: s(11),
    paddingVertical: s(10),
    ...shadows.button,
  },

  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  cardTitle: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(10),
    lineHeight: fs(13),
    fontWeight: weight.extrabold,
    color: colors.textPrimary,
  },

  badge: {
    paddingHorizontal: s(6),
    paddingVertical: s(2),
    borderRadius: s(4),
    backgroundColor: colors.primary,
  },

  badgeText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    fontWeight: weight.bold,
    color: colors.textOnAccent,
  },

  infoRow: {
    marginTop: s(7),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
  },

  infoText: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: colors.textPrimary,
  },

  reason: {
    marginTop: s(10),
    paddingTop: s(8),
    borderTopWidth: s(0.6),
    borderTopColor: colors.border,
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },

  errorText: {
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    color: colors.textMuted,
  },

  note: {
    marginTop: s(8),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textMuted,
  },

  /* 되돌아가는 길은 눈에 덜 띄게 — 주된 동작은 방 만들기다 */
  backLink: {
    marginTop: s(10),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: colors.textMuted,
  },
  cta: {
    marginTop: s(12),
    marginHorizontal: s(11.5),
  },
});
