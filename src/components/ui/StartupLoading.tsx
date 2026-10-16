import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

import { v3Colors as colors } from '../../theme/tokens';
import { fontFamily } from '../../theme/typography';
import { authStyles, BrandWordmark } from './AuthLayout';

const logo = require('../../../assets/brand/logo-main.png');

/** 543:1777. The caller owns the one-second threshold across all startup stages. */
export default function StartupLoading({ visible }: { visible: boolean }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduceMotion(value); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (!visible || reduceMotion) return;
    const animation = Animated.loop(Animated.timing(progress, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true }));
    animation.start();
    return () => { animation.stop(); progress.setValue(0); };
  }, [visible, reduceMotion, progress]);
  if (!visible) return <View style={authStyles.screen} />;
  return <View style={[authStyles.screen, styles.center]}>
    <Image source={logo} style={styles.logo} resizeMode="contain" accessible={false} />
    <BrandWordmark loading />
    {/* Figma blobs 320×180: 기존 자산이 없어 새로 생성하지 않고 공간만 유지한다. */}
    <View style={styles.blobsSpace} accessible={false} />
    <View style={styles.progress} accessibilityRole="progressbar" accessibilityLabel="밥약을 불러오는 중이에요" accessibilityState={{ busy: true }}>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, !reduceMotion && { transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-110, 332] }) }] }]} />
      </View>
      <Text style={styles.label}>밥약을 불러오는 중이에요</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 14 },
  logo: { width: 96, height: 96, borderRadius: 24 },
  blobsSpace: { width: 320, maxWidth: '100%', height: 180, borderRadius: 16 },
  progress: { width: 332, maxWidth: '100%', gap: 8, alignItems: 'center' },
  track: { width: '100%', height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { width: '33%', height: 6, borderRadius: 3, backgroundColor: colors.primary },
  label: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 22, color: colors.sub, textAlign: 'center' },
});
