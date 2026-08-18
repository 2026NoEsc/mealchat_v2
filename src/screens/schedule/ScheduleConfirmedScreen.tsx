import {
  CalendarDays,
  MapPin,
  Sparkles,
  Users,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/AuthProvider';
import AppHeader from '../../components/AppHeader';
import { CompleteButton } from '../../components/ui/Button';
import {
  createRoom,
  inviteFriendToRoom,
} from '../../lib/rooms';
import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors, shadows } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';
import type { RecommendationPick } from './scheduleTypes';

const moa = require('../../../assets/brand/moa.png');

type Params = {
  pick?: RecommendationPick;
  name?: string;
  invitees?: string[];
};

export default function ScheduleConfirmedScreen() {
  const insets = useSafeAreaInsets();

  const {
    navigate,
    current,
  } = useNavigation();

  const { user } = useAuth();

  const params =
    current.params as Params | undefined;

  const pick =
    params?.pick;

  const title =
    params?.name || '새 밥약';

  const invitees =
    params?.invitees ?? [];

  const [creating, setCreating] =
    useState(false);

  const openRoom = async () => {
    if (!user?.id) {
      Alert.alert(
        '로그인 필요',
        '로그인 정보를 확인해 주세요.',
      );

      return;
    }

    if (!pick) {
      Alert.alert(
        '일정 정보 없음',
        '확정할 일정 정보가 없습니다.',
      );

      return;
    }

    setCreating(true);

    try {
      const meetingDate =
        pick.slot.date;

      const confirmedSlot =
        `${pick.slot.date} ` +
        `${pick.slot.startTime}~${pick.slot.endTime}` +
        ` · ${pick.place.name}`;

      const {
        roomId,
        error,
      } = await createRoom({
        ownerId: user.id,
        title,
        meetingDate,

        expiresAt: new Date(
          `${meetingDate}T23:59:59`,
        ).toISOString(),

        locationName:
          pick.place.name,

        confirmedSlot,
      });

      if (error || !roomId) {
        Alert.alert(
          '방 만들기 실패',
          error?.message ??
            '잠시 후 다시 시도해 주세요.',
        );

        return;
      }

      const failed: string[] = [];

      for (const friendId of invitees) {
        const result =
          await inviteFriendToRoom(
            roomId,
            friendId,
          );

        if (result.error) {
          failed.push(friendId);
        }
      }

      if (failed.length > 0) {
        Alert.alert(
          '일부 초대 실패',
          `${failed.length}명을 넣지 못했어요. 방에서 초대 코드를 공유해 주세요.`,
        );
      }

      navigate('ChatRoom', {
        roomId,
        title,
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View
        style={{
          height: insets.top,
          backgroundColor: colors.surface,
        }}
      />

      <AppHeader />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Image
            source={moa}
            style={styles.heroImage}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>
          일정이 확정됐어요!
        </Text>

        <Text style={styles.subtitle}>
          선택한 일정으로 채팅방을 만들 수 있어요
        </Text>

        {pick ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>
                {title}
              </Text>

              <View style={styles.badge}>
                <Text
                  style={styles.badgeText}
                >
                  확정
                </Text>
              </View>
            </View>

            <InfoRow
              icon={
                <CalendarDays
                  size={s(9)}
                  color={colors.primary}
                  strokeWidth={2}
                />
              }
              text={formatSlot(pick)}
            />

            <InfoRow
              icon={
                <MapPin
                  size={s(9)}
                  color={colors.primary}
                  strokeWidth={2}
                />
              }
              text={pick.place.name}
            />

            <InfoRow
              icon={
                <Users
                  size={s(9)}
                  color={colors.primary}
                  strokeWidth={2}
                />
              }
              text={
                `${pick.availableCount} / ` +
                `${pick.totalCount}명 참석 가능`
              }
            />

            <InfoRow
              icon={
                <Sparkles
                  size={s(9)}
                  color={colors.primary}
                  strokeWidth={2}
                />
              }
              text={
                `AI 적합도 ${Math.round(
                  pick.score,
                )}%`
              }
            />

            <Text style={styles.reason}>
              {pick.reason}
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.errorText}>
              확정된 일정 정보를 찾을 수 없어요.
            </Text>
          </View>
        )}

        <Text style={styles.note}>
          채팅방으로 이동하면 방을 생성하고 선택한 메이트를 초대해요.
        </Text>

        <CompleteButton
          label={
            creating
              ? '방 만드는 중'
              : '채팅방으로 이동'
          }
          showNext
          style={styles.cta}
          disabled={
            creating || !pick
          }
          onPress={() =>
            void openRoom()
          }
        />
      </ScrollView>
    </View>
  );
}

function formatSlot(
  pick: RecommendationPick,
) {
  const [
    year,
    month,
    day,
  ] = pick.slot.date
    .split('-')
    .map(Number);

  return (
    `${year}년 ${month}월 ${day}일 ` +
    `${pick.slot.startTime}~${pick.slot.endTime}`
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

  cta: {
    marginTop: s(12),
    marginHorizontal: s(11.5),
  },
});