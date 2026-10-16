import BottomSheet from '../../components/ui/BottomSheet';
import { privacy } from '../../legal/privacy';
import { terms } from '../../legal/terms';
import LegalDocumentBody from './LegalDocumentBody';

export type LegalView = { document: 'terms' | 'privacy'; section?: 'retention' };

/** Anonymous signup and the consent gate have no authenticated navigation context. */
export default function LegalDocumentSheet({ view, onClose }: { view: LegalView | null; onClose: () => void }) {
  if (!view) return null;
  const document = view.document === 'terms' ? terms : privacy;
  return <BottomSheet visible title={document.title} onClose={onClose}>
    <LegalDocumentBody key={`${view.document}-${view.section ?? ''}`} document={document} initialSection={view.section} />
  </BottomSheet>;
}

export const legalViewForTerm = (key: 'service' | 'privacy' | 'marketing'): LegalView => key === 'service'
  ? { document: 'terms' }
  : { document: 'privacy', ...(key === 'marketing' ? { section: 'retention' as const } : {}) };
