import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { fs, s } from '../theme/scale';
import { colors } from '../theme/tokens';
import { fontFamily, weight } from '../theme/typography';

/** Figma BackButton (525:3226) — 14 x 13 흰 칩 안의 왼쪽 화살표 */
function BackArrow() {
  return (
    <Svg width={s(7)} height={s(7)} viewBox="0 0 8 8" fill="none">
      <Path
        d="M7 4H1M1 4L3.6 1.4M1 4L3.6 6.6"
        stroke={colors.textPrimary}
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

type Props = {
  title: string;
  onBack?: () => void;
  /** 우측 액션 (예: 취향게임의 "건너뛰기") */
  action?: React.ReactNode;
  /** 타이틀 아래 영역 (진행바 + STEP 라벨 등) */
  below?: React.ReactNode;
};

/** Figma 공통 헤더 — 뒤로가기 칩 x18 y49~52 (14×13), 타이틀 x41 y45~48 */
export default function ScreenHeader({ title, onBack, action, below }: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <Pressable style={styles.backChip} onPress={onBack} hitSlop={s(8)}>
          <BackArrow />
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>

      {below}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    // Figma: 뒤로가기 칩 y49~52, 상태바 28 을 뺀 값
    paddingHorizontal: s(18),
    paddingTop: s(22),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backChip: {
    width: s(14),
    height: s(13),
    borderRadius: s(4),
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginLeft: s(9),
    fontFamily: fontFamily.body,
    fontSize: fs(11),
    lineHeight: fs(16),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  action: {
    marginLeft: 'auto',
  },
});
