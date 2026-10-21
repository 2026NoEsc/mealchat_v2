import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { getRoomDecisionClient } from './roomDecisionClient';
import { getConsentAccess, subscribeConsentAccess } from '../consents/access';
import { fetchRoomDecisionState, invalidateS4Capabilities, subscribeRoomDecisions, type RoomDecisionState, type S4Mode } from './roomDecisions';

/** Open S4 flows revalidate stage/revision on server events, foreground and a short polling fallback. */
export function useRoomDecision(roomId: string | null, enabled: boolean) {
  const channelId = useId();
  const subscriptionSequence = useRef(0);
  const access = useSyncExternalStore(subscribeConsentAccess, getConsentAccess, getConsentAccess);
  const [snapshot, setSnapshot] = useState<{ owner: string | null; roomId: string | null; mode: S4Mode; data: RoomDecisionState | null; error: Error | null }>({ owner: access.userId, roomId, mode: 'unknown', data: null, error: null });
  const [loading, setLoading] = useState(false);
  const lastMode = useRef<S4Mode>('unknown');
  lastMode.current = snapshot.mode;
  const active = useRef(false), sequence = useRef(0);
  const reload = useCallback(async (probe = false) => {
    if (!roomId || !active.current) return null;
    const run = ++sequence.current;
    setLoading(true);
    if (probe) invalidateS4Capabilities();
    const result = await fetchRoomDecisionState(roomId);
    if (!active.current || run !== sequence.current) return null;
    const denied = ['42501', 'P0002', 'PGRST301', 'PGRST302', '28000', 'ACCOUNT_CHANGED', 'S1001', 'S1006', 'S1008'].includes((result.error as Error & { code?: string } | null)?.code ?? '');
    setSnapshot(previous => {
      const retain = result.error && !denied && previous.owner === access.userId && previous.roomId === roomId && previous.mode === 's4' && previous.data;
      return { owner: access.userId, roomId, mode: retain ? 's4' : result.mode, data: retain ? previous.data : result.data, error: result.mode === 'legacy' ? null : result.error };
    });
    setLoading(false);
    return result.data;
  }, [roomId, access.userId]);
  useEffect(() => {
    active.current = enabled && access.state === 'accepted';
    if (!active.current || !roomId) return () => { active.current = false; };
    void reload(lastMode.current === 'legacy' || lastMode.current === 'error');
    // Do not reuse a sibling's channel or a previous attachment still being removed.
    const channelName = `s4:${roomId}:${channelId}:${++subscriptionSequence.current}`;
    const unsubscribe = subscribeRoomDecisions(id => { if (id === roomId) void reload(); });
    // Let the shared capability listener invalidate once before any visible consumer probes.
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void Promise.resolve().then(() => reload()); });
    const interval = setInterval(() => { if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') void reload(); }, 10000);
    let attached = true;
    let detach = () => {};
    void Promise.resolve().then(getRoomDecisionClient).then(({ supabase }) => {
      if (!attached || typeof supabase.channel !== 'function') return;
      const channel = supabase.channel(channelName).on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, () => void reload())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` }, () => void reload()).subscribe();
      detach = () => { void supabase.removeChannel(channel); };
    }).catch(() => undefined);
    return () => { attached = false; active.current = false; clearInterval(interval); foreground.remove(); unsubscribe(); detach(); };
  }, [enabled, roomId, reload, access.state, channelId]);
  const same = snapshot.owner === access.userId && snapshot.roomId === roomId && access.state === 'accepted';
  const canRead = enabled && Boolean(roomId) && access.state === 'accepted';
  return { accountId: access.userId, mode: same ? snapshot.mode : 'unknown' as S4Mode, data: same ? snapshot.data : null, error: same ? snapshot.error : null,
    loading: canRead && (!same || (!snapshot.data && (loading || snapshot.mode === 'unknown'))), refreshing: same && Boolean(snapshot.data) && loading, reload };
}
