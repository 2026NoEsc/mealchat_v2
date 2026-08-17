import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import {
  fetchMyRooms,
  fetchRoom,
  fetchRoomMessages,
  type RoomMessage,
  type RoomSummary,
} from '../lib/rooms';

type Status = 'loading' | 'ready' | 'error';

export function useMyRooms() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    if (!userId) {
      setRooms([]);
      setStatus('loading');
      return;
    }

    let active = true;
    setStatus('loading');
    setError(null);

    void fetchMyRooms()
      .then((result) => {
        if (!active) return;
        if (result.error) {
          setError(result.error);
          setStatus('error');
          return;
        }
        setRooms(result.data ?? []);
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause : new Error('방 목록을 불러오지 못했어요.'));
        setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [userId, reloadToken]);

  return { rooms, status, error, reload };
}

export function useRoomMessages(roomId: string | null) {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    if (!roomId) {
      setMessages([]);
      setStatus('ready');
      return;
    }

    let active = true;
    setStatus('loading');
    setError(null);

    void fetchRoomMessages(roomId)
      .then((result) => {
        if (!active) return;
        if (result.error) {
          setError(result.error);
          setStatus('error');
          return;
        }
        setMessages(result.data ?? []);
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause : new Error('메시지를 불러오지 못했어요.'));
        setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [roomId, reloadToken]);

  return { messages, status, error, reload };
}

/** 채팅방 헤더가 쓰는 방 한 건 */
export function useRoom(roomId: string | null) {
  const [room, setRoom] = useState<RoomSummary | null>(null);

  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      return;
    }

    let active = true;
    void fetchRoom(roomId)
      .then(({ data }) => {
        if (active) setRoom(data);
      })
      .catch(() => {
        if (active) setRoom(null);
      });

    return () => {
      active = false;
    };
  }, [roomId]);

  return room;
}
