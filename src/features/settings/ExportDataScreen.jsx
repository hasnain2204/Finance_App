import { FileText, ShieldCheck } from 'lucide-react';
import { BackHeader } from '../../components/ui';

export function ExportDataScreen({ status, onExportPdf, onBack }) {
  return (
    <main className="account-shell">
      <BackHeader title="Export Data" onBack={onBack} backLabel="Back to More" />

      <section className="export-data-content">
       
        <section className="more-group export-data-card" aria-labelledby="pdf-statement-heading">
          <h2 id="pdf-statement-heading" className="more-group-title">PDF Statement</h2>
          <div className="more-row">
            <span>Format</span>
            <span className="more-row-value">PDF Document</span>
          </div>
          <div className="more-row">
            <span>Summary</span>
            <span className="more-row-value">KPI Cards &amp; Category Breakdown</span>
          </div>
          <div className="more-row">
            <span>Ledger</span>
            <span className="more-row-value">Full transaction history</span>
          </div>

          
          <button
            type="button"
            className="primary-action full export-data-button"
            onClick={onExportPdf}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', maxWidth: '80%' }}
          >
            <FileText size={18} /> Export PDF Statement
          </button>

          <div className="export-data-notice">
            <ShieldCheck size={20} aria-hidden="true" />
            <div>
              <strong>Export personal financial statement</strong>
                {/* <p>Generate your personal financial statement as a PDF report on your device.</p> */}
              <p className="export-data-footnote">Your financial details remain completely private and offline.</p>

            </div>
          </div>          
          
          
          
        </section>



        {status.message ? (
          <p className={`export-data-status ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>
            {status.type === 'success' ? <span aria-hidden="true">✓ </span> : null}
            {status.message}
          </p>
        ) : null}
      </section>
    </main>
  );
}
