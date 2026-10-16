type PublicEnv = Record<string, string | undefined>;

let warnedAboutLocalHttp = false;

function isLocalHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  const parts = hostname.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
  const [first, second] = parts.map(Number);
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

export function getSupabaseConfig(
  env: PublicEnv,
  isDevelopment = typeof __DEV__ !== 'undefined' && __DEV__ === true,
): {
  url: string;
  publishableKey: string;
} {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = (
    env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();

  let parsed: URL;
  try {
    if (!url || !/^[a-z][a-z\d+.-]*:\/\/[^/?#]+/i.test(url) || url.includes('\\') || /\s/.test(url)) throw new Error();
    parsed = new URL(url);
  } catch {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL must be a valid absolute URL.');
  }
  if (parsed.username || parsed.password || url.match(/^[^:]+:\/\/([^/?#]+)/)?.[1].includes('@')) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL must not contain user information.');
  }
  if (parsed.protocol === 'http:') {
    if (isDevelopment !== true) {
      throw new Error('EXPO_PUBLIC_SUPABASE_URL requires HTTPS outside development builds.');
    }
    if (env.EXPO_PUBLIC_SUPABASE_ALLOW_LOCAL_HTTP !== '1') {
      throw new Error('EXPO_PUBLIC_SUPABASE_URL requires HTTPS unless EXPO_PUBLIC_SUPABASE_ALLOW_LOCAL_HTTP=1 in development.');
    }
    if (!isLocalHost(parsed.hostname)) {
      throw new Error('EXPO_PUBLIC_SUPABASE_URL HTTP is restricted to approved loopback or private IPv4 hosts.');
    }
  } else if (parsed.protocol !== 'https:') {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL must use HTTPS (or explicitly enabled local HTTP in development).');
  }

  if (!publishableKey) {
    throw new Error('A Supabase publishable key is required.');
  }

  if (parsed.protocol === 'http:' && !warnedAboutLocalHttp) {
    warnedAboutLocalHttp = true;
    console.warn('Local Supabase HTTP is enabled for development only. Use a local publishable key; traffic is not encrypted.');
  }

  return { url, publishableKey };
}
