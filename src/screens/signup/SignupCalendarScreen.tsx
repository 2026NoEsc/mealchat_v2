import { useNavigation } from '../../navigation/NavigationContext';
import SignupIllustrationScreen from './SignupIllustrationScreen';

const moa = require('../../../assets/brand/moa.png');
const calendarMock = require('../../../assets/brand/calendar-mock.png');

/** Figma 회원가입/구글 캘린더 연동 (150:122) — moa x56 y158 104×85 */
export default function SignupCalendarScreen() {
  const { navigate, goBack } = useNavigation();

  return (
    <SignupIllustrationScreen
      title="구글 캘린더 연동"
      step={2}
      stepLabel="구글 캘린더 연동"
      characterName="모아"
      character={moa}
      characterBox={{ left: 40, top: 31, width: 104, height: 85 }}
      backgroundImage={calendarMock}
      description={['모아가 일정을 모을 수 있게', '구글 캘린더 연동을 해주세요']}
      footnote="필요시 추후 설정에서 변경 가능합니다!"
      ctaLabel="구글 캘린더 연동하러가기"
      onNext={() => navigate('SignupTaste')}
      onBack={goBack}
    />
  );
}
