import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { useForegroundRefreshToken } from '../lifecycle/AppLifecycleContext';
import {
  fetchMyRooms,
  fetchMySettlements,
  fetchRoom,
  fetchRoomMessages,
  type RoomMessage,
  type RoomSummary,
  type SettlementSummary,
} from '../lib/rooms';

type Status = 'loading' | 'ready' | 'error';

export function useMyRooms() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const foregroundRefreshToken = useForegroundRefreshToken();

  const [roomState, setRoomState] = useState<{ ownerId: string | null; rooms: RoomSummary[] }>({ ownerId: userId, rooms: [] });
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    setRoomState(previous => previous.ownerId === userId ? previous : { ownerId: userId, rooms: [] });
    if (!userId) {
      setRoomState({ ownerId: userId, rooms: [] });
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
        setRoomState({ ownerId: userId, rooms: result.data ?? [] });
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
  }, [userId, reloadToken, foregroundRefreshToken]);

  // Hide the previous account even in the render before effects run.
  const sameAccount = roomState.ownerId === userId;
  return { rooms: sameAccount ? roomState.rooms : [], status: sameAccount ? status : 'loading' as Status, error: sameAccount ? error : null, reload };
}

export function useRoomMessages(roomId: string | null) {
  const foregroundRefreshToken = useForegroundRefreshToken();
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
  }, [roomId, reloadToken, foregroundRefreshToken]);

  return { messages, status, error, reload };
}

/** 채팅방 헤더가 쓰는 방 한 건 */
/*
 * 방 하나를 읽는다. reload 를 함께 준다 — 단계(stage)는 방에 있는데 예전에는
 * 처음 한 번만 읽어서, 방장이 "식당 정하기로 넘어가기" 를 눌러 서버 단계가
 * 바뀌어도 액션 행이 계속 예전 단계로 그려졌다. 앱을 다시 켜야 반영됐다.
 */
export function useRoom(roomId: string | null) {
  const foregroundRefreshToken = useForegroundRefreshToken();
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      setStatus('error');
      return;
    }

    let active = true;
    setStatus('loading');
    void fetchRoom(roomId)
      .then(({ data, error }) => {
        if (!active) return;
        setRoom(error ? null : data);
        setStatus(error || !data ? 'error' : 'ready');
      })
      .catch(() => {
        if (active) { setRoom(null); setStatus('error'); }
      });

    return () => {
      active = false;
    };
  }, [roomId, reloadToken, foregroundRefreshToken]);

  return { room, reload, status };
}

/** 내가 볼 수 있는 정산 목록. 홈의 정산 넛지가 쓴다. */
export function useMySettlements() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const foregroundRefreshToken = useForegroundRefreshToken();
  const [settlementState, setSettlementState] = useState<{ ownerId: string | null; settlements: SettlementSummary[] }>({ ownerId: userId, settlements: [] });

  useEffect(() => {
    setSettlementState(previous => previous.ownerId === userId ? previous : { ownerId: userId, settlements: [] });
    if (!userId) {
      return;
    }

    let active = true;
    void fetchMySettlements(userId)
      .then(({ data }) => {
        if (active) setSettlementState({ ownerId: userId, settlements: data ?? [] });
      })
      .catch(() => {
        if (active) setSettlementState({ ownerId: userId, settlements: [] });
      });

    return () => {
      active = false;
    };
  }, [userId, foregroundRefreshToken]);

  // Account changes must hide old counts in the render before the effect clears its state.
  return settlementState.ownerId === userId ? settlementState.settlements : [];
}
