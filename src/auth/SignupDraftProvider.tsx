import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type SignupConsent = 'service' | 'privacy' | 'marketing';

export type SignupDraft = {
  nickname: string;
  email: string;
  password: string;
  passwordConfirm: string;
  bank: string | null;
  account: string;
  birth: { year: string; month: string; day: string };
  tastes: Record<string, boolean>;
  consents: Record<SignupConsent, boolean>;
};

const initialDraft: SignupDraft = {
  nickname: '',
  email: '',
  password: '',
  passwordConfirm: '',
  bank: null,
  account: '',
  birth: { year: '', month: '', day: '' },
  tastes: {},
  consents: { service: false, privacy: false, marketing: false },
};

type SignupDraftValue = {
  draft: SignupDraft;
  updateDraft: (patch: Partial<SignupDraft>) => void;
  resetDraft: () => void;
};

const SignupDraftContext = createContext<SignupDraftValue | null>(null);

export function SignupDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<SignupDraft>(initialDraft);

  const updateDraft = useCallback((patch: Partial<SignupDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const resetDraft = useCallback(() => setDraft(initialDraft), []);

  const value = useMemo(
    () => ({ draft, updateDraft, resetDraft }),
    [draft, updateDraft, resetDraft],
  );

  return <SignupDraftContext.Provider value={value}>{children}</SignupDraftContext.Provider>;
}

export function useSignupDraft() {
  const context = useContext(SignupDraftContext);
  if (!context) throw new Error('useSignupDraft must be used within SignupDraftProvider.');
  return context;
}
