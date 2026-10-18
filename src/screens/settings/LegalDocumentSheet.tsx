import BottomSheet from '../../components/ui/BottomSheet';
import { privacy } from '../../legal/privacy';
import { terms } from '../../legal/terms';
import type { LegalDocument } from '../../legal/terms';
import { healthConsent } from '../../legal/healthConsent';
import { marketingConsent } from '../../legal/marketingConsent';
import { Text } from 'react-native';
import { authStyles } from '../../components/ui/AuthLayout';
import LegalDocumentBody from './LegalDocumentBody';

export type LegalView = { document: 'terms' | 'privacy' | 'health' | 'marketing'; section?: 'retention'; content?: LegalDocument; fallback?: boolean };

/** Anonymous signup and the consent gate have no authenticated navigation context. */
export default function LegalDocumentSheet({ view, onClose }: { view: LegalView | null; onClose: () => void }) {
  if (!view) return null;
  const document = view.content ?? ({ terms, privacy, health: healthConsent, marketing: marketingConsent }[view.document]);
  return <BottomSheet visible title={document.title} onClose={onClose}>
    {view.fallback ? <Text style={authStyles.helper}>현재 문서를 확인하지 못해 앱에 포함된 원문을 보여 드려요. 이 상태에서는 동의할 수 없어요.</Text> : null}
    <LegalDocumentBody key={`${view.document}-${view.section ?? ''}`} document={document} initialSection={view.section} />
  </BottomSheet>;
}

export const legalViewForTerm = (key: 'service' | 'privacy' | 'health' | 'marketing'): LegalView => key === 'service'
  ? { document: 'terms' }
  : { document: key };
