import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { hasUnreadNotices } from '../lib/notificationsRead';
import {
  fetchMyNotifications,
  fetchNotificationsReadAt,
  markNotificationsRead,
  type RoomNotification,
} from '../lib/settlements';
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
 * 읽음 여부는 profile_private.notifications_read_at 에 사람마다 한 값으로 둔다.
 * 그 시각보다 뒤에 만들어진 알림이 안 읽은 것이다. 알림 행 자체에 표시를 달 수는
 * 없다 — 그 행은 방 참가자가 함께 보는 것이라 한 사람이 읽으면 모두가 읽은 것이 된다.
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [visible, setVisible] = useState(false);
  const [notices, setNotices] = useState<RoomNotification[]>([]);
  const [readAt, setReadAt] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setNotices([]);
      setReadAt(null);
      return;
    }

    let active = true;
    void Promise.all([fetchMyNotifications(), fetchNotificationsReadAt()])
      .then(([noticeResult, readResult]) => {
        if (!active) return;
        setNotices(noticeResult.data ?? []);
        setReadAt(readResult.data);
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

  /*
   * 점은 먼저 끄고 서버에 적는다. 실패하면 되돌린다 — 눌렀는데 점이 그대로 있으면
   * 눌린 것인지 알 수 없어서, 여기서는 낙관적으로 반영하는 편이 낫다.
   */
  const markAllRead = useCallback(() => {
    if (!userId) return;

    const previous = readAt;
    const now = new Date().toISOString();
    setReadAt(now);

    void markNotificationsRead(userId).then((error) => {
      if (error) setReadAt(previous);
    });
  }, [userId, readAt]);

  const unread = hasUnreadNotices(notices, readAt);

  const value = useMemo<NotificationsValue>(
    () => ({ hasUnread: unread, open, close, markAllRead }),
    [unread, open, close, markAllRead],
  );

  return (
    <NotificationsContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {visible ? (
          <NotificationPanel
            notices={notices}
            allRead={!unread}
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
