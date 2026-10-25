import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { observeAuthSession, useSupabaseAuth } from './useSupabaseAuth';

function createAuthClient(initialSession = null) {
  let listener;
  const subscription = { unsubscribe: vi.fn() };
  const client = {
    auth: {
      onAuthStateChange: vi.fn((callback) => {
        listener = callback;
        return { data: { subscription } };
      }),
      getSession: vi.fn(async () => ({ data: { session: initialSession }, error: null })),
      signUp: vi.fn(async () => ({ data: { user: { id: 'new-user' }, session: null }, error: null })),
      signInWithPassword: vi.fn(async () => ({
        data: { user: { id: 'signed-in-user' }, session: { user: { id: 'signed-in-user' } } },
        error: null
      })),
      signOut: vi.fn(async () => ({ data: {}, error: null }))
    }
  };
  return { client, emit: (event, session) => listener(event, session), subscription };
}

describe('Supabase authentication session handling', () => {
  it('restores a saved session and applies later user-session changes', async () => {
    const savedSession = { user: { id: 'user-one', email: 'one@example.com' } };
    const { client, emit, subscription } = createAuthClient(savedSession);
    const onStateChange = vi.fn();
    const unsubscribe = observeAuthSession(client, onStateChange);

    await waitFor(() => expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({
      event: 'SESSION_RESTORED',
      user: savedSession.user,
      loading: false
    })));

    const secondSession = { user: { id: 'user-two', email: 'two@example.com' } };
    act(() => emit('SIGNED_IN', secondSession));
    expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({
      event: 'SIGNED_IN',
      user: secondSession.user,
      session: secondSession
    }));

    act(() => emit('SIGNED_OUT', null));
    expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({
      event: 'SIGNED_OUT', user: null, session: null, loading: false
    }));

    unsubscribe();
    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
    act(() => emit('SIGNED_IN', secondSession));
    expect(onStateChange).toHaveBeenCalledTimes(3);
  });

  it('does not allow an older session restore response to overwrite a newer auth event', async () => {
    let resolveSession;
    const { client, emit } = createAuthClient();
    client.auth.getSession.mockImplementation(() => new Promise((resolve) => { resolveSession = resolve; }));
    const onStateChange = vi.fn();
    observeAuthSession(client, onStateChange);
    await waitFor(() => expect(resolveSession).toBeTypeOf('function'));

    const currentSession = { user: { id: 'current-user' } };
    act(() => emit('SIGNED_IN', currentSession));
    resolveSession({ data: { session: { user: { id: 'stale-user' } } }, error: null });
    await Promise.resolve();

    expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({
      event: 'SIGNED_IN', user: currentSession.user
    }));
  });

  it('uses email/password actions and returns clear confirmation messages', async () => {
    const { client, emit } = createAuthClient();
    const configuration = { configured: true, error: null };
    const { result } = renderHook(() => useSupabaseAuth(client, configuration));

    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => result.current.signUp(' user@example.com ', 'a-secure-password'));
    expect(client.auth.signUp).toHaveBeenCalledWith({ email: 'user@example.com', password: 'a-secure-password' });
    expect(result.current.message).toContain('Check user@example.com');

    await act(async () => result.current.signIn('user@example.com', 'a-secure-password'));
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'user@example.com', password: 'a-secure-password' });
    act(() => emit('SIGNED_IN', { user: { id: 'signed-in-user' } }));
    expect(result.current.user.id).toBe('signed-in-user');

    await act(async () => result.current.signOut());
    expect(client.auth.signOut).toHaveBeenCalledOnce();
    act(() => emit('SIGNED_OUT', null));
    expect(result.current.user).toBeNull();
    expect(result.current.message).toContain('local finance data remains');
  });

  it('keeps local-only operation when no Supabase client is configured', async () => {
    const configuration = { configured: false, error: 'Set the Supabase environment variables.' };
    const { result } = renderHook(() => useSupabaseAuth(null, configuration));

    expect(result.current.loading).toBe(false);
    expect(result.current.isConfigured).toBe(false);
    await act(async () => result.current.signIn('user@example.com', 'password'));
    expect(result.current.actionError).toBe(configuration.error);
  });
});
