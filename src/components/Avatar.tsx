import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { fs } from '../theme/scale';
import { colors } from '../theme/tokens';
import { fontFamily, weight } from '../theme/typography';

type Props = {
  name: string;
  color: string;
  url?: string | null;
  size: number;
  radius?: number;
  style?: StyleProp<ViewStyle & ImageStyle>;
};

/**
 * 아바타 하나를 그리는 곳.
 *
 * 사진이 있으면 사진, 없으면 avatar_color 원에 이름 첫 글자다. 화면마다 따로
 * 만들던 것을 모아 둔다 — 업로드가 생기면서 두 갈래를 모든 곳에서 다뤄야 한다.
 */
export default function Avatar({ name, color, url, size, radius, style }: Props) {
  const box = {
    width: size,
    height: size,
    borderRadius: radius ?? size / 2,
    backgroundColor: color,
  };

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[styles.image, box, style as StyleProp<ImageStyle>]}
        resizeMode="cover"
        // 사진이 뜨기 전까지 색이 보여 빈 사각형이 깜빡이지 않는다
        accessibilityLabel={`${name} 프로필 사진`}
      />
    );
  }

  return (
    <View style={[styles.fallback, box, style as StyleProp<ViewStyle>]}>
      <Text style={[styles.initial, { fontSize: fs(size * 0.42) }]}>
        {[...name.trim()][0] ?? '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    overflow: 'hidden',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: fontFamily.body,
    fontWeight: weight.bold,
    color: colors.textOnAccent,
  },
});
