import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import BottomSheet from '../../components/BottomSheet';
import { CompleteButton } from '../../components/ui/Button';
import { BREAKTIME_NOTICE, hasBreaktimeRisk } from '../../lib/breaktime';
import type { MyLocation } from '../../lib/myLocation';
import { ro } from '../../lib/particle';
import { buildPlaceCandidates } from '../../lib/placeCandidates';
import { fetchRoom } from '../../lib/rooms';
import { supabase } from '../../lib/supabase';
import { describeBasis } from '../../lib/tasteKeywords';
import { seedVotingOptions } from '../../lib/voting';
import { useMyProfile } from '../../profile/useMyProfile';
import type {
  PlacePick,
  ScheduleRecommendResponse,
  SlotPick,
} from '../schedule/scheduleTypes';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

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

type Props = {
  visible: boolean;
  roomId: string | null;
  title: string;
  onClose: () => void;
  onConfirm: (text: string) => void;
};

/**
 * 일정 조율이 끝난 뒤 올라오는 결과 시트.
 *
 * 시간과 식당을 따로 고른다. 시간은 참석 인원으로, 식당은 취향과 거리로
 * 평가한 값이 각각 온다. 확정하면 추천 식당들이 메뉴 투표로 올라간다 —
 * 영업시간을 알 수 없으니 마지막 한 걸음은 사람이 고르는 편이 정확하다.
 */
export default function RecommendSheet({ visible, roomId, title, onClose, onConfirm }: Props) {
  const { bundle } = useMyProfile();

  const [slotPicks, setSlotPicks] = useState<SlotPick[]>([]);
  const [placePicks, setPlacePicks] = useState<PlacePick[]>([]);
  const [slotIndex, setSlotIndex] = useState(0);
  const [placeIndex, setPlaceIndex] = useState(0);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [basis, setBasis] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    if (!roomId) return;

    const profile = bundle?.privateProfile;
    if (!profile?.startLat || !profile?.startLng) {
      setErrorMessage('사는 곳을 먼저 설정해 주세요. 프로필 → 사는 곳 설정.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const room = await fetchRoom(roomId);
      const memberIds = (room.data?.participants ?? [])
        .map((participant) => participant.profileId)
        .filter((id): id is string => Boolean(id));

      const origin: MyLocation = {
        name: profile.startLocationName?.trim() || '사는 곳',
        address: '',
        lat: profile.startLat,
        lng: profile.startLng,
        fromGps: false,
      };

      const candidates = await buildPlaceCandidates(memberIds, origin);

      if (!candidates) {
        setErrorMessage('출발지가 저장된 사람이 없어요.');
        return;
      }

      if (candidates.candidates.length === 0) {
        setErrorMessage('중간 지점 근처에서 식당을 찾지 못했어요.');
        return;
      }

      setBasis(describeBasis(candidates.midpoint.contributorCount, candidates.keywords[0]));

      const { data, error } = await supabase.functions.invoke('schedule-recommend', {
        body: {
          meetingName: title,
          roomId,
          placeCandidates: candidates.candidates,
        },
        timeout: INVOKE_TIMEOUT_MS,
      });

      if (error) throw error;

      const response = data as ScheduleRecommendResponse;
      if (
        !response ||
        !Array.isArray(response.slotRecommendations) ||
        !Array.isArray(response.placeRecommendations)
      ) {
        throw new Error('추천 응답 형식이 올바르지 않습니다.');
      }

      setSlotPicks([...response.slotRecommendations].sort((a, b) => a.rank - b.rank));
      setPlacePicks([...response.placeRecommendations].sort((a, b) => a.rank - b.rank));
      setSlotIndex(0);
      setPlaceIndex(0);
    } catch (error) {
      console.error('schedule recommendation error:', error);
      /*
       * FunctionsHttpError 는 본문을 삼키고 "non-2xx" 만 남긴다. 원인을 알 수
       * 있게 본문을 읽어 서버가 준 문구를 그대로 보여 준다.
       */
      const detail = await readFunctionError(error);
      setErrorMessage(detail ?? 'AI 추천을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, [roomId, title, bundle]);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const chosenSlot = slotPicks[slotIndex];
  const chosenPlace = placePicks[placeIndex];

  const confirm = async () => {
    if (!roomId || !chosenSlot || !chosenPlace) return;

    setApplying(true);
    try {
      /* 추천 식당을 전부 메뉴 투표에 올려 둔다 — 마지막 선택은 방에서 한다 */
      await seedVotingOptions(
        roomId,
        'menu',
        placePicks.map((pick) => pick.place.name),
      );

      const place = chosenPlace.place.name;
      onConfirm(
        `${chosenSlot.slot.label} · ${place}${ro(place)} 추천됐어요. 메뉴 투표에서 골라 주세요`,
      );
      onClose();
    } finally {
      setApplying(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      title="AI 맞춤 추천"
      subtitle={basis ?? '모인 일정으로 추천을 만들어요'}
      onClose={onClose}>
      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.stateText}>가능한 시간을 분석하고 있어요.</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.stateBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable style={styles.retry} onPress={() => void load()}>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.body}>
          <Text style={styles.section}>언제 만날까요</Text>

          {slotPicks.map((pick, i) => (
            <Pick
              key={pick.slot.id}
              on={i === slotIndex}
              rank={pick.rank}
              score={pick.score}
              heading={pick.slot.label}
              meta={
                pick.rainChance === null
                  ? `${pick.availableCount} / ${pick.totalCount}명 가능`
                  : `${pick.availableCount} / ${pick.totalCount}명 가능 · 강수 ${pick.rainChance}%`
              }
              reason={pick.reason}
              warn={hasBreaktimeRisk(pick.slot.startTime) ? BREAKTIME_NOTICE : null}
              onPress={() => setSlotIndex(i)}
            />
          ))}

          <Text style={styles.section}>어디서 먹을까요</Text>

          {placePicks.map((pick, i) => (
            <Pick
              key={`${pick.rank}-${pick.place.name}`}
              on={i === placeIndex}
              rank={pick.rank}
              score={pick.score}
              heading={pick.place.name}
              meta={pick.place.address ?? ''}
              reason={pick.reason}
              warn={null}
              onPress={() => setPlaceIndex(i)}
            />
          ))}
        </ScrollView>
      )}

      <CompleteButton
        label={applying ? '방에 올리는 중' : '이 추천으로 정하기'}
        showNext
        style={styles.cta}
        disabled={applying || loading || !chosenSlot || !chosenPlace}
        onPress={() => void confirm()}
      />
    </BottomSheet>
  );
}

/** 시간과 식당 카드는 모양이 같다 — 안에 들어가는 문구만 다르다 */
function Pick({
  on,
  rank,
  score,
  heading,
  meta,
  reason,
  warn,
  onPress,
}: {
  on: boolean;
  rank: number;
  score: number;
  heading: string;
  meta: string;
  reason: string;
  warn: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.card, on && styles.cardOn]} onPress={onPress}>
      <View style={styles.head}>
        <View style={[styles.chip, on && styles.chipOn]}>
          <Text style={[styles.chipText, on && styles.chipTextOn]}>{rank}순위</Text>
        </View>

        <Text style={styles.heading} numberOfLines={1}>
          {heading}
        </Text>

        <Text style={[styles.score, on && styles.scoreOn]}>{Math.round(score)}%</Text>
      </View>

      {meta ? (
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}

      <Text style={styles.reason}>{reason}</Text>

      {warn ? <Text style={styles.warn}>{warn}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    marginTop: s(6),
    maxHeight: s(230),
  },
  section: {
    marginTop: s(6),
    marginBottom: s(3),
    fontFamily: fontFamily.body,
    fontSize: fs(8.5),
    lineHeight: fs(11.5),
    fontWeight: weight.semibold,
    color: colors.textPrimary,
  },
  card: {
    marginBottom: s(4),
    backgroundColor: colors.card,
    borderRadius: s(8),
    borderWidth: s(0.8),
    borderColor: colors.border,
    paddingHorizontal: s(9),
    paddingVertical: s(8),
  },
  cardOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
  },
  chip: {
    paddingHorizontal: s(5),
    paddingVertical: s(2),
    borderRadius: s(5),
    backgroundColor: colors.surface,
  },
  chipOn: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    fontWeight: weight.bold,
    color: colors.textMuted,
  },
  chipTextOn: {
    color: colors.textOnAccent,
  },
  heading: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    lineHeight: fs(11),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  score: {
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    lineHeight: fs(11),
    fontWeight: weight.extrabold,
    color: colors.textMuted,
  },
  scoreOn: {
    color: colors.primary,
  },
  meta: {
    marginTop: s(3),
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8.5),
    color: colors.textMuted,
  },
  reason: {
    marginTop: s(3),
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9.5),
    color: colors.textPrimary,
  },
  warn: {
    marginTop: s(3),
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8.5),
    color: colors.danger,
  },
  stateBox: {
    marginTop: s(20),
    marginBottom: s(20),
    alignItems: 'center',
    gap: s(6),
  },
  stateText: {
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: colors.textMuted,
  },
  errorText: {
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: colors.danger,
  },
  retry: {
    paddingHorizontal: s(10),
    paddingVertical: s(4),
    borderRadius: s(8),
    backgroundColor: colors.primary,
  },
  retryText: {
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    fontWeight: weight.bold,
    color: colors.textOnAccent,
  },
  cta: {
    marginTop: s(8),
  },
});
