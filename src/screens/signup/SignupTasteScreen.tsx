import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { AuthFooter, SignupStepHeader, authStyles } from '../../components/ui/AuthLayout';
import { Button } from '../../components/ui/Button';
import { probeSignupFoodAvailability } from '../../lib/foodProfile';
import { useNavigation } from '../../navigation/NavigationContext';
import FoodProfileScreen from '../food/FoodProfileScreen';
import { setSignupFoodDraft } from '../food/signupFoodDraft';

export default function SignupTasteScreen() {
  const {navigate, goBack} = useNavigation(); const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => { let active = true; void probeSignupFoodAvailability().then(value => { if (active) setAvailable(value); }); return () => { active = false; }; }, []);
  if (available) return <FoodProfileScreen signup />;
  return <View style={authStyles.screen}><SignupStepHeader step={3} title="음식 프로필은 선택이에요" subtitle="음식 프로필 없이도 가입하고 밥약을 만들 수 있어요." onBack={goBack} />
    <View style={{flex: 1, padding: 20}}><Text style={authStyles.subtitle}>{available === null ? '음식 프로필 지원 여부를 확인하고 있어요.' : '이 서버에서는 아직 음식 프로필을 저장할 수 없어요. 가입은 계속할 수 있어요.'}</Text></View>
    <AuthFooter><Button label="건너뛰고 계속" onPress={() => { setSignupFoodDraft(null); navigate('SignupTerms'); }} /></AuthFooter>
  </View>;
}
