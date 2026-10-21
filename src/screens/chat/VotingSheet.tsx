import { Crown, MapPin, Plus, Search, Sparkles, Trash2, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthProvider';
import Avatar from '../../components/Avatar';
import { Button } from '../../components/ui/Button';
import { chatFeedbackColors } from '../../components/ui/chatTokens';
import FailureCard from '../../components/ui/FailureCard';
import { meetingTimeLabel } from '../../components/ui/MeetingCard';
import PlanConfirmation from '../../components/ui/PlanConfirmation';
import BottomSheet from '../../components/ui/BottomSheet';
import DecisionFailure, { DecisionRefreshError } from '../../components/ui/DecisionFailure';
import { useRoomDecision } from '../../lib/useRoomDecision';
import { confirmRoomAppointment, roomDecisionErrorMessage, type RoomDecisionState } from '../../lib/roomDecisions';
import type { MeetingTime } from '../../lib/meetingTime';
import TextField from '../../components/ui/TextField';
import Toast, { useToast } from '../../components/ui/Toast';
import VoteToggle from '../../components/ui/VoteToggle';
import { advanceRoomStage, type RoomParticipant, type RoomStage } from '../../lib/rooms';
import { hasStrictVoteMajority, pickLeadingVoteOption } from '../../lib/votingLeader';
import { addVotingItem, confirmRoomVote, fetchRoomVoting, removeVotingItem, toggleVote, type VotingKind, type VotingOption } from '../../lib/voting';
import { searchPlaces, type Place } from '../../lib/tmap';
import { useKeyboardOverlap } from '../../theme/keyboard';
import { v3Layout } from '../../theme/scale';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

export type RestaurantSuggestion = { label: string; matchPercent?: number; fresh?: boolean; source?: 'gemini' | 'rules' };
export type RecommendationStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'unavailable';
type Props = {
  visible: boolean; isOwner?: boolean; stage?: RoomStage; confirmedSlot?: string | null; participantCount?: number;
  meetingTime?: MeetingTime | null; onSelectTime?: () => void;
  confirmedRestaurant?: string | null; participants?: RoomParticipant[];
  roomId: string | null; kind: VotingKind; title: string; subtitle: string; placeholder: string;
  onClose: () => void; onConfirm: () => void; onVoted?: () => void;
  recommendationControls?: ReactNode; validateSuggestion?: (label: string) => Promise<void>;
  suggestions?: RestaurantSuggestion[]; suggestionTitle?: string;
  suggestionStatus?: RecommendationStatus; suggestionReason?: string; receivedMore?: boolean; onRequestSuggestions?: () => void;
};
type Plan = { id: string | null; label: string; voteSaved: boolean; revision?: string };
const votingLabelKey = (label: string) => label.trim().toLowerCase();
function votingAddErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  if (code === '23505') return '이미 같은 이름의 후보가 있어요. 목록을 확인해 주세요.';
  if (code === 'S4001' || code === 'S4002') return roomDecisionErrorMessage(error);
  if (code === '22023') return '후보 입력 내용을 확인하고 다시 시도해 주세요.';
  return '후보를 추가하지 못했어요. 목록을 확인하고 다시 시도해 주세요.';
}

/** Phone 540:1524 / 563:1755 / 628:3074 / 683:12975 / 540:1682. */
export default function VotingSheet(props: Props) {
  const decision = useRoomDecision(props.roomId, props.visible);
  const identity = useRef({ roomId: props.roomId });
  if (identity.current.roomId !== props.roomId) identity.current = { roomId: props.roomId };
  const binding = identity.current;
  const guarded = { ...props, onConfirm: () => { if (identity.current === binding) props.onConfirm(); }, onClose: () => { if (identity.current === binding) props.onClose(); }, onVoted: () => { if (identity.current === binding) props.onVoted?.(); } };
  if (decision.mode === 'legacy') return <VotingContent key={`${props.roomId}:${decision.accountId}`} {...guarded} decisionLoading={decision.loading} onRetrySupport={() => decision.reload(true)} />;
  if (decision.mode === 's4' && decision.data) return <VotingContent key={`${props.roomId}:${decision.accountId}`} {...guarded} stage={decision.data.stage} meetingTime={decision.data.meeting_time} decision={decision.data} decisionError={decision.error} refreshDecision={() => decision.reload()} />;
  return <BottomSheet visible={props.visible} title={props.title} onClose={props.onClose}><DecisionFailure decision={decision} /></BottomSheet>;
}
function VotingContent({ visible, isOwner = false, stage = 'place', confirmedSlot = null, participantCount, confirmedRestaurant, meetingTime, onSelectTime,
  participants = [], roomId, kind, title, subtitle, placeholder, onClose, onConfirm, onVoted, suggestions = [],
  suggestionStatus = 'idle', suggestionReason, receivedMore = false, onRequestSuggestions, recommendationControls, validateSuggestion, suggestionTitle, decision, refreshDecision, decisionLoading = false, decisionError, onRetrySupport }: Props & { decision?: RoomDecisionState; refreshDecision?: () => Promise<unknown>; decisionLoading?: boolean; decisionError?: Error | null; onRetrySupport?: () => Promise<unknown> }) {
  const { user } = useAuth(); const myId = user?.id ?? null;
  const [options, setOptions] = useState<VotingOption[]>([]); const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false); const operation = useRef(false);
  const mounted = useRef(true), loadRun = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [actionError, setActionError] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null); const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false); const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]); const [searchState, setSearchState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const savedRestaurant = !decision && kind === 'menu' && stage === 'place' ? confirmedRestaurant?.trim() : null;
  const restaurantLocked = decision ? stage !== 'place' : kind === 'menu' && stage === 'place' && Boolean(savedRestaurant || plan?.voteSaved);
  useEffect(() => { if (restaurantLocked) { setAdding(false); setActionError(null); } }, [restaurantLocked]);
  const [searchRequest, setSearchRequest] = useState(0); const { height } = useWindowDimensions();
  const { showToast, toastProps } = useToast(); const shownMore = useRef(false);
  useEffect(() => { setPlan(null); setConfirmationOpen(false); setConfirmationError(null); setAdding(false); setQuery(''); shownMore.current = false; }, [roomId]);
  useEffect(() => {
    if (!visible || restaurantLocked || !receivedMore || shownMore.current) return;
    const count = suggestions.filter(item => item.fresh).length;
    if (count > 0) { shownMore.current = true; showToast({ message: '조건에 맞는 곳을 ' + count + '곳 더 찾았어요' }); }
  }, [visible, receivedMore, suggestions, showToast, restaurantLocked]);

  const load = useCallback(async () => {
    if (!roomId) { setLoading(false); setLoadError(true); return []; }
    const run = ++loadRun.current;
    if (mounted.current) { setLoading(true); setLoadError(false); }
    try {
      const result = await fetchRoomVoting(roomId, myId);
      if (result.error) throw result.error;
      const rows = (result.data ?? []).filter(option => option.kind === kind);
      if (mounted.current && run === loadRun.current) { setOptions(rows); setMemberCount(result.memberCount); } return rows;
    } catch { if (mounted.current && run === loadRun.current) setLoadError(true); return null; }
    finally { if (mounted.current && run === loadRun.current) setLoading(false); }
  }, [roomId, myId, kind]);
  useEffect(() => { if (visible) void load(); }, [visible, load, decision?.revision]);
  useEffect(() => {
    if (restaurantLocked || kind !== 'menu' || !adding || query.trim().length < 2) { setResults([]); setSearchState('idle'); return; }
    let active = true; setSearchState('loading');
    const timer = setTimeout(() => {
      void searchPlaces(query.trim()).then(rows => { if (active) { setResults(rows); setSearchState('ready'); } })
        .catch(() => { if (active) { setResults([]); setSearchState('error'); } });
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [adding, query, searchRequest, kind, restaurantLocked]);

  const mutate = async (task: () => Promise<unknown>, message: string | ((error: unknown) => string)) => {
    if (operation.current || !roomId || restaurantLocked || decisionLoading) return;
    operation.current = true; setBusy(true); setActionError(null);
    try { await task(); }
    catch (error) { if (mounted.current) setActionError(decision && /^S4/.test((error as { code?: string })?.code ?? '') ? roomDecisionErrorMessage(error) : typeof message === 'function' ? message(error) : message); }
    finally { operation.current = false; if (mounted.current) setBusy(false); }
  };
  const vote = (option: VotingOption) => void mutate(async () => {
    const error = await toggleVote(roomId!, option.id); if (error) throw error;
    await load(); await refreshDecision?.(); onVoted?.();
  }, '투표를 바꾸지 못했어요. 다시 시도해 주세요.');
  const add = (label: string, thenVote = false) => {
    label = label.trim();
    if (!label || Array.from(label).length > 120) { setActionError('후보 이름은 1~120자로 입력해 주세요.'); return; }
    if (options.some(option => votingLabelKey(option.label) === votingLabelKey(label))) { setActionError('이미 같은 이름의 후보가 있어요. 목록을 확인해 주세요.'); return; }
    let added = false; return void mutate(async () => {
    if (thenVote && validateSuggestion) await validateSuggestion(label);
    const error = await addVotingItem(roomId!, kind, label); if (error) throw error; added = true;
    const rows = await load();
    if (thenVote) {
      const added = rows?.find(option => votingLabelKey(option.label) === votingLabelKey(label));
      if (!added) throw Error('Candidate unavailable');
      const voteError = await toggleVote(roomId!, added.id); if (voteError) throw voteError;
      await load(); await refreshDecision?.(); onVoted?.();
    }
    await refreshDecision?.(); if (mounted.current) showToast({ message: '후보에 추가했어요' });
  }, error => added && thenVote ? '후보는 추가됐지만 투표하지 못했어요. 추가된 후보에서 다시 투표해 주세요.' : votingAddErrorMessage(error)); };
  const discard = (option: VotingOption) => void mutate(async () => {
    const error = await removeVotingItem(roomId!, option.id); if (error) throw error; await load(); await refreshDecision?.();
  }, '후보를 지우지 못했어요. 다시 시도해 주세요.');

  const leader = decision ? options.find(option => option.id === decision.voting.leading_item_id) ?? null : pickLeadingVoteOption(options);
  const majority = decision ? Boolean(leader && decision.voting.eligible_count > 0 && decision.voting.leading_votes >= decision.voting.required_votes) : leader !== null && hasStrictVoteMajority(leader.voters.length, memberCount);
  // Only confirmed_menu proves the vote RPC succeeded. location_name may be a general location.
  const canConfirm = isOwner && (kind !== 'menu' || stage === 'place') && (!decision || decision.permissions.can_select_time || decision.permissions.can_confirm);
  useEffect(() => { if (!canConfirm) { setConfirmationOpen(false); setPlan(null); setConfirmationError(null); } }, [canConfirm]);
  const retry = Boolean(savedRestaurant || plan?.voteSaved);
  useEffect(() => {
    if (decision && plan?.revision && plan.revision !== decision.revision && !busy) {
      setConfirmationOpen(false); setPlan(null); setActionError(roomDecisionErrorMessage({ code: 'S4005' }));
    }
  }, [decision, plan, busy]);
  const confirmationHint = retry ? '저장한 식당으로 약속 단계만 다시 전환해요' : !leader ? '정할 식당이 아직 없어요' : !majority ? '과반수 표가 필요해요' : '고른 식당을 확인한 뒤 약속을 확정해요';
  const startConfirmation = () => {
    if (!canConfirm || busy || (!retry && (loading || loadError)) || (decision && (!decision.permissions.can_confirm || !decision.meeting_time || decisionLoading))) return;
    if (savedRestaurant) setPlan({ id: null, label: savedRestaurant, voteSaved: true });
    else if (!plan?.voteSaved) {
      if (!leader || !majority) return;
      setPlan({ id: leader.id, label: leader.label, voteSaved: false, revision: decision?.revision });
    }
    Keyboard.dismiss(); setConfirmationError(null); setConfirmationOpen(true);
  };
  const confirmPlan = async () => {
    if (!canConfirm || !roomId || !plan || operation.current) return;
    operation.current = true; setBusy(true); setConfirmationError(null); let voteSaved = plan.voteSaved;
    try {
      if (decision) {
        if (!plan.id || !plan.revision || !decision.meeting_time || decisionLoading) return;
        const result = await confirmRoomAppointment(roomId, plan.id, plan.revision);
        if (result.error) {
          if (mounted.current) {
            const message = roomDecisionErrorMessage(result.error);
            if (['S4003', 'S4005', 'S4006', 'S4007', 'S4008', 'S4009', 'S4010'].includes(result.error.code)) { setConfirmationOpen(false); setPlan(null); setActionError(['S4006', 'S4010'].includes(result.error.code) ? message + ' 시간을 다시 골라 주세요.' : message); await refreshDecision?.(); await load(); }
            else setConfirmationError(message);
          }
          return;
        }
        onConfirm(); onClose(); return;
      }
      if (!voteSaved) {
        if (!plan.id) return;
        const error = await confirmRoomVote(roomId, plan.id);
        if (error) {
          if (mounted.current) setConfirmationError('식당 선택을 저장하지 못했어요. 투표를 확인하고 다시 시도해 주세요.');
          if (/^S4/.test((error as { code?: string }).code ?? '')) await onRetrySupport?.();
          onVoted?.(); return;
        }
        voteSaved = true; setPlan({ ...plan, voteSaved: true });
      }
      if (kind === 'menu') {
        // Pre-S4 only: preserve recovery of the old two-call contract without claiming atomicity.
        const { error } = await advanceRoomStage(roomId, 'confirmed');
        if (error) { if (mounted.current) setConfirmationError('식당은 저장됐지만 약속을 확정하지 못했어요. 다시 시도해 주세요.'); if (/^S4/.test((error as { code?: string }).code ?? '')) await onRetrySupport?.(); return; }
      }
      setConfirmationOpen(false); setPlan(null); onConfirm(); onClose();
    } catch { if (mounted.current) setConfirmationError(decision ? '약속을 확정하지 못했어요. 다시 시도해 주세요.' : voteSaved ? '식당은 저장됐지만 약속을 확정하지 못했어요. 다시 시도해 주세요.' : '식당 선택을 저장하지 못했어요. 투표를 확인하고 다시 시도해 주세요.'); }
    finally { operation.current = false; if (mounted.current) setBusy(false); }
  };
  // A refreshed room can recover an already-confirmed vote even after this component was remounted.
  useEffect(() => {
    if (savedRestaurant && confirmationOpen) { setPlan({ id: null, label: savedRestaurant, voteSaved: true }); setConfirmationError(null); }
  }, [savedRestaurant, confirmationOpen]);

  const openSuggestions = restaurantLocked ? [] : suggestions.filter(item => !options.some(option => votingLabelKey(option.label) === votingLabelKey(item.label)));
  const noCandidates = options.length === 0 && openSuggestions.length === 0;
  const openAdding = () => { if (restaurantLocked) return; Keyboard.dismiss(); setActionError(null); setAdding(true); };
  const close = () => { if (busy) return; if (confirmationOpen) setConfirmationOpen(false); else if (adding) { setAdding(false); setActionError(null); } else onClose(); };
  const buttonLabel = retry ? '약속 확정 다시 시도' : leader ? leader.label + '으로 정하기' : '정할 식당이 아직 없어요';
  const footer = !adding ? <View style={styles.footer}>
    {!decision && decisionLoading ? <Text style={styles.hint} accessibilityLiveRegion="polite">서버 기능을 다시 확인하고 있어요. 입력 내용은 유지돼요.</Text> : null}
    {decision && stage !== 'place' ? <Text style={styles.hint}>약속 확정 또는 정산 단계여서 투표를 바꿀 수 없어요.</Text> : null}
    {decision && stage === 'place' ? <Text style={styles.hint} accessibilityLiveRegion="polite">투표만으로 자동 확정되지 않아요. 과반 최다 득표 식당을 방장이 확인해요.</Text> : null}
    {decision && !decision.meeting_time ? <Text style={styles.hint}>약속 확정 전에 한국 시간 기준의 시간을 선택해야 해요.</Text> : null}
    {decision?.permissions.can_select_time && stage === 'place' && onSelectTime ? <Button label={decision.meeting_time ? '시간 수정하기' : '시간 선택하기'} variant="secondary" disabled={busy} onPress={onSelectTime} /> : null}
    {restaurantLocked ? null : isOwner ? noCandidates && (suggestionStatus === 'error' || suggestionStatus === 'empty') ? null : <View style={styles.hintRow}><Crown size={14} color={colors.sub} /><Text style={styles.hint}>방장이 가장 많은 표를 받은 곳으로 정할 수 있어요.</Text></View>
      : <View style={styles.mateHint}><Crown size={18} color={colors.sub} /><Text style={styles.mateHintText}>{decision ? '방장이 확정해요. 그동안 투표를 바꿀 수 있어요.' : '이전 서버의 투표 방식을 사용해요. 전원 투표하면 자동으로 정해질 수 있어요.'}</Text></View>}
    {!decision && isOwner ? <Text style={styles.hint}>이전 서버에서는 전원 투표로 자동 결정될 수 있어요. 방장 확정 여부는 확인할 수 없어요.</Text> : null}
    {canConfirm ? <>{retry || (leader && !majority) ? <Text style={styles.hint} accessibilityLiveRegion="polite">{confirmationHint}</Text> : null}<Button label={buttonLabel} testID="voting-confirm-cta" accessibilityHint={confirmationHint}
      disabled={busy || (!retry && (loading || loadError || !majority)) || Boolean(decision && (!decision.permissions.can_confirm || !decision.meeting_time || decisionLoading))} onPress={startConfirmation} /></> : null}
  </View> : null;

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={close}><SafeAreaProvider>
    {confirmationOpen && plan ? <PlanConfirmation restaurant={plan.label} when={meetingTimeLabel(confirmedSlot, stage, meetingTime)} memberCount={decision?.voting.eligible_count ?? participantCount ?? memberCount}
      busy={busy} error={confirmationError ?? (decisionError ? roomDecisionErrorMessage(decisionError) : null)} retry={plan.voteSaved} onCancel={close} onConfirm={() => void confirmPlan()} />
      : <VotingFrame title={adding ? (kind === 'menu' ? '식당 직접 추가' : '시간 직접 추가') : title}
        subtitle={adding ? (kind === 'menu' ? '가고 싶은 곳을 검색해서 후보에 올려요.' : '추가할 시간을 입력해 주세요.') : subtitle}
        closeLabel={adding ? (kind === 'menu' ? '식당 직접 추가 닫기' : '시간 직접 추가 닫기') : (kind === 'menu' ? '식당 시트 닫기' : '시간 시트 닫기')}
        onClose={close} footer={footer}>
        {!decision && restaurantLocked ? <Text style={styles.savedNotice} accessibilityLiveRegion="polite">식당이 정해졌어요. 방장이 약속을 확정하면 끝나요</Text> : null}
        {actionError ? <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text> : null}
        {refreshDecision ? <DecisionRefreshError decision={{ error: decisionError ?? null, reload: refreshDecision }} /> : null}
        {adding ? <>
          <View style={styles.searchField}><TextField style={styles.searchInput} maxLength={120} label={kind === 'menu' ? '식당 검색' : '추가할 시간'} value={query} onChangeText={value => { setQuery(value); if (kind === 'menu' && value.trim().length >= 2) { setResults([]); setSearchState('loading'); } }} placeholder={placeholder} editable={!busy && !restaurantLocked}
            inputAccessory={<Pressable style={styles.iconButton} accessibilityRole="button" accessibilityLabel="검색어 지우기" disabled={busy} onPress={() => setQuery('')}><X size={18} color={colors.sub} /></Pressable>} /><Search size={18} color={colors.sub} style={styles.searchIcon} /></View>
          {searchState === 'loading' ? <Text style={styles.note}>검색하는 중이에요</Text> : null}
          {searchState === 'error' ? <FailureCard title="식당을 검색하지 못했어요" reason="잠시 후 다시 시도하거나 식당 이름을 직접 추가해 주세요." icon={<MapPin size={28} color={colors.selectedText} />} onRetry={() => setSearchRequest(n => n + 1)} /> : null}
          {searchState === 'ready' && results.length === 0 ? <Text style={styles.note}>검색 결과가 없어요. 식당 이름을 확인해 주세요.</Text> : null}
          <View>{results.map(place => { const exists = options.some(option => votingLabelKey(option.label) === votingLabelKey(place.name)); return <View key={place.id} style={styles.result}>
            <MapPin size={20} color={colors.sub} /><View style={styles.resultText}><Text style={styles.resultName}>{place.name}</Text><Text style={styles.note}>{[place.address, exists ? '후보에 있음' : ''].filter(Boolean).join(' · ')}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel={place.name + (exists ? ' 추가됨' : ' 추가')} accessibilityState={{ disabled: exists || busy || restaurantLocked || decisionLoading }} disabled={exists || busy || restaurantLocked || decisionLoading}
              onPress={() => add(place.name)} style={[styles.resultAdd, exists && styles.inactive]}><Text style={styles.resultAddText}>{exists ? '✓ 추가됨' : '추가'}</Text></Pressable>
          </View>; })}</View>
          {query.trim() && searchState !== 'loading' ? <Button label="이 이름으로 후보 추가" variant="secondary" disabled={busy || decisionLoading || options.some(option => votingLabelKey(option.label) === votingLabelKey(query))} onPress={() => add(query.trim())} /> : !query.trim() ? <Text style={styles.note}>{kind === 'menu' ? '식당 이름을 입력해 주세요. 검색은 두 글자부터 가능해요.' : '추가할 시간을 입력해 주세요.'}</Text> : null}
          {/* TODO(서버 단계): 후보에는 이름만 저장된다. 검색 주소/사진/가격/거리와 AI 출처 저장 계약은 없다. */}
        </> : <>
          {!restaurantLocked ? recommendationControls : null}
          {loading ? <Text style={styles.note}>후보를 불러오는 중이에요</Text> : loadError ? <FailureCard title="후보를 불러오지 못했어요" reason="잠시 후 다시 시도해 주세요." icon={<MapPin size={28} color={colors.sub} />} onRetry={() => void load()} /> : null}
          {!loading && !loadError ? options.map(option => <CandidateRow key={option.id} option={option} highlighted={leader?.id === option.id && option.voters.length > 0} participants={participants}
            suggestion={suggestions.find(item => votingLabelKey(item.label) === votingLabelKey(option.label))} busy={busy || restaurantLocked || decisionLoading} onVote={() => vote(option)}
            onRemove={isOwner || (Boolean(myId) && option.createdBy === myId) ? () => discard(option) : undefined} />) : null}
          {!loadError && openSuggestions.length ? <Text accessibilityRole="header" style={styles.resultName}>{openSuggestions.some(item => item.source === 'rules') ? '추천 식당' : suggestionTitle ?? '추천 식당'}</Text> : null}
          {!loadError ? openSuggestions.map(item => <CandidateRow key={'ai-' + item.label} option={{ id: item.label, kind, label: item.label, createdBy: null, voters: [], mine: false }}
            suggestion={item} pendingAddition participants={participants} busy={busy || loading || decisionLoading} onVote={() => add(item.label, true)} />) : null}
          {!restaurantLocked && (suggestionStatus === 'error' || suggestionStatus === 'empty') ? <View style={styles.failure}>
            <View style={styles.failureIcon}><MapPin size={28} color={colors.selectedText} /></View><Text style={styles.failureTitle}>{suggestionStatus === 'empty' ? '근처에서 찾은 곳이 없어요' : '추천을 불러오지 못했어요'}</Text>
            <Text style={styles.failureNote}>{suggestionReason || (suggestionStatus === 'empty' ? '아는 식당을 직접 추가해 주세요.' : '추천을 불러오지 못했어요. 다시 시도해 주세요.') }</Text>
            {suggestionStatus === 'error' ? <Button label="다시 시도" style={styles.retry} onPress={onRequestSuggestions} disabled={!onRequestSuggestions} /> : null}
          </View> : !restaurantLocked && suggestionStatus === 'loading' ? <Text style={styles.note} accessibilityLiveRegion="polite">식당을 찾고 있어요</Text> : !restaurantLocked && suggestionReason ? <Text style={styles.note}>{suggestionReason}</Text> : !restaurantLocked && noCandidates && !loading && !loadError ? <Text style={styles.note}>아직 후보가 없어요. 직접 추가해 주세요.</Text> : null}
          <View style={styles.addRow}><AddAction label="직접 추가" Icon={Plus} onPress={openAdding} disabled={busy || restaurantLocked} />
            {kind === 'menu' && (restaurantLocked || (suggestionStatus !== 'error' && suggestionStatus !== 'empty')) && onRequestSuggestions ? <AddAction label={receivedMore ? '추천을 받았어요' : '추천 더 받기'} Icon={Sparkles} accent onPress={onRequestSuggestions} disabled={busy || restaurantLocked || suggestionStatus === 'loading' || suggestionStatus === 'unavailable' || receivedMore} /> : null}</View>
        </>}
      </VotingFrame>}
    <Toast {...toastProps} bottom={Math.max(16, height - 164)} />
  </SafeAreaProvider></Modal>;
}

function CandidateRow({ option, pendingAddition = false, highlighted = false, suggestion, participants, busy, onVote, onRemove }: { option: VotingOption; pendingAddition?: boolean; highlighted?: boolean; suggestion?: RestaurantSuggestion; participants: RoomParticipant[]; busy: boolean; onVote: () => void; onRemove?: () => void }) {
  return <View style={[styles.candidate, highlighted && styles.candidateSelected, suggestion?.fresh && styles.candidateFresh]}>
    {/* TODO(서버 단계): 식당 사진·도보 거리·가격 값이 없다. 임의 이미지나 숫자를 표시하지 않는다. */}
    <View style={styles.candidateText}><View style={styles.nameRow}><Text style={styles.candidateName}>{option.label}</Text>
      {suggestion ? <View style={styles.aiBadge}><Sparkles size={11} color={colors.selectedText} /><Text style={styles.aiLabel}>{suggestion.source === 'rules' ? '기본 추천' : suggestion.fresh ? 'AI 새 추천' : 'AI 추천'}</Text></View> : null}</View>
      <View style={styles.voters}><View style={styles.avatarStack}>{option.voters.slice(0, 3).map((voter, index) => {
        // Voter IDs are absent in the existing contract. Only use a unique name match for a saved photo.
        const matching = participants.filter(member => member.name === voter.name);
        const person = matching.length === 1 ? matching[0] : null;
        return <View key={index} style={[styles.voterAvatar, index > 0 && styles.avatarOverlap]}><Avatar name={voter.name} url={person?.avatarUrl} seed={person?.profileId ?? voter.name} size={18} /></View>;
      })}</View><Text style={[styles.votes, option.voters.length === 0 && styles.note]}>{option.voters.length ? option.voters.length + '표' : '아직 표 없음'}</Text></View>
    </View>
    <VoteToggle label={option.label} selected={option.mine} disabled={busy} onPress={onVote} hint={pendingAddition ? '후보에 추가하고 투표해요' : undefined} />
    {onRemove ? <Pressable style={styles.iconButton} disabled={busy} accessibilityRole="button" accessibilityLabel={option.label + ' 후보 삭제'} onPress={onRemove}><Trash2 size={18} color={colors.sub} /></Pressable> : null}
  </View>;
}
function AddAction({ label, Icon, onPress, disabled, accent = false }: { label: string; Icon: typeof Plus; onPress: () => void; disabled?: boolean; accent?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.addAction, disabled && styles.inactive]}>
    <Icon size={16} color={accent ? colors.selectedText : colors.ink} /><Text style={[styles.addLabel, accent && styles.accent]}>{label}</Text>
  </Pressable>;
}
/** One Modal switches its content; the protected shared BottomSheet needs no API changes. */
function VotingFrame({ title, subtitle, closeLabel, onClose, children, footer }: { title: string; subtitle: string; closeLabel: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const insets = useSafeAreaInsets(); const rootRef = useRef<View>(null); const { overlap, remeasure } = useKeyboardOverlap(rootRef);
  return <View ref={rootRef} onLayout={remeasure} style={[styles.root, { paddingTop: insets.top, paddingBottom: overlap }]}>
    <Pressable accessible={false} importantForAccessibility="no" aria-hidden style={styles.scrim} onPress={onClose} />
    <View testID="voting-sheet" style={[styles.sheet, { paddingBottom: 24 + (overlap > 0 ? 0 : insets.bottom) }]} accessibilityViewIsModal aria-modal>
      <View style={styles.handle} /><View style={styles.heading}><View style={styles.headingText}><Text accessibilityRole="header" style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} style={styles.iconButton}><X size={24} color={colors.ink} /></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>{children}</ScrollView>{footer}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' }, scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.ink, opacity: 0.5 },
  sheet: { maxHeight: '95%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface, paddingHorizontal: 20, paddingTop: 8, gap: 14 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center' },
  heading: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' }, headingText: { flex: 1, gap: 2 },
  title: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 29, color: colors.ink },
  subtitle: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, color: colors.sub },
  iconButton: { width: v3Layout.minTouchTarget, height: v3Layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  body: { gap: 14 }, footer: { gap: 14 }, hintRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  hint: { flexShrink: 1, fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.sub },
  mateHint: { backgroundColor: colors.mutedBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  mateHintText: { flex: 1, fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: colors.sub },
  note: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 18, color: colors.sub },
  savedNotice: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: colors.selectedText, backgroundColor: colors.selectedBg, padding: 12, borderRadius: 12 },
  error: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: v3FeedbackColors.error },
  candidate: { minHeight: 92, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, borderWidth: 1, borderRadius: 16, borderColor: colors.border, backgroundColor: colors.surface },
  candidateSelected: { borderWidth: 2, borderColor: colors.primary, backgroundColor: chatFeedbackColors.candidateBackground },
  candidateFresh: { borderWidth: 1.5, borderColor: colors.primary }, candidateText: { flex: 1, minWidth: 0, gap: 4 },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  candidateName: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 23, color: colors.ink, flexShrink: 1 },
  aiBadge: { borderRadius: 10, backgroundColor: colors.selectedBg, paddingHorizontal: 7, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 3 },
  aiLabel: { fontFamily: fontFamily.bold, fontSize: 12, lineHeight: 18, color: colors.selectedText },
  voters: { flexDirection: 'row', alignItems: 'center', gap: 6 }, avatarStack: { flexDirection: 'row' },
  voterAvatar: { width: 22, height: 22, borderWidth: 2, borderColor: colors.surface, borderRadius: 11, backgroundColor: colors.mutedBg, overflow: 'hidden' }, avatarOverlap: { marginLeft: -6 },
  votes: { fontFamily: fontFamily.bold, fontSize: 12, lineHeight: 18, color: colors.ink },
  addRow: { flexDirection: 'row', gap: 8 }, addAction: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addLabel: { fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 20, color: colors.ink, flexShrink: 1 }, accent: { color: colors.selectedText }, inactive: { opacity: 0.4 },
  searchField: { position: 'relative' }, searchInput: { paddingLeft: 44, paddingRight: 48 }, searchIcon: { position: 'absolute', left: 14, top: 43 },
  result: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }, resultText: { flex: 1 },
  resultName: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22, color: colors.ink },
  resultAdd: { minWidth: 44, minHeight: 44, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.selectedBg, alignItems: 'center', justifyContent: 'center' },
  resultAddText: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 19, color: colors.selectedText },
  failure: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 12 },
  failureIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.selectedBg, alignItems: 'center', justifyContent: 'center' },
  failureTitle: { fontFamily: fontFamily.bold, fontSize: 18, lineHeight: 26, color: colors.ink, textAlign: 'center' },
  failureNote: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, color: colors.sub, textAlign: 'center' }, retry: { alignSelf: 'stretch', marginTop: 12 },
});
