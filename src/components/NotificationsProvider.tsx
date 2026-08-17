import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { fetchMyNotifications, type RoomNotification } from '../lib/settlements';
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
 *
 * 읽음 여부는 서버에 없다. notifications 에 읽음 컬럼이 없어서, 이 세션에서
 * "모두 읽음"을 눌렀는지만 기억한다. 앱을 다시 켜면 다시 점이 붙는다.
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [notices, setNotices] = useState<RoomNotification[]>([]);

  useEffect(() => {
    if (!userId) {
      setNotices([]);
      return;
    }

    let active = true;
    void fetchMyNotifications()
      .then(({ data }) => {
        if (active) setNotices(data ?? []);
      })
      .catch(() => {
        if (active) setNotices([]);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);
  const markAllRead = useCallback(() => setDismissed(true), []);

  const value = useMemo<NotificationsValue>(
    () => ({ hasUnread: notices.length > 0 && !dismissed, open, close, markAllRead }),
    [notices.length, dismissed, open, close, markAllRead],
  );

  return (
    <NotificationsContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {visible ? (
          <NotificationPanel
            notices={notices}
            allRead={dismissed}
            onClose={close}
            onMarkAllRead={markAllRead}
          />
        ) : null}
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
