import { AlertCircle, Clock, Ticket } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { notify } from '../lib/confirm';
import {
  createRoomInviteController,
  type RoomInviteView,
} from '../lib/roomInviteController';
import { fetchS3Capabilities, roomLifecycleErrorMessage } from '../lib/roomLifecycle';
import { isRoomMembershipClosed, membershipClosedMessage } from '../lib/roomMembership';
import { joinRoomByCode } from '../lib/rooms';
import { v3Layout } from '../theme/scale';
import { v3Colors as colors, v3FeedbackColors } from '../theme/tokens';
import { fontFamily } from '../theme/typography';
import BottomSheet from './ui/BottomSheet';
import { Button } from './ui/Button';
import TextField from './ui/TextField';

const CODE_LENGTH = 6;
const initialInviteState: RoomInviteView = {
  code: '', pending: false, preview: null, roomId: null,
  inviteRetryAt: null, retrySeconds: 0, error: null,
};

const JOIN_ERRORS: Record<string, string> = {
  'Invalid invite code': '코드를 다시 확인해 주세요. 없는 초대 코드예요.',
  'This invite has expired': '초대 기간이 지났어요. 새 코드를 받아 주세요.',
  'Authentication is required': '로그인이 풀렸어요. 다시 로그인해 주세요.',
};

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}분 ${s < 10 ? '0' : ''}${s}초`;
}

/**
 * [결정] S3 SD03 / SD04 / SD05 / Figma 543:1665, 559:1657, 590:2533:
 * 초대 코드 6칸 입력, 칸 안 오류 표시, 방 미리보기(제목+인원만, 방장/멤버 이름 제외),
 * 5회 잠금 카운트다운 안내.
 * 서버 capability가 legacy인 경우 기존 단일 입력으로 안전하게 fallback.
 */
export default function JoinCodeSheet({
  visible,
  onClose,
  onJoined,
  onMembershipClosed,
}: {
  visible: boolean;
  onClose: () => void;
  onJoined: (roomId: string) => void;
  onMembershipClosed?: () => void;
}) {
  const [s3Mode, setS3Mode] = useState<'s3' | 'legacy' | 'loading' | 'error' | 'unknown'>('unknown');
  const [probeAttempt, setProbeAttempt] = useState(0);
  const [inviteState, setInviteState] = useState<RoomInviteView>(initialInviteState);

  const controllerRef = useRef<ReturnType<typeof createRoomInviteController> | null>(null);
  const inputRef = useRef<TextInput | null>(null);

  // B4: 부모 리렌더 시 새 함수가 전달되어도 중복 호출 및 이전 방 재진입 방지
  const joinedRef = useRef<string | null>(null);
  const onJoinedRef = useRef(onJoined);
  onJoinedRef.current = onJoined;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // 레거시 fallback용 상태
  const [legacyCode, setLegacyCode] = useState('');
  const [legacyJoining, setLegacyJoining] = useState(false);
  const sessionRef = useRef(0);
  const legacyBusyRef = useRef(false);

  const close = () => {
    setLegacyCode('');
    sessionRef.current++;
    setInviteState(initialInviteState);
    controllerRef.current?.dispose();
    controllerRef.current = null;
    onCloseRef.current();
  };

  useEffect(() => {
    const session = ++sessionRef.current;
    joinedRef.current = null;
    setInviteState(initialInviteState);
    setLegacyCode('');
    setLegacyJoining(false);
    legacyBusyRef.current = false;
    if (!visible) {
      return;
    }
    let active = true;
    let controller: ReturnType<typeof createRoomInviteController> | null = null;
    let unsubscribe: (() => void) | undefined;
    setS3Mode('loading');
    void fetchS3Capabilities().then(support => {
      if (!active || session !== sessionRef.current) return;
      if (support.mode === 's3') {
        controller = createRoomInviteController();
        controllerRef.current = controller;
        unsubscribe = controller.subscribe(setInviteState);
        setS3Mode('s3');
      }
      else if (support.mode === 'legacy') setS3Mode('legacy');
      else setS3Mode('error');
    }).catch(() => {
      if (active && session === sessionRef.current) setS3Mode('error');
    });
    return () => {
      active = false;
      sessionRef.current = session + 1;
      unsubscribe?.();
      controller?.dispose();
      controllerRef.current = null;
    };
  }, [visible, probeAttempt]);

  // 잠금 시 카운트다운 타이머
  useEffect(() => {
    if (!visible || !inviteState.retrySeconds || inviteState.retrySeconds <= 0) return;
    const timer = setInterval(() => {
      controllerRef.current?.tick();
    }, 1000);
    return () => clearInterval(timer);
  }, [visible, inviteState.retrySeconds]);

  // 성공적으로 방에 들어간 경우: ref 가드로 일회성 실행 보장
  useEffect(() => {
    if (visible && inviteState.roomId && joinedRef.current === null) {
      const targetRoomId = inviteState.roomId;
      joinedRef.current = targetRoomId;
      controllerRef.current?.setCode('');
      setInviteState(initialInviteState);
      onCloseRef.current();
      onJoinedRef.current(targetRoomId);
    }
  }, [visible, inviteState.roomId]);

  const handleCodeChange = (text: string) => {
    const cleaned = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, CODE_LENGTH);
    controllerRef.current?.setCode(cleaned);
    if (cleaned.length === CODE_LENGTH) {
      void controllerRef.current?.preview();
    }
  };

  const handleJoin = async () => {
    if (!controllerRef.current || !inviteState.preview || inviteState.pending || inviteState.retrySeconds > 0) return;
    await controllerRef.current.join();
  };

  // 레거시 입장
  const handleLegacyJoin = async () => {
    const ready = legacyCode.length === CODE_LENGTH && !legacyJoining;
    if (!ready || legacyBusyRef.current) return;
    legacyBusyRef.current = true;
    const session = sessionRef.current;
    setLegacyJoining(true);
    try {
      const { roomId, error } = await joinRoomByCode(legacyCode);
      if (session !== sessionRef.current) return;
      if (error) {
        if (isRoomMembershipClosed(error)) {
          // [결정] 레거시 멤버십 마감 거절 시 입력값 비우기
          setLegacyCode('');
          onCloseRef.current();
          onMembershipClosed?.();
          notify('입장할 수 없어요', membershipClosedMessage);
          return;
        }
        notify('입장할 수 없어요', JOIN_ERRORS[error.message] ?? '초대 코드를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
      setLegacyCode('');
      onCloseRef.current();
      if (roomId) onJoinedRef.current(roomId);
    } catch {
      if (session === sessionRef.current) notify('입장할 수 없어요', '초대 코드를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      if (session === sessionRef.current) { legacyBusyRef.current = false; setLegacyJoining(false); }
    }
  };

  // 로딩 화면 (B5)
  if (s3Mode === 'loading' || s3Mode === 'unknown') {
    return (
      <BottomSheet visible={visible} title="초대 코드 입력" subtitle="메이트에게 받은 6자리 코드를 넣어 주세요" onClose={close}>
        <View style={[styles.sheetBody, { alignItems: 'center', paddingVertical: 32, gap: 12 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.placeholderText}>서버 상태를 확인하고 있어요...</Text>
        </View>
      </BottomSheet>
    );
  }

  // 서버 오류 화면 (B5)
  if (s3Mode === 'error') {
    return (
      <BottomSheet visible={visible} title="초대 코드 입력" subtitle="메이트에게 받은 6자리 코드를 넣어 주세요" onClose={close}>
        <View style={styles.sheetBody}>
          <View style={[styles.previewBox, styles.errorBox]} accessibilityRole="alert">
            <AlertCircle size={20} color={v3FeedbackColors.error} />
            <View style={styles.textBox}>
              <Text style={styles.errorTitle}>서버 상태를 확인하지 못했어요</Text>
              <Text style={styles.errorSub}>잠시 후 다시 시도해 주세요.</Text>
            </View>
          </View>
          <Button
            label="다시 시도"
            onPress={() => setProbeAttempt(value => value + 1)}
          />
        </View>
      </BottomSheet>
    );
  }

  // 레거시 화면
  if (s3Mode === 'legacy') {
    const ready = legacyCode.length === CODE_LENGTH && !legacyJoining;
    return (
      <BottomSheet visible={visible} title="초대 코드 입력" subtitle="메이트에게 받은 6자리 코드를 넣어 주세요" onClose={close}>
        <View style={styles.legacyBody}>
          <TextField
            label="초대 코드"
            value={legacyCode}
            onChangeText={(text) => setLegacyCode(text.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, CODE_LENGTH))}
            placeholder="예: ABC123"
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            returnKeyType="go"
            editable={!legacyJoining}
            onSubmitEditing={() => void handleLegacyJoin()}
          />
          <Button label="입장" loading={legacyJoining} disabled={!ready} onPress={() => void handleLegacyJoin()} />
        </View>
      </BottomSheet>
    );
  }

  // S3 6칸 화면
  const code = inviteState.code;
  const isLocked = inviteState.retrySeconds > 0;
  const isError = Boolean(inviteState.error) && !isLocked;
  const canJoin = Boolean(inviteState.preview) && !inviteState.pending && !isLocked;

  let errorMessage = '초대 코드를 확인해 주세요.';
  if (inviteState.error) {
    const errorCode = (inviteState.error as Error & { code?: string }).code;
    if (errorCode === 'INVALID_CODE') {
      errorMessage = '영문과 숫자로 된 초대 코드 6자리를 확인해 주세요.';
    } else if (errorCode === 'INVITE_RATE_LIMITED' && !isLocked) {
      errorMessage = '다시 확인을 눌러 초대 코드를 확인해 주세요.';
    } else if (errorCode === 'INVALID_RESPONSE') {
      errorMessage = '초대 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.';
    } else if (['NETWORK', 'TIMEOUT'].includes(errorCode ?? '')) {
      errorMessage = '네트워크 연결을 확인해 주세요.';
    } else {
      errorMessage = roomLifecycleErrorMessage(inviteState.error);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      title="초대 코드 입력"
      subtitle="메이트에게 받은 6자리 코드를 넣으면 바로 밥약에 들어갈 수 있어요"
      onClose={close}
    >
      <View style={styles.sheetBody}>
        {/* 6칸 입력 셀 */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="초대 코드 6자리 입력칸"
          accessibilityValue={{ text: code || '비어 있음' }}
          onPress={() => inputRef.current?.focus()}
          style={styles.cellsRow}
        >
          {Array.from({ length: CODE_LENGTH }).map((_, idx) => {
            const char = code[idx] ?? '';
            const isCurrent = idx === code.length && !isLocked && !isError;
            return (
              <View
                key={idx}
                accessibilityLabel={`${idx + 1}번째 자리 ${char || '비어 있음'}`}
                style={[
                  styles.cell,
                  isError && styles.cellError,
                  isCurrent && styles.cellFocused,
                ]}
              >
                <Text style={styles.cellChar}>{char}</Text>
              </View>
            );
          })}
        </Pressable>

        {/* 투명 숨김 입력창: maxLength 제거하여 붙여넣기 시 전체 텍스트 수신 */}
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={handleCodeChange}
          autoCapitalize="characters"
          autoCorrect={false}
          keyboardType="ascii-capable"
          editable={!isLocked && !inviteState.pending}
          style={styles.hiddenInput}
          autoFocus={visible}
        />

        {/* 상태 및 미리보기 영역 */}
        {isLocked ? (
          /* [결정] S3 SD04: 5회 잠금 카운트다운 안내 */
          <View style={[styles.previewBox, styles.lockBox]} accessibilityRole="alert">
            <Clock size={20} color={v3FeedbackColors.error} />
            <View style={styles.textBox}>
              <Text style={styles.lockTitle}>초대 코드 확인이 잠겼어요</Text>
              <Text style={styles.lockSub}>
                {`${formatCountdown(inviteState.retrySeconds)} 뒤 다시 시도해 주세요.`}
              </Text>
            </View>
          </View>
        ) : isError ? (
          /* [결정] S3 SD03: 오류 상태 (없는 초대 코드 등) */
          <View style={[styles.previewBox, styles.errorBox]} accessibilityRole="alert">
            <AlertCircle size={20} color={v3FeedbackColors.error} />
            <View style={styles.textBox}>
              <Text style={styles.errorTitle}>초대 코드를 확인해 주세요</Text>
              <Text style={styles.errorSub}>{errorMessage}</Text>
            </View>
          </View>
        ) : inviteState.preview ? (
          /* [결정] S3 SD05: 방 미리보기 (제목 + 인원만, 방장/멤버 이름 제외) */
          <View style={[styles.previewBox, styles.successBox]}>
            <View style={styles.roomIcon}>
              <Ticket size={20} color={colors.primary} />
            </View>
            <View style={styles.textBox}>
              <Text style={styles.previewTitle} numberOfLines={1}>
                {inviteState.preview.title}
              </Text>
              <Text style={styles.previewSub}>
                {`메이트 ${inviteState.preview.member_count}명`}
              </Text>
            </View>
          </View>
        ) : (
          /* 기본 안내 */
          <View style={styles.previewBox}>
            <Ticket size={20} color={colors.sub} />
            <Text style={styles.placeholderText}>
              코드를 다 넣으면 방 이름과 약속 정보를 먼저 보여 드려요.
            </Text>
          </View>
        )}

        {isError && !inviteState.pending && code.length === CODE_LENGTH ? (
          <Button label="다시 확인" variant="secondary" onPress={() => void controllerRef.current?.preview()} />
        ) : null}
        {/* 입장 버튼 */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="방에 들어가기"
          accessibilityState={{ disabled: !canJoin, busy: inviteState.pending }}
          disabled={!canJoin}
          onPress={() => void handleJoin()}
          style={[styles.joinButton, !canJoin && styles.disabledButton]}
        >
          {inviteState.pending ? (
            <ActivityIndicator color={colors.surface} />
          ) : null}
          <Text style={styles.joinButtonText}>방에 들어가기</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBody: {
    gap: 16,
    paddingBottom: 12,
  },
  legacyBody: {
    gap: 16,
  },
  cellsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cell: {
    flex: 1,
    height: 56,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellFocused: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  cellError: {
    borderColor: v3FeedbackColors.error,
    borderWidth: 1.5,
  },
  cellChar: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.ink,
    textAlign: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  previewBox: {
    minHeight: 52,
    backgroundColor: colors.mutedBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  successBox: {
    backgroundColor: colors.selectedBg,
    borderColor: colors.border,
    borderWidth: 1,
  },
  errorBox: {
    backgroundColor: colors.mutedBg,
    borderColor: v3FeedbackColors.error,
    borderWidth: 1,
  },
  lockBox: {
    backgroundColor: colors.mutedBg,
    borderColor: v3FeedbackColors.error,
    borderWidth: 1,
  },
  roomIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBox: {
    flex: 1,
    gap: 2,
  },
  placeholderText: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.sub,
  },
  previewTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.ink,
  },
  previewSub: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.selectedText,
  },
  errorTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    lineHeight: 20,
    color: v3FeedbackColors.error,
  },
  errorSub: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.sub,
  },
  lockTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    lineHeight: 20,
    color: v3FeedbackColors.error,
  },
  lockSub: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink,
  },
  joinButton: {
    minHeight: v3Layout.buttonHeight,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  joinButtonText: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.surface,
  },
  disabledButton: {
    opacity: 0.4,
  },
});
