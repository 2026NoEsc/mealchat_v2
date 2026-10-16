import { Clock, CloudRain, Sparkles, Users } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/ui/Button';
import { Radio } from '../../components/ui/Radio';
import { BREAKTIME_NOTICE, hasBreaktimeRisk } from '../../lib/breaktime';
import type { MyLocation } from '../../lib/myLocation';
import { buildPlaceCandidates } from '../../lib/placeCandidates';
import { advanceRoomStage, fetchRoom } from '../../lib/rooms';
import { supabase } from '../../lib/supabase';
import { useNavigation } from '../../navigation/NavigationContext';
import { scheduleColors, scheduleLayout as layout } from '../../theme/scheduleTokens';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import ScheduleFrame from './ScheduleFrame';
import { recommendationDate } from './scheduleState';
import type { ScheduleRecommendResponse, SlotPick } from './scheduleTypes';

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

type Params = { roomId?: string; name?: string; invitees?: string[]; origin?: MyLocation; originSource?: 'profile' | 'gps' | 'search' };
type Failure = { title: string; message: string; action: 'restart' | 'home' | 'search' | 'retry' };

export default function ScheduleConfirmedScreen() {
  /* 상태바 높이는 insets.top 만으로는 모자란 기기가 있다 */

  const { navigate, resetTo, goBackWith, current } = useNavigation();

  const params = current.params as Params | undefined;

  const roomId = params?.roomId ?? null;
  const title = params?.name || '새 밥약';
  const invitees = params?.invitees ?? [];
  const origin = params?.origin;

  const [picks, setPicks] = useState<SlotPick[]>([]);
  const [selected, setSelected] = useState(0);

  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setPicks([]);
    setFailure(null);
    if (!roomId) {
      setFailure({ title: '밥약 정보가 없어요', message: '새 밥약을 만들고 가능한 시간을 골라 주세요.', action: 'restart' });
      setLoading(false); return;
    }
    if (!origin) {
      setFailure({ title: '출발지를 골라 주세요', message: '중간 지점을 계산하려면 내가 출발할 곳이 필요해요.', action: 'search' });
      setLoading(false); return;
    }
    let phase: 'room' | 'candidates' | 'recommendation' = 'room';
    try {
      const room = await fetchRoom(roomId);
      // A failed room lookup cannot establish membership for the candidate request.
      if (room.error) throw room.error;
      if (!room.data) {
        setFailure({ title: '밥약을 찾을 수 없어요', message: '방이 없어졌거나 참여 정보를 확인할 수 없어요.', action: 'home' }); return;
      }
      const memberIds = room.data.participants.map(participant => participant.profileId).filter((id): id is string => Boolean(id));
      phase = 'candidates';
      const candidates = await buildPlaceCandidates(memberIds, origin);
      if (!candidates) {
        setFailure({ title: '중간 지점을 계산하지 못했어요', message: '출발지 좌표를 확인할 수 없어요. 다른 출발지를 골라 다시 찾아보세요.', action: 'search' }); return;
      }
      if (!candidates.candidates.length) {
        setFailure({ title: '근처에서 식당 후보를 찾지 못했어요', message: '다른 출발지를 골라 다시 찾아보세요.', action: 'search' }); return;
      }
      phase = 'recommendation';
      const { data, error } = await supabase.functions.invoke('schedule-recommend', {
        body: { meetingName: title, roomId, placeCandidates: candidates.candidates }, timeout: INVOKE_TIMEOUT_MS,
      });
      if (error) throw error;
      const response = data as ScheduleRecommendResponse;
      if (!response || !Array.isArray(response.slotRecommendations)) throw new Error('Invalid recommendation response');
      if (!response.slotRecommendations.length) throw new Error('Empty recommendation response');
      setPicks([...response.slotRecommendations].sort((a, b) => a.rank - b.rank)); setSelected(0);
    } catch (error) {
      const detail = phase === 'recommendation' ? await readFunctionError(error) : null;
      setFailure(phase === 'room'
        ? { title: '밥약 정보를 불러오지 못했어요', message: '연결 상태를 확인하고 다시 시도해 주세요.', action: 'retry' }
        : phase === 'candidates'
          ? { title: '식당 후보를 불러오지 못했어요', message: '연결 상태를 확인하고 다시 시도해 주세요.', action: 'retry' }
          : { title: '모두 되는 시간을 계산하지 못했어요', message: detail ?? '다시 시도하거나 날짜를 직접 골라 주세요.', action: 'retry' });
    } finally { setLoading(false); }
  }, [roomId, origin, title]);

  useEffect(() => {
    void load();
  }, [load]);

  const goPrev = () => goBackWith({ roomId, name: title, invitees, origin, originSource: params?.originSource });

  const chosen = picks[selected];

  /* 시간 추천 선택은 이 화면에서만 유지하고 기존 식당 단계로 이동한다. */
  const goToRestaurants = async () => {
    if (!roomId || !chosen || loading || failure || confirming) return;

    setConfirming(true);
    try {
      // TODO(서버 단계): 선택 시간 저장 계약. chosen.slot을 저장하는 계약이 없으므로 기존 stage 변경만 유지한다.
      const { error } = await advanceRoomStage(roomId, 'place');
      if (error) {
        Alert.alert('식당 정하기로 넘어가지 못했어요', error.message);
        return;
      }

      navigate('ChatRoom', { roomId, title, openSheet: 'menu' });
    } finally {
      setConfirming(false);
    }
  };

  return <ScheduleFrame step={3} title="언제가 좋을까요?" subtitle="모인 일정으로 추천한 시간을 살펴보고, 식당을 정하러 가요." onBack={goPrev}
    footer={<Button label="식당 정하러 가기" loading={confirming} disabled={confirming || loading || Boolean(failure) || !chosen} onPress={() => void goToRestaurants()} />}>
    {loading ? <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.note}>가능한 시간을 분석하고 있어요.</Text></View>
      : failure ? <View style={styles.state}>
        <View style={styles.stateIcon}><Clock size={28} color={colors.selectedText} /></View>
        <Text accessibilityRole="header" style={styles.stateTitle}>{failure.title}</Text>
        <Text accessibilityRole="alert" style={styles.stateNote}>{failure.message}</Text>
        <View style={styles.actions}>{failure.action === 'retry' ? <><Button label="다시 시도" onPress={() => void load()} /><Button label="날짜 직접 고르기" variant="secondary" onPress={goPrev} /></> : <Button
          label={failure.action === 'restart' ? '새 밥약 만들기' : failure.action === 'home' ? '홈으로 가기' : '다른 출발지 고르기'}
          onPress={() => { if (failure.action === 'restart') navigate('ScheduleDetail'); else if (failure.action === 'home') resetTo('Home'); else navigate('ScheduleOriginSearch', { name: title, invitees, origin }); }} />}</View>
      </View> : <>
        <View accessibilityRole="radiogroup" accessibilityLabel="추천 시간" style={styles.recommendations}>
          {picks.map((pick, index) => {
            const on = selected === index;
            const attendance = pick.availableCount === pick.totalCount ? pick.totalCount + '명 모두 가능' : pick.availableCount + '명 가능 · ' + (pick.totalCount - pick.availableCount) + '명 불가';
            return <Radio key={pick.slot.id} label={pick.rank + '순위, ' + recommendationDate(pick.slot) + ', ' + attendance} selected={on} radioSize={24} onSelect={() => setSelected(index)} style={[styles.card, on && styles.selected]}>
              <View style={styles.cardBody}>
                <View style={styles.cardHead}><View style={[styles.rank, on && styles.rankOn]}><Text style={[styles.rankText, on && styles.rankTextOn]}>{pick.rank}순위</Text></View><Text style={styles.date}>{recommendationDate(pick.slot)}</Text></View>
                <View style={styles.attendance}><Users size={16} color={colors.safeText} /><Text style={styles.attendanceText}>{attendance}</Text>
                  {pick.rainChance !== null ? <View style={styles.rain}><CloudRain size={12} color={colors.sub} /><Text style={styles.rainText}>강수 {pick.rainChance}%</Text></View> : null}
                </View>
                {/* TODO(서버 단계): 추천별 불참자 이름은 응답에 없어 인원만 표시한다. */}
                <Text style={styles.reason}>{pick.reason}</Text>
                {hasBreaktimeRisk(pick.slot.startTime) ? <Text style={styles.warning}>{BREAKTIME_NOTICE}</Text> : null}
              </View>
            </Radio>;
          })}
        </View>
        {chosen && chosen.availableCount < chosen.totalCount ? <View style={styles.warningCard}><Text style={styles.warning}>{chosen.totalCount - chosen.availableCount}명은 이 시간에 오기 어려워요. 메이트들과 확인해 주세요.</Text></View> : null}
        <View style={styles.hint}><Sparkles size={16} color={colors.selectedText} /><Text style={styles.hintText}>식당은 방에서 함께 정해요.</Text></View>
      </>}
  </ScheduleFrame>;
}
const styles = StyleSheet.create({
  recommendations: { gap: 12 },
  card: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8, padding: layout.cardPadding, borderRadius: layout.cardRadius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  selected: { padding: layout.cardPadding, borderWidth: 2, borderColor: colors.primary, backgroundColor: scheduleColors.recommendationSelected },
  cardBody: { flex: 1, minWidth: 0, gap: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rank: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: colors.mutedBg },
  rankOn: { backgroundColor: colors.primary }, rankText: { fontFamily: fontFamily.bold, fontSize: 12, lineHeight: 17, color: colors.sub }, rankTextOn: { color: colors.onPrimary },
  date: { flex: 1, fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 25, color: colors.ink },
  attendance: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  attendanceText: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 19, color: colors.safeText },
  rain: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: colors.mutedBg },
  rainText: { fontFamily: fontFamily.bold, fontSize: 12, lineHeight: 17, color: colors.sub },
  reason: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.sub },
  hint: { flexDirection: 'row', gap: 8 }, hintText: { flex: 1, fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 19, color: colors.selectedText },
  warning: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: v3FeedbackColors.error },
  warningCard: { backgroundColor: colors.selectedBg, padding: 12, borderRadius: layout.fieldRadius },
  state: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 24, alignItems: 'center', gap: 12 },
  stateIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.selectedBg, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontFamily: fontFamily.bold, fontSize: 18, lineHeight: 26, color: colors.ink, textAlign: 'center' },
  stateNote: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, color: colors.sub, textAlign: 'center' },
  actions: { gap: 8, width: '100%' }, note: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.sub },
});
