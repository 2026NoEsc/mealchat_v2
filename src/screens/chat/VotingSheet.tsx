import { X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import BottomSheet from '../../components/BottomSheet';
import { CompleteButton } from '../../components/ui/Button';
import {
  addVotingItem,
  removeVotingItem,
  fetchRoomVoting,
  toggleVote,
  type VotingKind,
  type VotingOption,
} from '../../lib/voting';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

const TINT = '#FFF5EB';

type Props = {
  visible: boolean;
  roomId: string | null;
  kind: VotingKind;
  title: string;
  subtitle: string;
  placeholder: string;
  /** 확정했을 때 채팅에 남길 문구를 만든다 */
  confirmMessage: (label: string) => string;
  onClose: () => void;
  /** 채팅에 남길 문구와, 저장에 쓸 원래 라벨을 함께 준다 */
  onConfirm: (text: string, label: string) => void;
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
  roomId,
  kind,
  title,
  subtitle,
  placeholder,
  confirmMessage,
  onClose,
  onConfirm,
  onVoted,
  suggestions,
  suggestionTitle,
}: Props) {
  const { user } = useAuth();
  const myId = user?.id ?? null;

  const [options, setOptions] = useState<VotingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

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
    const { data } = await fetchRoomVoting(roomId, myId);
    setOptions((data ?? []).filter((option) => option.kind === kind));
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
  const leader = options.reduce<VotingOption | null>(
    (best, option) => (best === null || option.voters.length > best.voters.length ? option : best),
    null,
  );

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
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
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={() => void add()}
        />
        <Pressable
          style={[styles.addButton, (!draft.trim() || busy) && styles.addButtonOff]}
          disabled={!draft.trim() || busy}
          onPress={() => void add()}>
          <Text style={styles.addButtonText}>추가</Text>
        </Pressable>
      </View>

      <CompleteButton
        label="이걸로 정하기"
        style={styles.cta}
        disabled={busy || !leader || leader.voters.length === 0}
        onPress={() => {
          if (!leader) return;
          onConfirm(confirmMessage(leader.label), leader.label);
          onClose();
        }}
      />

    </BottomSheet>
  );
}

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
