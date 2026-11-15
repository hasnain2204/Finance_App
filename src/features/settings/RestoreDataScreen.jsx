import { CircleAlert, FileUp, ShieldCheck } from 'lucide-react';
import { BackHeader, ConfirmDialog } from '../../components/ui';
import { MigrationVerificationSummary } from './MigrationVerificationSummary';

export function RestoreDataScreen({
  fileInputRef,
  status,
  setStatus,
  restoreCandidate,
  setRestoreCandidate,
  migrationReport,
  showRestoreConfirm,
  setShowRestoreConfirm,
  isPreparingRestore,
  onFileChange,
  onConfirmRestore,
  onBack
}) {
  return (
    <main className="account-shell">
      <BackHeader title="Restore Data" onBack={onBack} backLabel="Back to More" />

      <section className="export-data-content">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={onFileChange}
        />
        {status.type === 'success' ? (
          <>
            <div className="export-data-notice">
              <ShieldCheck size={20} aria-hidden="true" />
              <div>
                <strong>Your local records are ready</strong>
                <p>The selected backup has replaced the records on this device. No data was sent to a cloud account.</p>
              </div>
            </div>
            <MigrationVerificationSummary report={migrationReport} />
            <p className="restore-complete-status" role="status">
              <span aria-hidden="true">✓</span>
              Data restored
            </p>
            <button type="button" className="restore-back-button" onClick={onBack}>
              Back to More
            </button>
          </>
        ) : status.type === 'error' ? (
          <>
            <section className="restore-error-card" role="alert">
              <CircleAlert className="restore-error-icon" size={22} aria-hidden="true" />
              <h2>Unable to restore data</h2>
              <p>{status.message || 'Choose a valid PWS backup and try again.'}</p>
              <strong>Your current data is unchanged.</strong>
            </section>
            <MigrationVerificationSummary report={migrationReport} />
            <button
              type="button"
              className="primary-action full restore-retry-button"
              onClick={() => {
                setStatus({ type: 'idle', message: '' });
                setRestoreCandidate(null);
                setShowRestoreConfirm(false);
                fileInputRef.current?.click();
              }}
            >
              Choose another file
            </button>
            <button
              type="button"
              className="restore-back-button"
              onClick={() => {
                setStatus({ type: 'idle', message: '' });
                setRestoreCandidate(null);
                setShowRestoreConfirm(false);
                onBack();
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <div className="export-data-notice">
              {restoreCandidate ? <FileUp size={20} aria-hidden="true" /> : <ShieldCheck size={20} aria-hidden="true" />}
              <div>
                <strong>{restoreCandidate ? 'Backup ready to restore' : 'Back up before you restore'}</strong>
                <p>{restoreCandidate
                  ? 'PWS backup selected. Confirmation required before replacing your local records.'
                  : 'Restoring replaces the records currently on this device. Export a backup first so you can recover your existing data.'}</p>
              </div>
            </div>

            <section className="restore-file-card">
              {restoreCandidate ? (
                <button
                  type="button"
                  className="restore-selected-backup"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Choose a different backup file"
                >
                  <strong>Selected backup</strong>
                  <span>{`PWS backup · ${restoreCandidate.fileDate}`}</span>
                </button>
              ) : (
                <>
                  <FileUp className="restore-file-icon" size={22} aria-hidden="true" />
                  <h2>Choose a PWS backup</h2>
                  <p>Use a backup previously exported from PWS.</p>
                  <button
                    type="button"
                    className="restore-file-button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isPreparingRestore}
                  >
                    {isPreparingRestore ? 'Checking backup…' : 'Choose backup file'}
                  </button>
                </>
              )}
            </section>

            {restoreCandidate ? (
              <button
                type="button"
                className="primary-action full restore-data-button"
                onClick={() => setShowRestoreConfirm(true)}
              >
                Restore Data
              </button>
            ) : null}
            {status.message ? (
              <p className={`restore-data-status ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>
                {status.message}
              </p>
            ) : null}
            {!restoreCandidate ? (
              <p className="export-data-disclaimer">Select a valid backup to continue. Your current data stays unchanged until you confirm.</p>
            ) : null}
          </>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(showRestoreConfirm && restoreCandidate)}
        titleId="restore-confirm-title"
        title="Restore backup?"
        description="This will replace the data on this device. Export your current data first if you want to keep it."
        onCancel={() => setShowRestoreConfirm(false)}
        onConfirm={onConfirmRestore}
        confirmLabel="Restore"
        confirmClassName="restore-confirm-button"
        dialogClassName="restore-confirm-dialog"
      />
    </main>
  );
}
