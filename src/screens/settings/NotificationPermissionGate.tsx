import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { authStyles } from '../../components/ui/AuthLayout';
import { NOTIFICATION_PERMISSION_PROMPT } from '../../config/features';
import NotificationPermissionScreen from './NotificationPermissionScreen';
import { markNotificationGuideSeen, readNotificationGuide, readNotificationPermission, subscribeNotificationGuide } from './notificationPermission';

/** Only a persisted signup marker can open the once-per-user device guide. */
export default function NotificationPermissionGate({ userId, children }: { userId: string | null; children: ReactNode }) {
  const enabled = NOTIFICATION_PERMISSION_PROMPT;
  const [state, setState] = useState<{ userId: string | null; ready: boolean; show: boolean }>({ userId: null, ready: false, show: false });
  useEffect(() => {
    if (!enabled || !userId) return;
    let active = true;
    let revision = 0;
    const check = async () => {
      const current = ++revision;
      const update = (show: boolean) => { if (active && current === revision) setState({ userId, ready: true, show }); };
      try {
        if (await readNotificationGuide(userId) !== 'pending') { update(false); return; }
        if (!active || current !== revision) return;
        const permission = await readNotificationPermission();
        if (!active || current !== revision) return;
        // Save the impression before mounting: killing the app or choosing later must not prompt again.
        await markNotificationGuideSeen(userId);
        update(permission.status === 'undetermined' && permission.canAskAgain);
      } catch { update(false); } // Optional onboarding must not block the existing application on local/OS failure.
    };
    const unsubscribe = subscribeNotificationGuide((changedUserId) => { if (changedUserId === userId) void check(); });
    void check();
    return () => { active = false; ++revision; unsubscribe(); };
  }, [userId, enabled]);
  if (!enabled || !userId) return <>{children}</>;
  if (state.userId !== userId || !state.ready) return <View style={authStyles.screen} accessibilityLabel="알림 권한 확인 중" accessibilityState={{ busy: true }} />;
  return state.show ? <NotificationPermissionScreen onDone={() => setState((previous) => previous.userId === userId ? { ...previous, show: false } : previous)} /> : <>{children}</>;
}
