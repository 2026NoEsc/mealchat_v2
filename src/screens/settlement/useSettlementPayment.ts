import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { registerSensitiveConsentClearer } from '../../consents/access';
import { fetchSettlementPaymentDetails, subscribeSettlementPayments, type SettlementPayment } from '../../lib/settlements';
export const SETTLEMENT_PAYMENT_RECHECK_MS = 5000;

/** View-local only. No AsyncStorage, query cache, navigation params or diagnostics contain accounts. */
export function useSettlementPayment(billId: string | null, enabled: boolean) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<{ key: string; status: 'loading' | 'ready' | 'error'; data: SettlementPayment | null }>({ key: '', status: 'loading', data: null });
  const key = `${userId ?? ''}:${billId ?? ''}`;
  const current = useRef({ key, enabled }); current.current = { key, enabled };
  const generation = useRef(0), mounted = useRef(true), active = useRef(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const checking = useRef(0);
  // Terminal results contain no account details and prevent automatic disclosure rechecks.
  const terminal = useRef<{ key: string; data: SettlementPayment } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = useCallback(() => { if (timer.current) { clearInterval(timer.current); timer.current = null; } }, []);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const clear = useCallback(() => { generation.current++; if (mounted.current) setView({ key: '', status: 'loading', data: null }); }, []);
  const reload = useCallback(() => {
    if (terminal.current?.key === key) {
      if (mounted.current && enabled && active.current) setView({ key, status: 'ready', data: terminal.current.data });
      return;
    }
    clear(); setAttempt(value => value + 1);
  }, [clear, enabled, key]);
  const refresh = useCallback(async (): Promise<SettlementPayment | null> => {
    if (!enabled || !billId || !userId || !active.current || current.current.key !== key || !current.current.enabled) return null;
    if (terminal.current?.key === key) {
      setView({ key, status: 'ready', data: terminal.current.data }); return terminal.current.data;
    }
    const ticket = ++generation.current;
    checking.current++;
    // Keep a ready account visible during validation; errors/closed results replace it immediately.
    setView(previous => previous.key === key && previous.status === 'ready' ? previous : { key, status: 'loading', data: null });
    try {
      const result = await fetchSettlementPaymentDetails(billId);
      if (!mounted.current || !active.current || ticket !== generation.current || current.current.key !== key || !current.current.enabled) return null;
      const data = result.error ? null : result.data;
      if (data && data.status !== 'open') { terminal.current = { key, data }; stopPolling(); }
      setView({ key, status: data ? 'ready' : 'error', data });
      return data;
    } catch {
      if (mounted.current && ticket === generation.current && current.current.key === key) setView({ key, status: 'error', data: null });
      return null;
    } finally { checking.current--; }
  }, [billId, enabled, key, stopPolling, userId]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; invalidate(); }; }, [invalidate]);
  useEffect(() => { if (enabled) void refresh(); else clear(); return invalidate; }, [enabled, refresh, clear, attempt, invalidate]);
  useEffect(() => {
    if (!enabled || !billId || !userId || terminal.current?.key === key) return;
    // Bill Realtime publication is not assumed. Bound disclosure staleness while visible.
    timer.current = setInterval(() => { if (active.current && checking.current === 0) void refresh(); }, SETTLEMENT_PAYMENT_RECHECK_MS);
    const focus = () => { if (active.current) reload(); };
    if (Platform.OS === 'web') window.addEventListener('focus', focus);
    return () => { stopPolling(); if (Platform.OS === 'web') window.removeEventListener('focus', focus); };
  }, [enabled, billId, userId, key, refresh, reload, stopPolling]);
  useEffect(() => {
    const unregister = registerSensitiveConsentClearer(clear);
    const unsubscribe = subscribeSettlementPayments(reload);
    const foreground = AppState.addEventListener('change', state => {
      active.current = state === 'active';
      if (active.current) reload(); else clear();
    });
    return () => { unregister(); unsubscribe(); foreground.remove(); };
  }, [clear, reload]);
  return {
    contextKey: key,
    status: enabled && view.key === key ? view.status : 'loading' as const,
    data: enabled && view.key === key ? view.data : null,
    refresh, reload, clear,
  };
}
export type SettlementPaymentController = ReturnType<typeof useSettlementPayment>;
