import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SignupHeader from '../../components/SignupHeader';
import { AccentButton } from '../../components/ui/Button';
import { fs, s } from '../../theme/scale';
import { colors, radii, shadows } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

type Props = {
  title: string;
  step: 2 | 3 | 4;
  stepLabel: string;
  /** 카드 안 타이틀의 캐릭터 이름 ("모아" / "웰링" / "두두") */
  characterName: string;
  character: ImageSourcePropType;
  /** 카드 기준 캐릭터 위치·크기 (Figma 프레임 좌표에서 카드 y127 을 뺀 값) */
  characterBox: { left: number; top: number; width: number; height: number };
  /** 카드 배경 이미지 (구글 캘린더 연동 화면의 캘린더 목업, opacity 0.2) */
  backgroundImage?: ImageSourcePropType;
  description: [string, string];
  /** 카드 아래 보조 문구 */
  footnote?: string;
  /** 카드 아래 추가 영역 (약관 목록 등) */
  children?: React.ReactNode;
  ctaLabel: string;
  onNext: () => void;
  onBack: () => void;
  submitting?: boolean;
};

/**
 * Figma 회원가입 2~4단계 공통 레이아웃.
 * 일러스트 카드 x16 y127 184×190 / 카드 안 타이틀 y153 / 설명 y271~274 / 버튼 y423
 */
export default function SignupIllustrationScreen({
  title,
  step,
  stepLabel,
  characterName,
  character,
  characterBox,
  backgroundImage,
  description,
  footnote,
  children,
  ctaLabel,
  onNext,
  onBack,
  submitting = false,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <SignupHeader title={title} step={step} stepLabel={stepLabel} onBack={onBack} />

      <View style={styles.body}>
        <View style={styles.card}>
          {backgroundImage ? (
            <Image source={backgroundImage} style={styles.cardBg} resizeMode="cover" />
          ) : null}

          <Text style={styles.cardTitle}>
            <Text style={styles.cardTitleBrand}>MEALCHAT </Text>
            {characterName}
          </Text>

          <Image
            source={character}
            resizeMode="contain"
            style={{
              position: 'absolute',
              left: s(characterBox.left),
              top: s(characterBox.top),
              width: s(characterBox.width),
              height: s(characterBox.height),
            }}
          />

          <Text style={styles.description}>
            <Text style={styles.descriptionBrand}>&apos;MEALCHAT&apos; </Text>
            {description[0]}
            {'\n'}
            {description[1]}
          </Text>
        </View>

        {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
        {children}
      </View>

      <AccentButton
        label={ctaLabel}
        showNext
        style={styles.cta}
        onPress={onNext}
        disabled={submitting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  body: {
    flex: 1,
    paddingHorizontal: s(18),
  },
  card: {
    // STEP 라벨 하단 → 카드 y127
    marginTop: s(29),
    height: s(190),
    borderRadius: s(radii.button),
    backgroundColor: colors.card,
    overflow: 'hidden',
    ...shadows.accent,
  },
  cardBg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.2,
  },
  cardTitle: {
    // 카드 기준 y26 (프레임 y153)
    marginTop: s(26),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(11),
    lineHeight: fs(14),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  cardTitleBrand: {
    fontFamily: fontFamily.wordmark,
    fontWeight: weight.extrabold,
    color: colors.primary,
  },
  description: {
    position: 'absolute',
    // 카드 기준 y144 (프레임 y271)
    top: s(144),
    left: s(7),
    width: s(170),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(11),
    color: colors.textMuted,
  },
  descriptionBrand: {
    fontFamily: fontFamily.wordmark,
    fontWeight: weight.extrabold,
    color: colors.textPrimary,
  },
  footnote: {
    // 카드 하단(y317) → y321
    marginTop: s(4),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(6),
    lineHeight: fs(10),
    color: colors.textMuted,
  },
  cta: {
    // y423 h28, 프레임 하단(486)까지 35
    marginHorizontal: s(12),
    marginBottom: s(35),
  },
});
