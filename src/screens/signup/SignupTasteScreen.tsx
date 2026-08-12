import { useNavigation } from '../../navigation/NavigationContext';
import SignupIllustrationScreen from './SignupIllustrationScreen';

const welling = require('../../../assets/brand/welling2.png');

/** Figma 회원가입/취향 분석 (150:123) — welling 3 x74 y175 73×88 */
export default function SignupTasteScreen() {
  const { navigate, goBack } = useNavigation();

  return (
    <SignupIllustrationScreen
      title="취향 분석"
      step={3}
      stepLabel="취향을 알아볼까요?"
      characterName="웰링"
      character={welling}
      characterBox={{ left: 58, top: 48, width: 73, height: 88 }}
      description={['웰링이 손가락 떠 먹여주듯 먹여줄 수 있게', '메뉴 취향을 입력해주세요']}
      ctaLabel="음식 취향 입력하러가기"
      onNext={() => navigate('SignupTerms')}
      onBack={goBack}
    />
  );
}
