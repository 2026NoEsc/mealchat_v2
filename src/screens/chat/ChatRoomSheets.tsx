import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';

import BottomSheet from '../../components/BottomSheet';
import { CompleteButton } from '../../components/ui/Button';
import { MONTH, weekdayOf } from '../../lib/calendar';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

const moa = require('../../../assets/brand/moa.png');
const ddori = require('../../../assets/brand/ddori.png');
const dudu = require('../../../assets/brand/dudu.png');
const welling = require('../../../assets/brand/welling2.png');

/** 선택된 카드 배경 — 일정 조율 화면과 동일한 오렌지 틴트 */
const TINT = '#FFF5EB';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  /** 확정 시 채팅방에 남길 시스템 메시지 */
  onConfirm: (message: string) => void;
};

/* ------------------------------------------------------------------ 일정 조율 */

/** 요일은 실제 달력에서 파생한다 ([lib/calendar](../../lib/calendar.ts)) */
const DAYS = [14, 15, 16, 17].map((day) => ({
  day: String(day),
  label: `${weekdayOf(day)}요일`,
}));

const SLOTS = [
  { time: '11:30 – 12:30', count: 2 },
  { time: '12:30 – 13:30', count: 4 },
  { time: '13:30 – 14:30', count: 2 },
];

/** Figma 채팅/일정 패널 (553:408) */
export function ScheduleSheet({ visible, onClose, onConfirm }: SheetProps) {
  const [day, setDay] = useState(1);
  const [slot, setSlot] = useState(1);

  return (
    <BottomSheet
      visible={visible}
      title="일정 조율"
      subtitle="가능한 날짜와 시간을 선택해 주세요"
      onClose={onClose}>
      <View style={styles.dayRow}>
        {DAYS.map((d, i) => (
          <Pressable
            key={d.day}
            style={[styles.dayChip, i === day && styles.dayChipOn]}
            onPress={() => setDay(i)}>
            <Text style={[styles.dayNum, i === day && styles.accentText]}>{d.day}</Text>
            <Text style={[styles.dayLabel, i === day && styles.accentText]}>{d.label}</Text>
          </Pressable>
        ))}
      </View>

      {SLOTS.map((s2, i) => (
        <Pressable
          key={s2.time}
          style={[styles.slotRow, i === slot && styles.rowOn]}
          onPress={() => setSlot(i)}>
          <Text style={[styles.slotTime, i === slot && styles.accentText]}>{s2.time}</Text>
          <Text style={[styles.slotCount, i === slot && styles.accentText]}>
            {s2.count}명 가능
          </Text>
        </Pressable>
      ))}

      <CompleteButton
        label="선택 완료"
        showNext
        style={styles.cta}
        onPress={() => {
          onConfirm(
            `${MONTH}월 ${DAYS[day].day}일 (${DAYS[day].label[0]}) ${SLOTS[slot].time} 로 일정을 제안했어요`,
          );
          onClose();
        }}
      />
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ 메뉴 정하기 */

const MENUS = [
  { name: '칼국수', votes: [moa, ddori] },
  { name: '국밥', votes: [dudu] },
  { name: '버거', votes: [welling] },
];

/** Figma 채팅/메뉴 패널 (553:698) */
export function MenuSheet({ visible, onClose, onConfirm }: SheetProps) {
  const [picked, setPicked] = useState(0);

  return (
    <BottomSheet
      visible={visible}
      title="메뉴 정하기"
      subtitle="먹고 싶은 메뉴에 투표해 주세요"
      onClose={onClose}>
      {MENUS.map((menu, i) => (
        <Pressable
          key={menu.name}
          style={[styles.menuRow, i === picked && styles.rowOn]}
          onPress={() => setPicked(i)}>
          <Text style={[styles.menuName, i === picked && styles.accentText]}>{menu.name}</Text>

          <View style={styles.voteStack}>
            {menu.votes.map((src, vi) => (
              <View key={vi} style={[styles.voteAvatar, vi > 0 && styles.voteOverlap]}>
                <Image source={src} style={styles.voteImage} resizeMode="contain" />
              </View>
            ))}
          </View>

          <Text style={styles.voteCount}>{menu.votes.length}표</Text>
        </Pressable>
      ))}

      <View style={styles.addRow}>
        <Text style={styles.addText}>＋ 메뉴 직접 추가</Text>
      </View>

      <CompleteButton
        label="선택하기"
        style={styles.cta}
        onPress={() => {
          onConfirm(`오늘 메뉴는 '${MENUS[picked].name}' 로 정해졌어요`);
          onClose();
        }}
      />
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ N빵 정산 */

const MEMBERS: { name: string; state: '완료' | '대기'; avatar: ImageSourcePropType }[] = [
  { name: '모아', state: '완료', avatar: moa },
  { name: '두두', state: '대기', avatar: dudu },
  { name: '또리', state: '완료', avatar: ddori },
  { name: '웰링', state: '대기', avatar: welling },
];

const TOTAL = 48000;

/** Figma 채팅/정산 패널 (553:727) */
export function SettlementSheet({ visible, onClose, onConfirm }: SheetProps) {
  const each = TOTAL / MEMBERS.length;

  return (
    <BottomSheet
      visible={visible}
      title="N빵 정산"
      subtitle="결제 금액을 입력하면 자동으로 나눠요"
      onClose={onClose}>
      <View style={styles.amountRow}>
        <View>
          <Text style={styles.amountLabel}>총 결제금액</Text>
          <Text style={styles.amountTotal}>₩{TOTAL.toLocaleString()}</Text>
        </View>
        <View style={styles.amountRight}>
          <Text style={[styles.amountLabel, styles.accentText]}>1인당</Text>
          <Text style={[styles.amountTotal, styles.accentText]}>₩{each.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.memberRow}>
        {MEMBERS.map((m) => (
          <View key={m.name} style={styles.memberCard}>
            <Image source={m.avatar} style={styles.memberAvatar} resizeMode="contain" />
            <Text style={styles.memberName}>{m.name}</Text>
            <Text style={[styles.memberState, m.state === '완료' && styles.accentText]}>
              {m.state}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.receiptBox}>
        <Camera size={s(9)} color={colors.primary} strokeWidth={2} />
        <Text style={styles.receiptText}>영수증 촬영하여 자동 입력</Text>
      </View>

      <CompleteButton
        label="정산 요청 보내기"
        showNext
        style={styles.cta}
        onPress={() => {
          onConfirm(`1인당 ₩${each.toLocaleString()} 정산 요청을 보냈어요`);
          onClose();
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  accentText: {
    color: colors.primary,
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
    fontFamily: fontFamily.body,
    fontSize: fs(10),
    lineHeight: fs(13),
    fontWeight: weight.bold,
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
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    lineHeight: fs(11),
    fontWeight: weight.semibold,
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
    fontFamily: fontFamily.body,
    fontSize: fs(8),
    lineHeight: fs(11),
    fontWeight: weight.semibold,
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
    fontFamily: fontFamily.body,
    fontSize: fs(13),
    lineHeight: fs(17),
    fontWeight: weight.extrabold,
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
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(8),
    fontWeight: weight.semibold,
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
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    fontWeight: weight.semibold,
    color: colors.primary,
  },
});

/* ------------------------------------------------------------------ 참여 멤버 */

type RoomMember = {
  name: string;
  status: string;
  role: '방장' | '메이트';
  avatar: ImageSourcePropType;
  me?: boolean;
};

/** Figma 채팅/멤버 패널 (553:768) */
const ROOM_MEMBERS: RoomMember[] = [
  { name: '모아(나)', status: '온라인', role: '방장', avatar: moa, me: true },
  { name: '두두', status: '온라인', role: '메이트', avatar: dudu },
  { name: '또리', status: '3시간 전', role: '메이트', avatar: ddori },
  { name: '웰링', status: '온라인', role: '메이트', avatar: welling },
];

export function MembersSheet({
  visible,
  onClose,
  onInvite,
}: {
  visible: boolean;
  onClose: () => void;
  onInvite: () => void;
}) {
  return (
    <BottomSheet
      visible={visible}
      title="참여 멤버"
      subtitle={`멤버 ${ROOM_MEMBERS.length}명 · 초대코드 VF4HLD`}
      onClose={onClose}>
      <View style={memberStyles.list}>
        {ROOM_MEMBERS.map((member) => (
          <View
            key={member.name}
            style={[memberStyles.row, member.me && memberStyles.rowMe]}>
            <View style={memberStyles.avatarBox}>
              <Image source={member.avatar} style={memberStyles.avatar} resizeMode="contain" />
            </View>

            <View style={memberStyles.body}>
              <Text style={memberStyles.name}>{member.name}</Text>
              <Text style={memberStyles.status}>{member.status}</Text>
            </View>

            {member.role === '방장' ? (
              <View style={memberStyles.badge}>
                <Text style={memberStyles.badgeText}>방장</Text>
              </View>
            ) : (
              <Text style={memberStyles.role}>메이트</Text>
            )}
          </View>
        ))}
      </View>

      <CompleteButton label="＋ 메이트 초대" style={memberStyles.cta} onPress={onInvite} />
    </BottomSheet>
  );
}

const memberStyles = StyleSheet.create({
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
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(9),
    fontWeight: weight.semibold,
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
    fontFamily: fontFamily.body,
    fontSize: fs(5.5),
    lineHeight: fs(7),
    fontWeight: weight.bold,
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
