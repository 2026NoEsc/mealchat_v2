import { Check } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { profileFeedbackColors } from '../../theme/profileTokens';
import { v3Layout } from '../../theme/scale';
import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

export type ToastOptions = {
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  durationMs?: number;
};
export type ToastProps = { toast: (ToastOptions & { id: number }) | null; onDismiss: () => void; bottom?: number; onActionError?: () => void };
export const toastLayout = { gap: 16, durationMs: 3000, actionDurationMs: 5000, accessibleActionDurationMs: 10000 } as const;

/**
 * Screen-local API; no App.tsx provider required. Home and other screens can use:
 * const { showToast, toastProps } = useToast();
 * showToast({ message: '저장했어요', actionLabel: '되돌리기', onAction: undo });
 * Render <Toast {...toastProps} bottom={footerHeight + 16} /> last inside the
 * screen. The navigator owns the tabs, so bottom=16 sits 16 above those tabs.
 * Replaces the previous message; 3s normally, 5s with an action (at least 10s
 * with a screen reader). Actions run once; rejected actions show a generic error.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastProps['toast']>(null);
  const sequence = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Until the async check resolves, assume a screen reader so the first Undo
  // cannot expire before it is announced. Keep that toast's initial 10s window
  // even if the check later returns false; later actions use the known setting.
  const screenReader = useRef(true);
  const current = useRef<ToastProps['toast']>(null);
  const mounted = useRef(true);
  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    current.current = null;
    setToast(null);
  }, []);
  const showToast = useCallback((options: ToastOptions) => {
    if (!mounted.current) return;
    if (timer.current) clearTimeout(timer.current);
    const requested = options.durationMs ?? (options.onAction ? toastLayout.actionDurationMs : toastLayout.durationMs);
    const durationMs = options.onAction && screenReader.current ? Math.max(requested, toastLayout.accessibleActionDurationMs) : requested;
    current.current = { ...options, id: ++sequence.current, durationMs };
    setToast(current.current);
    timer.current = setTimeout(dismiss, durationMs);
  }, [dismiss]);
  useEffect(() => {
    mounted.current = true;
    let listening = true;
    const updateReader = (enabled: boolean) => {
      if (!listening) return;
      screenReader.current = enabled;
      if (enabled && current.current?.onAction) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(dismiss, Math.max(current.current.durationMs ?? 0, toastLayout.accessibleActionDurationMs));
      }
    };
    void AccessibilityInfo.isScreenReaderEnabled().then(updateReader).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', updateReader);
    return () => {
      listening = false;
      mounted.current = false;
      subscription.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [dismiss]);
  const actionError = useCallback(() => showToast({ message: '작업을 완료하지 못했어요. 다시 시도해 주세요.' }), [showToast]);
  return { showToast, dismissToast: dismiss, toastProps: { toast, onDismiss: dismiss, onActionError: actionError } };
}

export default function Toast({ toast, onDismiss, bottom = toastLayout.gap, onActionError }: ToastProps) {
  const acted = useRef<number | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (toast && Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(toast.message + (toast.actionLabel ? '. ' + toast.actionLabel + ' 버튼을 사용할 수 있어요.' : ''));
  }, [toast]);
  if (!toast) return null;
  return <View pointerEvents="box-none" style={[styles.position, { bottom }]}>
    <View style={styles.toast}>
      <Check size={18} strokeWidth={2.6} color={colors.surface} aria-hidden={true} />
      <Text key={toast.id} aria-live={Platform.OS === 'web' ? 'polite' : undefined} aria-atomic={true} style={styles.message}>{toast.message}</Text>
      {toast.actionLabel && toast.onAction ? <Pressable accessibilityRole="button" accessibilityLabel={toast.actionLabel}
        onPress={() => {
          if (acted.current === toast.id) return;
          acted.current = toast.id;
          onDismiss();
          void Promise.resolve().then(() => toast.onAction?.()).catch(() => {
            if (!mounted.current) return;
            if (onActionError) onActionError();
            else console.warn('Toast action failed.'); // Never log the exception or user data.
          });
        }} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
        <Text style={styles.actionText}>{toast.actionLabel}</Text>
      </Pressable> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  position: { position: 'absolute', left: 20, right: 20, alignItems: 'center', zIndex: 20 },
  toast: { width: '100%', maxWidth: 372, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 8, borderRadius: 12, backgroundColor: colors.ink },
  message: { flex: 1, minWidth: 0, fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: colors.surface },
  action: { minHeight: v3Layout.minTouchTarget, minWidth: v3Layout.minTouchTarget, padding: 8, marginVertical: -12, justifyContent: 'center' },
  actionText: { fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 20, color: profileFeedbackColors.toastAction },
  pressed: { opacity: 0.8 },
});
