import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import NotificationPanel from './NotificationPanel';

type NotificationsValue = {
  /** 헤더 벨의 오렌지 점 */
  hasUnread: boolean;
  open: () => void;
  close: () => void;
  markAllRead: () => void;
};

const NotificationsContext = createContext<NotificationsValue | null>(null);

/**
 * 알림 패널을 앱 최상단에서 관리한다.
 *
 * 패널은 하단 탭까지 덮어야 하므로 네비게이터 바깥에서 렌더하고,
 * 헤더는 화면마다 다시 배선할 필요 없이 이 컨텍스트로 벨을 연결한다.
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);
  const markAllRead = useCallback(() => setHasUnread(false), []);

  const value = useMemo<NotificationsValue>(
    () => ({ hasUnread, open, close, markAllRead }),
    [hasUnread, open, close, markAllRead],
  );

  return (
    <NotificationsContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {visible ? <NotificationPanel onClose={close} onMarkAllRead={markAllRead} /> : null}
      </View>
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications 는 NotificationsProvider 안에서만 사용할 수 있습니다.');
  }
  return ctx;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
