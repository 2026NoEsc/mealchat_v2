import { AlertCircle, Check, Copy } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Clipboard, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { v3Layout } from '../../theme/scale';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

/** Writes real clipboard contents; no success state is shown if the browser refuses. */
export async function copyToClipboard(text: string): Promise<void> {
  if (Platform.OS !== 'web') {
    // RN 0.81 still ships the native Clipboard module. No new native dependency required.
    Clipboard.setString(text);
    return;
  }
  if (globalThis.navigator?.clipboard?.writeText) {
    try { await globalThis.navigator.clipboard.writeText(text); return; }
    catch { /* Older browsers may still allow the user-initiated fallback below. */ }
  }
  const input = document.createElement('textarea');
  input.value = text;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  try {
    if (!document.execCommand('copy')) throw new Error('Clipboard access denied');
  } finally { input.remove(); }
}

/** Figma 597:2254; compact is the 44px account-copy instance at 521:1600. */
export default function CopyButton({ text, compact = false, accessibilityLabel = '복사', failureHint = '내용을 길게 눌러 직접 복사해 주세요', onCopied }: {
  text: string; compact?: boolean; accessibilityLabel?: string; failureHint?: string; onCopied?: () => void;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (timer.current) clearTimeout(timer.current); }; }, []);
  const copy = async () => {
    try {
      await copyToClipboard(text);
      if (!mounted.current) return;
      setState('copied');
      // An observer cannot turn a successful clipboard write into a copy failure.
      try { onCopied?.(); } catch { /* Clipboard contents were already written. */ }
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility('복사됨');
    } catch {
      if (!mounted.current) return;
      setState('error');
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility('복사 실패');
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  };
  const Icon = state === 'copied' ? Check : state === 'error' ? AlertCircle : Copy;
  const label = state === 'copied' ? '복사됨' : state === 'error' ? '복사 실패' : '복사';
  return <Pressable accessibilityRole="button" accessibilityLabel={state === 'idle' ? accessibilityLabel : label}
    accessibilityLiveRegion="polite" accessibilityHint={state === 'error' ? failureHint : undefined}
    onPress={() => void copy()} style={({ pressed }) => [styles.button, state !== 'idle' && styles.feedback, compact && styles.compact, pressed && styles.pressed]}>
    <Icon size={compact ? 20 : 16} color={state === 'error' ? v3FeedbackColors.error : colors.ink} />
    {!compact ? <Text style={styles.label} accessibilityLiveRegion="polite">{label}</Text> : null}
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { width: 84, minWidth: 84, alignSelf: 'flex-start', minHeight: v3Layout.minTouchTarget, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' },
  feedback: { width: 'auto' },
  compact: { minWidth: v3Layout.minTouchTarget, width: v3Layout.minTouchTarget, borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0 },
  label: { fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 21, color: colors.ink },
  pressed: { opacity: 0.8 },
});
