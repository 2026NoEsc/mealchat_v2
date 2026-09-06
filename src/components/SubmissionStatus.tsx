import { StyleSheet, Text, View } from 'react-native';

import Avatar from './Avatar';
import { fs, s } from '../theme/scale';
import { colors, shadows } from '../theme/tokens';
import { fontFamily } from '../theme/typography';

export type SubmissionMember = {
  id: string;
  name: string;
  avatarColor: string;
  avatarUrl?: string | null;
  submitted: boolean;
};

/**
 * Figma 일정 추가/시간 선택 (2125:497) — 제출 완료 카드
 * 카드 w197 h63 radius8 pad 9/8 / 아바타 20 radius5 간격 5 / 이름 6 semibold
 *
 * 누가 언제 가능한지는 보여 주지 않는다. 제출했는지만 밝혀서, 개인의 가능·불가
 * 패턴이 방 전체에 드러나지 않게 한다.
 */
export default function SubmissionStatus({ members }: { members: SubmissionMember[] }) {
  const submitted = members.filter((member) => member.submitted).length;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>제출 완료</Text>
        <Text style={styles.count}>
          {submitted} / {members.length} 명
        </Text>
      </View>

      {/*
        아직 안 낸 사람은 흐리게 둔다. 시안에는 이 구분이 없지만, 누가 아직인지
        보이지 않으면 이 카드가 숫자 하나로만 남는다.
      */}
      <View style={styles.row}>
        {members.map((member) => (
          <View key={member.id} style={styles.member}>
            <Avatar
              name={member.name}
              color={member.avatarColor}
              url={member.avatarUrl}
              size={s(20)}
              radius={s(5)}
              style={!member.submitted ? styles.waiting : undefined}
            />
            <Text
              style={[styles.name, !member.submitted && styles.waitingText]}
              numberOfLines={1}>
              {member.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: s(8),
    paddingHorizontal: s(9),
    paddingVertical: s(8),
    /* 흰 바탕 위의 흰 카드라, 그림자만으로는 경계가 보이지 않는다 */
    borderWidth: s(0.6),
    borderColor: colors.border,
    ...shadows.button,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: fs(8.5),
    lineHeight: fs(11.5),
    color: colors.textPrimary,
  },
  count: {
    fontFamily: fontFamily.semibold,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textMuted,
  },
  row: {
    marginTop: s(5),
    flexDirection: 'row',
    gap: s(5),
  },
  member: {
    width: s(20),
    alignItems: 'center',
  },
  name: {
    marginTop: s(5),
    fontFamily: fontFamily.semibold,
    fontSize: fs(6),
    lineHeight: fs(8),
    color: colors.textPrimary,
  },
  waiting: {
    opacity: 0.3,
  },
  waitingText: {
    color: colors.textMuted,
  },
});
