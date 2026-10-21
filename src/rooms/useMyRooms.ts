import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { useForegroundRefreshToken } from '../lifecycle/AppLifecycleContext';
import { subscribeRoomDecisions } from '../lib/roomDecisions';
import { getRoomDecisionClient } from '../lib/roomDecisionClient';
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
  useEffect(() => subscribeRoomDecisions(() => reload()), [reload]);

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
  const channelId = useId();
  const subscriptionSequence = useRef(0);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const foregroundRefreshToken = useForegroundRefreshToken();
  const [roomState, setRoomState] = useState<{ ownerId: string | null; roomId: string | null; room: RoomSummary | null; status: Status; error: Error | null }>({ ownerId: userId, roomId, room: null, status: 'loading', error: null });
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  useEffect(() => {
    if (!roomId) return;
    // Each hook and attachment owns its channel, including while an old unsubscribe is pending.
    const channelName = `room:${roomId}:${channelId}:${++subscriptionSequence.current}`;
    const unsubscribe = subscribeRoomDecisions(id => { if (id === roomId) reload(); });
    let active = true, detach = () => {};
    void Promise.resolve().then(getRoomDecisionClient).then(({ supabase }) => {
      if (!active || typeof supabase.channel !== 'function') return;
      const channel = supabase.channel(channelName).on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, reload)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` }, reload).subscribe();
      detach = () => { void supabase.removeChannel(channel); };
    }).catch(() => undefined);
    // Realtime delivery is optional; the foreground token and short visible-screen poll recheck state.
    const interval = setInterval(() => { if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') reload(); }, 10000);
    return () => { active = false; unsubscribe(); detach(); clearInterval(interval); };
  }, [roomId, userId, reload, channelId]);

  useEffect(() => {
    setRoomState(previous => previous.ownerId === userId && previous.roomId === roomId ? previous
      : { ownerId: userId, roomId, room: null, status: 'loading', error: null });
    if (!roomId) {
      setRoomState({ ownerId: userId, roomId, room: null, status: 'error', error: new Error('밥약 정보를 확인해 주세요.') });
      return;
    }

    let active = true;
    const fail = (cause: unknown, absent = false) => {
      if (!active) return;
      const error = cause instanceof Error ? cause : Object.assign(new Error('방 정보를 불러오지 못했어요.'), cause && typeof cause === 'object' ? cause : {});
      const code = (error as Error & { code?: string }).code;
      const status = (error as Error & { status?: number }).status;
      const denied = absent || status === 401 || status === 403 || ['42501', 'P0002', 'PGRST301', 'PGRST302', '28000', 'ACCOUNT_CHANGED', 'S1001', 'S1006', 'S1008'].includes(code ?? '');
      setRoomState(previous => {
        const retain = !denied && previous.ownerId === userId && previous.roomId === roomId && previous.room;
        return { ownerId: userId, roomId, room: retain ? previous.room : null, status: retain ? 'ready' : 'error', error };
      });
    };
    void fetchRoom(roomId)
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) { fail(error, !error && !data); return; }
        setRoomState({ ownerId: userId, roomId, room: data, status: 'ready', error: null });
      })
      .catch(fail);

    return () => {
      active = false;
    };
  }, [roomId, userId, reloadToken, foregroundRefreshToken]);

  const same = roomState.ownerId === userId && roomState.roomId === roomId;
  return { room: same ? roomState.room : null, reload, status: same ? roomState.status : 'loading' as Status, error: same ? roomState.error : null };
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
