import { Crown, Info, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { roomLifecycleErrorMessage, type OwnerTransfer } from '../../lib/roomLifecycle';
import type { RoomParticipant } from '../../lib/rooms';
import { Button } from '../../components/ui/Button';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

/**
 * [결정] S3 D2 A: 동의 기반 방장 위임 상태 카드
 * 당사자(요청자, 대상자)에게만 노출되며, 제3자에게는 상세 및 조작을 노출하지 않는다.
 */
export default function OwnerTransferCard({
  transfer,
  myId,
  participants = [],
  onCancel,
  onRespond,
}: {
  transfer: OwnerTransfer | null;
  myId: string | null;
  participants?: RoomParticipant[];
  onCancel?: () => Promise<void>;
  onRespond?: (accept: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const terminalKey = transfer && transfer.status !== 'pending' ? `${transfer.id}:${transfer.status}` : null;
  useEffect(() => {
    setActionError(null);
    if (!terminalKey) return;
    const timer = setTimeout(() => setDismissedId(terminalKey), 8000);
    return () => clearTimeout(timer);
  }, [terminalKey, transfer?.id]);

  if (!transfer || !myId || (terminalKey !== null && dismissedId === terminalKey)) return null;

  const isOwner = transfer.from_owner_id === myId;
  const isTarget = transfer.target_profile_id === myId;

  // 제3자에게는 조작 및 상세 카드를 노출하지 않음
  if (!isOwner && !isTarget) return null;

  const findName = (profileId: string | null) => {
    if (!profileId) return '메이트';
    const match = participants.find(p => p.profileId === profileId);
    return match?.name ?? '메이트';
  };

  const targetName = findName(transfer.target_profile_id);
  const ownerName = findName(transfer.from_owner_id);

  const handleCancel = async () => {
    if (busy || !onCancel) return;
    setBusy(true);
    setActionError(null);
    try {
      await onCancel();
    } catch (err: unknown) {
      setActionError(roomLifecycleErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRespond = async (accept: boolean) => {
    if (busy || !onRespond) return;
    setBusy(true);
    setActionError(null);
    try {
      await onRespond(accept);
    } catch (err: unknown) {
      setActionError(roomLifecycleErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (transfer.status === 'pending') {
    if (isOwner) {
      return (
        <View style={styles.card}>
          <View style={styles.head}>
            <View style={styles.iconCircle}>
              <Crown size={18} color={colors.primary} />
            </View>
            <View style={styles.titleBox}>
              <Text style={styles.title}>방장 넘기기 대기 중</Text>
              <Text style={styles.sub}>
                {`${targetName}님에게 방장 넘기기를 요청했어요.`}
              </Text>
            </View>
          </View>
          <Text style={styles.hint}>
            {transfer.leave_after_accept
              ? '상대방이 수락하면 나는 방에서 나가요.'
              : '상대방이 수락한 후에도 일반 메이트로 방에 남아요.'}
          </Text>
          <Text style={styles.hint}>{`수락 기한: ${new Date(transfer.expires_at).toLocaleString('ko-KR')}`}</Text>
          {actionError ? <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text> : null}
          <Button
            label="요청 취소"
            variant="secondary"
            disabled={busy}
            loading={busy}
            onPress={() => void handleCancel()}
            style={styles.actionBtn}
          />
        </View>
      );
    }

    if (isTarget) {
      return (
        <View style={styles.card}>
          <View style={styles.head}>
            <View style={styles.iconCircle}>
              <Crown size={18} color={colors.primary} />
            </View>
            <View style={styles.titleBox}>
              <Text style={styles.title}>방장 넘기기 요청을 받았어요</Text>
              <Text style={styles.sub}>
                {`${ownerName}님이 방장 권한을 넘기려 해요.`}
              </Text>
            </View>
          </View>
          <Text style={styles.hint}>
            {transfer.leave_after_accept
              ? `수락하면 ${ownerName}님은 방에서 나가요.`
              : `수락 후에도 ${ownerName}님은 메이트로 남아요.`}
          </Text>
          <Text style={styles.hint}>{`수락 기한: ${new Date(transfer.expires_at).toLocaleString('ko-KR')}`}</Text>
          {actionError ? <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text> : null}
          <View style={styles.buttonRow}>
            <Button
              label="거절"
              variant="secondary"
              disabled={busy}
              onPress={() => void handleRespond(false)}
              style={styles.halfBtn}
            />
            <Button
              label="수락하기"
              variant="primary"
              disabled={busy}
              loading={busy}
              onPress={() => void handleRespond(true)}
              style={styles.halfBtn}
            />
          </View>
        </View>
      );
    }
  }

  // 종료 상태 (declined, expired, cancelled, accepted) 피드백 카드
  let statusMessage = '';
  if (transfer.status === 'declined') {
    statusMessage = isOwner ? `${targetName}님이 방장 넘기기를 거절했어요.` : '방장 넘기기 요청을 거절했어요.';
  } else if (transfer.status === 'expired') {
    statusMessage = '방장 넘기기 요청이 만료되었어요.';
  } else if (transfer.status === 'cancelled') {
    statusMessage = isOwner ? '방장 넘기기 요청을 취소했어요.' : '방장이 넘기기 요청을 취소했어요.';
  } else if (transfer.status === 'accepted') {
    statusMessage = isOwner ? '방장을 넘겼어요.' : '방장이 되었어요!';
  }

  return (
    <View style={[styles.card, styles.finishedCard]}>
      <Info size={16} color={colors.sub} />
      <Text style={styles.finishedText}>{statusMessage}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="안내 닫기" onPress={() => setDismissedId(terminalKey)} hitSlop={8}>
        <X size={16} color={colors.sub} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  finishedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.mutedBg,
    borderColor: 'transparent',
    paddingVertical: 12,
  },
  finishedText: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.sub,
    flex: 1,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.selectedBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBox: {
    flex: 1,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
  sub: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.sub,
  },
  hint: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.selectedText,
    backgroundColor: colors.selectedBg,
    padding: 10,
    borderRadius: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  halfBtn: {
    flex: 1,
  },
  actionBtn: {
    alignSelf: 'stretch',
  },
  error: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: v3FeedbackColors.error,
  },
});
