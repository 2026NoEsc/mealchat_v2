import { AppRegistry, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../../src/auth/AuthProvider';
import { useConsentGate } from '../../src/consents/useConsentGate';
import { AppLifecycleProvider } from '../../src/lifecycle/AppLifecycleContext';
import { NavigationProvider } from '../../src/navigation/NavigationContext';
import { NotificationsProvider } from '../../src/components/NotificationsProvider';
import DialogHost from '../../src/components/DialogHost';
import ChatHomeScreen from '../../src/screens/chat/ChatHomeScreen';
import App from '../../App';
import { supabase } from '../../src/lib/supabase';
import * as decisions from '../../src/lib/roomDecisions';
import * as rooms from '../../src/lib/rooms';
import * as voting from '../../src/lib/voting';
import * as settlements from '../../src/lib/settlements';
import { getConsentAccess } from '../../src/consents/access';
import { settlementUiError } from '../../src/components/ui/TransferConfirmationSheet';

// Explicit local-only entry. Real application, SDK and RPCs; no production resolver aliases.
if (process.env.EXPO_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:54321') throw Error('Local S4 API required');
Reflect.set(globalThis, '__s4E2E', {
  decisions, rooms, voting, settlements, settlementUiError, access: getConsentAccess,
  async signIn(email: string, password: string) {
    const result = await supabase.auth.signInWithPassword({ email, password });
    return { id: result.data.user?.id ?? null, code: result.error?.code ?? null };
  },
  async signOut() { const result = await supabase.auth.signOut(); return { code: result.error?.code ?? null }; },
});
// Isolated entry for the existing, unlinked legacy invitation screen. Real providers, SDK and UI; no response mocks.
function InvitationGate() {
  const { user } = useAuth(); const gate = useConsentGate();
  return user && gate.checked && gate.state === 'accepted'
    ? <NavigationProvider initialRoute="Chat"><NotificationsProvider><ChatHomeScreen /></NotificationsProvider></NavigationProvider>
    : <Text>로컬 초대 화면 로그인 대기</Text>;
}
function InvitationEntry() { return <SafeAreaProvider><AuthProvider><AppLifecycleProvider><InvitationGate /></AppLifecycleProvider></AuthProvider><DialogHost /></SafeAreaProvider>; }
const Entry = new URLSearchParams(globalThis.location?.search).get('entry') === 'invitations' ? InvitationEntry : App;
AppRegistry.registerComponent('S4LocalE2E', () => Entry);
AppRegistry.runApplication('S4LocalE2E', { rootTag: document.getElementById('root') });
