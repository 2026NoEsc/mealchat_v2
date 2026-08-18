import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import BottomSheet from '../../components/BottomSheet';
import { CompleteButton } from '../../components/ui/Button';
import {
  addVotingItem,
  fetchRoomVoting,
  toggleVote,
  type VotingKind,
  type VotingOption,
} from '../../lib/voting';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

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
  onConfirm: (text: string) => void;
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
}: Props) {
  const { user } = useAuth();
  const myId = user?.id ?? null;

  const [options, setOptions] = useState<VotingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

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
    <BottomSheet visible={visible} title={title} subtitle={subtitle} onClose={onClose}>
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
          onConfirm(confirmMessage(leader.label));
          onClose();
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
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
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    fontWeight: weight.semibold,
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
    fontFamily: fontFamily.body,
    fontSize: fs(5.5),
    fontWeight: weight.bold,
    color: colors.textOnAccent,
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
    fontFamily: fontFamily.body,
    fontSize: fs(7.5),
    fontWeight: weight.bold,
    color: colors.textOnAccent,
  },
  cta: {
    marginTop: s(14),
  },
});
