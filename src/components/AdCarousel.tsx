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
     * 홈 배너 실측값 (Figma 2169:821 — 412 × 197). 원본 파일이 1817 × 866
     * (2.098) 이라 시안 비율(2.091) 과 거의 같다 — 잘라 낼 것이 없다.
     *
     * 예전에는 카드처럼 모서리를 굴리고 그림자를 깔았는데, 새 시안은 화면
     * 폭을 꽉 채우고 여백을 그림 안에 그려 넣었다.
     */
    aspectRatio: 412 / 197,
    overflow: 'hidden',
  },
  page: {
    height: '100%',
    overflow: 'hidden',
  },
  /* 시안(2169:821) 그대로 — 좌우로 0.21% 만 넘겨 가장자리 이음매를 덮는다 */
  image: {
    position: 'absolute',
    left: '-0.11%',
    top: 0,
    width: '100.21%',
    height: '100%',
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
