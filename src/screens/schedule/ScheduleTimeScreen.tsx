import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { useTopInset } from '../../theme/insets';

import AppHeader from '../../components/AppHeader';
import AvailabilityGrid from '../../components/AvailabilityGrid';
import PickedSlotChips from '../../components/PickedSlotChips';
import SubmissionStatus from '../../components/SubmissionStatus';
import { CompleteButton } from '../../components/ui/Button';
import {
  fetchRoomAvailability,
  saveMyAvailability,
  type AvailabilityStatus,
} from '../../lib/availability';
import { leaveRoom } from '../../lib/rooms';
import { useNavigation } from '../../navigation/NavigationContext';
import {
  buildNextDays,
  cellKey,
  isPastCell,
  toSlots,
} from '../../lib/scheduleSlots';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import ScheduleStepHeader from './ScheduleStepHeader';
import type { MyLocation } from '../../lib/myLocation';

type Params = {
  /** STEP 1 에서 만든 방 — 메이트의 응답이 여기에 쌓인다 */
  roomId?: string;
  name?: string;
  invitees?: string[];
  /** STEP 1 에서 잡은 내 위치 — 중간 지점 계산에 쓴다 */
  origin?: MyLocation;
};

/**
 * STEP 2 — 언제 만날까요.
 *
 * 방은 STEP 1 에서 이미 만들어졌고, 여기서 각자 가능한 시간을 낸다. 남이 고른
 * 칸은 회색으로 겹쳐 보이되 누가 골랐는지는 오지 않는다 — 내가 언제를 고를지
 * 정하는 데 필요한 것은 "이 시간은 누군가 된다" 까지다.
 */

export default function ScheduleTimeScreen() {
  /* 상태바 높이는 insets.top 만으로는 모자란 기기가 있다 */
  const topInset = useTopInset();
  const { navigate, goBackWith, current } = useNavigation();

  const params = current.params as Params | undefined;

  const roomId = params?.roomId ?? null;
  const name = params?.name ?? '';
  const invitees = params?.invitees ?? [];
  const origin = params?.origin;

  const days = useMemo(() => buildNextDays(5), []);

  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<AvailabilityStatus | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!roomId) return;
    const { data, error } = await fetchRoomAvailability(roomId);
    if (error || !data) return;

    setStatus(data);
    /* 전에 낸 답이 있으면 격자에 되살린다 */
    setPicked(new Set(data.mySlots));
  }, [roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (date: string, hour: number) => {
    if (isPastCell(date, hour)) {
      return;
    }

    setPicked((prev) => {
      const next = new Set(prev);
      const k = cellKey(date, hour);

      if (next.has(k)) {
        next.delete(k);
      } else {
        next.add(k);
      }

      return next;
    });
  };

  const slots = toSlots(picked, days);

  const othersCells = useMemo(
    () => new Set(status?.othersSlots ?? []),
    [status],
  );

  /* 내 답을 방에 저장하고 AI 추천으로 넘어간다 */
  const goNext = async () => {
    if (!roomId || !origin || slots.length === 0) return;

    setSaving(true);
    const error = await saveMyAvailability(roomId, [...picked]);
    setSaving(false);

    if (error) {
      Alert.alert('저장 실패', error.message);
      return;
    }

    navigate('ScheduleConfirmed', { roomId, name, invitees, origin });
  };

  /*
   * 뒤로 갈 때 STEP 1 이 다시 채울 수 있게 입력값을 실어 보낸다.
   *
   * 방은 여기서 지운다. STEP 1 의 "다음" 이 방을 먼저 만들기 때문에 — 조율은
   * 방이 있어야 시작되니 어쩔 수 없다 — 그냥 돌아가면 아무도 안 쓰는 방이
   * 채팅 목록에 남고, 다시 "다음" 을 누르면 방이 하나 더 생겼다.
   * leave_room 은 마지막 사람이 나가면 방까지 지운다.
   */
  const goPrev = () => {
    if (roomId) void leaveRoom(roomId);
    goBackWith({ name, invitees, origin });
  };

  return (
    <View style={styles.screen}>
      <View
        style={{
          height: topInset,
          backgroundColor: colors.surface,
        }}
      />

      <AppHeader />

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <ScheduleStepHeader
          step={2}
          title="언제 만날까요?"
          subtitle="가능한 시간을 탭해서 표시해 주세요"
          onBack={goPrev}
        />

        <View style={styles.gridWrap}>
          <AvailabilityGrid
            days={days}
            picked={picked}
            others={othersCells}
            onToggle={toggle}
          />
        </View>

        <View style={styles.chipsWrap}>
          <PickedSlotChips slots={slots} />
        </View>

        {status ? (
          <View style={styles.chipsWrap}>
            <SubmissionStatus members={status.members} />
          </View>
        ) : null}

        <CompleteButton
          label={saving ? '저장 중' : '선택 완료'}
          showNext
          disabled={saving || slots.length === 0 || !origin}
          style={styles.cta}
          onPress={() => void goNext()}
        />
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

  gridWrap: {
    marginTop: s(10),
    marginHorizontal: s(11.5),
  },

  chipsWrap: {
    marginTop: s(8),
    marginHorizontal: s(11.5),
  },

  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: s(4),
  },

  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: s(2),
  },

  hourLabel: {
    width: s(14),
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textMuted,
  },

  col: {
    flex: 1,
    paddingHorizontal: s(1.5),
  },

  headText: {
    textAlign: 'center',
    fontFamily: fontFamily.semibold,
    fontSize: fs(5.5),
    lineHeight: fs(8),
    color: colors.textPrimary,
  },

  sunday: {
    color: colors.primary,
  },

  cell: {
    height: s(13),
    borderRadius: s(4),
    backgroundColor: colors.surface,
  },

  cellOn: {
    backgroundColor: colors.primary,
  },

  cellDisabled: {
    opacity: 0.25,
  },

  pickedTitle: {
    marginTop: s(10),
    marginLeft: s(11.5),
    fontFamily: fontFamily.bold,
    fontSize: fs(8),
    lineHeight: fs(11),
    color: colors.textPrimary,
  },

  chipRow: {
    marginTop: s(5),
    marginHorizontal: s(11.5),
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(4),
  },

  chip: {
    paddingHorizontal: s(6),
    paddingVertical: s(3),
    borderRadius: s(5),
    backgroundColor: colors.primarySoft,
  },

  chipText: {
    fontFamily: fontFamily.semibold,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.primary,
  },

  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },

  cta: {
    marginTop: s(14),
    marginHorizontal: s(11.5),
  },
});