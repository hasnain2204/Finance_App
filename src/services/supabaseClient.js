import { createClient } from '@supabase/supabase-js';

function isLoopback(hostname) {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname.toLowerCase());
}

function getJwtRole(key) {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const encodedPayload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = globalThis.atob(encodedPayload.padEnd(Math.ceil(encodedPayload.length / 4) * 4, '='));
    return JSON.parse(payload).role || null;
  } catch {
    return null;
  }
}

export function validateSupabaseConfig(urlValue, keyValue) {
  const url = typeof urlValue === 'string' ? urlValue.trim() : '';
  const key = typeof keyValue === 'string' ? keyValue.trim() : '';
  if (!url || !key) {
    return {
      configured: false,
      error: 'Set both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.'
    };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { configured: false, error: 'VITE_SUPABASE_URL must be a valid HTTPS URL or a local loopback URL.' };
  }
  if (
    (parsedUrl.protocol !== 'https:' && !(parsedUrl.protocol === 'http:' && isLoopback(parsedUrl.hostname))) ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    return { configured: false, error: 'VITE_SUPABASE_URL must use HTTPS, except for local loopback development URLs.' };
  }

  if (key.startsWith('sb_secret_') || getJwtRole(key) === 'service_role') {
    return {
      configured: false,
      error: 'A secret or service-role key cannot be used in the browser. Use a Supabase publishable key.'
    };
  }
  const isPublishableKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  const isLegacyAnonKey = getJwtRole(key) === 'anon';
  if (!isPublishableKey && !isLegacyAnonKey) {
    return {
      configured: false,
      error: 'VITE_SUPABASE_PUBLISHABLE_KEY must be a Supabase publishable key or a legacy anon key.'
    };
  }

  return { configured: true, error: null };
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const configValidation = validateSupabaseConfig(supabaseUrl, supabasePublishableKey);

export const supabaseConfiguration = Object.freeze({
  configured: configValidation.configured,
  error: configValidation.error
});

export const supabaseClient = configValidation.configured
  ? createClient(supabaseUrl.trim(), supabasePublishableKey.trim(), {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true
      }
    })
  : null;
