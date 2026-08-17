import { LinearGradient } from 'expo-linear-gradient';
import { Heart, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/AuthProvider';
import { useSignupDraft } from '../../auth/SignupDraftProvider';
import { saveTastes } from '../../lib/profile';
import { useMyProfile } from '../../profile/useMyProfile';
import ScreenHeader from '../../components/ScreenHeader';
import { useNavigation } from '../../navigation/NavigationContext';
import { fs, s } from '../../theme/scale';
import { colors } from '../../theme/tokens';
import { fontFamily, weight } from '../../theme/typography';

const thumb = require('../../../assets/brand/welling-thumb.png');

type Question = { key: string; label: string; image: ImageSourcePropType };

/** Figma 취향게임 6화면 (296:2866 ~ 296:2966) — 프레임별 데이터만 다르고 레이아웃은 동일 */
const QUESTIONS: Question[] = [
  { key: 'meat', label: '고기', image: require('../../../assets/taste/meat.png') },
  { key: 'seafood', label: '해산물', image: require('../../../assets/taste/seafood.png') },
  { key: 'western', label: '양식', image: require('../../../assets/taste/western.png') },
  { key: 'chinese', label: '중식', image: require('../../../assets/taste/chinese.png') },
  { key: 'japanese', label: '일식', image: require('../../../assets/taste/japanese.png') },
  { key: 'korean', label: '한식', image: require('../../../assets/taste/korean.png') },
];

/** 진행바 fill 폭 (트랙 전체 178 기준) — Figma 각 화면에서 추출 */
const FILL_WIDTHS = [29.7, 59.3, 89, 118.7, 148.3, 178];
const TRACK = 178;

export default function TasteGameScreen() {
  const { navigate, goBack, resetTo } = useNavigation();
  const insets = useSafeAreaInsets();
  const { draft, updateDraft } = useSignupDraft();
  const { user } = useAuth();
  const { bundle } = useMyProfile();

  /*
   * 가입 도중이면 초안에, 로그인한 뒤 프로필에서 다시 하면 서버에 저장한다.
   * 지금까지는 어느 쪽이든 초안에만 담겨서, 프로필에서 다시 해도 사라졌다.
   */
  const signedIn = Boolean(user?.id);

  const [index, setIndex] = useState(0);
  const [likes, setLikes] = useState<Record<string, boolean>>(
    signedIn ? (bundle?.privateProfile.tastes ?? {}) : draft.tastes,
  );

  const finish = async (next: Record<string, boolean>) => {
    if (signedIn && user?.id) {
      const error = await saveTastes(user.id, next);
      if (error) {
        Alert.alert('저장 실패', error.message);
        return;
      }
      resetTo('Profile');
      return;
    }

    updateDraft({ tastes: next });
    navigate('SignupTerms');
  };

  const question = QUESTIONS[index];

  const answer = (liked: boolean) => {
    const next = { ...likes, [question.key]: liked };
    setLikes(next);
    if (index < QUESTIONS.length - 1) {
      setIndex(index + 1);
    } else {
      void finish(next);
    }
  };

  const back = () => {
    if (index > 0) {
      setIndex(index - 1);
    } else {
      goBack();
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="취향 분석"
        onBack={back}
        action={
          <Pressable onPress={() => void finish(likes)} hitSlop={s(8)}>
            <Text style={styles.skip}>건너뛰기</Text>
          </Pressable>
        }
        below={
          <>
            <View style={styles.track}>
              <LinearGradient
                colors={[...colors.accentGradient]}
                locations={[...colors.accentGradientLocations]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[styles.fill, { width: `${(FILL_WIDTHS[index] / TRACK) * 100}%` }]}
              />
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.stepLabel}>취향을 알아볼까요?</Text>
              <Text style={styles.counter}>
                {index + 1} / {QUESTIONS.length}
              </Text>
            </View>
          </>
        }
      />

      <Text style={styles.question}>{question.label}, 좋아하세요?</Text>

      <View style={styles.card}>
        <Image source={question.image} style={styles.cardImage} resizeMode="cover" />
      </View>

      <View style={styles.actions}>
        <Image source={thumb} style={styles.thumb} resizeMode="contain" />

        <Pressable style={[styles.circle, styles.circleLeft]} onPress={() => answer(false)}>
          <X size={s(15)} color={colors.textPrimary} strokeWidth={3} />
        </Pressable>
        <Pressable style={[styles.circle, styles.circleRight]} onPress={() => answer(true)}>
          <Heart size={s(14)} color={colors.danger} fill={colors.danger} strokeWidth={2} />
        </Pressable>

        <Text style={[styles.actionLabel, styles.actionLabelLeft]}>별로예요</Text>
        <Text style={[styles.actionLabel, styles.actionLabelRight]}>좋아요</Text>
      </View>
    </View>
  );
}

/** Figma 좌표를 220 프레임 기준 비율로 (절대 배치용) */
const at = (x: number) => `${(x / 220) * 100}%` as const;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  skip: {
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(10),
    color: colors.textMuted,
  },
  track: {
    // y82, 타이틀 박스 하단(y70) 에서 12 / 폭 178 (x20~198)
    marginTop: s(14),
    marginHorizontal: s(2),
    height: s(5),
    borderRadius: s(3),
    backgroundColor: '#D9D9D9',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: s(3),
  },
  metaRow: {
    marginTop: s(3),
    marginHorizontal: s(2),
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepLabel: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(11),
    fontWeight: weight.bold,
    color: colors.primary,
  },
  counter: {
    fontFamily: fontFamily.body,
    fontSize: fs(7),
    lineHeight: fs(11),
    color: colors.textMuted,
  },
  question: {
    // y118, STEP 라벨 하단(y101) 에서 17
    marginTop: s(17),
    marginHorizontal: s(20),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(13),
    lineHeight: fs(18),
    fontWeight: weight.bold,
    color: colors.textPrimary,
  },
  card: {
    // x20 y148 180×180 radius 12
    marginTop: s(12),
    marginHorizontal: s(20),
    height: s(180),
    borderRadius: s(12),
    overflow: 'hidden',
    backgroundColor: colors.surfaceStrong,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  actions: {
    // 썸 y365.5 ~ 라벨 하단 y422
    marginTop: 'auto',
    marginBottom: s(64),
    height: s(57),
  },
  thumb: {
    position: 'absolute',
    left: at(87),
    top: 0,
    width: s(46),
    height: s(55),
  },
  circle: {
    position: 'absolute',
    // y378 — 썸 상단(y365.5) 에서 12.5
    top: s(12.5),
    width: s(30),
    height: s(30),
    borderRadius: s(30),
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A9A9A9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: s(4),
    elevation: 2,
  },
  circleLeft: {
    left: at(22),
  },
  circleRight: {
    left: at(168),
  },
  actionLabel: {
    position: 'absolute',
    // y414 — 썸 상단에서 48.5
    top: s(48.5),
    width: at(50),
    textAlign: 'center',
    fontFamily: fontFamily.body,
    fontSize: fs(6.5),
    lineHeight: fs(9),
    color: colors.textMuted,
  },
  actionLabelLeft: {
    left: at(12),
  },
  actionLabelRight: {
    left: at(158),
  },
});
