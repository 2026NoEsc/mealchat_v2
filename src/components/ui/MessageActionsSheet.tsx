import { Copy, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Avatar from '../Avatar';
import BottomSheet from './BottomSheet';
import { copyToClipboard } from './CopyButton';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

export type CopyableMessage = { text: string; name: string; senderId?: string | null; avatarUrl?: string | null };
export default function MessageActionsSheet({ message, onClose, onCopied }: { message: CopyableMessage | null; onClose: () => void; onCopied: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const copying = useRef(false);
  useEffect(() => { setError(null); }, [message]);
  const copy = async () => {
    if (!message || copying.current) return;
    copying.current = true; setError(null);
    try { await copyToClipboard(message.text); onClose(); onCopied(); }
    catch { setError('복사하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    finally { copying.current = false; }
  };
  return <BottomSheet visible={Boolean(message)} title="" onClose={onClose} contentStyle={styles.surface}>
    <View style={styles.quote}><Avatar name={message?.name ?? ''} seed={message?.senderId ?? undefined} url={message?.avatarUrl} size={32} />
      <View style={styles.grow}><Text style={styles.name}>{message?.name}</Text><Text style={styles.message} numberOfLines={3}>{message?.text}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="메시지 메뉴 닫기" onPress={onClose} style={styles.close}><X size={22} color={colors.ink} /></Pressable>
    </View>
    {/* TODO(서버 단계): 답장·삭제·신고·차단은 서버 계약 이후에만 노출한다. */}
    <Pressable accessibilityRole="button" accessibilityLabel="메시지 복사" onPress={() => void copy()} style={styles.action}><Copy size={20} color={colors.ink} /><Text style={styles.actionText}>복사</Text></Pressable>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </BottomSheet>;
}
const styles = StyleSheet.create({
  surface: { paddingHorizontal: 8, gap: 0 }, quote: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  grow: { flex: 1, minWidth: 0 }, name: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 18, color: colors.sub }, message: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, action: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 12 },
  actionText: { fontFamily: fontFamily.medium, fontSize: 16, lineHeight: 23, color: colors.ink }, error: { padding: 12, fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, color: v3FeedbackColors.error },
});
