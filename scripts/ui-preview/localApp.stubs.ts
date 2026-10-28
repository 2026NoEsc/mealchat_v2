/** Offline application render only. No real account, notifications, or network. */
export const useAuth = () => ({ user: null, session: null, isReady: true });
export const useNotifications = () => ({ hasUnread: false, open() {}, close() {} });
