import { useCallback, useEffect, useMemo, useState } from 'react';
import { createFinanceSyncService } from './financeSync';
import { getSyncMetadata, setSyncMetadata } from './financeSyncQueue';
import { supabaseClient } from './supabaseClient';

export function useFinanceSync(repository, auth) {
  const service = useMemo(() => createFinanceSyncService({ repository, client: supabaseClient }), [repository]);
  const [status, setStatus] = useState({ status: 'pending', pending: 0, conflicts: 0, errors: 0 });
  const [conflicts, setConflicts] = useState([]);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [syncPreference, setSyncPreference] = useState({ userId: null, enabled: false, loading: true });
  const userId = auth?.user?.id || null;
  const syncPreferenceLoading = Boolean(auth?.loading ||
    (userId && (syncPreference.userId !== userId || syncPreference.loading)));
  const syncEnabled = Boolean(userId && syncPreference.userId === userId &&
    !syncPreference.loading && syncPreference.enabled);

  const getDatabase = useCallback(() => repository.syncStorage || repository.getSyncStorage?.(), [repository]);

  const isSyncEnabledForUser = useCallback(async (accountUserId) => {
    if (!accountUserId) return false;
    const database = getDatabase();
    if (!database) throw new Error('Local sync storage is unavailable.');
    return await getSyncMetadata(database, `cloudSyncEnabled:${accountUserId}`) === true;
  }, [getDatabase]);

  const refresh = useCallback(async () => {
    const userId = auth?.user?.id;
    try {
      const [nextStatus, nextConflicts] = await Promise.all([
        service.getStatus({ userId }),
        service.getConflicts()
      ]);
      setStatus(nextStatus);
      setConflicts(nextConflicts.filter((conflict) => conflict.status === 'unresolved'));
      return nextStatus;
    } catch (refreshError) {
      setError(refreshError?.message || 'Unable to read local sync status.');
      return null;
    }
  }, [auth?.user?.id, service]);

  const run = useCallback(async (action, successText) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const accountUserId = auth?.user?.id;
      if (!accountUserId) throw new Error('Sign in to a cloud account before syncing.');
      if (!await isSyncEnabledForUser(accountUserId)) throw new Error('Turn on Cloud Sync from About before syncing this account.');
      const result = await action(accountUserId);
      setMessage(successText || 'Sync activity completed.');
      await refresh();
      return result;
    } catch (actionError) {
      setError(actionError?.message || 'Sync could not complete. Local records are still available.');
      await refresh();
      return null;
    } finally {
      setBusy(false);
    }
  }, [auth?.user?.id, isSyncEnabledForUser, refresh]);

  const reviewInitialSync = useCallback(async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const accountUserId = auth?.user?.id;
      if (!accountUserId) throw new Error('Sign in to a cloud account before reviewing sync.');
      if (!await isSyncEnabledForUser(accountUserId)) throw new Error('Turn on Cloud Sync from About before reviewing the initial sync.');
      const nextPreview = await service.getInitialSyncPreview(accountUserId);
      setPreview(nextPreview);
      return nextPreview;
    } catch (previewError) {
      setError(previewError?.message || 'Could not create the initial sync preview.');
      return null;
    } finally {
      setBusy(false);
    }
  }, [auth?.user?.id, isSyncEnabledForUser, service]);

  const setSyncEnabled = useCallback(async (enabled) => {
    const accountUserId = auth?.user?.id;
    if (!accountUserId) throw new Error('Connect a cloud account before changing its sync setting.');
    const database = getDatabase();
    if (!database) throw new Error('Local sync storage is unavailable.');
    const nextEnabled = Boolean(enabled);
    await setSyncMetadata(database, `cloudSyncEnabled:${accountUserId}`, nextEnabled);
    setSyncPreference({ userId: accountUserId, enabled: nextEnabled, loading: false });
    setError('');
    return nextEnabled;
  }, [auth?.user?.id, getDatabase]);

  const confirmInitialSync = useCallback(() => run(
    (userId) => service.confirmInitialSync(userId),
    'Initial merge confirmed. Local and remote records are being reconciled.'
  ).then((result) => {
    if (result) setPreview(null);
    return result;
  }), [run, service]);

  const dismissPreview = useCallback(() => setPreview(null), []);

  const syncNow = useCallback(() => run(
    (userId) => service.syncNow(userId),
    'Sync check completed.'
  ), [run, service]);

  const retryFailed = useCallback(() => run(
    (userId) => service.retryFailed(userId),
    'Retry completed.'
  ), [run, service]);

  const resolveConflict = useCallback((conflictId, choice) => run(
    (userId) => service.resolveConflict(conflictId, choice, userId),
    choice === 'local' ? 'Local version selected for sync.' : 'Remote version applied to this device.'
  ), [run, service]);

  useEffect(() => {
    if (auth?.loading) return undefined;
    let cancelled = false;
    const database = getDatabase();
    Promise.resolve(setSyncMetadata(database, 'activeAuthUserId', auth?.user?.id || null))
      .finally(() => { if (!cancelled) refresh(); });
    return () => { cancelled = true; };
  }, [auth?.loading, auth?.user?.id, getDatabase, refresh]);

  useEffect(() => {
    if (auth?.loading) return undefined;
    const accountUserId = auth?.user?.id || null;
    let cancelled = false;
    if (!accountUserId) {
      setSyncPreference({ userId: null, enabled: false, loading: false });
      return undefined;
    }

    setSyncPreference((current) => current.userId === accountUserId
      ? { ...current, loading: true }
      : { userId: accountUserId, enabled: false, loading: true });
    const loadPreference = async () => {
      try {
        const enabled = await isSyncEnabledForUser(accountUserId);
        if (!cancelled) setSyncPreference({ userId: accountUserId, enabled, loading: false });
      } catch (preferenceError) {
        if (!cancelled) {
          setSyncPreference({ userId: accountUserId, enabled: false, loading: false });
          setError(preferenceError?.message || 'Unable to read the Cloud Sync setting.');
        }
      }
    };
    void loadPreference();
    return () => { cancelled = true; };
  }, [auth?.loading, auth?.user?.id, isSyncEnabledForUser]);

  useEffect(() => {
    const accountUserId = auth?.user?.id;
    if (!accountUserId || auth?.loading || syncPreferenceLoading || !syncEnabled ||
      !globalThis.navigator?.onLine) return undefined;
    let cancelled = false;
    const tryAutomaticSync = async () => {
      try {
        const owner = await service.getStatus({ userId: accountUserId });
        if (cancelled || owner.ownerUserId !== accountUserId) return;
        const database = getDatabase();
        if (await getSyncMetadata(database, 'initialSyncConfirmed') !== true) return;
        await service.syncNow(accountUserId);
      } catch (automaticSyncError) {
        if (!cancelled) setError(automaticSyncError?.message || 'Automatic sync could not complete.');
      } finally {
        if (!cancelled) await refresh();
      }
    };
    const onResume = () => {
      if (globalThis.navigator?.onLine) void tryAutomaticSync();
      else void refresh();
    };
    window.addEventListener('online', onResume);
    window.addEventListener('pageshow', onResume);
    window.addEventListener('focus', onResume);
    document.addEventListener('visibilitychange', onResume);
    void tryAutomaticSync();
    return () => {
      cancelled = true;
      window.removeEventListener('online', onResume);
      window.removeEventListener('pageshow', onResume);
      window.removeEventListener('focus', onResume);
      document.removeEventListener('visibilitychange', onResume);
    };
  }, [auth?.loading, auth?.user?.id, getDatabase, refresh, service, syncEnabled, syncPreferenceLoading]);

  useEffect(() => {
    if (!auth?.user?.id || !syncEnabled || status.status !== 'pending') return undefined;
    let timer;
    service.getOutbox().then((entries) => {
      const dueTimes = entries
        .filter((entry) => entry.ownerUserId === auth.user.id && entry.status === 'retry' && entry.nextAttemptAt)
        .map((entry) => new Date(entry.nextAttemptAt).getTime())
        .filter(Number.isFinite);
      if (!dueTimes.length) return;
      const delay = Math.max(250, Math.min(600000, Math.min(...dueTimes) - Date.now()));
      timer = window.setTimeout(() => { void syncNow(); }, delay);
    });
    return () => window.clearTimeout(timer);
  }, [auth?.user?.id, service, status.status, syncEnabled, syncNow]);

  // Periodic 30-second auto-sync: when Cloud Sync is enabled, automatically check outbox every 30s
  // and sync if any pending transactions or mutations have been queued.
  useEffect(() => {
    const accountUserId = auth?.user?.id;
    if (!accountUserId || auth?.loading || syncPreferenceLoading || !syncEnabled || !globalThis.navigator?.onLine) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const database = getDatabase();
        if (!database) return;
        if (await getSyncMetadata(database, 'initialSyncConfirmed') !== true) return;

        const outbox = await service.getOutbox();
        const hasPendingItems = outbox.some(
          (entry) => entry.ownerUserId === accountUserId && (entry.status === 'pending' || entry.status === 'retry')
        );
        if (hasPendingItems) {
          await service.syncNow(accountUserId);
          await refresh();
        }
      } catch (_) {
        // Silent catch for background auto-sync poll
      }
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [auth?.loading, auth?.user?.id, getDatabase, refresh, service, syncEnabled, syncPreferenceLoading]);

  useEffect(() => { void refresh(); }, [refresh]);

  return {
    status,
    conflicts,
    preview,
    syncEnabled,
    syncPreferenceLoading,
    busy,
    error,
    message,
    setSyncEnabled,
    reviewInitialSync,
    confirmInitialSync,
    dismissPreview,
    syncNow,
    retryFailed,
    resolveConflict,
    refresh
  };
}
