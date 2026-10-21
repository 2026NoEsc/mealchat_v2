import { Info, Share2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import BottomSheet from './BottomSheet';
import CopyButton from './CopyButton';
import Toast, { useToast } from './Toast';
import { fetchRoomLifecycle, fetchS3Capabilities } from '../../lib/roomLifecycle';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

export const inviteSubtitle = '초대 코드를 보내면 메이트가 바로 들어올 수 있어요.';
export function MateInviteContent({
  code,
  expiresAt,
  roomId,
}: {
  code: string;
  expiresAt?: string | null;
  roomId?: string;
}) {
  const { showToast, toastProps } = useToast();
  const { height } = useWindowDimensions();
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isS3, setIsS3] = useState(false);
  const [serverExpiry, setServerExpiry] = useState<string | null>(null);
  const sharingRef = useRef(false);

  useEffect(() => {
    let active = true;
    setIsS3(false);
    setServerExpiry(null);
    void fetchS3Capabilities().then(async cap => {
      if (!active) return;
      setIsS3(cap.mode === 's3');
      if (cap.mode !== 's3') return;
      if (expiresAt) { setServerExpiry(expiresAt); return; }
      if (!roomId) return;
      const result = await fetchRoomLifecycle(roomId);
      if (active && result.data?.invite?.code === code) setServerExpiry(result.data.invite.expires_at);
    }).catch(() => {
      if (active) setIsS3(false);
    });
    return () => { active = false; };
  }, [code, roomId, expiresAt]);

  const share = async () => {
    if (sharingRef.current) return;
    sharingRef.current = true; setSharing(true); setError(null);
    try {
      await Share.share({ message: 'MEALCHAT 밥약에 초대해요!\n초대 코드: ' + code + '\nMEALCHAT 앱에서 홈 → + → 초대 코드 입력으로 참여해 주세요.' });
    } catch { setError('공유 창을 열지 못했어요. 초대 코드를 복사해 보내 주세요.'); }
    finally { sharingRef.current = false; setSharing(false); }
  };

  const codeLabelText = isS3 && serverExpiry && Number.isFinite(Date.parse(serverExpiry))
    ? `초대 코드 · ${new Date(serverExpiry).toLocaleString('ko-KR')}까지`
    : '초대 코드';

  return <>
    {/* [결정] S3 SD07 / Figma 561:2039: S3 capability가 켜졌을 때만 만료 안내 표시, 레거시는 '초대 코드'만 표시 */}
    <View style={styles.codeBox}><View style={styles.grow}><Text style={styles.codeLabel}>{codeLabelText}</Text><Text selectable style={styles.code}>{code}</Text></View>
      <CopyButton text={code} accessibilityLabel="초대 코드 복사" onCopied={() => showToast({ message: '초대 코드를 복사했어요' })} />
    </View>
    {/* [결정] S3 SD06 D6 A: 초대 코드 복사 및 OS 범용 공유만 제공, 초대 링크·카카오톡 전용 버튼 제외 */}
    <View style={styles.shareRow}><Pressable accessibilityRole="button" accessibilityLabel="초대 코드 공유" accessibilityState={{ disabled: sharing, busy: sharing }} disabled={sharing}
      onPress={() => void share()} style={[styles.shareAction, sharing && styles.disabled]}>
      <View style={styles.shareIcon}><Share2 size={24} color={colors.ink} /></View><Text style={styles.shareLabel}>{sharing ? '여는 중' : '공유하기'}</Text>
    </Pressable></View>
    <View style={styles.hint}><Info size={16} color={colors.sub} /><Text style={styles.note}>MEALCHAT 앱에서 홈의 + → 초대 코드 입력으로 참여할 수 있어요.</Text></View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Toast {...toastProps} bottom={Math.max(16, height - 164)} />
  </>;
}
export default function MateInviteSheet({
  visible,
  code,
  expiresAt,
  roomId,
  onClose,
}: {
  visible: boolean;
  code: string;
  expiresAt?: string | null;
  roomId?: string;
  onClose: () => void;
}) {
  return <BottomSheet visible={visible} title="메이트 초대" subtitle={inviteSubtitle} onClose={onClose}>{visible ? <MateInviteContent code={code} roomId={roomId} expiresAt={expiresAt} /> : null}</BottomSheet>;
}
const styles = StyleSheet.create({
  codeBox: { backgroundColor: colors.selectedBg, borderRadius: 12, paddingLeft: 16, paddingRight: 8, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1, minWidth: 0 }, codeLabel: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 18, color: colors.selectedText },
  code: { fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 38, letterSpacing: 4, color: colors.selectedText },
  shareRow: { flexDirection: 'row', justifyContent: 'center' }, shareAction: { minWidth: 88, minHeight: 88, paddingVertical: 4, gap: 6, alignItems: 'center' },
  shareIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.mutedBg, alignItems: 'center', justifyContent: 'center' },
  shareLabel: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 19, color: colors.ink }, disabled: { opacity: 0.5 },
  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, note: { flex: 1, fontFamily: fontFamily.body, fontSize: 13, lineHeight: 19, color: colors.sub },
  error: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20, color: v3FeedbackColors.error },
});
