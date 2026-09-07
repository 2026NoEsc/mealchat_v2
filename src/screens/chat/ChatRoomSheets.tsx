import { Camera } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import Avatar from '../../components/Avatar';
import BottomSheet from '../../components/BottomSheet';
import { CompleteButton } from '../../components/ui/Button';

import { notify } from '../../lib/confirm';
import { formatAmount } from '../../lib/format';
import { useMyProfile } from '../../profile/useMyProfile';
import type { RoomParticipant } from '../../lib/rooms';
import {
  canEditSettlement,
  createRoomSettlement,
  fetchRoomSettlements,
  setSettlementCompleted,
  settlementMutationErrorMessage,
  type Settlement,
  type SettlementMember,
} from '../../lib/settlements';
import { pickActiveSettlement } from '../../lib/settlementSummary';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';


/** 선택된 카드 배경 — 일정 조율 화면과 동일한 오렌지 틴트 */
const TINT = '#FFF5EB';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  /**
   * 방의 상태가 바뀌었을 때. 전원이 정산을 마치면 서버 트리거가 방을 'done'
   * 으로 넘기는데, 앱이 방을 다시 읽지 않으면 단계가 바뀐 줄 모른 채 예전
   * 화면을 그대로 그린다.
   */
  onStateChanged?: () => void;
};

/* ------------------------------------------------------------------ 일정 조율 */

/** 요일은 실제 달력에서 파생한다 ([lib/calendar](../../lib/calendar.ts)) */
/* ------------------------------------------------------------------ N빵 정산 */

/** Figma 채팅/정산 패널 (553:727) */
export function SettlementSheet({
  visible,
  roomId,
  onClose,
  onStateChanged,
}: SheetProps & { roomId: string | null }) {
  const { user } = useAuth();
  const { bundle } = useMyProfile();
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [amountText, setAmountText] = useState('');
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!visible || !roomId) return;

    let active = true;
    void fetchRoomSettlements(roomId)
      .then(({ data }) => {
        if (!active) return;
        /* 방에 정산이 여러 건이면 지금 할 일이 남은 것을 띄운다 */
        const picked = pickActiveSettlement(data ?? [], user?.id ?? null);
        setSettlement(picked);
        if (picked) setAmountText(String(picked.totalAmount));
      })
      .catch(() => {
        if (active) setSettlement(null);
      });

    return () => {
      active = false;
    };
  }, [visible, roomId, reloadToken, user?.id]);

  const amount = Number(amountText.replace(/[^0-9]/g, '')) || 0;
  const members = settlement?.members ?? [];
  const editable = canEditSettlement(settlement, user?.id ?? null);

  /*
   * 전원이 보내고 나면 완료를 되돌릴 수 없다. 마지막 한 명이 완료하는 순간
   * 서버 트리거가 방을 '정산 완료' 로 넘기고 24시간 카운트다운을 시작하는데,
   * 여기서 되돌려도 그 방은 done 인 채로 남는다 — 화면은 미완료인데 방은
   * 사라지는 중인, 서로 어긋난 상태가 된다.
   */
  const finished = members.length > 0 && members.every((member) => member.isCompleted);
  /* 아직 정산이 없으면 나눌 인원을 알 수 없어 1 로 둔다 */
  const splitCount = settlement?.splitCount ?? members.length ?? 1;
  const each = splitCount > 0 ? Math.ceil(amount / splitCount) : amount;

  const request = async () => {
    if (!roomId || amount <= 0 || !editable) return;

    /*
     * 계좌가 없으면 요청을 만들지 않는다. 계좌는 profile_private 에 있고 본인만
     * 읽을 수 있어서, 여기서 비워 두면 받는 사람들은 어디로 보낼지 영영 알 수
     * 없는 정산을 받는다. 나중에 채울 방법도 없다.
     */
    const bankName = bundle?.privateProfile.bankName ?? null;
    const accountNumber = bundle?.privateProfile.accountNumber ?? null;
    if (!bankName || !accountNumber) {
      notify(
        '계좌를 먼저 등록해 주세요',
        '프로필 → 내 정보에서 계좌를 넣으면 메이트가 바로 보낼 수 있어요.',
      );
      return;
    }

    setBusy(true);
    /* 계좌를 정산표에 옮겨 적는다 — 토스 송금 링크가 이 값을 쓴다 */
    const { error } = await createRoomSettlement({
      roomId,
      title: '식사 정산',
      amount,
      bankName,
      accountNumber,
      accountHolder: bundle?.profile.name ?? null,
    });
    setBusy(false);

    if (error) {
      notify('정산 요청 실패', settlementMutationErrorMessage(error));
      return;
    }

    setReloadToken((token) => token + 1);
    onStateChanged?.();
    onClose();
  };

  const toggleMine = async (member: SettlementMember) => {
    setBusy(true);
    const error = await setSettlementCompleted(member.id, !member.isCompleted);
    setBusy(false);

    if (error) {
      notify('변경 실패', settlementMutationErrorMessage(error));
      return;
    }
    setReloadToken((token) => token + 1);
    /* 마지막 한 명이 완료하면 서버가 방을 '정산 완료' 로 넘긴다 */
    onStateChanged?.();
  };

  return (
    <BottomSheet
      visible={visible}
      title="N빵 정산"
      subtitle="결제 금액을 입력하면 자동으로 나눠요"
      onClose={onClose}>
      <View style={styles.amountRow}>
        <View style={styles.amountLeft}>
          <Text style={styles.amountLabel}>총 결제금액</Text>
          <TextInput
            style={styles.amountInput}
            value={amountText}
            onChangeText={setAmountText}
            editable={editable}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <View style={styles.amountRight}>
          <Text style={[styles.amountLabel, styles.accentText]}>1인당</Text>
          <Text style={[styles.amountTotal, styles.accentText]}>{formatAmount(each)}</Text>
        </View>
      </View>

      {members.length === 0 ? (
        <Text style={styles.settlementEmpty}>
          {settlement ? '정산 참가자가 없어요' : '아직 정산이 없어요. 금액을 넣고 요청해 보세요.'}
        </Text>
      ) : (
        <View style={styles.memberRow}>
          {members.map((member) => {
            const mine = member.profileId === user?.id;
            return (
              <Pressable
                key={member.id}
                style={styles.memberCard}
                disabled={busy || !mine || finished}
                onPress={() => void toggleMine(member)}>
                <View style={[styles.memberDot, member.isCompleted && styles.memberDotDone]}>
                  <Text style={styles.memberInitial}>
                    {[...member.name.trim()][0] ?? '?'}
                  </Text>
                </View>
                <Text style={styles.memberName} numberOfLines={1}>
                  {member.name}
                </Text>
                <Text style={[styles.memberState, member.isCompleted && styles.accentText]}>
                  {member.isCompleted ? '완료' : mine ? '눌러서 완료' : '대기'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.receiptBox}>
        <Camera size={s(9)} color={colors.primary} strokeWidth={2} />
        <Text style={styles.receiptText}>영수증 촬영하여 자동 입력</Text>
      </View>

      {finished ? (
        <Text style={styles.settlementLocked}>정산이 끝났어요. 되돌릴 수 없어요.</Text>
      ) : null}

      {editable ? (
        <CompleteButton
          label={busy ? '보내는 중' : settlement ? '정산 내용 수정' : '정산 요청 보내기'}
          showNext
          style={styles.cta}
          disabled={busy || amount <= 0 || !roomId}
          onPress={() => void request()}
        />
      ) : (
        <Text style={styles.settlementLocked}>정산 내용은 만든 사람만 수정할 수 있어요.</Text>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  accentText: {
    color: colors.primary,
  },
  amountLeft: {
    flex: 1,
  },
  amountInput: {
    paddingVertical: 0,
    fontFamily: fontFamily.extrabold,
    fontSize: fs(14),
    color: colors.textPrimary,
  },
  settlementEmpty: {
    marginTop: s(14),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    color: colors.textMuted,
  },
  settlementLocked: {
    marginTop: s(12),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    color: colors.textMuted,
  },
  memberDot: {
    width: s(20),
    height: s(20),
    borderRadius: s(999),
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberDotDone: {
    backgroundColor: colors.primary,
  },
  memberInitial: {
    fontFamily: fontFamily.bold,
    fontSize: fs(8),
    color: colors.textOnAccent,
  },
  rowOn: {
    backgroundColor: TINT,
    borderColor: colors.primary,
  },
  cta: {
    marginTop: s(12),
  },

  // 일정 조율
  dayRow: {
    marginTop: s(10),
    flexDirection: 'row',
    gap: s(6),
  },
  dayChip: {
    flex: 1,
    height: s(34),
    borderRadius: s(8),
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: s(0.8),
    borderColor: 'transparent',
  },
  dayChipOn: {
    backgroundColor: TINT,
    borderColor: colors.primary,
  },
  dayNum: {
    fontFamily: fontFamily.bold,
    fontSize: fs(10),
    lineHeight: fs(13),
    color: colors.textPrimary,
  },
  dayLabel: {
    marginTop: s(1),
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
  slotRow: {
    marginTop: s(7),
    height: s(26),
    borderRadius: s(8),
    borderWidth: s(0.8),
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(10),
  },
  slotTime: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: fs(8),
    lineHeight: fs(11),
    color: colors.textPrimary,
  },
  slotCount: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },

  // 메뉴 정하기
  menuRow: {
    marginTop: s(7),
    height: s(26),
    borderRadius: s(8),
    borderWidth: s(0.8),
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(10),
    gap: s(6),
  },
  menuName: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: fs(8),
    lineHeight: fs(11),
    color: colors.textPrimary,
  },
  voteStack: {
    flexDirection: 'row',
  },
  voteAvatar: {
    width: s(14),
    height: s(14),
    borderRadius: s(14),
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  voteOverlap: {
    marginLeft: s(-4),
  },
  voteImage: {
    width: s(10),
    height: s(12),
  },
  voteCount: {
    width: s(16),
    textAlign: 'right',
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  addRow: {
    marginTop: s(7),
    height: s(24),
    borderRadius: s(8),
    borderWidth: s(0.8),
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },

  // N빵 정산
  amountRow: {
    marginTop: s(10),
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  amountRight: {
    alignItems: 'flex-end',
  },
  amountLabel: {
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  amountTotal: {
    marginTop: s(1),
    fontFamily: fontFamily.extrabold,
    fontSize: fs(13),
    lineHeight: fs(17),
    color: colors.textPrimary,
  },
  memberRow: {
    marginTop: s(10),
    flexDirection: 'row',
    gap: s(6),
  },
  memberCard: {
    flex: 1,
    height: s(42),
    borderRadius: s(8),
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatar: {
    width: s(14),
    height: s(17),
  },
  memberName: {
    marginTop: s(1),
    fontFamily: fontFamily.semibold,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textPrimary,
  },
  memberState: {
    fontFamily: fontFamily.body,
    fontSize: fs(5.5),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
  receiptBox: {
    marginTop: s(10),
    height: s(26),
    borderRadius: s(8),
    borderWidth: s(0.8),
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: TINT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(4),
  },
  receiptText: {
    fontFamily: fontFamily.semibold,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.primary,
  },
});

/* ------------------------------------------------------------------ 참여 멤버 */

/**
 * Figma 채팅/멤버 패널 (553:768)
 *
 * 예전에는 브랜드 캐릭터 네 명과 초대코드 `VF4HLD` 가 그대로 박혀 있었다. Figma
 * 시안을 옮기면서 남은 값인데, 실제 방과 아무 상관이 없다. 초대 코드는 사람을
 * 불러들이는 유일한 통로라 가짜 코드를 보여 주면 아무도 들어오지 못한다.
 */
export function MembersSheet({
  visible,
  participants,
  code,
  myId,
  onClose,
  onInvite,
}: {
  visible: boolean;
  participants: RoomParticipant[];
  code: string | null;
  myId: string | null;
  onClose: () => void;
  onInvite: (code: string) => void;
}) {
  return (
    <BottomSheet
      visible={visible}
      title="참여 멤버"
      subtitle={
        code ? `멤버 ${participants.length}명 · 초대코드 ${code}` : `멤버 ${participants.length}명`
      }
      onClose={onClose}>
      <View style={memberStyles.list}>
        {participants.length === 0 ? (
          <Text style={memberStyles.empty}>참여 멤버를 불러오지 못했어요</Text>
        ) : (
          participants.map((participant) => {
            const mine = participant.profileId !== null && participant.profileId === myId;
            return (
              <View
                key={participant.id}
                style={[memberStyles.row, mine && memberStyles.rowMe]}>
                <Avatar
                  name={participant.name}
                  color={participant.avatarColor}
                  size={s(26)}
                  style={memberStyles.avatar}
                />

                <View style={memberStyles.body}>
                  <Text style={memberStyles.name}>
                    {participant.name}
                    {mine ? ' (나)' : ''}
                  </Text>
                </View>

                {mine ? (
                  <View style={memberStyles.badge}>
                    <Text style={memberStyles.badgeText}>나</Text>
                  </View>
                ) : (
                  <Text style={memberStyles.role}>메이트</Text>
                )}
              </View>
            );
          })
        )}
      </View>

      {/* 코드가 없으면 알려 줄 것이 없으므로 버튼도 내린다 */}
      {code ? (
        <CompleteButton
          label="＋ 메이트 초대"
          style={memberStyles.cta}
          onPress={() => onInvite(code)}
        />
      ) : null}
    </BottomSheet>
  );
}

const memberStyles = StyleSheet.create({
  empty: {
    paddingVertical: s(12),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: colors.textMuted,
  },
  list: {
    marginTop: s(10),
    gap: s(5),
  },
  row: {
    height: s(30),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(7),
    borderRadius: s(8),
    backgroundColor: colors.surface,
  },
  rowMe: {
    backgroundColor: TINT,
    borderWidth: s(0.8),
    borderColor: colors.primary,
  },
  avatarBox: {
    width: s(18),
    height: s(18),
    borderRadius: s(6),
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: s(12),
    height: s(14),
  },
  body: {
    flex: 1,
    marginLeft: s(7),
  },
  name: {
    fontFamily: fontFamily.semibold,
    fontSize: fs(7),
    lineHeight: fs(9),
    color: colors.textPrimary,
  },
  status: {
    fontFamily: fontFamily.body,
    fontSize: fs(5.5),
    lineHeight: fs(7),
    color: colors.textMuted,
  },
  badge: {
    paddingHorizontal: s(5),
    paddingVertical: s(2),
    borderRadius: s(5),
    backgroundColor: colors.primary,
  },
  badgeText: {
    fontFamily: fontFamily.bold,
    fontSize: fs(5.5),
    lineHeight: fs(7),
    color: colors.textOnAccent,
  },
  role: {
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
  cta: {
    marginTop: s(14),
  },
});
