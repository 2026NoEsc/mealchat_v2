import { X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardOverlap } from '../../theme/keyboard';
import PlanConfirmation from '../../components/ui/PlanConfirmation';
import { meetingTimeLabel } from '../../components/ui/MeetingCard';
import { advanceRoomStage, type RoomStage } from '../../lib/rooms';
import { CompleteButton } from '../../components/ui/Button';
import {
  addVotingItem,
  removeVotingItem,
  confirmRoomVote,
  fetchRoomVoting,
  toggleVote,
  type VotingKind,
  type VotingOption,
} from '../../lib/voting';
import { hasStrictVoteMajority, pickLeadingVoteOption } from '../../lib/votingLeader';
import { fs, s } from '../../theme/scale';
import { colors, v3Colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

const TINT = '#FFF5EB';

type Props = {
  visible: boolean;
  isOwner?: boolean; stage?: RoomStage; confirmedSlot?: string | null; participantCount?: number;
  roomId: string | null;
  kind: VotingKind;
  title: string;
  subtitle: string;
  placeholder: string;
  onClose: () => void;
  /** 서버가 실제 상태와 system event를 기록한 뒤 채팅을 새로 고친다. */
  onConfirm: () => void;
  /*
   * 표가 하나 오갈 때마다 부른다. 마지막 한 표로 서버가 방을 '확정' 으로
   * 넘겨 버리므로, 화면이 그걸 알아채려면 방을 다시 읽어야 한다.
   */
  onVoted?: () => void;
  /**
   * AI 가 고른 후보들. 목록 위에 순위와 취향 일치율로 보여 주고, 눌러서 투표
   * 후보로 올릴 수 있다 — 흐름도의 "AI 식당 추천을 후보로 추가".
   */
  suggestions?: { label: string; matchPercent: number }[];
  suggestionTitle?: string;
};

/**
 * 메뉴 투표와 시간 투표는 화면 구조가 같다 — 후보 목록, 표, 직접 추가.
 * 다른 것은 문구와 kind 뿐이라 한 컴포넌트로 두고 인자로 가른다.
 */
export default function VotingSheet({
  visible,
  isOwner = false, stage = 'place', confirmedSlot = null, participantCount,
  roomId,
  kind,
  title,
  subtitle,
  placeholder,
  onClose,
  onConfirm,
  onVoted,
  suggestions,
  suggestionTitle,
}: Props) {
  const { user } = useAuth();
  const myId = user?.id ?? null;

  const [options, setOptions] = useState<VotingOption[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const [plan, setPlan] = useState<{ id: string; label: string; voteSaved: boolean } | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  useEffect(() => { setPlan(null); setConfirmationOpen(false); setConfirmationError(null); }, [roomId]);

  /*
   * 이미 투표 후보에 오른 것은 추천에서 뺀다. 남겨 두면 같은 이름이 위아래로
   * 두 번 보이고, 무엇을 눌러야 하는지 헷갈린다.
   */
  const openSuggestions = (suggestions ?? []).filter(
    (item) => !options.some((option) => option.label.trim() === item.label.trim()),
  );

  /* AI 가 고른 것을 투표 후보로 올린다 */
  const addSuggestion = async (label: string) => {
    if (!roomId) return;

    setBusy(true);
    const error = await addVotingItem(roomId, kind, label);
    setBusy(false);

    if (error) {
      Alert.alert('추가하지 못했어요', error.message);
      return;
    }
    await load();
  };

  const discard = async (option: VotingOption) => {
    if (!roomId) return;

    setBusy(true);
    const error = await removeVotingItem(roomId, option.id);
    setBusy(false);

    if (error) {
      Alert.alert('지우지 못했어요', error.message);
      return;
    }
    await load();
  };

  const load = useCallback(async () => {
    if (!roomId) return;
    const { data, memberCount: fetchedMemberCount } = await fetchRoomVoting(roomId, myId);
    setOptions((data ?? []).filter((option) => option.kind === kind));
    setMemberCount(fetchedMemberCount);
    setLoading(false);
  }, [roomId, myId, kind]);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    void load();
  }, [visible, load]);

  const vote = async (option: VotingOption) => {
    if (!roomId) return;
    setBusy(true);
    const error = await toggleVote(roomId, option.id);
    setBusy(false);

    if (error) {
      Alert.alert('투표 실패', error.message);
      return;
    }
    void load();
    onVoted?.();
  };

  const add = async () => {
    if (!roomId) return;
    const label = draft.trim();
    if (!label) return;

    setBusy(true);
    const error = await addVotingItem(roomId, kind, label);
    setBusy(false);

    if (error) {
      Alert.alert('추가 실패', error.message);
      return;
    }
    setDraft('');
    void load();
  };

  /* 표가 가장 많은 후보. 동률이면 먼저 추가된 쪽이 앞에 온다. */
  const leader = pickLeadingVoteOption(options);
  const leaderHasMajority = leader !== null && hasStrictVoteMajority(leader.voters.length, memberCount);

  const canConfirm = isOwner && (kind !== 'menu' || stage === 'place');
  const startConfirmation = () => {
    if (!canConfirm || busy || loading) return;
    if (!plan?.voteSaved) {
      if (!leader || !leaderHasMajority) return;
      setPlan({ id: leader.id, label: leader.label, voteSaved: false });
    }
    Keyboard.dismiss(); setConfirmationError(null); setConfirmationOpen(true);
  };
  const confirmPlan = async () => {
    if (!canConfirm || !roomId || !plan || operation.current) return;
    operation.current = true; setBusy(true); setConfirmationError(null);
    let voteSaved = plan.voteSaved;
    try {
      if (!voteSaved) {
        const error = await confirmRoomVote(roomId, plan.id);
        if (error) { setConfirmationError('식당 선택을 저장하지 못했어요. 투표를 확인하고 다시 시도해 주세요.'); return; }
        voteSaved = true; setPlan({ ...plan, voteSaved: true });
      }
      if (kind === 'menu') {
        // TODO(서버 단계): 식당 저장과 단계 전환을 하나의 원자적 RPC로 합친다.
        const { error } = await advanceRoomStage(roomId, 'confirmed');
        if (error) { setConfirmationError('식당은 저장됐지만 약속을 확정하지 못했어요. 다시 시도해 주세요.'); return; }
      }
      setConfirmationOpen(false); setPlan(null); onConfirm(); onClose();
    } catch {
      setConfirmationError(voteSaved ? '식당은 저장됐지만 약속을 확정하지 못했어요. 다시 시도해 주세요.' : '식당 선택을 저장하지 못했어요. 투표를 확인하고 다시 시도해 주세요.');
    } finally { operation.current = false; setBusy(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!busy) { if (confirmationOpen) setConfirmationOpen(false); else onClose(); } }}>
    <SafeAreaProvider>
    {confirmationOpen && plan ? <PlanConfirmation restaurant={plan.label} when={meetingTimeLabel(confirmedSlot, stage)} memberCount={participantCount ?? memberCount}
      busy={busy} error={confirmationError} retry={plan.voteSaved} onCancel={() => setConfirmationOpen(false)} onConfirm={() => void confirmPlan()} />
      : <VotingFrame title={title} onClose={() => { if (!busy) onClose(); }}>

      {openSuggestions.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{suggestionTitle ?? 'AI 추천'}</Text>

          {openSuggestions.map((item, i) => (
            <View key={item.label} style={styles.suggestRow}>
              <Text style={styles.suggestRank}>{i + 1}.</Text>

              <Text style={styles.suggestLabel} numberOfLines={1}>
                {item.label}
              </Text>

              <Text style={styles.suggestMatch} numberOfLines={1}>
                메이트들의 취향과 {item.matchPercent}% 일치합니다!
              </Text>

              <Pressable
                disabled={busy}
                hitSlop={s(6)}
                onPress={() => void addSuggestion(item.label)}>
                <Text style={styles.suggestAdd}>＋ 추가</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{subtitle}</Text>
      </View>

      {loading ? (
        <Text style={styles.notice}>불러오는 중...</Text>
      ) : options.length === 0 ? (
        <Text style={styles.notice}>아직 후보가 없어요. 아래에서 추가해 보세요.</Text>
      ) : (
        options.map((option) => (
          <Pressable
            key={option.id}
            style={[styles.row, option.mine && styles.rowOn]}
            disabled={busy}
            onPress={() => void vote(option)}>
            <Text style={[styles.label, option.mine && styles.accent]} numberOfLines={1}>
              {option.label}
            </Text>

            <View style={styles.voterStack}>
              {option.voters.slice(0, 3).map((voter, i) => (
                <View
                  key={`${option.id}-${i}`}
                  style={[
                    styles.voterDot,
                    i > 0 && styles.voterOverlap,
                    { backgroundColor: voter.color },
                  ]}>
                  <Text style={styles.voterInitial}>{[...voter.name.trim()][0] ?? '?'}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.count, option.mine && styles.accent]}>
              {option.voters.length}표
            </Text>

            {/* 올린 사람과 방장만 지울 수 있다 — 아니면 서버가 막는다 */}
            <Pressable
              style={styles.remove}
              disabled={busy}
              hitSlop={s(6)}
              onPress={() => void discard(option)}>
              <X size={s(8)} color={colors.textMuted} strokeWidth={2.5} />
            </Pressable>
          </Pressable>
        ))
      )}

      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          onSubmitEditing={() => void add()}
        />
        <Pressable
          style={[styles.addButton, (!draft.trim() || busy) && styles.addButtonOff]}
          disabled={!draft.trim() || busy}
          onPress={() => void add()}>
          <Text style={styles.addButtonText}>추가</Text>
        </Pressable>
      </View>

      {canConfirm ? <CompleteButton label={plan?.voteSaved ? '약속 확정 다시 시도' : kind === 'menu' ? '약속 확정' : '이걸로 정하기'}
        style={styles.cta} disabled={busy || loading || (!plan?.voteSaved && (!leader || !leaderHasMajority))} onPress={startConfirmation} /> : null}

    </VotingFrame>}
    </SafeAreaProvider></Modal>
  );
}

/** One Modal switches its content, avoiding iOS sheet/dialog presentation overlap. */
function VotingFrame({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets(); const root = useRef<View>(null);
  const { overlap, remeasure } = useKeyboardOverlap(root);
  return <View ref={root} onLayout={remeasure} style={[frameStyles.root, { paddingTop: insets.top, paddingBottom: overlap }]}>
    <Pressable accessible={false} style={frameStyles.scrim} onPress={onClose} />
    <View style={[frameStyles.sheet, { paddingBottom: 24 + (overlap > 0 ? 0 : insets.bottom) }]} accessibilityViewIsModal aria-modal>
      <View style={frameStyles.handle} /><View style={frameStyles.heading}><Text style={frameStyles.title}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="식당 시트 닫기" onPress={onClose} style={frameStyles.close}><X size={24} color={v3Colors.ink} /></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
    </View>
  </View>;
}
const frameStyles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' }, scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: v3Colors.ink, opacity: 0.5 },
  sheet: { maxHeight: '95%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: v3Colors.surface, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: v3Colors.border },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 }, title: { flex: 1, fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 28, color: v3Colors.ink },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});

const styles = StyleSheet.create({
  extraAction: {
    marginTop: s(8),
    alignItems: 'center',
  },
  extraActionText: {
    fontFamily: fontFamily.bold,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: colors.primary,
  },
  extraActionTextOff: {
    color: colors.textMuted,
  },
  notice: {
    marginTop: s(18),
    marginBottom: s(6),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    color: colors.textMuted,
  },
  row: {
    marginTop: s(8),
    height: s(26),
    borderRadius: s(8),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: s(10),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },
  rowOn: {
    backgroundColor: TINT,
    borderColor: colors.primary,
  },
  label: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: fs(8),
    color: colors.textPrimary,
  },
  accent: {
    color: colors.primary,
  },
  voterStack: {
    flexDirection: 'row',
  },
  voterDot: {
    width: s(13),
    height: s(13),
    borderRadius: s(999),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.surface,
  },
  voterOverlap: {
    marginLeft: s(-4),
  },
  voterInitial: {
    fontFamily: fontFamily.bold,
    fontSize: fs(5.5),
    color: colors.textOnAccent,
  },
  section: {
    marginTop: s(8),
    gap: s(5),
  },
  sectionLabel: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  /* 시안 Option 행 — h30 radius7, 주황 테두리 */
  suggestRow: {
    height: s(30),
    borderRadius: s(7),
    borderWidth: s(0.8),
    borderColor: colors.primary,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(6),
    gap: s(5),
  },
  suggestRank: {
    fontFamily: fontFamily.semibold,
    fontSize: fs(7),
    color: colors.primary,
  },
  suggestLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fs(7),
    color: colors.textPrimary,
  },
  suggestMatch: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    color: colors.textMuted,
  },
  suggestAdd: {
    fontFamily: fontFamily.semibold,
    fontSize: fs(6.5),
    color: colors.primary,
  },
  remove: {
    marginLeft: s(4),
    padding: s(2),
  },
  count: {
    minWidth: s(22),
    textAlign: 'right',
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    color: colors.textMuted,
  },
  addRow: {
    marginTop: s(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
  },
  addInput: {
    flex: 1,
    height: s(24),
    borderRadius: s(8),
    backgroundColor: colors.surfaceSunken,
    paddingHorizontal: s(9),
    paddingVertical: 0,
    fontFamily: fontFamily.body,
    fontSize: fs(7.5),
    color: colors.textPrimary,
  },
  addButton: {
    paddingHorizontal: s(12),
    height: s(24),
    borderRadius: s(8),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonOff: {
    opacity: 0.4,
  },
  addButtonText: {
    fontFamily: fontFamily.bold,
    fontSize: fs(7.5),
    color: colors.textOnAccent,
  },
  cta: {
    marginTop: s(14),
  },
});
