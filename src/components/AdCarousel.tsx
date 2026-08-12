import { useState } from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';

import { fs, s } from '../theme/scale';
import { colors } from '../theme/tokens';
import { fontFamily, weight } from '../theme/typography';

/**
 * Figma AD Viewer (83:435) — 213 x 127.594
 * 좌우 원형 화살표(#BABABA, 20.6) + 우하단 카운터 필(#929292)
 */
export default function AdCarousel({ images }: { images: ImageSourcePropType[] }) {
  const [index, setIndex] = useState(0);
  const total = images.length;

  const go = (delta: number) => setIndex((prev) => (prev + delta + total) % total);

  return (
    <View style={styles.container}>
      {total > 0 ? (
        <Image source={images[index]} style={styles.image} resizeMode="cover" />
      ) : null}

      <Pressable style={[styles.arrow, styles.arrowLeft]} onPress={() => go(-1)} hitSlop={s(6)}>
        <Text style={styles.chevron}>{'<'}</Text>
      </Pressable>
      <Pressable style={[styles.arrow, styles.arrowRight]} onPress={() => go(1)} hitSlop={s(6)}>
        <Text style={styles.chevron}>{'>'}</Text>
      </Pressable>

      <View style={styles.counter}>
        <Text style={styles.counterText}>
          {index + 1} / {total}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 213 / 127.594,
    borderRadius: s(10.29),
    backgroundColor: colors.surface,
    overflow: 'hidden',
    shadowColor: '#A9A9A9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: s(4.116),
    elevation: 2,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  arrow: {
    position: 'absolute',
    top: '39.52%',
    width: s(20.6),
    height: s(20.6),
    borderRadius: s(20.6),
    backgroundColor: '#BABABA',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: s(4.116) },
    shadowOpacity: 0.1,
    shadowRadius: s(4.116),
    elevation: 2,
  },
  arrowLeft: {
    left: '2.42%',
  },
  arrowRight: {
    right: '2.42%',
  },
  chevron: {
    fontFamily: fontFamily.body,
    fontSize: fs(10.29),
    lineHeight: fs(13),
    fontWeight: weight.bold,
    color: '#707070',
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
    fontFamily: fontFamily.body,
    fontSize: fs(10.29),
    lineHeight: fs(13),
    fontWeight: weight.bold,
    color: colors.textOnAccent,
  },
});
