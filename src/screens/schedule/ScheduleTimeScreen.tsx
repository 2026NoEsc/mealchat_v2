import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppHeader from '../../components/AppHeader';
import AvailabilityGrid from '../../components/AvailabilityGrid';
import PickedSlotChips from '../../components/PickedSlotChips';
import { CompleteButton } from '../../components/ui/Button';
import { useNavigation } from '../../navigation/NavigationContext';
import {
  buildNextDays,
  cellKey,
  isPastCell,
  toSlots,
} from '../../lib/scheduleSlots';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';
import ScheduleStepHeader from './ScheduleStepHeader';
import type { MyLocation } from '../../lib/myLocation';

type Params = {
  name?: string;
  invitees?: string[];
  /** STEP 1 에서 잡은 내 위치 — 중간 지점 계산에 쓴다 */
  origin?: MyLocation;
  /** STEP 3 에서 뒤로 돌아올 때 되돌려받는 선택 칸 */
  picked?: string[];
};

export default function ScheduleTimeScreen() {
  const insets = useSafeAreaInsets();
  const { navigate, goBackWith, current } = useNavigation();

  const params = current.params as Params | undefined;

  const name = params?.name ?? '';
  const invitees = params?.invitees ?? [];
  const origin = params?.origin;

  const days = useMemo(() => buildNextDays(5), []);

  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(params?.picked ?? []),
  );

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

  /*
   * AI 추천은 여기서 돌리지 않는다.
   *
   * 이 시점에는 메이트에게 아무것도 물어보지 않은 상태라, 추천을 돌려 봐야
   * "저장된 개인 일정과 안 겹치는 후보" 일 뿐 실제 참석 여부가 아니다. 방을
   * 먼저 만들어 가능한 시간을 모으고, 그 결과로 추천을 받는다.
   */
  const goConfirm = () => {
    if (!origin || slots.length === 0) {
      return;
    }

    navigate('ScheduleConfirmed', {
      name,
      invitees,
      origin,
      slots,
      // 확정 화면에서 뒤로 올 때 그대로 돌려주면 격자 선택이 살아난다
      picked: [...picked],
    });
  };

  /* 뒤로 갈 때 STEP 1 이 다시 채울 수 있게 입력값을 실어 보낸다 */
  const goPrev = () =>
    goBackWith({ name, invitees, origin });

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
            onToggle={toggle}
          />
        </View>

        <View style={styles.chipsWrap}>
          <PickedSlotChips slots={slots} />
        </View>

        <CompleteButton
          label="밥약 방 만들기"
          showNext
          disabled={
            slots.length === 0 || !origin
          }
          style={styles.cta}
          onPress={goConfirm}
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
    fontFamily: fontFamily.body,
    fontSize: fs(5.5),
    lineHeight: fs(8),
    fontWeight: weight.semibold,
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
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    lineHeight: fs(11),
    fontWeight: weight.bold,
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
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    fontWeight: weight.semibold,
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