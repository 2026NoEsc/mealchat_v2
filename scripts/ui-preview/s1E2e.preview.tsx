import { AppRegistry } from 'react-native';
import App from '../../App';
import { supabase } from '../../src/lib/supabase';
import * as consents from '../../src/lib/consents';
import * as profile from '../../src/lib/profile';
import * as settlements from '../../src/lib/settlements';
import * as rooms from '../../src/lib/rooms';
import { getConsentAccess } from '../../src/consents/access';
import { settlementUiError } from '../../src/components/ui/TransferConfirmationSheet';

// Explicit local-only test entry; never imported by the production entry point.
if (process.env.EXPO_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:54321') throw new Error('Local E2E requires the project-local API.');
Reflect.set(globalThis, '__s1E2E', {
  consents, profile, settlements, rooms, access: getConsentAccess, settlementUiError,
  async signIn(email: string, password: string) {
    const result = await supabase.auth.signInWithPassword({ email, password });
    return { id: result.data.user?.id ?? null, code: result.error?.code ?? null };
  },
  async signOut() { const result = await supabase.auth.signOut(); return { code: result.error?.code ?? null }; },
  async who() {
    const result = await supabase.auth.getUser();
    return { id: result.data.user?.id ?? null, confirmed: Boolean(result.data.user?.email_confirmed_at), code: result.error?.code ?? null };
  },
});
AppRegistry.registerComponent('S1LocalE2E', () => App);
AppRegistry.runApplication('S1LocalE2E', { rootTag: document.getElementById('root') });
