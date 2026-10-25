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

  const refresh = useCallback(async () => {
    const userId = auth?.user?.id;
    try {
      const [nextStatus, nextConflicts] = await Promise.all([
        service.getStatus({ userId }),
        service.getConflicts()
      ]);
      setStatus(nextStatus);
      setConflicts(nextConflicts.filter((conflict) => conflict.status === 'unresolved'));
    } catch (refreshError) {
      setError(refreshError?.message || 'Unable to read local sync status.');
    }
  }, [auth?.user?.id, service]);

  const run = useCallback(async (action, successText) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await action(auth?.user?.id);
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
  }, [auth?.user?.id, refresh]);

  const reviewInitialSync = useCallback(async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const nextPreview = await service.getInitialSyncPreview(auth?.user?.id);
      setPreview(nextPreview);
      return nextPreview;
    } catch (previewError) {
      setError(previewError?.message || 'Could not create the initial sync preview.');
      return null;
    } finally {
      setBusy(false);
    }
  }, [auth?.user?.id, service]);

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
    const database = repository.syncStorage || repository.getSyncStorage?.();
    Promise.resolve(setSyncMetadata(database, 'activeAuthUserId', auth?.user?.id || null))
      .finally(() => { if (!cancelled) refresh(); });
    return () => { cancelled = true; };
  }, [auth?.loading, auth?.user?.id, repository, refresh]);

  useEffect(() => {
    const userId = auth?.user?.id;
    if (!userId || auth?.loading || !globalThis.navigator?.onLine) return undefined;
    let cancelled = false;
    const tryAutomaticSync = async () => {
      const owner = await service.getStatus({ userId });
      if (cancelled || owner.ownerUserId !== userId) return;
      const database = repository.syncStorage || repository.getSyncStorage?.();
      if (await getSyncMetadata(database, 'initialSyncConfirmed') !== true) return;
      try { await service.syncNow(userId); } catch { /* status/error is surfaced by the next refresh */ }
      if (!cancelled) await refresh();
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
  }, [auth?.loading, auth?.user?.id, refresh, repository, service]);

  useEffect(() => {
    if (!auth?.user?.id || status.status !== 'pending') return undefined;
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
  }, [auth?.user?.id, service, status.status, syncNow]);

  useEffect(() => { void refresh(); }, [refresh]);

  return {
    status,
    conflicts,
    preview,
    busy,
    error,
    message,
    reviewInitialSync,
    confirmInitialSync,
    dismissPreview,
    syncNow,
    retryFailed,
    resolveConflict,
    refresh
  };
}
