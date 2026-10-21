import { AlertTriangle } from 'lucide-react-native';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { v3Layout } from '../../theme/scale';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { Button } from './Button';
import { chatFeedbackColors } from './chatTokens';

/** Phone 528:1684: cancellation never invokes the destructive operation. */
export default function DestructiveDialog({
  visible,
  busy,
  title = '방을 없앨까요?',
  description = '메이트 모두에게서 방과 모든 사람의 채팅이 사라져요.\n정산 내역은 남아 있어요.',
  confirmLabel = '없애기',
  cancelLabel = '그대로 둘게요',
  error,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  busy: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={() => { if (!busy) onClose(); }}>
    <View style={styles.root}>
      <View style={styles.scrim} />
      <View style={styles.dialog} accessibilityViewIsModal aria-modal onAccessibilityEscape={() => { if (!busy) onClose(); }}>
        <View style={styles.icon}><AlertTriangle size={24} color={v3FeedbackColors.error} /></View>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        <Text style={styles.description}>{description}</Text>
        {error ? <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text> : null}
        <View style={styles.buttons}>
          <Button label={cancelLabel} variant="secondary" disabled={busy} onPress={onClose} style={styles.button} />
          <Pressable accessibilityRole="button" accessibilityLabel={confirmLabel} accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={onConfirm} style={[styles.confirm, busy && styles.disabled]}>
            {busy ? <ActivityIndicator color={colors.surface} /> : null}<Text style={styles.confirmText}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>;
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
  confirm: { flex: 1, minHeight: v3Layout.buttonHeight, borderRadius: 14, backgroundColor: v3FeedbackColors.error, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  confirmText: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 24, color: colors.surface },
  disabled: { opacity: 0.4 },
});
