import { ArrowLeft, Cloud, LogIn, LogOut, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useSupabaseAuth } from '../services/useSupabaseAuth';
import { useFinanceSync } from '../services/useFinanceSync';

const syncCollectionLabels = {
  categories: 'Categories',
  paymentMethods: 'Payment methods',
  transactions: 'Transactions',
  budgets: 'Monthly budgets',
  budgetHistory: 'Budget history',
  preferences: 'Preferences'
};

export default function CloudAccountPanel({ onBack, onDataChanged, repository }) {
  const auth = useSupabaseAuth();
  const sync = useFinanceSync(repository, auth);
  const [mode, setMode] = useState('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const refreshFinanceData = async () => {
    if (onDataChanged) await onDataChanged();
  };

  const handleBack = async () => {
    await refreshFinanceData();
    onBack();
  };

  const runAndRefresh = async (action) => {
    const result = await action();
    if (result) await refreshFinanceData();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (mode === 'sign-up') await auth.signUp(email, password);
    else await auth.signIn(email, password);
    setPassword('');
  };

  return (
    <main className="account-shell">
      <header className="add-transaction-header">
        <button type="button" className="back-button" onClick={handleBack} aria-label="Back to More">
          <ArrowLeft size={22} />
        </button>
        <h1>Cloud Account</h1>
      </header>

      <section className="cloud-account-content">
        <div className="export-data-notice cloud-account-local-notice">
          <Cloud size={20} aria-hidden="true" />
          <div>
            <strong>Local finance stays available</strong>
            <p>Finance records stay local until you review the device/account counts and explicitly confirm the initial merge.</p>
          </div>
        </div>

        {!auth.isConfigured ? (
          <section className="cloud-auth-card">
            <h2>Cloud account setup required</h2>
            <p>{auth.configurationError || 'Add the Supabase project URL and publishable key to .env.local, then restart Vite.'}</p>
            <p>Local finance features continue to work without cloud configuration.</p>
          </section>
        ) : auth.loading ? (
          <section className="cloud-auth-card" role="status" aria-live="polite">
            <h2>Restoring session</h2>
            <p>Checking this device for a saved Supabase session…</p>
          </section>
        ) : auth.user ? (
          <>
            <section className="cloud-auth-card">
              <p className="eyebrow">Signed in</p>
              <h2>{auth.user.email || 'Supabase user'}</h2>
              <p>Local finance stays available offline. Sync uses this account only after you review and confirm the initial merge.</p>
              <div className={`sync-status sync-status-${sync.status.status}`} role="status" aria-live="polite">
                <span className="sync-status-dot" aria-hidden="true" />
                <strong>{sync.busy ? 'Syncing' : (['conflict-error', 'error'].includes(sync.status.status)
                  ? 'Conflict/Error'
                  : `${sync.status.status[0].toUpperCase()}${sync.status.status.slice(1)}`)}</strong>
                {sync.status.pending ? <span>{sync.status.pending} pending</span> : null}
                {sync.status.conflicts ? <span>{sync.status.conflicts} unresolved</span> : null}
              </div>
              {sync.status.ownerUserId && sync.status.ownerUserId !== auth.user.id ? (
                <p className="cloud-auth-error" role="alert">
                  This device’s sync queue is bound to another account. Sync is paused to protect that account’s records.
                </p>
              ) : null}
              {sync.status.ownerUserId === auth.user.id && sync.status.status !== 'offline' ? (
                <div className="sync-actions">
                  <button type="button" className="primary-action full cloud-auth-submit" onClick={() => runAndRefresh(sync.syncNow)} disabled={sync.busy}>
                    {sync.busy ? 'Syncing…' : 'Sync now'}
                  </button>
                  {sync.status.errors ? (
                    <button type="button" className="link-button" onClick={() => runAndRefresh(sync.retryFailed)} disabled={sync.busy}>
                      Retry failed operations
                    </button>
                  ) : null}
                </div>
              ) : null}
              {!sync.status.ownerUserId || sync.status.ownerUserId === auth.user.id ? (
                <button type="button" className="link-button sync-review-button" onClick={sync.reviewInitialSync} disabled={sync.busy || sync.status.status === 'offline'}>
                  {sync.status.ownerUserId ? 'Review unassigned local changes' : 'Review initial sync'}
                </button>
              ) : null}
              {sync.error ? <p className="cloud-auth-error" role="alert">{sync.error}</p> : null}
              {sync.message ? <p className="cloud-auth-message" role="status">{sync.message}</p> : null}
              <button
                type="button"
                className="primary-action full cloud-auth-submit"
                onClick={auth.signOut}
                disabled={auth.actionLoading || sync.busy}
              >
                <LogOut size={17} aria-hidden="true" />
                {auth.actionLoading ? 'Signing out…' : 'Sign out'}
              </button>
            </section>

            {sync.preview ? (
              <section className="cloud-auth-card sync-preview-card" aria-labelledby="sync-preview-title">
                <p className="eyebrow">Review before transfer</p>
                <h2 id="sync-preview-title">Initial sync preview</h2>
                <p>Confirming will merge by stable sync ID. It will not replace or clear local records. Same-ID changes are preserved as conflicts for you to resolve.</p>
                <div className="sync-count-table" role="table" aria-label="Local and remote record counts">
                  <div className="sync-count-row sync-count-header" role="row"><span role="columnheader">Collection</span><span role="columnheader">This device</span><span role="columnheader">Account</span></div>
                  {Object.entries(syncCollectionLabels).map(([collection, label]) => (
                    <div className="sync-count-row" role="row" key={collection}>
                      <span role="cell">{label}</span>
                      <span role="cell">{sync.preview.localCounts[collection]}</span>
                      <span role="cell">{sync.preview.remoteCounts[collection]}</span>
                    </div>
                  ))}
                </div>
                <p className="sync-preview-total">{sync.preview.totalLocal} local records · {sync.preview.totalRemote} account records</p>
                {sync.preview.identityIssueCount ? (
                  <p className="cloud-auth-error" role="alert">
                    {sync.preview.identityIssueCount} local sync identity or relationship issue(s) must be fixed before the initial merge. No records will be uploaded until every record has a valid unique sync ID and its references resolve.
                  </p>
                ) : null}
                {sync.preview.unboundPendingCount ? <p>{sync.preview.unboundPendingCount} local changes are waiting for account assignment.</p> : null}
                {sync.preview.foreignPendingCount ? (
                  <p className="cloud-auth-error" role="alert">
                    {sync.preview.foreignPendingCount} queued change(s) were made under another signed-in account. They remain paused and cannot be assigned here.
                  </p>
                ) : null}
                {sync.status.message ? <p className="cloud-auth-error" role="alert">{sync.status.message}</p> : null}
                <button type="button" className="primary-action full cloud-auth-submit" onClick={() => runAndRefresh(sync.confirmInitialSync)} disabled={sync.busy || sync.preview.foreignPendingCount > 0 || sync.preview.identityIssueCount > 0}>
                  {sync.busy ? 'Starting sync…' : 'Confirm merge and sync'}
                </button>
                <button type="button" className="link-button" onClick={() => sync.refresh().then(() => {})} disabled={sync.busy}>
                  Refresh status
                </button>
                <button type="button" className="link-button" onClick={sync.dismissPreview} disabled={sync.busy}>
                  Cancel
                </button>
              </section>
            ) : null}

            {sync.conflicts.map((conflict) => (
              <section className="cloud-auth-card sync-conflict-card" key={conflict.id}>
                <p className="eyebrow">Conflict · {syncCollectionLabels[conflict.collection]}</p>
                <h2>Choose which version to keep</h2>
                <p>{conflict.remotePayload?.deleted_at
                  ? 'The account has a deletion tombstone. Accepting it hides this record from normal finance views but keeps the local row in storage and backups.'
                  : 'Both versions are saved locally. The remote revision changed after this device’s base revision.'}</p>
                <details>
                  <summary>Compare saved versions</summary>
                  <strong>This device</strong>
                  <pre>{JSON.stringify(conflict.localPayload, null, 2)}</pre>
                  <strong>Account</strong>
                  <pre>{JSON.stringify(conflict.remotePayload, null, 2)}</pre>
                </details>
                <div className="sync-conflict-actions">
                  <button type="button" className="primary-action" onClick={() => runAndRefresh(() => sync.resolveConflict(conflict.id, 'local'))} disabled={sync.busy}>Keep this device’s version</button>
                  <button type="button" className="secondary-button" onClick={() => runAndRefresh(() => sync.resolveConflict(conflict.id, 'remote'))} disabled={sync.busy}>
                    {conflict.remotePayload?.deleted_at ? 'Accept account deletion' : 'Use account version'}
                  </button>
                </div>
              </section>
            ))}
          </>
        ) : (
          <form className="cloud-auth-card cloud-auth-form" onSubmit={handleSubmit}>
            <p className="eyebrow">{mode === 'sign-up' ? 'Create account' : 'Welcome back'}</p>
            <h2>{mode === 'sign-up' ? 'Sign up with email' : 'Sign in with email'}</h2>
            <label htmlFor="cloud-account-email">Email</label>
            <input
              id="cloud-account-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <label htmlFor="cloud-account-password">Password</label>
            <input
              id="cloud-account-password"
              name="password"
              type="password"
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {auth.error ? <p className="cloud-auth-error" role="alert">{auth.error.message || String(auth.error)}</p> : null}
            {auth.actionError ? <p className="cloud-auth-error" role="alert">{auth.actionError}</p> : null}
            {auth.message ? <p className="cloud-auth-message" role="status">{auth.message}</p> : null}
            <button
              type="submit"
              className="primary-action full cloud-auth-submit"
              disabled={auth.actionLoading}
            >
              {mode === 'sign-up' ? <UserPlus size={17} aria-hidden="true" /> : <LogIn size={17} aria-hidden="true" />}
              {auth.actionLoading
                ? (mode === 'sign-up' ? 'Creating account…' : 'Signing in…')
                : (mode === 'sign-up' ? 'Create account' : 'Sign in')}
            </button>
            <button
              type="button"
              className="link-button cloud-auth-mode-toggle"
              onClick={() => setMode((current) => current === 'sign-in' ? 'sign-up' : 'sign-in')}
              disabled={auth.actionLoading}
            >
              {mode === 'sign-up' ? 'Already registered? Sign in' : 'New to PWS? Create an account'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
