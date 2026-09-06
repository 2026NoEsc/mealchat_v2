import { useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { fs, s } from '../theme/scale';
import { colors } from '../theme/tokens';
import { fontFamily } from '../theme/typography';

/**
 * Figma 홈/메인 (2154:680) 안의 광고 배너 — 194 × 83
 *
 * 좌우 화살표를 두지 않는다. 손가락으로 넘기는 것이 배너의 기본 동작이고,
 * 화살표는 한 장뿐일 때도 떠 있어서 넘길 것이 있는 것처럼 보인다. 몇 장 중
 * 몇 번째인지는 우하단 카운터가 알려 준다.
 */
export default function AdCarousel({ images }: { images: ImageSourcePropType[] }) {
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const total = images.length;

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  return (
    <View style={styles.container} onLayout={onLayout}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        /* 손을 뗀 뒤 한 번만 읽는다 — 스크롤 중에 계속 세면 카운터가 떨린다 */
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}>
        {images.map((image, i) => (
          /*
           * 한 장이 정확히 컨테이너 폭을 차지해야 페이징이 맞는다. 그림은 그
           * 안에서 넘치게 그리고 잘라 낸다.
           */
          <View key={i} style={[styles.page, { width }]}>
            <Image source={image} style={styles.image} resizeMode="cover" />
          </View>
        ))}
      </ScrollView>

      {total > 1 ? (
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {index + 1} / {total}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    /*
     * 홈 배너 실측값 (Figma 2154:680 — 194 × 83). 예전 197 × 109 로 두면
     * 홈이 잡아 둔 83 높이보다 카드가 커져서, 위쪽 여백만 보이고 그림이 잘린다.
     */
    aspectRatio: 194 / 83,
    borderRadius: s(10),
    backgroundColor: colors.surface,
    overflow: 'hidden',
    shadowColor: '#A9A9A9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: s(4.116),
    elevation: 2,
  },
  page: {
    height: '100%',
    overflow: 'hidden',
  },
  /*
   * 시안(2154:680)이 그림을 마스크보다 키워서 넣는다 — 배너 원본에 사방으로
   * 여백이 붙어 있어서, 딱 맞게 넣으면 그 여백이 카드 안에 그대로 보인다.
   * 키운 비율과 오프셋은 시안 값 그대로다.
   */
  image: {
    position: 'absolute',
    left: '-3.31%',
    top: '-7.99%',
    width: '107.18%',
    height: '118.54%',
  },
  counter: {
    position: 'absolute',
    right: '3.38%',
    bottom: '5.65%',
    paddingHorizontal: s(6),
    paddingVertical: s(2),
    borderRadius: s(10.29),
    backgroundColor: '#929292',
  },
  counterText: {
    fontFamily: fontFamily.bold,
    fontSize: fs(10.29),
    lineHeight: fs(13),
    color: colors.textOnAccent,
  },
});
