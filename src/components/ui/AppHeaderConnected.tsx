import { useNotifications } from '../NotificationsProvider';
import { AppHeader } from './AppHeader';

/** Notification wiring stays separate so the presentation can render in isolation. */
export default function AppHeaderConnected() {
  const { hasUnread, open } = useNotifications();
  return <AppHeader hasUnread={hasUnread} onPressBell={open} />;
}
