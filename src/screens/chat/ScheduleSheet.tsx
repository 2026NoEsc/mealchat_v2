import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import AvailabilityGrid from '../../components/AvailabilityGrid';
import BottomSheet from '../../components/BottomSheet';
import PickedSlotChips from '../../components/PickedSlotChips';
import SubmissionStatus from '../../components/SubmissionStatus';
import { CompleteButton } from '../../components/ui/Button';
import {
  fetchRoomAvailability,
  saveMyAvailability,
  type AvailabilityStatus,
} from '../../lib/availability';
import { advanceRoomStage } from '../../lib/rooms';
import { toRoomNoticeToken } from '../../lib/roomNotice';
import { buildNextDays, cellKey, toSlots } from '../../lib/scheduleSlots';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

type Props = {
  visible: boolean;
  roomId: string | null;
  /** 단계를 넘기는 건 방장만 할 수 있다 — advance_room_stage 가 서버에서 막는다 */
  isOwner: boolean;
  onClose: () => void;
  onSubmitted: (text: string) => void;
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
  isOwner,
  onClose,
  onSubmitted,
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
  /*
   * 모두 냈다고 방이 알아서 넘어가지는 않는다. 단계를 올리는 RPC 가 방장만
   * 통과시키기 때문에, 마지막 사람이 낸 순간 자동으로 넘기면 그 사람이 방장이
   * 아닐 때 그냥 실패한다. 그래서 방장이 마무리를 눌러 넘긴다.
   */
  const allSubmitted = members.length > 0 && members.every((member) => member.submitted);
  const [advancing, setAdvancing] = useState(false);

  const advance = async () => {
    if (!roomId) return;

    setAdvancing(true);
    const { error } = await advanceRoomStage(roomId, 'place');
    setAdvancing(false);

    if (error) {
      Alert.alert('넘어가지 못했어요', error.message);
      return;
    }

    onSubmitted(toRoomNoticeToken('schedule', '이제 식당을 정할 차례예요'));
    onClose();
  };

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

            <SubmissionStatus members={members} />

            {allSubmitted && !isOwner ? (
              <Text style={styles.waiting}>
                모두 냈어요. 방장이 마치면 식당 정하기로 넘어가요.
              </Text>
            ) : null}
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
      ) : allSubmitted && isOwner ? (
        <CompleteButton
          label={advancing ? '넘어가는 중' : '식당 정하기로 넘어가기'}
          showNext
          style={styles.cta}
          disabled={advancing}
          onPress={() => void advance()}
        />
      ) : (
        <CompleteButton
          label="일정 수정"
          style={styles.cta}
          disabled={loading}
          onPress={() => setEditing(true)}
        />
      )}

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
  cta: {
    marginTop: s(8),
  },
  waiting: {
    marginTop: s(6),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
});
