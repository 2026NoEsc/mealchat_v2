import { CalendarDays, MapPin, Sparkles, Users } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppHeader from '../../components/AppHeader';
import { CompleteButton } from '../../components/ui/Button';
import { BREAKTIME_NOTICE, hasBreaktimeRisk } from '../../lib/breaktime';
import type { MyLocation } from '../../lib/myLocation';
import { buildPlaceCandidates } from '../../lib/placeCandidates';
import { advanceRoomStage, fetchRoom } from '../../lib/rooms';
import { formatSlotDate } from '../../lib/scheduleSlots';
import { supabase } from '../../lib/supabase';
import { describeBasis } from '../../lib/tasteKeywords';
import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors, shadows } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import type { ScheduleRecommendResponse, SlotPick } from './scheduleTypes';

const moa = require('../../../assets/brand/moa.png');

/*
 * Edge Function 은 최악의 경우 20 초짜리 시도를 세 번 하고 사이에 백오프가 붙어
 * 약 61 초까지 간다. 그보다 짧게 끊으면 서버는 아직 답을 만드는 중인데 앱만
 * 포기하는 꼴이라 여유를 두고 70 초로 잡는다.
 */
const INVOKE_TIMEOUT_MS = 70_000;

/** supabase-js 가 감싼 오류에서 서버가 보낸 문구를 꺼낸다 */
async function readFunctionError(error: unknown): Promise<string | null> {
  const context = (error as { context?: unknown })?.context;
  if (!(context instanceof Response)) return null;

  try {
    const body = await context.clone().json();
    const message = (body as { error?: unknown })?.error;
    return typeof message === 'string' && message.trim() ? message : null;
  } catch {
    return null;
  }
}

type Params = {
  roomId?: string;
  name?: string;
  invitees?: string[];
  origin?: MyLocation;
};

/**
 * STEP 3 — AI 일정 추천과 확정.
 *
 * 방은 STEP 1 에서 이미 만들어졌고 STEP 2 에서 각자 시간을 냈다. 여기서는 모인
 * 응답으로 시간을 추천받아 하나를 고르고, 확정하면 방이 '식당 결정' 단계로
 * 넘어간다 — 어디서 먹을지는 방 안에서 정한다.
 */
export default function ScheduleConfirmedScreen() {
  const insets = useSafeAreaInsets();

  const { navigate, goBackWith, current } = useNavigation();

  const params = current.params as Params | undefined;

  const roomId = params?.roomId ?? null;
  const title = params?.name || '새 밥약';
  const invitees = params?.invitees ?? [];
  const origin = params?.origin;

  const [picks, setPicks] = useState<SlotPick[]>([]);
  const [selected, setSelected] = useState(0);
  const [basis, setBasis] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    if (!roomId || !origin) {
      setErrorMessage('방 정보가 없습니다.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const room = await fetchRoom(roomId);
      const memberIds = (room.data?.participants ?? [])
        .map((participant) => participant.profileId)
        .filter((id): id is string => Boolean(id));

      /*
       * 식당은 여기서 정하지 않지만, 엣지 함수가 후보를 요구한다 — 시간과 식당을
       * 한 번에 평가하기 때문이다. 여기서는 시간 추천만 쓰고 식당은 버린다.
       */
      const candidates = await buildPlaceCandidates(memberIds, origin);

      if (!candidates || candidates.candidates.length === 0) {
        setErrorMessage('중간 지점 근처에서 후보를 찾지 못했어요.');
        return;
      }

      setBasis(describeBasis(candidates.midpoint.contributorCount, candidates.keywords[0]));

      const { data, error } = await supabase.functions.invoke('schedule-recommend', {
        body: { meetingName: title, roomId, placeCandidates: candidates.candidates },
        timeout: INVOKE_TIMEOUT_MS,
      });

      if (error) throw error;

      const response = data as ScheduleRecommendResponse;
      if (!response || !Array.isArray(response.slotRecommendations)) {
        throw new Error('추천 응답 형식이 올바르지 않습니다.');
      }

      setPicks([...response.slotRecommendations].sort((a, b) => a.rank - b.rank));
      setSelected(0);
    } catch (error) {
      console.error('schedule recommendation error:', error);
      const detail = await readFunctionError(error);
      setErrorMessage(detail ?? 'AI 추천을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, [roomId, origin, title]);

  useEffect(() => {
    void load();
  }, [load]);

  const goPrev = () => goBackWith({ roomId, name: title, invitees, origin });

  const chosen = picks[selected];

  /*
   * 일정을 확정하고 방을 '식당 결정' 단계로 넘긴다. 되돌릴 수 없어서 한 번 묻는다.
   */
  const confirmPlan = async () => {
    if (!roomId || !chosen) return;

    setConfirming(true);
    try {
      const { error } = await advanceRoomStage(roomId, 'place');
      if (error) {
        Alert.alert('확정하지 못했어요', error.message);
        return;
      }

      navigate('ChatRoom', { roomId, title, openSheet: 'menu' });
    } finally {
      setConfirming(false);
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

        <Text style={styles.title}>언제가 좋을까요?</Text>
        <Text style={styles.subtitle}>{basis ?? '모인 일정으로 시간을 추천해 드려요'}</Text>

        {loading ? (
          <View style={styles.card}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.note}>가능한 시간을 분석하고 있어요.</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.card}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable style={styles.retry} onPress={() => void load()}>
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : (
          picks.map((pick, i) => {
            const on = i === selected;

            return (
              <Pressable
                key={pick.slot.id}
                style={[styles.card, styles.pick, on && styles.pickOn]}
                onPress={() => setSelected(i)}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>{pick.rank}순위</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{Math.round(pick.score)}%</Text>
                  </View>
                </View>

                <InfoRow
                  icon={<CalendarDays size={s(9)} color={colors.primary} strokeWidth={2} />}
                  text={formatSlotDate(pick.slot)}
                />

                <InfoRow
                  icon={<Users size={s(9)} color={colors.primary} strokeWidth={2} />}
                  text={`${pick.availableCount} / ${pick.totalCount}명 참석 가능`}
                />

                {pick.rainChance !== null ? (
                  <InfoRow
                    icon={<Sparkles size={s(9)} color={colors.primary} strokeWidth={2} />}
                    text={`강수 확률 ${pick.rainChance}%`}
                  />
                ) : null}

                <Text style={styles.reason}>{pick.reason}</Text>

                {hasBreaktimeRisk(pick.slot.startTime) ? (
                  <Text style={styles.warn}>{BREAKTIME_NOTICE}</Text>
                ) : null}
              </Pressable>
            );
          })
        )}

        {!loading && !errorMessage && origin ? (
          <View style={styles.card}>
            <InfoRow
              icon={<MapPin size={s(9)} color={colors.primary} strokeWidth={2} />}
              text={`내 출발지 · ${origin.name}`}
            />
            <Text style={styles.note}>식당은 확정한 뒤 방에서 함께 정해요.</Text>
          </View>
        ) : null}

        <CompleteButton
          label={confirming ? '확정하는 중' : '이 시간으로 확정하기'}
          showNext
          style={styles.cta}
          disabled={confirming || loading || !chosen}
          onPress={() => void confirmPlan()}
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
    fontFamily: fontFamily.extrabold,
    fontSize: fs(13),
    lineHeight: fs(17),
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
    fontFamily: fontFamily.extrabold,
    fontSize: fs(10),
    lineHeight: fs(13),
    color: colors.textPrimary,
  },

  badge: {
    paddingHorizontal: s(6),
    paddingVertical: s(2),
    borderRadius: s(4),
    backgroundColor: colors.primary,
  },

  badgeText: {
    fontFamily: fontFamily.bold,
    fontSize: fs(6),
    lineHeight: fs(8),
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
  /* 고른 순위는 테두리로 표시한다 — 카드가 여러 장이라 한눈에 갈려야 한다 */
  pick: {
    marginTop: s(6),
    borderWidth: s(0.8),
    borderColor: colors.border,
  },
  pickOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  warn: {
    marginTop: s(4),
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.danger,
  },
  retry: {
    marginTop: s(8),
    alignSelf: 'center',
    paddingHorizontal: s(12),
    paddingVertical: s(5),
    borderRadius: s(8),
    backgroundColor: colors.primary,
  },
  retryText: {
    fontFamily: fontFamily.bold,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: colors.textOnAccent,
  },

  cta: {
    marginTop: s(12),
    marginHorizontal: s(11.5),
  },
});
