import { CheckSquare, Square, UserCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import BottomSheet from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import RoomMemberRow from '../../components/ui/RoomMemberRow';
import { roomLifecycleErrorMessage } from '../../lib/roomLifecycle';
import { confirmedLeaveMessage } from '../../lib/roomLifecycleController';
import type { RoomParticipant, RoomStage } from '../../lib/rooms';
import { v3Colors as colors, v3FeedbackColors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';

/**
 * [결정] S3 D2 A: 동의 기반 방장 위임 시트
 * 다른 실제 현재 메이트를 지정하고 상대 동의 후 위임한다.
 * 요청 시 leave_after_accept(수락 후 나가기 여부)를 고정한다.
 */
export default function OwnerTransferSheet({
  visible,
  roomId,
  stage,
  myId,
  participants = [],
  onClose,
  onSubmit,
}: {
  visible: boolean;
  roomId: string;
  stage?: RoomStage | string | null;
  myId: string | null;
  participants: RoomParticipant[];
  onClose: () => void;
  onSubmit: (targetProfileId: string, leaveAfterAccept: boolean) => Promise<void>;
}) {
  const [selectedTarget, setSelectedTarget] = useState<RoomParticipant | null>(null);
  const [leaveAfterAccept, setLeaveAfterAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 본인 및 profileId가 없는 표시행 제외
  const eligibleMates = participants.filter(
    p => p.profileId !== null && p.profileId !== myId
  );

  const handleClose = () => {
    if (busy) return;
    setSelectedTarget(null);
    setLeaveAfterAccept(false);
    setError(null);
    onClose();
  };

  const handleTransfer = async () => {
    if (!selectedTarget?.profileId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(selectedTarget.profileId, leaveAfterAccept);
      setSelectedTarget(null);
      setLeaveAfterAccept(false);
      setError(null);
      onClose();
    } catch (err: unknown) {
      setError(roomLifecycleErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      title="방장 넘기기"
      subtitle={selectedTarget ? `${selectedTarget.name}님에게 방장을 넘길까요?` : '방장을 넘길 메이트를 선택해 주세요'}
      onClose={handleClose}
    >
      <View style={styles.content}>
        {!selectedTarget ? (
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {eligibleMates.length > 0 ? (
              eligibleMates.map(member => (
                <RoomMemberRow
                  key={member.id}
                  participant={member}
                  myId={myId}
                  ownerId={myId}
                  onPress={() => setSelectedTarget(member)}
                />
              ))
            ) : (
              <Text style={styles.emptyText}>방장을 넘길 수 있는 다른 메이트가 없어요.</Text>
            )}
          </ScrollView>
        ) : (
          <View style={styles.confirmBox}>
            <View style={styles.selectedRow}>
              <UserCheck size={20} color={colors.primary} />
              <Text style={styles.selectedName}>{selectedTarget.name}님</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="다른 메이트 선택"
                onPress={() => setSelectedTarget(null)}
                disabled={busy}
                style={styles.changeTargetBtn}
              >
                <Text style={styles.changeTargetText}>변경</Text>
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: leaveAfterAccept }}
              accessibilityLabel="방장을 넘긴 뒤 방 나가기"
              style={styles.optionRow}
              disabled={busy}
              onPress={() => setLeaveAfterAccept(!leaveAfterAccept)}
            >
              {leaveAfterAccept ? (
                <CheckSquare size={20} color={colors.primary} />
              ) : (
                <Square size={20} color={colors.sub} />
              )}
              <Text style={styles.optionLabel}>방장을 넘긴 뒤 방 나가기</Text>
            </Pressable>

            {leaveAfterAccept && stage === 'confirmed' ? (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>{confirmedLeaveMessage}</Text>
              </View>
            ) : null}

            <Text style={styles.ttlHint}>수락 기한은 요청 후 서버에서 확인할 수 있어요.</Text>

            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

            <View style={styles.btnRow}>
              <Button
                label="이전"
                variant="secondary"
                disabled={busy}
                onPress={() => setSelectedTarget(null)}
                style={styles.halfBtn}
              />
              <Button
                label="요청 보내기"
                variant="primary"
                disabled={busy}
                loading={busy}
                onPress={() => void handleTransfer()}
                style={styles.halfBtn}
              />
            </View>
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 8,
  },
  list: {
    maxHeight: 280,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.sub,
    textAlign: 'center',
    paddingVertical: 24,
  },
  confirmBox: {
    gap: 16,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.selectedBg,
    padding: 12,
    borderRadius: 12,
  },
  selectedName: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 22,
    color: colors.selectedText,
  },
  changeTargetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  changeTargetText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.primary,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  optionLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  noticeBox: {
    backgroundColor: colors.mutedBg,
    padding: 12,
    borderRadius: 10,
  },
  noticeText: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.sub,
  },
  ttlHint: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.sub,
  },
  error: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: v3FeedbackColors.error,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  halfBtn: {
    flex: 1,
  },
});
