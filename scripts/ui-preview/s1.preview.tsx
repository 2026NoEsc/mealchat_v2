import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { AppRegistry, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { scene, fixture } from './s1.fixtures';
import { NavigationProvider, useNavigation } from '../../src/navigation/NavigationContext';
import { SignupDraftProvider, useSignupDraft } from '../../src/auth/SignupDraftProvider';
import SignupTermsScreen from '../../src/screens/signup/SignupTermsScreen';
import ReConsentScreen from '../../src/screens/auth/ReConsentScreen';
import OptionalConsentsScreen from '../../src/screens/settings/OptionalConsentsScreen';
import SettingsScreen from '../../src/screens/settings/SettingsScreen';
import PrivacyScreen from '../../src/screens/profile/PrivacyScreen';
import LegalDocumentBody from '../../src/screens/settings/LegalDocumentBody';
import SettingsFrame from '../../src/screens/settings/SettingsFrame';
import CurrentLegalScreen from '../../src/screens/settings/CurrentLegalScreen';
import { healthConsent } from '../../src/legal/healthConsent';
import { marketingConsent } from '../../src/legal/marketingConsent';
import BottomNav from '../../src/components/ui/BottomNav';
import { v3Colors } from '../../src/theme/tokens';
import { fetchConsentManifest } from '../../src/lib/consents';
import PrivacyNoticeBanner from '../../src/screens/settings/PrivacyNoticeBanner';
import PrivacyRevisionScreen from '../../src/screens/settings/PrivacyRevisionScreen';
import SettlementsScreen from '../../src/screens/settlement/SettlementsScreen';
import { SettlementSheet } from '../../src/screens/chat/ChatRoomSheets';

function Signup() {
  const { updateDraft } = useSignupDraft();
  useEffect(() => updateDraft({ nickname: '밀챗', email: 'fixture@example.test', password: 'fixture-password' }), [updateDraft]);
  return <SignupTermsScreen />;
}
function PaymentChatPreview() {
  const { replace } = useNavigation();
  const [ready, setReady] = useState(false);
  useEffect(() => { replace('Settings', { settlementAmountText: '52000' }); setReady(true); }, [replace]);
  return <><SettingsScreen />{ready ? <SettlementSheet visible roomId="fixture-room" onClose={() => {}} participants={[
    { id: 'fixture-self', profileId: 's1-fixture-user', name: '밀챗', avatarColor: '', avatarUrl: null },
    { id: 'fixture-mate', profileId: 'fixture-mate', name: '모아', avatarColor: '', avatarUrl: null },
  ]} /> : null}</>;
}
function Flow() {
  const { current } = useNavigation();
  const content = scene === 'payment-chat' || scene === 'payment-request' ? <PaymentChatPreview /> : scene.startsWith('payment-') ? <SettlementsScreen /> : current.name === 'PrivacyRevision' || scene === 'notice-changes' ? <PrivacyRevisionScreen /> : scene === 'signup' ? <Signup /> : scene === 'reconsent' || scene === 'gate-error'
    ? <ReConsentScreen onDone={() => {}} manifest={scene === 'gate-error' ? null : fixture.manifest} status={scene === 'gate-error' ? null : fixture.status} gateError={scene === 'gate-error'} />
    : scene === 'service-document' || scene === 'privacy-document' ? <CurrentLegalScreen kind={scene === 'service-document' ? 'service' : 'privacy'} />
    : scene === 'health-document' || scene === 'marketing-document'
      ? <SettingsFrame title={scene === 'health-document' ? healthConsent.title : marketingConsent.title}><LegalDocumentBody document={scene === 'health-document' ? healthConsent : marketingConsent} /></SettingsFrame>
      : current.name === 'OptionalConsents' ? <OptionalConsentsScreen /> : scene === 'privacy' || scene === 'legacy-privacy' ? <PrivacyScreen /> : <SettingsScreen />;
  const tabs = ['settings', 'optional', 'privacy', 'legacy-privacy', 'notice-changes', 'service-document', 'privacy-document'].includes(scene);
  // Notice placement uses the real App-owned banner above a Settings content fixture.
  return <View style={{ flex: 1, backgroundColor: v3Colors.bg }}>{scene === 'notice' ? <PrivacyNoticeBanner /> : null}<View style={{ flex: 1 }}>{content}</View>{tabs ? <BottomNav active="profile" onChange={() => {}} /> : null}</View>;
}
function Preview() {
  const [modeReady, setModeReady] = useState(false);
  useEffect(() => { void fetchConsentManifest().then(() => setModeReady(true)); }, []);
  const [loaded, error] = useFonts({ 'Dot42Sans-Regular': require('../../assets/fonts/42dotSans-Regular.ttf'), 'Dot42Sans-Medium': require('../../assets/fonts/42dotSans-Medium.ttf'), 'Dot42Sans-Bold': require('../../assets/fonts/42dotSans-Bold.ttf') });
  if ((!loaded && !error) || !modeReady) return <Text>폰트 불러오는 중</Text>;
  return <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 412, height: 892 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } }}>
    <SafeAreaInsetsContext.Provider value={{ top: 0, bottom: 0, left: 0, right: 0 }}><NavigationProvider initialRoute={scene === 'optional' ? 'OptionalConsents' : scene === 'notice' ? 'Home' : 'Settings'}>
      <SignupDraftProvider><Flow /></SignupDraftProvider>
    </NavigationProvider></SafeAreaInsetsContext.Provider>
  </SafeAreaProvider>;
}
AppRegistry.registerComponent('S1AppPreview', () => Preview);
AppRegistry.runApplication('S1AppPreview', { rootTag: document.getElementById('root') });
