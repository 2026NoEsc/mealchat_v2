import { Text, View } from 'react-native';
import { useState } from 'react';
import { authStyles } from '../../components/ui/AuthLayout';
import { TextButton } from '../../components/ui/Button';
import { useConsentManifest } from '../../consents/useConsentManifest';
import { manifestDocument } from '../../legal/manifest';
import { terms } from '../../legal/terms';
import { privacy } from '../../legal/privacy';
import SettingsFrame from './SettingsFrame';
import LegalDocumentBody from './LegalDocumentBody';

export default function CurrentLegalScreen({ kind, initialSection }: { kind: 'service' | 'privacy'; initialSection?: string }) {
  const { manifest, legacy, loading, reload } = useConsentManifest();
  const [previous, setPrevious] = useState(false);
  const currentDocument = manifest ? manifestDocument(manifest, kind) : kind === 'service' ? terms : privacy;
  const hasPrevious = kind === 'privacy' && currentDocument.edition > privacy.edition;
  const document = previous && hasPrevious ? privacy : currentDocument;
  return <SettingsFrame title={document.title}>
    {!manifest && !legacy ? <View style={{ paddingHorizontal: 20, gap: 8 }}>
      <Text style={authStyles.helper}>{loading ? '현재 문서를 확인하고 있어요' : '현재 문서를 확인하지 못해 앱에 포함된 원문을 보여 드려요.'}</Text>
      {!loading ? <TextButton label="현재 문서 다시 확인" onPress={reload} /> : null}
    </View> : null}
    {hasPrevious ? <TextButton label={previous ? '현재 판 보기' : '이전 판 보기 · 1판'} onPress={() => setPrevious(value => !value)} /> : null}
    <LegalDocumentBody key={`${manifest?.documents[kind].content_hash ?? kind}-${previous}`} document={document} initialSection={initialSection} />
  </SettingsFrame>;
}
