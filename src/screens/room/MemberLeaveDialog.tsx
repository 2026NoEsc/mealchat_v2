import { LogOut } from 'lucide-react-native';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { confirmedLeaveMessage, doneLeaveMessage } from '../../lib/roomLifecycleController';
import type { RoomStage } from '../../lib/rooms';
import { Button } from '../../components/ui/Button';
import { chatFeedbackColors } from '../../components/ui/chatTokens';
import { v3Layout } from '../../theme/scale';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

export function getLeaveMessage(stage: RoomStage | string | null | undefined): string {
  if (stage === 'confirmed') return confirmedLeaveMessage;
  if (stage === 'done') return doneLeaveMessage;
  return '방에서 나가면 대화 내용과 약속 정보를 더 이상 볼 수 없어요. 다시 들어오려면 초대 코드가 필요해요.';
}

export function getLeaveConfirmButtonLabel(stage: RoomStage | string | null | undefined): string {
  if (stage === 'confirmed') return '내용을 확인하고 나가기';
  return '나가기';
}

/**
 * [결정] S3 SD01: 일반 메이트 나가기 확인 대화상자 (Figma 561:1815 기반)
 * confirmed/done 단계별 법률·정산 안내 문구 적용
 */
export default function MemberLeaveDialog({
  visible,
  busy,
  stage,
  roomTitle,
  error,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  busy: boolean;
  stage?: RoomStage | string | null;
  roomTitle?: string;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const title = roomTitle?.trim() ? `${roomTitle.trim()}에서 나갈까요?` : '방에서 나갈까요?';
  const description = getLeaveMessage(stage);
  const confirmLabel = getLeaveConfirmButtonLabel(stage);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={() => { if (!busy) onClose(); }}>
      <View style={styles.root}>
        <View style={styles.scrim} />
        <View style={styles.dialog} accessibilityViewIsModal aria-modal onAccessibilityEscape={() => { if (!busy) onClose(); }}>
          <View style={styles.icon}>
            <LogOut size={24} color={v3FeedbackColors.error} />
          </View>
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          <Text style={styles.description}>{description}</Text>
          {error ? <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text> : null}
          <View style={styles.buttons}>
            <Button label="그대로 있을게요" variant="secondary" disabled={busy} onPress={onClose} style={styles.button} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              accessibilityState={{ disabled: busy, busy }}
              disabled={busy}
              onPress={onConfirm}
              style={[styles.confirm, busy && styles.disabled]}
            >
              {busy ? <ActivityIndicator color={colors.surface} /> : null}
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.ink, opacity: 0.5 },
  dialog: { width: 340, maxWidth: '100%', backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, alignItems: 'center', gap: 16 },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: chatFeedbackColors.alertBackground, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fontFamily.bold, fontSize: 19, lineHeight: 28, color: colors.ink, textAlign: 'center' },
  description: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, color: colors.sub, textAlign: 'center' },
  error: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: v3FeedbackColors.error, textAlign: 'center' },
  buttons: { alignSelf: 'stretch', flexDirection: 'row', gap: 8 },
  button: { flex: 1, paddingHorizontal: 8 },
  confirm: { flex: 1, minHeight: v3Layout.buttonHeight, borderRadius: 14, backgroundColor: v3FeedbackColors.error, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 8 },
  confirmText: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22, color: colors.surface, textAlign: 'center' },
  disabled: { opacity: 0.4 },
});
