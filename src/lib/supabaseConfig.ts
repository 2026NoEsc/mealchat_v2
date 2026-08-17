type PublicEnv = Record<string, string | undefined>;

export function getSupabaseConfig(env: PublicEnv): {
  url: string;
  publishableKey: string;
} {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = (
    env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();

  if (!url?.startsWith('https://')) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL must be an HTTPS URL.');
  }

  if (!publishableKey) {
    throw new Error('A Supabase publishable key is required.');
  }

  return { url, publishableKey };
}
