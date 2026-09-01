import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import Avatar from '../../components/Avatar';
import AvailabilityGrid from '../../components/AvailabilityGrid';
import BottomSheet from '../../components/BottomSheet';
import PickedSlotChips from '../../components/PickedSlotChips';
import { CompleteButton } from '../../components/ui/Button';
import {
  fetchRoomAvailability,
  saveMyAvailability,
  type AvailabilityStatus,
} from '../../lib/availability';
import { buildNextDays, cellKey, toSlots } from '../../lib/scheduleSlots';
import { fs, s } from '../../theme/scale';
import { colors, shadows } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

type Props = {
  visible: boolean;
  roomId: string | null;
  onClose: () => void;
  onSubmitted: (text: string) => void;
  /** 제출이 모이면 여기서 결과 시트로 넘어간다 */
  onAskRecommend: () => void;
};

/**
 * 방의 일정 조율 시트. 두 가지 상태가 있다.
 *
 * - 아직 안 냈으면 격자를 채운다 — Figma 채팅/일정 패널 (2111:16888)
 * - 냈으면 요약과 제출 현황을 본다 — Figma 채팅/일정 완료 패널 (2115:397)
 *
 * 투표가 아니라 각자 자기 격자를 낸다. 누가 어느 시간에 가능한지는 보여 주지
 * 않고 제출 여부만 밝힌다 — 개인의 가능·불가 패턴이 방 전체에 드러나면
 * 곤란하고, 추천에 필요한 것은 합계뿐이다.
 */
export default function ScheduleSheet({
  visible,
  roomId,
  onClose,
  onSubmitted,
  onAskRecommend,
}: Props) {
  const { user } = useAuth();
  const myId = user?.id ?? null;

  const days = useMemo(() => buildNextDays(5), []);

  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<AvailabilityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  /** 낸 뒤에도 "일정 수정" 으로 격자를 다시 열 수 있다 */
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);

    const { data, error } = await fetchRoomAvailability(roomId);
    if (!error && data) {
      setStatus(data);
      /* 전에 낸 답이 있으면 격자에 되살려서 이어 고칠 수 있게 한다 */
      setPicked(new Set(data.mySlots));
      setEditing(data.mySlots.length === 0);
    }
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const toggle = (date: string, hour: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      const key = cellKey(date, hour);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const slots = toSlots(picked, days);

  const submit = async () => {
    if (!roomId || !myId) return;

    setSaving(true);
    const error = await saveMyAvailability(roomId, [...picked]);
    setSaving(false);

    if (error) {
      Alert.alert('저장 실패', error.message);
      return;
    }

    onSubmitted(`가능한 시간 ${slots.length}개를 등록했어요`);
    await load();
  };

  const members = status?.members ?? [];
  const submitted = members.filter((member) => member.submitted).length;

  return (
    <BottomSheet
      visible={visible}
      title="일정 조율"
      subtitle={
        editing
          ? '가능한 시간을 눌러서 표시해 주세요'
          : '일정을 수정하거나 메이트들의 일정 제출 현황을 확인하세요'
      }
      onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.body}>
        {editing ? (
          <>
            <AvailabilityGrid days={days} picked={picked} onToggle={toggle} />
            <View style={styles.gap} />
          </>
        ) : null}

        <PickedSlotChips slots={slots} />

        {!editing ? (
          <>
            <View style={styles.gap} />

            <View style={styles.statusCard}>
              <View style={styles.statusHead}>
                <Text style={styles.statusTitle}>제출 완료</Text>
                <Text style={styles.statusCount}>
                  {submitted} / {members.length} 명
                </Text>
              </View>

              {/*
                아직 안 낸 사람은 흐리게 둔다. 시안에는 이 구분이 없지만, 누가
                아직인지 보이지 않으면 "제출 현황" 카드가 숫자 하나로만 남는다.
              */}
              <View style={styles.memberRow}>
                {members.map((member) => (
                  <View key={member.id} style={styles.member}>
                    <Avatar
                      name={member.name}
                      color={member.avatarColor}
                      size={s(20)}
                      radius={s(5)}
                      style={!member.submitted ? styles.waiting : undefined}
                    />
                    <Text
                      style={[styles.memberName, !member.submitted && styles.waitingText]}
                      numberOfLines={1}>
                      {member.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>

      {editing ? (
        <CompleteButton
          label={saving ? '저장 중' : '선택 완료'}
          showNext
          style={styles.cta}
          disabled={saving || slots.length === 0}
          onPress={() => void submit()}
        />
      ) : (
        <CompleteButton
          label="일정 수정"
          style={styles.cta}
          disabled={loading}
          onPress={() => setEditing(true)}
        />
      )}

      {/*
        내 일정을 낸 뒤에만 보인다. 격자를 고치는 중에 추천으로 빠지면 하던
        선택이 사라지고, 아직 아무도 안 낸 상태에서는 추천할 근거도 없다.
      */}
      {!editing && submitted > 0 ? (
        <Pressable
          style={styles.askRow}
          onPress={() => {
            onClose();
            onAskRecommend();
          }}>
          <Text style={styles.askText}>모인 일정으로 AI 추천 받기 ({submitted}명) →</Text>
        </Pressable>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    marginTop: s(6),
    /*
     * 들어갈 수 있으면 한 화면에 다 보여 준다. 시트가 화면 한도에 닿았을
     * 때만 줄어들면서 스크롤이 생긴다.
     */
    flexShrink: 1,
  },
  gap: {
    height: s(6),
  },
  statusCard: {
    // card y123 w197 h63 radius8 pad 9/8
    backgroundColor: colors.card,
    borderRadius: s(8),
    paddingHorizontal: s(9),
    paddingVertical: s(8),
    borderWidth: s(0.6),
    borderColor: colors.border,
    ...shadows.button,
  },
  statusHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusTitle: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(8.5),
    lineHeight: fs(11.5),
    fontWeight: weight.semibold,
    color: colors.textPrimary,
  },
  /* 선택한 시간 카드의 개수 표기와 같은 값을 쓴다 — 두 카드가 나란히 놓인다 */
  statusCount: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    fontWeight: weight.semibold,
    color: colors.textMuted,
  },
  memberRow: {
    // mr y23, 아바타 20 간격 5
    marginTop: s(5),
    flexDirection: 'row',
    gap: s(5),
  },
  member: {
    width: s(20),
    alignItems: 'center',
  },
  memberName: {
    marginTop: s(5),
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    fontWeight: weight.semibold,
    color: colors.textPrimary,
  },
  waiting: {
    opacity: 0.3,
  },
  waitingText: {
    color: colors.textMuted,
  },
  cta: {
    marginTop: s(8),
  },
  askRow: {
    marginTop: s(7),
    alignItems: 'center',
  },
  askText: {
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    fontWeight: weight.bold,
    color: colors.primary,
  },
});
