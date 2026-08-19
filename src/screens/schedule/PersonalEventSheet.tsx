import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import BottomSheet from '../../components/BottomSheet';
import { CompleteButton, DangerButton } from '../../components/ui/Button';
import { formatDateIn } from '../../lib/calendar';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

export type PersonalEvent = {
  id: string;
  title: string;
  time: string;
  color: string;
  /** 기기 캘린더에서 동기화된 일정 — 앱에서 수정할 수 없다 */
  device?: boolean;
};

/** 일정 바 색상 — 일정 조율 화면의 기존 3색에 초록을 더했다 */
export const EVENT_COLORS = ['#5B9BD5', '#B483C8', '#04CDA3', '#FF9900'];

type EventSheetProps = {
  visible: boolean;
  /**
   * 열 때마다 증가하는 값. 입력 폼을 초기화하는 유일한 신호다.
   * `visible` 로 초기화하면 닫는 순간 Modal 까지 언마운트돼 iOS 슬라이드 애니메이션이 끊긴다.
   */
  session: number;
  year: number;
  month: number;
  day: number;
  /** 값이 있으면 수정, 없으면 새로 추가 */
  editing?: PersonalEvent | null;
  onClose: () => void;
  /** 저장에 성공했을 때만 true. 실패하면 시트를 열어 둬 입력을 잃지 않는다 */
  onSave: (event: PersonalEvent) => Promise<boolean>;
  onDelete?: (id: string) => void;
};

/** 개인 일정 추가·수정 시트 — 캘린더 앱의 기본 일정 입력에 해당한다 */
export function EventSheet({
  visible,
  session,
  year,
  month,
  day,
  editing,
  onClose,
  onSave,
  onDelete,
}: EventSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      title={editing ? '일정 수정' : '일정 추가'}
      subtitle={formatDateIn(year, month, day)}
      onClose={onClose}>
      <EventSheetFields
        key={session}
        editing={editing}
        onClose={onClose}
        onSave={onSave}
        onDelete={onDelete}
      />
    </BottomSheet>
  );
}

type EventSheetFieldsProps = Pick<EventSheetProps, 'editing' | 'onClose' | 'onSave' | 'onDelete'>;

function EventSheetFields({ editing, onClose, onSave, onDelete }: EventSheetFieldsProps) {
  const initial = initialEventDraft(editing);
  const [title, setTitle] = useState(initial.title);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [color, setColor] = useState(initial.color);

  const [saving, setSaving] = useState(false);

  /*
   * 예전에는 onSave 를 부르고 곧바로 닫았다. 저장이 실패해도 시트가 사라져서
   * 사용자는 방금 적은 것을 통째로 다시 입력해야 했다. 성공했을 때만 닫는다.
   */
  const save = async () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    const saved = await onSave({
      id: editing?.id ?? `${Date.now()}`,
      title: trimmed,
      time: `${start} ~ ${end}`,
      color,
    });
    setSaving(false);

    if (saved) onClose();
  };

  return (
    <>
      <Text style={styles.label}>일정 이름</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="예: 알바, 스터디"
        placeholderTextColor={colors.textMuted}
        autoFocus
      />

      <Text style={styles.label}>시간</Text>
      <View style={styles.timeRow}>
        <TextInput
          style={[styles.input, styles.timeInput]}
          value={start}
          onChangeText={setStart}
          placeholder="09:00"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.tilde}>~</Text>
        <TextInput
          style={[styles.input, styles.timeInput]}
          value={end}
          onChangeText={setEnd}
          placeholder="10:00"
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <Text style={styles.label}>색상</Text>
      <View style={styles.swatchRow}>
        {EVENT_COLORS.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            style={[
              styles.swatch,
              { backgroundColor: c },
              color === c && styles.swatchSelected,
            ]}
          />
        ))}
      </View>

      <CompleteButton
        label={editing ? '수정하기' : '추가하기'}
        style={styles.cta}
        disabled={saving || title.trim().length === 0}
        onPress={() => void save()}
      />

      {editing && onDelete ? (
        <DangerButton
          label="일정 삭제"
          style={styles.delete}
          onPress={() => {
            onDelete(editing.id);
            onClose();
          }}
        />
      ) : null}
    </>
  );
}

function initialEventDraft(editing: PersonalEvent | null | undefined) {
  if (!editing) {
    return { title: '', start: '09:00', end: '10:00', color: EVENT_COLORS[0] };
  }

  const [start, end] = editing.time.split('~').map((time) => time.trim());
  return {
    title: editing.title,
    start: start || '09:00',
    end: end || '10:00',
    color: editing.color,
  };
}

type MemoSheetProps = {
  visible: boolean;
  /** EventSheet 과 같은 이유로 열 때마다 증가한다 */
  session: number;
  year: number;
  month: number;
  day: number;
  memo: string;
  onClose: () => void;
  /** 저장에 성공했을 때만 true */
  onSave: (memo: string) => Promise<boolean>;
};

/** Figma "＋ 이 날짜에 약속 메모 남기기" 에 대응하는 메모 입력 시트 */
export function MemoSheet({
  visible,
  session,
  year,
  month,
  day,
  memo,
  onClose,
  onSave,
}: MemoSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      title="약속 메모"
      subtitle={`${formatDateIn(year, month, day)} 에 남길 메모`}
      onClose={onClose}>
      <MemoSheetFields key={session} memo={memo} onClose={onClose} onSave={onSave} />
    </BottomSheet>
  );
}

type MemoSheetFieldsProps = Pick<MemoSheetProps, 'memo' | 'onClose' | 'onSave'>;

function MemoSheetFields({ memo, onClose, onSave }: MemoSheetFieldsProps) {
  const [draft, setDraft] = useState(memo);
  const [saving, setSaving] = useState(false);

  /* 일정 시트와 같은 이유로 성공했을 때만 닫는다 */
  const save = async () => {
    if (saving) return;
    setSaving(true);
    const saved = await onSave(draft.trim());
    setSaving(false);
    if (saved) onClose();
  };

  return (
    <>
      <TextInput
        style={[styles.input, styles.memoInput]}
        value={draft}
        onChangeText={setDraft}
        placeholder="예: 저녁 약속 잡기 좋은 날"
        placeholderTextColor={colors.textMuted}
        multiline
        autoFocus
      />

      <CompleteButton
        label="저장하기"
        style={styles.cta}
        disabled={saving}
        onPress={() => void save()}
      />

      {memo ? (
        <DangerButton
          label="메모 지우기"
          style={styles.delete}
          onPress={() => {
            onSave('');
            onClose();
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    marginTop: s(12),
    marginBottom: s(3),
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    fontWeight: weight.semibold,
    color: colors.textPrimary,
  },
  input: {
    height: s(24),
    borderRadius: s(8),
    backgroundColor: colors.surface,
    paddingHorizontal: s(9),
    paddingVertical: 0,
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    color: colors.textPrimary,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
  },
  timeInput: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
  },
  tilde: {
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    color: colors.textMuted,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: s(8),
  },
  swatch: {
    width: s(20),
    height: s(20),
    borderRadius: s(20),
  },
  swatchSelected: {
    borderWidth: s(2),
    borderColor: colors.textPrimary,
  },
  memoInput: {
    marginTop: s(12),
    height: s(56),
    paddingTop: s(7),
    textAlignVertical: 'top',
  },
  cta: {
    marginTop: s(16),
  },
  delete: {
    marginTop: s(6),
  },
});
