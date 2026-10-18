import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { TextButton } from '../../components/ui/Button';
import Toast, { useToast } from '../../components/ui/Toast';
import { authStyles } from '../../components/ui/AuthLayout';
import { fetchConsentManifest, fetchConsentStatus } from '../../lib/consents';
import type { ConsentManifest, ConsentStatus } from '../../consents/contracts';
import SettingsFrame from './SettingsFrame';
import OptionalConsentControls from './OptionalConsentControls';

/** S1 new screen; Figma node mapping awaits coordinator confirmation. */
export default function OptionalConsentsScreen() {
  // Keep confirmed feedback mounted while the controls reload their server state.
  const { showToast, toastProps } = useToast();
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<{ manifest: ConsentManifest | null; status: ConsentStatus | null }>({ manifest: null, status: null });
  const [loading, setLoading] = useState(true);
  const [legacy, setLegacy] = useState(false);
  const reload = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    let active = true; setLoading(true); setLegacy(false); setData({ manifest: null, status: null });
    void (async () => {
      const manifest = await fetchConsentManifest();
      if (!active) return;
      setLegacy(manifest.legacy === true);
      if (manifest.legacy || manifest.error) { setLoading(false); return; }
      const status = await fetchConsentStatus();
      if (active) { setData({ manifest: manifest.data, status: status.data }); setLoading(false); }
    })().catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  return <SettingsFrame title="선택 동의">
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}>
      {loading ? <Text accessibilityLiveRegion="polite" style={authStyles.subtitle}>동의 상태를 확인하고 있어요</Text> : null}
      {legacy ? <Text accessibilityLiveRegion="polite" style={authStyles.subtitle}>곧 이용할 수 있어요. 건강정보·마케팅 선택 동의 설정은 아직 변경할 수 없어요.</Text> : <>
        {!loading && (!data.manifest || !data.status) ? <TextButton label="동의 상태 다시 확인" onPress={reload} /> : null}
        {!loading ? <OptionalConsentControls manifest={data.manifest} status={data.status} onChanged={reload} onFeedback={message => showToast({ message })} /> : null}
      </>}
    </ScrollView>
    <Toast {...toastProps} />
  </SettingsFrame>;
}
