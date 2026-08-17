import { getSupabaseConfig } from '../src/lib/supabaseConfig';

describe('getSupabaseConfig', () => {
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
