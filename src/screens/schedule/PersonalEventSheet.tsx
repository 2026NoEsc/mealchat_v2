import { Clock, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../../components/ui/Button';
import ColorDot from '../../components/ui/ColorDot';
import TextField from '../../components/ui/TextField';
import { formatDateIn } from '../../lib/calendar';
import { formatTimeInput, isCompleteTime } from '../../lib/timeInput';
import { useKeyboardOverlap } from '../../theme/keyboard';
import { v3Layout } from '../../theme/scale';
import { scheduleColors, scheduleEventColors, scheduleLayout as layout } from '../../theme/scheduleTokens';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

export type PersonalEvent = { id: string; title: string; time: string; color: string; device?: boolean };
export const EVENT_COLORS = scheduleEventColors.map((entry) => entry.value);
export type PersonalEventTab = 'event' | 'memo';
export type PersonalEventSheetProps = {
  visible: boolean; session: number; year: number; month: number; day: number;
  editing?: PersonalEvent | null; memo: string; initialTab?: PersonalEventTab;
  onClose: () => void;
  onSave: (event: PersonalEvent) => Promise<boolean>;
  onSaveMemo: (memo: string) => Promise<boolean>;
  onDelete?: (id: string) => Promise<boolean>;
};

/** One sheet owns both drafts; switching tabs never discards unsaved input. */
export default function PersonalEventSheet(props: PersonalEventSheetProps) {
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <SafeAreaProvider><SheetContent key={props.session} {...props} /></SafeAreaProvider>
    </Modal>
  );
}
function SheetContent({ year, month, day, editing, memo, initialTab = 'event', onClose, onSave, onSaveMemo, onDelete }: PersonalEventSheetProps) {
  const insets = useSafeAreaInsets();
  const rootRef = useRef<View>(null);
  const { overlap, remeasure } = useKeyboardOverlap(rootRef);
  const [tab, setTab] = useState<PersonalEventTab>(initialTab);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [initialStart, initialEnd] = editing?.time.split('~').map((part) => part.trim()) ?? [];
  const [start, setStart] = useState(initialStart ?? '');
  const [end, setEnd] = useState(initialEnd ?? '');
  const [color, setColor] = useState<string>(editing?.color ?? EVENT_COLORS[0]);
  const colorOptions = editing?.color && !EVENT_COLORS.includes(editing.color as (typeof EVENT_COLORS)[number])
    ? [...scheduleEventColors, { value: editing.color, label: '기존 색상', check: colors.ink }] : scheduleEventColors;
  const [draftMemo, setDraftMemo] = useState(memo);
  const [saving, setSaving] = useState(false);
  const [timeError, setTimeError] = useState<string>();
  const [saveError, setSaveError] = useState<string>();
  const close = () => { if (!saving) onClose(); };
  const save = async () => {
    if (saving) return;
    if (tab === 'event' && (!isCompleteTime(start) || !isCompleteTime(end))) {
      setTimeError('시작과 끝을 09:00처럼 네 자리로 넣어 주세요.');
      return;
    }
    if (tab === 'event' && !title.trim()) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      const saved = tab === 'memo'
        ? await onSaveMemo(draftMemo.trim())
        : await onSave({ id: editing?.id ?? String(Date.now()), title: title.trim(), time: start + ' ~ ' + end, color });
      if (saved) onClose();
    } catch {
      setSaveError('저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally { setSaving(false); }
  };
  const remove = async () => {
    if (saving || !editing || !onDelete) return;
    setSaving(true);
    setSaveError(undefined);
    try { if (await onDelete(editing.id)) onClose(); }
    catch { setSaveError('삭제하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    finally { setSaving(false); }
  };
  return (
    <View ref={rootRef} onLayout={remeasure} style={[styles.overlay, { paddingBottom: overlap }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="일정 시트 닫기" style={StyleSheet.absoluteFill} onPress={close} />
      <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: layout.footerBottom + insets.bottom }]}>
        <View style={styles.handle} accessible={false} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.fields}>
          <View style={styles.head}>
            <View style={styles.flex}>
              <Text accessibilityRole="header" style={styles.title}>{formatDateIn(year, month, day)}</Text>
              <Text style={styles.subtitle}>내 일정과 이 날짜의 약속 메모를 남겨요.</Text>
              {/* TODO(서버 단계): 개인 일정의 바쁜 시간 공유 계약을 연결한다. 현재 API는 개인 일정 저장만 지원한다. */}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="닫기" disabled={saving} onPress={close} style={styles.close}>
              <X size={24} color={colors.ink} />
            </Pressable>
          </View>
          <View accessibilityRole="tablist" style={styles.tabs}>
            {(['event', 'memo'] as const).map((key) => (
              <Pressable key={key} accessibilityRole="tab" accessibilityLabel={key === 'event' ? '일정' : '약속 메모'}
                accessibilityState={{ selected: tab === key, disabled: saving }} aria-selected={tab === key}
                disabled={saving} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.tabOn]}>
                <Text style={[styles.tabLabel, tab === key && styles.tabLabelOn]}>{key === 'event' ? '일정' : '약속 메모'}</Text>
              </Pressable>
            ))}
          </View>
          {tab === 'event' ? <>
            <TextField label="일정 이름" value={title} onChangeText={setTitle} placeholder="예: 알바, 스터디" editable={!saving} />
            <View>
              <Text style={styles.label}>시간</Text>
              <View style={styles.times}>
                <View style={styles.timeField}><View pointerEvents="none" style={styles.clock}><Clock size={18} color={colors.sub} /></View><TextField label="시작" accessibilityLabel="시작 시간" value={start} onChangeText={(text) => { setStart(formatTimeInput(text)); setTimeError(undefined); }} placeholder="09:00" keyboardType="number-pad" maxLength={5} editable={!saving} containerStyle={styles.flex} style={styles.timeInput} /></View>
                <Text style={styles.tilde}>~</Text>
                <View style={styles.timeField}><View pointerEvents="none" style={styles.clock}><Clock size={18} color={colors.sub} /></View><TextField label="끝" accessibilityLabel="끝 시간" value={end} onChangeText={(text) => { setEnd(formatTimeInput(text)); setTimeError(undefined); }} placeholder="10:00" keyboardType="number-pad" maxLength={5} editable={!saving} containerStyle={styles.flex} style={styles.timeInput} /></View>
              </View>
              {timeError ? <Text accessibilityRole="alert" style={styles.error}>{timeError}</Text> : null}
            </View>
            <View>
              <Text style={styles.label}>색상</Text>
              <View accessibilityRole="radiogroup" accessibilityLabel="일정 색상" style={styles.colors}>
                {colorOptions.map((entry) => <ColorDot key={entry.value} color={entry.value} label={entry.label} selected={color === entry.value} disabled={saving} onSelect={() => setColor(entry.value)} />)}
              </View>
            </View>
          </> : <TextField label="약속 메모" value={draftMemo} onChangeText={setDraftMemo} placeholder="예: 저녁 약속 잡기 좋은 날" multiline editable={!saving} style={styles.memoInput} />}
          {saveError ? <Text accessibilityRole="alert" style={styles.error}>{saveError}</Text> : null}
          <Button label={tab === 'memo' ? '저장하기' : editing ? '수정하기' : '추가하기'} loading={saving} disabled={tab === 'event' && !title.trim()} onPress={() => void save()} />
          {tab === 'event' && editing && onDelete ? <Pressable accessibilityRole="button" accessibilityLabel="일정 삭제" disabled={saving} onPress={() => void remove()} style={styles.delete}><Text style={styles.deleteText}>일정 삭제</Text></Pressable> : null}
          {tab === 'memo' && memo ? <Pressable accessibilityRole="button" accessibilityLabel="메모 지우기" disabled={saving} style={styles.delete} onPress={async () => { if (saving) return; setSaving(true); try { if (await onSaveMemo('')) onClose(); } catch { setSaveError('메모를 지우지 못했어요.'); } finally { setSaving(false); } }}><Text style={styles.deleteText}>메모 지우기</Text></Pressable> : null}
        </ScrollView>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: scheduleColors.scrim },
  sheet: { maxHeight: '92%', borderTopLeftRadius: layout.sheetRadius, borderTopRightRadius: layout.sheetRadius, backgroundColor: colors.surface, paddingHorizontal: layout.pagePadding, paddingTop: 8 },
  handle: { width: layout.sheetHandleWidth, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 },
  fields: { gap: layout.sectionGap }, flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 29, color: colors.ink },
  subtitle: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, color: colors.sub, marginTop: 2 },
  close: { width: v3Layout.minTouchTarget, height: v3Layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 14, backgroundColor: colors.mutedBg },
  tab: { flex: 1, minHeight: v3Layout.minTouchTarget, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  tabOn: { borderColor: colors.primary, backgroundColor: colors.surface },
  tabLabel: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: colors.sub },
  tabLabelOn: { fontFamily: fontFamily.bold, color: colors.ink },
  label: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 20, color: colors.sub, marginBottom: 6 },
  times: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeField: { flex: 1, minWidth: 0, position: 'relative' },
  clock: { position: 'absolute', left: 14, bottom: 17, zIndex: 1 },
  timeInput: { paddingLeft: 40, paddingRight: 14 },
  tilde: { alignSelf: 'flex-end', marginBottom: 14, lineHeight: 24, fontFamily: fontFamily.body, fontSize: 16, color: colors.sub },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memoInput: { minHeight: 120, textAlignVertical: 'top' },
  error: { color: v3FeedbackColors.error, fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19 },
  delete: { minHeight: v3Layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: v3FeedbackColors.error, fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 20 },
});
