import { privacy } from '../../legal/privacy';
import { useNavigation } from '../../navigation/NavigationContext';
import LegalDocumentBody from './LegalDocumentBody';
import SettingsFrame from './SettingsFrame';

export default function PrivacyPolicyScreen() {
  const { current } = useNavigation();
  return <SettingsFrame title={privacy.title}>
    <LegalDocumentBody document={privacy} initialSection={current.params?.section === 'retention' ? 'retention' : undefined} />
  </SettingsFrame>;
}
