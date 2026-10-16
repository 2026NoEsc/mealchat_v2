import { StyleSheet, Text, View } from 'react-native';

import { fs, s } from '../theme/scale';
import { colors } from '../theme/tokens';
import { fontFamily } from '../theme/typography';
import BackButton from './BackButton';

type Props = {
  title: string;
  onBack?: () => void;
  /** 우측 액션 (예: 취향게임의 "건너뛰기") */
  action?: React.ReactNode;
  /** 타이틀 아래 영역 (진행바 + STEP 라벨 등) */
  below?: React.ReactNode;
  /**
   * AppHeader 아래에 겹쳐 놓일 때. 기본 위 여백(22)은 상태바 바로 아래에
   * 놓이는 것을 전제한 값이라, 헤더가 이미 하나 있으면 여백이 두 번 쌓인다.
   */
  compact?: boolean;
};

/** Figma 공통 헤더 — 뒤로가기 칩 x18 y49~52 (14×13), 타이틀 x41 y45~48 */
export default function ScreenHeader({ title, onBack, action, below, compact }: Props) {
  return (
    <View style={[styles.wrapper, compact && styles.wrapperCompact]}>
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
  wrapperCompact: {
    paddingTop: s(10),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    marginLeft: s(9),
    fontFamily: fontFamily.bold,
    fontSize: fs(11),
    lineHeight: fs(16),
    color: colors.textPrimary,
  },
  action: {
    marginLeft: 'auto',
  },
});
