import { StyleSheet, Text, View } from 'react-native';

import { fs, s } from '../theme/scale';
import { colors } from '../theme/tokens';
import { fontFamily, weight } from '../theme/typography';
import BackButton from './BackButton';

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
        <BackButton onPress={onBack} />
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
