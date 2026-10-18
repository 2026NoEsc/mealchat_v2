import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, SecondaryButton, TextButton } from '../../components/ui/Button';
import { authStyles } from '../../components/ui/AuthLayout';
import Toast, { useToast } from '../../components/ui/Toast';
import { newConsentRequestId, consentErrorMessage, type ConsentManifest, type ConsentStatus, type OptionalKind, type OptionalSubmission, type OptionalConsentResult } from '../../consents/contracts';
import { setOptionalConsent } from '../../lib/consents';
import { manifestDocument } from '../../legal/manifest';
import { v3Colors, v3FeedbackColors } from '../../theme/tokens';
import LegalDocumentSheet, { legalViewForTerm, type LegalView } from './LegalDocumentSheet';

const label = { health: '건강정보', marketing: '마케팅 정보 수신' };
const stateText = { not_asked: '아직 선택하지 않았어요', granted: '동의', declined: '거절', withdrawn: '철회', expired: '만료' };
export default function OptionalConsentControls({ manifest, status, withdrawalOnly = false, onChanged, onFeedback }: {
  manifest: ConsentManifest | null; status: ConsentStatus | null; withdrawalOnly?: boolean; onChanged?: () => void; onFeedback?: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [results, setResults] = useState<Partial<Record<OptionalKind, OptionalConsentResult>>>({});
  const [legalView, setLegalView] = useState<LegalView | null>(null);
  const pending = useRef<{ key: string; input: OptionalSubmission } | null>(null);
  const locked = useRef(false);
  const mounted = useRef(true);
  const { showToast, toastProps } = useToast();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => setResults({}), [status]);
  const change = async (kind: OptionalKind, action: 'grant' | 'withdraw') => {
    if (locked.current || (action === 'grant' && (!manifest || !status || status.required.status !== 'accepted' || withdrawalOnly))) return;
    const document = manifest?.documents[kind];
    const selected = results[kind] ?? status?.[kind];
    const key = JSON.stringify([kind, action, action === 'grant' ? [document?.version, document?.content_hash, selected?.revision] : null]);
    if (pending.current?.key !== key) pending.current = { key, input: { p_request_id: newConsentRequestId(), p_kind: kind, p_action: action, p_document_version: action === 'grant' ? document!.version : null, p_content_hash: action === 'grant' ? document!.content_hash : null, p_expected_revision: action === 'grant' ? selected!.revision : null, p_source: 'settings' } };
    locked.current = true; setBusy(true); setError('');
    try {
      const result = await setOptionalConsent(pending.current.input);
      if (!mounted.current) return;
      if (result.error || !result.data) {
        setError(consentErrorMessage(result.error));
        if (['S1002', 'S1004'].includes((result.error as { code?: string } | null)?.code ?? '')) { pending.current = null; onChanged?.(); }
        return;
      }
      setResults(current => ({ ...current, [kind]: result.data! })); pending.current = null;
      const message = result.data.status !== (action === 'withdraw' ? 'withdrawn' : 'granted') ? '최신 선택 동의 상태를 확인했어요'
        : action === 'withdraw' ? (kind === 'health' ? '동의를 철회하고 건강정보를 삭제했어요' : '마케팅 수신 동의를 철회했어요') : '선택 동의를 저장했어요';
      if (onFeedback) onFeedback(message); else showToast({ message });
      onChanged?.();
    } catch { if (mounted.current) setError('처리하지 못했어요. 다시 시도해 주세요.'); }
    finally { if (mounted.current) { locked.current = false; setBusy(false); } }
  };
  return <View style={styles.body}>
    {(['health', 'marketing'] as const).map(kind => {
      const current = results[kind] ?? status?.[kind];
      const deadline = kind === 'health' ? (current as { valid_until?: string | null })?.valid_until : (current as { next_confirmation_at?: string | null })?.next_confirmation_at;
      return <View key={kind} style={styles.card}>
        <Text accessibilityRole="header" style={authStyles.label}>{label[kind]} (선택)</Text>
        <Text style={authStyles.subtitle}>{current ? stateText[current.status] : '상태를 확인하지 못했어요'}</Text>
        {current?.granted_at ? <Text style={authStyles.helper}>동의일 {new Date(current.granted_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</Text> : null}
        {deadline ? <Text style={authStyles.helper}>{kind === 'health' ? '만료' : '다음 재확인'} {new Date(deadline).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</Text> : null}
        {kind === 'marketing' && (current as { confirmation_due?: boolean })?.confirmation_due ? <Text style={authStyles.helper}>동의 여부를 다시 확인할 때가 됐어요.</Text> : null}
        <Text style={authStyles.helper}>{kind === 'health' ? '선택하지 않아도 기본 서비스를 이용할 수 있어요. 유효기간은 1년이며, 철회하면 건강정보를 삭제해요.' : '2년마다 동의를 다시 확인해요. 현재 광고성 발송은 비활성입니다.'}</Text>
        <TextButton label={`${label[kind]} 원문 보기`} onPress={() => setLegalView({ ...legalViewForTerm(kind), ...(manifest ? { content: manifestDocument(manifest, kind) } : { fallback: true }) })} />
        {!withdrawalOnly && manifest && status?.required.status === 'accepted' ? <PrimaryButton label={`${label[kind]} 동의하기`} disabled={busy} onPress={() => void change(kind, 'grant')} /> : null}
        <SecondaryButton label={`${label[kind]} 동의 철회`} disabled={busy} onPress={() => void change(kind, 'withdraw')} />
      </View>;
    })}
    {error ? <Text accessibilityRole="alert" style={[authStyles.helper, styles.error]}>{error}</Text> : null}
    <LegalDocumentSheet view={legalView} onClose={() => setLegalView(null)} />
    <Toast {...toastProps} />
  </View>;
}
const styles = StyleSheet.create({ body: { gap: 16 }, card: { padding: 16, gap: 8, borderRadius: 16, borderWidth: 1, borderColor: v3Colors.border, backgroundColor: v3Colors.surface }, error: { color: v3FeedbackColors.error } });
