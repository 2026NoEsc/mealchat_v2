import { terms } from '../../legal/terms';
import LegalDocumentBody from './LegalDocumentBody';
import SettingsFrame from './SettingsFrame';

export default function ServiceTermsScreen() {
  return <SettingsFrame title={terms.title}><LegalDocumentBody document={terms} /></SettingsFrame>;
}
