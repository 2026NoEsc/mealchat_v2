/** Test-only fixture: auth calls never leave this preview process. */
export function useAuth() {
  return {
    user: { id: 'offline-fixture', email: 'mealchat@example.test' },
    sendPasswordReset: async () => null,
    signInWithEmail: async () => { throw new Error('Offline visual fixture'); },
    completePasswordReset: async () => { throw new Error('Offline visual fixture'); },
    cancelPasswordReset: async () => { throw new Error('Offline visual fixture'); },
    signUpWithEmail: async () => { throw new Error('Offline visual fixture'); },
    signOut: async () => { throw new Error('Offline visual fixture'); },
  };
}
