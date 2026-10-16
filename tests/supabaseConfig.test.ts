import { getSupabaseConfig } from '../src/lib/supabaseConfig';

describe('getSupabaseConfig', () => {
  const env = (url: string, optIn = '1') => ({
    EXPO_PUBLIC_SUPABASE_URL: url,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
    EXPO_PUBLIC_SUPABASE_ALLOW_LOCAL_HTTP: optIn,
  });
  let warn: jest.SpyInstance;
  beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined); });
  afterEach(() => warn.mockRestore());

  it.each(['127.0.0.1', 'localhost', '10.0.2.2', '10.255.255.254', '172.16.0.1', '172.31.255.254', '192.168.1.12'])(
    'allows development HTTP with explicit opt-in for %s', (host) => {
      const url = `http://${host}:54321`;
      expect(getSupabaseConfig(env(url), true).url).toBe(url);
    },
  );
  it.each(['127.0.0.2', '127.0.0.1.evil.com', 'localhost.evil.com', 'example.com', '8.8.8.8', '172.15.255.255', '172.32.0.1', '192.169.0.1', '[::1]'])(
    'rejects unapproved HTTP host %s', (host) => {
      expect(() => getSupabaseConfig(env(`http://${host}:54321`), true)).toThrow('restricted');
    },
  );
  it.each(['http://localhost@evil.com', 'http://user:password@localhost', 'http://@localhost', 'https://user@example.supabase.co'])(
    'rejects user information in %s', (url) => {
      expect(() => getSupabaseConfig(env(url), true)).toThrow('user information');
    },
  );
  it.each(['not a URL', 'http://', 'http:localhost', 'http://localhost:invalid', 'http://256.1.1.1', 'http://localhost\\@evil.com'])(
    'rejects malformed URL %s', (url) => {
      expect(() => getSupabaseConfig(env(url), true)).toThrow('valid absolute URL');
    },
  );
  it('requires both a development build and exact opt-in', () => {
    expect(() => getSupabaseConfig(env('http://localhost:54321'), false)).toThrow('outside development');
    for (const optIn of ['0', '', 'true', ' 1']) {
      expect(() => getSupabaseConfig(env('http://localhost:54321', optIn), true)).toThrow('ALLOW_LOCAL_HTTP=1');
    }
    expect(() => getSupabaseConfig({ ...env('http://localhost:54321'), EXPO_PUBLIC_SUPABASE_ALLOW_LOCAL_HTTP: undefined }, true)).toThrow('ALLOW_LOCAL_HTTP=1');
  });
  it('rejects other protocols and missing keys', () => {
    expect(() => getSupabaseConfig(env('ftp://localhost'), true)).toThrow('must use HTTPS');
    expect(() => getSupabaseConfig({ EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }, false)).toThrow('key is required');
  });
  it('warns once without disclosing connection values', () => {
    jest.isolateModules(() => {
      const { getSupabaseConfig: isolatedConfig } = require('../src/lib/supabaseConfig');
      isolatedConfig(env('http://localhost:54321'), true);
      isolatedConfig(env('http://10.0.2.2:54321'), true);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0].join(' ')).not.toMatch(/localhost|10\.0\.2\.2|sb_publishable_example/);
    });
  });
  it('uses the current publishable-key variable', () => {
    expect(
      getSupabaseConfig({
        EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      }),
    ).toEqual({
      url: 'https://example.supabase.co',
      publishableKey: 'sb_publishable_example',
    });
  });

  it('supports the legacy variable while local environments are migrated', () => {
    expect(
      getSupabaseConfig({
        EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_legacy',
      }),
    ).toEqual({
      url: 'https://example.supabase.co',
      publishableKey: 'sb_publishable_legacy',
    });
  });

  it('rejects missing and non-HTTPS connection details', () => {
    expect(() => getSupabaseConfig({})).toThrow('EXPO_PUBLIC_SUPABASE_URL');
    expect(() =>
      getSupabaseConfig({
        EXPO_PUBLIC_SUPABASE_URL: 'http://example.supabase.co',
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      }),
    ).toThrow('EXPO_PUBLIC_SUPABASE_URL');
  });
});
