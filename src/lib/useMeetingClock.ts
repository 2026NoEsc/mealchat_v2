import { useEffect, useReducer } from 'react';
import { AppState } from 'react-native';
import { adjustedServerNow, setServerClockActive } from './meetingTime';

/** Refresh at minute boundaries (including KST midnight) and when returning to the foreground. */
export function useMeetingClock(snapshot: { server_time: string } | null) {
  const [, tick] = useReducer(value => value + 1, 0);
  const now = adjustedServerNow(snapshot);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => { timer = setTimeout(() => { tick(); schedule(); }, 60000 - adjustedServerNow(snapshot).getTime() % 60000); };
    setServerClockActive(snapshot, AppState.currentState !== 'inactive' && AppState.currentState !== 'background');
    schedule();
    const subscription = AppState.addEventListener('change', state => {
      setServerClockActive(snapshot, state === 'active');
      if (state === 'active') { clearTimeout(timer); tick(); schedule(); }
    });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [snapshot]);
  return now;
}
