import { ShieldCheck } from 'lucide-react';
import { BackHeader } from '../../components/ui';

export function ExportDataScreen({ status, onExport, onBack }) {
  return (
    <main className="account-shell">
      <BackHeader title="Export Data" onBack={onBack} backLabel="Back to More" />

      <section className="export-data-content">
        <div className="export-data-notice">
          <ShieldCheck size={20} aria-hidden="true" />
          <div>
            <strong>Keep a copy of your data</strong>
            <p>PWS stores your records on this device. A backup protects them if you clear browser data or change your phone.</p>
          </div>
        </div>

        <section className="more-group export-data-card" aria-labelledby="local-backup-heading">
          <h2 id="local-backup-heading" className="more-group-title">Local backup</h2>
          <div className="more-row">
            <span>Transactions</span>
            <span className="more-row-value">Included</span>
          </div>
          <div className="more-row">
            <span>Budgets</span>
            <span className="more-row-value">Included</span>
          </div>
          <div className="more-row">
            <span>Categories &amp; methods</span>
            <span className="more-row-value">Included</span>
          </div>
          <p className="export-data-footnote">Export does not remove or change your data. Keep the downloaded file somewhere safe.</p>
        </section>

        <button type="button" className="primary-action full export-data-button" onClick={onExport}>
          Export Data
        </button>
        {status.message ? (
          <p className={`export-data-status ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>
            {status.type === 'success' ? <span aria-hidden="true">✓</span> : null}
            {status.message}
          </p>
        ) : null}
        <p className="export-data-disclaimer">No cloud account or bank connection is required.</p>
      </section>
    </main>
  );
}
