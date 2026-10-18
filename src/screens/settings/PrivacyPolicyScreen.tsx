import { useNavigation } from '../../navigation/NavigationContext';
import CurrentLegalScreen from './CurrentLegalScreen';

export default function PrivacyPolicyScreen() {
  const { current } = useNavigation();
  return <CurrentLegalScreen kind="privacy" initialSection={current.params?.section === 'retention' ? 'retention' : undefined} />;
}
