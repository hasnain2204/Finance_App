import { describe, expect, it } from 'vitest';
import { validateSupabaseConfig } from './supabaseClient';

describe('Supabase configuration validation', () => {
  it('allows an unconfigured app to remain in local-only mode', () => {
    const result = validateSupabaseConfig('', '');
    expect(result.configured).toBe(false);
    expect(result.error).toContain('VITE_SUPABASE_URL');
  });

  it('requires both the project URL and publishable key', () => {
    expect(validateSupabaseConfig('https://finance.supabase.co', '').configured).toBe(false);
    expect(validateSupabaseConfig('', 'sb_publishable_public-demo').configured).toBe(false);
  });

  it('accepts HTTPS project URLs with a current publishable key', () => {
    expect(validateSupabaseConfig(
      'https://finance.supabase.co',
      'sb_publishable_public-demo_123'
    )).toEqual({ configured: true, error: null });
  });

  it('allows a local loopback URL for local Supabase development', () => {
    expect(validateSupabaseConfig(
      'http://127.0.0.1:54321',
      'sb_publishable_local-demo'
    ).configured).toBe(true);
    expect(validateSupabaseConfig(
      'http://192.168.1.5:54321',
      'sb_publishable_local-demo'
    ).configured).toBe(false);
  });

  it('accepts legacy anon JWT keys but rejects service-role and secret keys', () => {
    const anonKey = 'header.eyJyb2xlIjoiYW5vbiJ9.signature';
    const serviceRoleKey = 'header.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature';
    expect(validateSupabaseConfig('https://finance.supabase.co', anonKey).configured).toBe(true);
    expect(validateSupabaseConfig('https://finance.supabase.co', serviceRoleKey).error)
      .toContain('service-role');
    expect(validateSupabaseConfig('https://finance.supabase.co', 'sb_secret_do-not-use').error)
      .toContain('secret');
  });

  it('rejects malformed and insecure hosted URLs', () => {
    expect(validateSupabaseConfig('not a url', 'sb_publishable_key').configured).toBe(false);
    expect(validateSupabaseConfig('http://finance.supabase.co', 'sb_publishable_key').configured).toBe(false);
    expect(validateSupabaseConfig('https://user:pass@finance.supabase.co', 'sb_publishable_key').configured).toBe(false);
  });
});
