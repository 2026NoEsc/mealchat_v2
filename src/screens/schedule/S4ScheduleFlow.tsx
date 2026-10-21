import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import AvailabilityGrid from '../../components/AvailabilityGrid';
import { Button } from '../../components/ui/Button';
import { Radio } from '../../components/ui/Radio';
import DecisionFailure, { DecisionRefreshError } from '../../components/ui/DecisionFailure';
import { adjustedServerNow, buildKstDays, formatMeetingTime, futureKstSlots, isPastKstCell, kstDateKey, meetingTimeFromSlot, type MeetingTime } from '../../lib/meetingTime';
import { useMeetingClock } from '../../lib/useMeetingClock';
import { useMeetingTimePreview } from '../../lib/useMeetingTimePreview';
import { leaveRoom } from '../../lib/rooms';
import { roomDecisionErrorMessage, selectRoomMeetingTime, submitRoomAvailability } from '../../lib/roomDecisions';
import { cellKey, toSlots } from '../../lib/scheduleSlots';
import { useRoomDecision } from '../../lib/useRoomDecision';
import { fetchFoodCatalog } from '../../lib/foodProfile';
import { getRoomDecisionClient } from '../../lib/roomDecisionClient';
import { useNavigation } from '../../navigation/NavigationContext';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import ScheduleFrame from './ScheduleFrame';
import type { SlotPick } from './scheduleTypes';

type Decision = ReturnType<typeof useRoomDecision>;
type Props = { roomId: string | null; name: string; decision: Decision; invitees?: string[] };
export function S4ScheduleTime({ roomId, name, decision, invitees }: Props) {
  const { navigate, goBack, goBackWith } = useNavigation();
  const [picked, setPicked] = useState(new Set<string>()), [error, setError] = useState(''), [saving, setSaving] = useState(false), [saved, setSaved] = useState<'submitted' | 'withdrawn' | null>(null);
  const initialized = useRef(false), mounted = useRef(true), operation = useRef(false), draftRevision = useRef<string | null>(null);
  const state = decision.data;
  const currentState = useRef(state); currentState.current = state;
  const now = useMeetingClock(state), day = kstDateKey(now);
  const days = useMemo(() => buildKstDays(5, new Date(`${day}T00:00:00+09:00`)), [day]);
  useEffect(() => { if (state && !initialized.current) { initialized.current = true; draftRevision.current = state.revision; setPicked(new Set(state.availability.my_slots)); } }, [state]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const save = async () => {
    if (!roomId || !state?.permissions.can_submit || operation.current) return;
    const slots = futureKstSlots([...picked], adjustedServerNow(state));
    if (picked.size && !slots.length) { setError('고른 시간이 모두 지났어요. 앞으로 가능한 시간을 다시 골라 주세요.'); return; }
    operation.current = true; setSaving(true); setError('');
    const result = await submitRoomAvailability(roomId, slots, draftRevision.current ?? state.revision);
    operation.current = false;
    if (!mounted.current) return;
    setSaving(false);
    if (result.error) {
      setError(roomDecisionErrorMessage(result.error));
      const latest = await decision.reload();
      const preserved = latest ?? currentState.current;
      if (mounted.current && preserved?.room_id === roomId && ['S4005', 'S4006'].includes(result.error.code)) {
        draftRevision.current = preserved.revision;
        if (result.error.code === 'S4005') setError('일정이 바뀌었어요. 고른 시간은 유지했어요. 확인한 뒤 다시 제출해 주세요.');
      }
      return;
    }
    if (slots.length && result.data.state.availability.all_submitted && result.data.state.permissions.can_select_time) navigate('ScheduleConfirmed', { roomId, name });
    else { setSaved(slots.length ? 'submitted' : 'withdrawn'); await decision.reload(); }
  };
  const back = async () => {
    if (operation.current) return;
    if (invitees === undefined) { goBack(); return; }
    if (roomId && state?.stage === 'scheduling' && state.permissions.can_select_time && state.availability.eligible_count === 1 && !state.availability.my_slots.length) {
      operation.current = true; setSaving(true);
      try { const error = await leaveRoom(roomId); if (error) { if (mounted.current) setError('빈 밥약을 정리하지 못했어요. 다시 시도해 주세요.'); return; } }
      catch { if (mounted.current) setError('빈 밥약을 정리하지 못했어요. 다시 시도해 주세요.'); return; }
      finally { operation.current = false; if (mounted.current) setSaving(false); }
    }
    if (mounted.current) goBackWith({ name, invitees });
  };
  const waiting = saved || (state?.stage === 'scheduling' && !state.permissions.can_submit);
  return <ScheduleFrame step={2} title="언제 만날까요?" subtitle="한국 시간 기준으로 가능한 시간을 제출해 주세요. 빈 제출은 미제출이에요." onBack={() => void back()}
    footer={waiting ? <Button label="채팅방에서 기다리기" onPress={() => navigate('ChatRoom', { roomId, title: name })} />
      : <Button label={picked.size ? '선택 완료' : '제출 철회'} disabled={!state?.permissions.can_submit || saving || (!picked.size && !state.availability.my_slots.length)} loading={saving} onPress={() => void save()} />}>
    {state ? <DecisionRefreshError decision={decision} /> : null}
    {decision.mode !== 's4' || !state ? <DecisionFailure decision={decision} /> : state.stage !== 'scheduling' && !state.permissions.can_submit ? <><Text style={styles.note}>일정 제출 단계가 끝났어요.</Text><Button label="채팅방으로 가기" onPress={() => navigate('ChatRoom', { roomId, title: name })} /></>
      : waiting ? <View style={styles.stack}><Text style={styles.title}>{saved === 'withdrawn' ? '일정을 철회했어요' : '일정을 제출했어요'}</Text><Text style={styles.note} accessibilityLiveRegion="polite">{state.availability.eligible_count}명 중 {state.availability.submitted_count}명 제출 · 모두 제출하면 방장이 시간을 선택할 수 있어요.</Text>
        {state.permissions.can_submit ? <Button label="일정 다시 수정" variant="secondary" onPress={() => setSaved(null)} /> : null}
        <Button label="제출 상태 다시 확인" variant="secondary" onPress={() => void decision.reload()} />
        {state.availability.all_submitted && state.permissions.can_select_time ? <Button label="시간 선택하기" onPress={() => navigate('ScheduleConfirmed', { roomId, name })} /> : null}</View>
      : <><Text style={styles.note}>한국 시간 · 메이트가 표시한 가능 시간도 함께 보여요.</Text><View pointerEvents={saving ? 'none' : 'auto'}><AvailabilityGrid variant="v3" timeZone="Asia/Seoul" now={now} days={days} picked={picked} others={new Set(state.availability.others_slots)} onToggle={(date, hour) => {
        if (operation.current || isPastKstCell(date, hour, adjustedServerNow(state))) return;
        setPicked(previous => { const next = new Set(previous), key = cellKey(date, hour); if (next.has(key)) next.delete(key); else next.add(key); return next; });
      }} /></View><Text style={styles.note}>{picked.size ? `${picked.size}시간 선택` : '빈 제출은 제출을 철회하며 미제출 상태가 돼요.'}</Text></>}
    {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
  </ScheduleFrame>;
}

export function S4TimeSelection({ roomId, name, decision }: Props) {
  const { navigate, goBack } = useNavigation();
  const state = decision.data;
  const now = useMeetingClock(state), day = kstDateKey(now);
  const days = useMemo(() => buildKstDays(5, new Date(`${day}T00:00:00+09:00`)), [day]);
  const [picked, setPicked] = useState(new Set<string>()), [selection, setSelection] = useState<{ time: MeetingTime; revision: string } | null>(null);
  const [picks, setPicks] = useState<{ pick: SlotPick; time: MeetingTime; revision: string }[]>([]);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [saving, setSaving] = useState(false), [recommending, setRecommending] = useState(false);
  const manualRevision = useRef<string | null>(null), operation = useRef(false), mounted = useRef(true), recommendationRun = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const slots = toSlots(picked, days);
  const canSelect = Boolean(state?.permissions.can_select_time && (state.stage === 'place' || (state.stage === 'scheduling' && state.availability.all_submitted)));
  const manual = picked.size > 0 && Boolean(selection);
  const preview = useMeetingTimePreview(roomId, canSelect && manual ? selection!.time : null, state?.revision);
  const previewReady = !manual || preview.unsupported || Boolean(preview.data && preview.data.available_count > 0);
  const recommend = async () => {
    if (!state || !roomId || !canSelect || recommending) return;
    const run = ++recommendationRun.current, snapshot = state.revision;
    setRecommending(true); setError(''); setNotice('');
    try {
      const capability = await fetchFoodCatalog();
      if (!capability.data) { if ((capability.error as { code?: string } | null)?.code === 'S5_UNAVAILABLE') { if (mounted.current && run === recommendationRun.current) setNotice('시간 추천은 곧 다시 이용할 수 있어요. 아래에서 직접 시간을 골라 주세요.'); } else throw capability.error; return; }
      const { supabase } = getRoomDecisionClient();
      const { data, error: invokeError } = await supabase.functions.invoke('schedule-recommend', { body: { meetingName: name, roomId, placeCandidates: [] }, timeout: 70000 });
      if (invokeError) throw invokeError;
      const items = data?.slotRecommendations;
      if (!Array.isArray(items)) throw new Error('Invalid response');
      const valid: typeof picks = [];
      for (const item of items) {
        if (!item || typeof item.reason !== 'string' || typeof item.slot?.id !== 'string' || !item.slot.id || valid.some(entry => entry.pick.slot.id === item.slot.id)
          || !Number.isSafeInteger(item.availableCount) || !Number.isSafeInteger(item.totalCount) || item.availableCount < 1 || item.totalCount !== state.availability.eligible_count || item.availableCount > item.totalCount) continue;
        try {
          const time = meetingTimeFromSlot(item.slot);
          if (Date.parse(time.starts_at) <= adjustedServerNow(state).getTime()) continue;
          valid.push({ pick: item, time, revision: snapshot });
        } catch { /* A malformed provider candidate is never a selectable appointment. */ }
      }
      if (mounted.current && run === recommendationRun.current) { setPicks(valid); setNotice(valid.length ? '' : '유효한 추천 시간이 없어요. 직접 시간을 골라 주세요.'); }
    } catch (cause) {
      if (mounted.current && run === recommendationRun.current) {
        const context = (cause as { context?: { status?: number; clone?: () => { json: () => Promise<unknown> }; json?: () => Promise<unknown> } })?.context;
        const status = context?.status ?? (cause as { status?: number })?.status;
        let code = (cause as { code?: string })?.code;
        if (status === 409 && !code && context?.json) {
          try { const body = await (context.clone ? context.clone().json() : context.json()); if (body && typeof body === 'object' && 'code' in body && body.code === 'S4004') code = 'S4004'; } catch { /* A status alone is never proof of an availability conflict. */ }
        }
        if (!mounted.current || run !== recommendationRun.current) return;
        if (code === 'S4004') {
          setNotice(roomDecisionErrorMessage({ code })); setPicks([]); setSelection(null); setPicked(new Set()); manualRevision.current = null;
          await decision.reload(); return;
        }
        setNotice(status === 400 ? '현재 서버와 시간 추천 방식이 달라요. 직접 시간을 골라 주세요.' : '시간 추천을 불러오지 못했어요. 직접 시간을 골라 주세요.');
      }
    } finally { if (mounted.current && run === recommendationRun.current) setRecommending(false); }
  };
  const chooseManual = (date: string, hour: number) => {
    if (!state || !canSelect || operation.current || isPastKstCell(date, hour, adjustedServerNow(state))) return;
    manualRevision.current ??= state.revision;
    const next = new Set(picked), key = cellKey(date, hour); if (next.has(key)) next.delete(key); else next.add(key);
    setPicked(next); setError('');
    const ranges = toSlots(next, days);
    if (ranges.length === 1) setSelection({ time: meetingTimeFromSlot(ranges[0]), revision: manualRevision.current }); else setSelection(null);
  };
  const save = async (withoutTime = false) => {
    if (!roomId || !state || !canSelect || operation.current || (!withoutTime && (!selection || !previewReady))) return;
    if (withoutTime && state.stage !== 'scheduling') return;
    operation.current = true; setSaving(true); setError('');
    const result = await selectRoomMeetingTime(roomId, withoutTime ? null : selection!.time,
      withoutTime ? state.revision : manual && preview.data ? preview.data.revision : selection!.revision);
    operation.current = false;
    if (!mounted.current) return;
    setSaving(false);
    if (result.error) {
      setError(roomDecisionErrorMessage(result.error));
      if (['S4003', 'S4005', 'S4006'].includes(result.error.code)) { setSelection(null); setPicked(new Set()); setPicks([]); manualRevision.current = null; await decision.reload(); }
      return;
    }
    navigate('ChatRoom', { roomId, title: name, openSheet: 'menu' });
  };
  return <ScheduleFrame step={3} title="언제가 좋을까요?" subtitle="모인 일정에서 한국 시간 기준으로 한 구간을 선택해요." onBack={goBack}
    footer={<View style={styles.stack}><Button label={state?.stage === 'place' ? '선택한 시간 저장' : '시간 저장하고 식당 정하기'} disabled={!canSelect || !selection || !previewReady || saving} loading={saving} onPress={() => void save()} />
      {canSelect && state?.stage === 'scheduling' ? <Button label="시간 없이 식당 정하기" variant="text" disabled={saving} onPress={() => void save(true)} /> : null}</View>}>
    {state ? <DecisionRefreshError decision={decision} /> : null}
    {decision.mode !== 's4' || !state ? <DecisionFailure decision={decision} /> : !canSelect ? <View style={styles.stack}><Text style={styles.note} accessibilityLiveRegion="polite">{state.stage === 'scheduling' && !state.availability.all_submitted ? `${state.availability.eligible_count}명 중 ${state.availability.submitted_count}명 제출 · 모두 제출해야 방장이 진행할 수 있어요.` : '지금은 시간을 선택할 수 없어요. 확정 전 방장만 시간을 수정할 수 있어요.'}</Text><Button label="채팅방으로 가기" onPress={() => navigate('ChatRoom', { roomId, title: name })} /></View> : <>
      <Text style={styles.note}>한국 시간 · 선택한 시간은 식당 확정 전까지 방장만 바꿀 수 있어요.</Text>
      {state.meeting_time ? <Text style={styles.title}>{formatMeetingTime(state.meeting_time, state.stage)}</Text> : null}
      <Button label="시간 추천받기" variant="secondary" loading={recommending} disabled={recommending || saving} onPress={() => void recommend()} />
      {notice ? <Text style={styles.note} accessibilityLiveRegion="polite">{notice}</Text> : null}
      {picks.map(({ pick, time, revision }) => <Radio key={pick.slot.id} label={formatMeetingTime(time) + `, ${pick.availableCount}/${pick.totalCount}명 가능`} selected={selection?.time.starts_at === time.starts_at && selection.time.ends_at === time.ends_at} onSelect={() => { setSelection({ time, revision }); setPicked(new Set()); manualRevision.current = null; setError(''); }}>
        <View style={styles.stack}><Text style={styles.title}>{formatMeetingTime(time)}</Text><Text style={styles.note}>{pick.availableCount}명 / {pick.totalCount}명 가능 · 참석률 {Math.round(pick.availableCount / pick.totalCount * 100)}%</Text><Text style={styles.note}>{pick.reason}</Text></View></Radio>)}
      <Text accessibilityRole="header" style={styles.title}>시간 직접 고르기</Text>
      <Text style={styles.note}>같은 날 11~21시 사이에서 연속한 한 구간을 골라 주세요. 저장할 때 서버가 구간 전체 참석 가능자를 다시 확인해요.</Text>
      <View pointerEvents={saving ? 'none' : 'auto'}><AvailabilityGrid variant="v3" timeZone="Asia/Seoul" now={now} days={days} picked={picked} others={new Set([...state.availability.my_slots, ...state.availability.others_slots])} onToggle={chooseManual} /></View>
      {slots.length > 1 ? <Text style={styles.error} accessibilityRole="alert">같은 날 연속한 한 구간만 선택해 주세요.</Text> : selection ? <Text testID="s4-selected-time" style={styles.title}>{formatMeetingTime(selection.time)}</Text> : null}
      {manual && preview.loading ? <Text style={styles.note} accessibilityLiveRegion="polite">참석 가능한 인원을 확인하고 있어요.</Text> : null}
      {manual && preview.data ? <Text testID="s4-time-attendance" style={styles.note} accessibilityLiveRegion="polite">{preview.data.eligible_count}명 중 {preview.data.available_count}명 가능 · 참석률 {preview.data.eligible_count ? Math.round(preview.data.available_count / preview.data.eligible_count * 100) : 0}%</Text> : null}
      {manual && preview.data?.available_count === 0 ? <Text style={styles.error} accessibilityRole="alert">이 구간 전체에 참석 가능한 메이트가 없어요. 최소 1명이 가능한 시간을 골라 주세요.</Text> : null}
      {manual && preview.error ? <View style={styles.stack}><Text style={styles.error} accessibilityRole="alert">{roomDecisionErrorMessage(preview.error)}</Text><Button label="참석 인원 다시 확인" variant="secondary" onPress={preview.reload} /></View> : null}
      {selection && (manual && preview.data ? preview.data.revision : selection.revision) !== state.revision ? <Text style={styles.error} accessibilityLiveRegion="polite">일정이 바뀌었어요. 선택을 다시 확인하고 저장해 주세요.</Text> : null}
      {state.stage === 'scheduling' ? <Text style={styles.note}>시간 없이 식당 단계로 갈 수 있지만, 최종 약속 확정 전에는 시간을 선택해야 해요.</Text> : null}
    </>}
    {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
  </ScheduleFrame>;
}
const styles = StyleSheet.create({
  stack: { gap: 12 }, title: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 24, color: colors.ink },
  note: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 21, color: colors.sub }, error: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 21, color: v3FeedbackColors.error },
});
