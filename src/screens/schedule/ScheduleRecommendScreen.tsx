import {
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppHeader from '../../components/AppHeader';
import BackButton from '../../components/BackButton';
import { CompleteButton } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors, shadows } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';
import type {
  CandidateSlot,
  RecommendationPick,
  SchedulePlace,
  ScheduleRecommendResponse,
} from './scheduleTypes';

/*
 * Edge Function 은 최악의 경우 20 초짜리 시도를 세 번 하고 사이에 백오프가 붙어
 * 약 61 초까지 간다. 그보다 짧게 끊으면 서버는 아직 답을 만드는 중인데 앱만
 * 포기하는 꼴이라 여유를 두고 70 초로 잡는다. 이 값을 주지 않으면 안드로이드는
 * OkHttp 타임아웃이 0(무제한)이라 스피너가 영영 돌 수 있다.
 */
const INVOKE_TIMEOUT_MS = 70_000;

const GENERIC_FAILURE =
  "AI 추천을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";

/*
 * functions-js 는 함수가 2xx 가 아니면 FunctionsHttpError 를 돌려주는데 message 가
 * 'Edge Function returned a non-2xx status code' 로 고정이라, 그대로 쓰면 한국어
 * 화면에 영어 내부 문구가 그대로 뜬다. 실제 사유는 응답 본문의 error 에 있다.
 * Response 인지 instanceof 로 보지 않는 것은 RN 과 웹의 전역 구현이 달라서다.
 */
async function describeInvokeError(
  error: unknown,
): Promise<string> {
  const context = (
    error as { context?: unknown } | null
  )?.context;

  if (
    context &&
    typeof (context as Response).json ===
      "function"
  ) {
    try {
      const body = await (
        context as Response
      ).json();

      const message = (
        body as { error?: unknown }
      )?.error;

      if (
        typeof message === "string" &&
        message.trim()
      ) {
        return message;
      }
    } catch {
      // 본문이 JSON 이 아니면 아래 기본 문구로 넘어간다
    }

    return GENERIC_FAILURE;
  }

  // 타임아웃은 AbortController 로 끊기므로 fetch 실패로 감싸여 들어온다
  const aborted =
    context instanceof Error &&
    (context.name === "AbortError" ||
      context.name === "TimeoutError");

  if (aborted) {
    return "응답이 너무 오래 걸려 중단했어요. 잠시 후 다시 시도해 주세요.";
  }

  if (error instanceof Error) {
    return error.message || GENERIC_FAILURE;
  }

  return GENERIC_FAILURE;
}

type Params = {
  name?: string;
  invitees?: string[];
  place?: SchedulePlace;
  slots?: CandidateSlot[];
  /** STEP 2 의 격자 선택. 뒤로 갈 때 그대로 돌려준다 */
  picked?: string[];
};

export default function ScheduleRecommendScreen() {
  const insets = useSafeAreaInsets();

  const {
    navigate,
    goBackWith,
    current,
  } = useNavigation();

  const params =
    current.params as Params | undefined;

  const name =
    params?.name ?? '새 밥약';

  const invitees =
    params?.invitees ?? [];

  const place =
    params?.place;

  const slots =
    params?.slots ?? [];

  const picked =
    params?.picked ?? [];

  /* 뒤로 가면 STEP 2 가 새로 마운트되므로 격자 선택을 돌려보낸다 */
  const goPrev = () =>
    goBackWith({ picked });

  const [picks, setPicks] =
    useState<RecommendationPick[]>([]);

  const [selected, setSelected] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [elapsed, setElapsed] =
    useState(0);

  const participantCount =
    invitees.length + 1;

  const loadRecommendations =
    async () => {
      if (!place) {
        setErrorMessage(
          '약속 장소 정보가 없습니다.',
        );
        setLoading(false);
        return;
      }

      if (slots.length === 0) {
        setErrorMessage(
          '선택한 시간이 없습니다.',
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage(null);

      try {
        const {
          data,
          error,
        } =
          await supabase.functions.invoke(
            'schedule-recommend',
            {
              body: {
                meetingName: name,
                inviteeIds: invitees,
                place,
                candidateSlots: slots,
              },

              timeout: INVOKE_TIMEOUT_MS,
            },
          );

        if (error) {
          throw error;
        }

        const response =
          data as ScheduleRecommendResponse;

        if (
          !response ||
          !Array.isArray(
            response.recommendations,
          )
        ) {
          throw new Error(
            '추천 응답 형식이 올바르지 않습니다.',
          );
        }

        const slotMap =
          new Map(
            slots.map((slot) => [
              slot.id,
              slot,
            ]),
          );

        const nextPicks =
          response.recommendations
            .map((recommendation) => {
              const slot =
                slotMap.get(
                  recommendation.slotId,
                );

              if (!slot) {
                return null;
              }

              const pick: RecommendationPick =
                {
                  ...recommendation,
                  slot,
                  place,
                };

              return pick;
            })
            .filter(
              (
                pick,
              ): pick is RecommendationPick =>
                pick !== null,
            )
            .sort(
              (a, b) =>
                a.rank - b.rank,
            );

        if (nextPicks.length === 0) {
          throw new Error(
            '추천 가능한 일정이 없습니다.',
          );
        }

        setPicks(nextPicks);
        setSelected(0);
      } catch (error) {
        console.error(
          'schedule recommendation error:',
          error,
        );

        setPicks([]);

        setErrorMessage(
          await describeInvokeError(error),
        );
      } finally {
        setLoading(false);
      }
    };

  /*
   * 추천 한 번에 20 초가 걸린 적이 있다. 그동안 스피너만 돌면 멈춘 것과 구분되지
   * 않아 사용자가 화면을 벗어난다. 초를 세어 살아 있다는 것을 보여 준다.
   */
  useEffect(() => {
    if (!loading) return;

    setElapsed(0);

    const timer = setInterval(
      () => setElapsed((prev) => prev + 1),
      1000,
    );

    return () => clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    void loadRecommendations();
    // 현재 navigation params는 화면 진입 시 고정된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedPick =
    picks[selected];

  const confirm = () => {
    if (!selectedPick) return;

    navigate('ScheduleConfirmed', {
      pick: selectedPick,
      name,
      invitees,
    });
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
        <View style={styles.titleRow}>
          <BackButton
            onPress={goPrev}
            style={styles.back}
          />

          <Text style={styles.title}>
            AI 맞춤 추천
          </Text>

          <Text style={styles.basis}>
            {participantCount}명 기준
          </Text>
        </View>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator
              size="small"
              color={colors.primary}
            />

            <Text style={styles.stateText}>
              가능한 시간을 분석하고 있어요.
            </Text>

            {elapsed >= 5 ? (
              <Text style={styles.stateHint}>
                {elapsed}초째 기다리는 중이에요.
                최대 1분까지 걸릴 수 있어요.
              </Text>
            ) : null}
          </View>
        ) : errorMessage ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>
              {errorMessage}
            </Text>

            <Pressable
              style={styles.retryButton}
              onPress={() =>
                void loadRecommendations()
              }
            >
              <Text style={styles.retryText}>
                다시 시도
              </Text>
            </Pressable>
          </View>
        ) : (
          picks.map((pick, i) => {
            const on =
              i === selected;

            const travelText =
              pick.averageTravelMinutes !==
              null
                ? `평균 이동 ${pick.averageTravelMinutes}분`
                : null;

            return (
              <Pressable
                key={pick.slotId}
                style={[
                  styles.card,
                  on && styles.cardOn,
                ]}
                onPress={() =>
                  setSelected(i)
                }
              >
                <View
                  style={styles.cardHead}
                >
                  <View
                    style={[
                      styles.rankChip,
                      on &&
                        styles.rankChipOn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rankText,
                        on &&
                          styles.rankTextOn,
                      ]}
                    >
                      {pick.rank}순위
                    </Text>
                  </View>

                  <Text
                    style={styles.when}
                  >
                    {pick.slot.label}
                  </Text>

                  <Text
                    style={[
                      styles.score,
                      on &&
                        styles.scoreOn,
                    ]}
                  >
                    {Math.round(
                      pick.score,
                    )}
                    %
                  </Text>
                </View>

                <View style={styles.bar}>
                  <View
                    style={[
                      styles.barFill,
                      on &&
                        styles.barFillOn,
                      {
                        width: `${Math.max(
                          0,
                          Math.min(
                            100,
                            pick.score,
                          ),
                        )}%`,
                      },
                    ]}
                  />
                </View>

                <Text style={styles.meta}>
                  {pick.availableCount} /{' '}
                  {pick.totalCount}명 참석 가능
                  {' · '}
                  {Math.round(
                    pick.attendanceRate *
                      100,
                  )}
                  %
                </Text>

                {travelText ? (
                  <Text style={styles.meta}>
                    {travelText}
                  </Text>
                ) : null}

                <Text
                  style={styles.reason}
                >
                  {pick.reason}
                </Text>

                <Text
                  style={styles.place}
                >
                  {pick.place.name}
                </Text>
              </Pressable>
            );
          })
        )}

        {!loading &&
        !errorMessage &&
        selectedPick ? (
          <CompleteButton
            label={`${selectedPick.rank}순위로 확정하기`}
            showNext
            style={styles.cta}
            onPress={confirm}
          />
        ) : null}
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

  titleRow: {
    marginTop: s(9),
    marginHorizontal: s(11.5),
    flexDirection: 'row',
    alignItems: 'center',
  },

  back: {
    // 공통 헤더와 같은 간격 (칩 오른쪽 9)
    marginRight: s(9),
  },

  title: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(12),
    lineHeight: fs(16),
    fontWeight: weight.extrabold,
    color: colors.textPrimary,
  },

  basis: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },

  stateBox: {
    marginTop: s(20),
    marginHorizontal: s(11.5),
    minHeight: s(100),
    borderRadius: s(10),
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(16),
    gap: s(8),
  },

  stateText: {
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: colors.textMuted,
  },
  stateHint: {
    marginTop: s(4),
    textAlign: "center",
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(9),
    color: colors.textMuted,
  },

  errorText: {
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: colors.textPrimary,
  },

  retryButton: {
    paddingHorizontal: s(10),
    paddingVertical: s(5),
    borderRadius: s(7),
    backgroundColor: colors.primary,
  },

  retryText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    fontWeight: weight.bold,
    color: colors.textOnAccent,
  },

  card: {
    marginTop: s(12),
    marginHorizontal: s(11.5),
    borderRadius: s(8),
    backgroundColor: colors.card,
    borderWidth: s(0.6),
    borderColor: colors.border,
    paddingHorizontal: s(9),
    paddingVertical: s(8),
    gap: s(4),
    ...shadows.button,
  },

  cardOn: {
    borderWidth: s(1),
    borderColor: colors.primary,
  },

  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
  },

  rankChip: {
    paddingHorizontal: s(5),
    paddingVertical: s(2),
    borderRadius: s(4),
    backgroundColor: colors.surfaceSunken,
  },

  rankChipOn: {
    backgroundColor: colors.primary,
  },

  rankText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.3),
    lineHeight: fs(9),
    fontWeight: weight.semibold,
    color: '#696969',
  },

  rankTextOn: {
    color: colors.textOnAccent,
  },

  when: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    lineHeight: fs(11),
    fontWeight: weight.semibold,
    color: colors.textPrimary,
  },

  score: {
    fontFamily: fontFamily.body,
    fontSize: fs(9.5),
    lineHeight: fs(13),
    fontWeight: weight.extrabold,
    color: colors.textMuted,
  },

  scoreOn: {
    color: colors.primary,
  },

  bar: {
    height: s(3),
    borderRadius: s(999),
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },

  barFill: {
    height: s(3),
    borderRadius: s(999),
    backgroundColor: '#B4B2A8',
  },

  barFillOn: {
    backgroundColor: colors.primary,
  },

  meta: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(8.5),
    color: '#696969',
  },

  reason: {
    marginTop: s(2),
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textPrimary,
  },

  place: {
    marginTop: s(3),
    fontFamily: fontFamily.body,
    fontSize: fs(7.2),
    lineHeight: fs(10),
    fontWeight: weight.semibold,
    color: colors.textPrimary,
  },

  cta: {
    marginTop: s(16),
    marginHorizontal: s(11.5),
  },
});