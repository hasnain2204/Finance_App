import { useCallback, useEffect, useState } from 'react';
import { supabaseClient, supabaseConfiguration } from './supabaseClient';

const initialSessionState = {
  session: null,
  user: null,
  loading: true,
  event: null,
  error: null
};

export function observeAuthSession(client, onStateChange) {
  let active = true;
  let authEventVersion = 0;
  const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
    authEventVersion += 1;
    if (!active) return;
    onStateChange({
      session: session || null,
      user: session?.user || null,
      loading: false,
      event,
      error: null
    });
  });
  const initialVersion = authEventVersion;

  Promise.resolve()
    .then(() => client.auth.getSession())
    .then(({ data, error }) => {
      if (!active || authEventVersion !== initialVersion) return;
      onStateChange({
        session: data?.session || null,
        user: data?.session?.user || null,
        loading: false,
        event: 'SESSION_RESTORED',
        error: error || null
      });
    })
    .catch((error) => {
      if (!active || authEventVersion !== initialVersion) return;
      onStateChange({
        session: null,
        user: null,
        loading: false,
        event: 'SESSION_RESTORE_FAILED',
        error
      });
    });

  return () => {
    active = false;
    subscription?.unsubscribe();
  };
}

export function useSupabaseAuth(client = supabaseClient, configuration = supabaseConfiguration) {
  const [sessionState, setSessionState] = useState(() => ({
    ...initialSessionState,
    loading: Boolean(client)
  }));
  const [actionState, setActionState] = useState({ loading: false, message: '', error: '' });

  useEffect(() => {
    if (!client) {
      setSessionState({ ...initialSessionState, loading: false });
      return undefined;
    }
    setSessionState({ ...initialSessionState, loading: true });
    return observeAuthSession(client, setSessionState);
  }, [client]);

  const runAuthAction = useCallback(async (operation, successMessage) => {
    if (!client) {
      const error = new Error(configuration.error || 'Supabase is not configured.');
      setActionState({ loading: false, message: '', error: error.message });
      return { data: null, error };
    }

    setActionState({ loading: true, message: '', error: '' });
    try {
      const { data, error } = await operation();
      if (error) throw error;
      const message = typeof successMessage === 'function' ? successMessage(data) : successMessage;
      setActionState({ loading: false, message, error: '' });
      return { data, error: null };
    } catch (error) {
      const message = error?.message || 'The authentication request failed. Check your connection and try again.';
      setActionState({ loading: false, message: '', error: message });
      return { data: null, error };
    }
  }, [client, configuration.error]);

  const signUp = useCallback((email, password) => runAuthAction(
    () => client.auth.signUp({ email: email.trim(), password }),
    (data) => data?.session
      ? 'Account created and signed in. Local finance data remains on this device.'
      : `Account created. Check ${email.trim()} for a confirmation email before signing in.`
  ), [client, runAuthAction]);

  const signIn = useCallback((email, password) => runAuthAction(
    () => client.auth.signInWithPassword({ email: email.trim(), password }),
    'Signed in. Finance records remain local; cloud transfer is not enabled yet.'
  ), [client, runAuthAction]);

  const signOut = useCallback(() => runAuthAction(
    () => client.auth.signOut(),
    'Signed out. Your local finance data remains available on this device.'
  ), [client, runAuthAction]);

  return {
    ...sessionState,
    isConfigured: Boolean(client),
    configurationError: configuration.error,
    actionLoading: actionState.loading,
    message: actionState.message,
    actionError: actionState.error,
    signUp,
    signIn,
    signOut
  };
}
