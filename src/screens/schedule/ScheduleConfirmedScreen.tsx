import { CalendarDays, Footprints, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/AuthProvider';
import AppHeader from '../../components/AppHeader';
import { CompleteButton } from '../../components/ui/Button';
import { formatDate, MONTH, YEAR } from '../../lib/calendar';
import { createRoom } from '../../lib/rooms';
import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors, shadows } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

const moa = require('../../../assets/brand/moa.png');
const ddori = require('../../../assets/brand/ddori.png');
const dudu = require('../../../assets/brand/dudu.png');
const welling = require('../../../assets/brand/welling2.png');

const MATES = [moa, dudu, ddori, welling];

type Pick = { when: string; travel: string; place: string };

/**
 * Figma 일정 조율/일정 추가/일정 확정 (160:827)
 * 확정 카드 → 채팅방으로 이동
 */
export default function ScheduleConfirmedScreen() {
  const insets = useSafeAreaInsets();
  const { navigate, current } = useNavigation();
  const { user } = useAuth();
  const params = current.params as
    | { pick?: Pick; name?: string; day?: number }
    | undefined;
  const pick = params?.pick;
  const title = params?.name || '새 밥약';
  const [creating, setCreating] = useState(false);

  /*
   * 여기까지 온 시점에는 아직 방이 없다. 화면에 들어오자마자 만들면 뒤로 갔다
   * 다시 오는 것만으로 빈 방이 쌓이므로, 채팅방으로 이동할 때 한 번만 만든다.
   */
  const openRoom = async () => {
    if (!user?.id) return;

    setCreating(true);
    const meetingDate = `${YEAR}-${String(MONTH).padStart(2, '0')}-${String(params?.day ?? 15).padStart(2, '0')}`;
    const { roomId, error } = await createRoom({
      ownerId: user.id,
      title,
      meetingDate,
      // 약속 다음 날까지 방을 남겨 정산할 시간을 준다
      expiresAt: new Date(`${meetingDate}T23:59:59`).toISOString(),
      locationName: pick?.place ?? null,
      confirmedSlot: pick ? `${pick.when} · ${pick.place}` : null,
    });
    setCreating(false);

    if (error || !roomId) {
      Alert.alert('방 만들기 실패', error?.message ?? '잠시 후 다시 시도해 주세요.');
      return;
    }

    navigate('ChatRoom', { roomId, title });
  };

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: colors.surface }} />
      <AppHeader />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={moa} style={styles.heroImage} resizeMode="contain" />
        </View>

        <Text style={styles.title}>일정이 확정됐어요!</Text>
        <Text style={styles.subtitle}>참여자 모두에게 알림을 보냈어요</Text>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{title}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>확정</Text>
            </View>
          </View>

          <InfoRow
            icon={<CalendarDays size={s(9)} color={colors.primary} strokeWidth={2} />}
            text={`${YEAR}년 ${pick?.when ?? `${formatDate(15)} 18:30`}`}
          />
          <InfoRow
            icon={<MapPin size={s(9)} color={colors.primary} strokeWidth={2} />}
            text={pick?.place ?? '조선칼국수 하단점'}
          />
          <InfoRow
            icon={<Footprints size={s(9)} color={colors.primary} strokeWidth={2} />}
            text={pick?.travel ?? '평균 이동 18분'}
          />

          <View style={styles.mateRow}>
            <View style={styles.stack}>
              {MATES.map((src, i) => (
                <View key={i} style={[styles.stackItem, i > 0 && styles.stackOverlap]}>
                  <Image source={src} style={styles.stackImage} resizeMode="contain" />
                </View>
              ))}
            </View>
            <Text style={styles.attend}>4 / 4명 참석</Text>
          </View>
        </View>

        <Text style={styles.note}>스마트폰 캘린더에 자동 저장했어요</Text>

        <CompleteButton
          label={creating ? '방 만드는 중' : '채팅방으로 이동'}
          showNext
          style={styles.cta}
          disabled={creating}
          onPress={() => void openRoom()}
        />
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.infoRow}>
      {icon}
      <Text style={styles.infoText}>{text}</Text>
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
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: colors.textPrimary,
  },
  mateRow: {
    marginTop: s(10),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
  },
  stack: {
    flexDirection: 'row',
  },
  stackItem: {
    width: s(18),
    height: s(18),
    borderRadius: s(18),
    backgroundColor: colors.primarySoft,
    borderWidth: s(0.8),
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stackOverlap: {
    marginLeft: s(-5),
  },
  stackImage: {
    width: s(12),
    height: s(14),
  },
  attend: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
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
