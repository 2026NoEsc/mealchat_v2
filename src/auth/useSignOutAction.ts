import { useEffect, useRef, useState } from 'react';

import { useToast } from '../components/ui/Toast';
import { useAuth } from './AuthProvider';

/** Shared local interaction only; AuthProvider owns session and storage cleanup. */
export function useSignOutAction() {
  const { signOut } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const locked = useRef(false);
  const active = useRef(true);
  const { showToast, toastProps } = useToast();
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const leave = async () => {
    if (locked.current || !active.current) return;
    locked.current = true;
    setLeaving(true);
    const failure = () => {
      if (active.current) showToast({ message: '로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.' });
    };
    try { if (await signOut()) failure(); }
    catch { failure(); }
    finally { locked.current = false; if (active.current) setLeaving(false); }
  };
  return { leave, leaving, toastProps };
}
