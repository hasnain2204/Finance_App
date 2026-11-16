import { Cloud, RotateCw, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { BackHeader } from '../../components/ui';

export function CloudSyncScreen({ onBack, auth, sync, onOpenCloudAccount, onToggleSync }) {
  const [toggleError, setToggleError] = useState('');
  const connectedEmail = auth?.user?.email;
  const enabled = sync?.syncEnabled === true;
  const ownerUserId = sync?.status?.ownerUserId;
  const accountMismatch = Boolean(ownerUserId && ownerUserId !== auth?.user?.id);
  const toggleDisabled = !connectedEmail || auth?.loading || sync?.syncPreferenceLoading ||
    sync?.busy || accountMismatch;

  const handleToggle = async () => {
    setToggleError('');
    try {
      await onToggleSync(!enabled);
    } catch (error) {
      setToggleError(error?.message || 'Could not update Cloud Sync.');
    }
  };

  return (
    <main className="account-shell">
      <BackHeader title="Cloud Sync" onBack={onBack} backLabel="Back to Settings" />

      <section className="cloud-sync-content">
        <div className="export-data-notice about-local-notice">
          <ShieldCheck size={20} aria-hidden="true" />
          <div>
            <strong>Online sync available</strong>
            <p>Connect an email account and enable sync for this device.</p>
          </div>
        </div>

        <section className="cloud-sync-card" aria-labelledby="cloud-sync-title">
          <div className="cloud-sync-heading">
            <div className="cloud-sync-title-group">
              <Cloud size={20} aria-hidden="true" />
              <h2 id="cloud-sync-title">Cloud Sync</h2>
            </div>
            {connectedEmail && enabled ? (
              <button
                type="button"
                className={`sync-icon-button ${sync?.busy ? 'is-spinning' : ''}`}
                onClick={async () => {
                  if (sync?.syncNow && !sync.busy) {
                    await sync.syncNow();
                  }
                }}
                disabled={sync?.busy || !sync?.syncEnabled}
                aria-label={sync?.busy ? 'Syncing…' : 'Sync now'}
                title={sync?.busy ? 'Syncing…' : 'Sync now'}
              >
                <RotateCw size={17} aria-hidden="true" />
              </button>
            ) : null}
          </div>
          {auth?.loading ? (
            <p className="cloud-sync-account" role="status">Checking this device for a saved account…</p>
          ) : connectedEmail ? (
            <>
              <p className="cloud-sync-account">Connected account <strong>{connectedEmail}</strong></p>
              <div className="cloud-sync-toggle-row">
                <div>
                  <strong>Sync this device</strong>
                  <p>{enabled
                    ? 'Changes sync automatically while this device is online.'
                    : 'Cloud syncing is off. Your finance data remains available on this device.'}</p>
                </div>
                <button
                  type="button"
                  className="preferences-toggle"
                  role="switch"
                  aria-checked={enabled}
                  aria-label="Cloud Sync"
                  disabled={toggleDisabled}
                  onClick={handleToggle}
                >
                  <span />
                </button>
              </div>
              {accountMismatch ? (
                <p className="cloud-sync-error" role="alert">
                  This device is bound to another account. Sync is paused to protect its records.
                </p>
              ) : null}
            </>
          ) : (
            <div className="cloud-sync-unconnected">
              <p>No account is connected. Connect an email address (Gmail works) to enable Cloud Sync.</p>
              <button type="button" className="secondary-button" onClick={onOpenCloudAccount}>
                Connect account
              </button>
              <div className="cloud-sync-toggle-row">
                <div>
                  <strong>Sync this device</strong>
                  <p>Unavailable until an account is connected.</p>
                </div>
                <button
                  type="button"
                  className="preferences-toggle"
                  role="switch"
                  aria-checked="false"
                  aria-label="Cloud Sync"
                  disabled
                >
                  <span />
                </button>
              </div>
            </div>
          )}
          {toggleError ? <p className="cloud-sync-error" role="alert">{toggleError}</p> : null}
          {sync?.error && sync.error !== toggleError
            ? <p className="cloud-sync-error" role="alert">{sync.error}</p>
            : null}
          {sync?.message ? <p className="cloud-sync-message" role="status">{sync.message}</p> : null}
        </section>
      </section>
    </main>
  );
}
