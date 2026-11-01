import { ChevronRight } from 'lucide-react';
import { StatusMessage } from '../../components/ui';

export function MoreScreen({
  preferences,
  status,
  onOpenCloudAccount,
  onOpenAccount,
  onOpenPaymentMethods,
  onOpenExport,
  onOpenRestore,
  onOpenPreferences,
  onOpenHelp,
  onOpenAbout
}) {
  return (
    <div className="more-page">
      <section className="more-group" aria-labelledby="more-cloud-account-heading">
        <h2 id="more-cloud-account-heading" className="more-group-title">Cloud account</h2>
        <button type="button" className="more-row" onClick={onOpenCloudAccount}>
          <span>Sign in or create account</span>
          <span className="more-row-trailing">
            <span className="more-row-value">Optional</span>
            <ChevronRight className="more-chevron" size={20} />
          </span>
        </button>
      </section>

      <section className="more-group" aria-labelledby="more-account-heading">
        <h2 id="more-account-heading" className="more-group-title">Account</h2>
        <button type="button" className="more-row" onClick={onOpenAccount}>
          <span>Categories</span>
          <ChevronRight className="more-chevron" size={20} />
        </button>
        <button type="button" className="more-row" onClick={onOpenPaymentMethods}>
          <span>Payment Methods</span>
          <ChevronRight className="more-chevron" size={20} />
        </button>
      </section>

      <section className="more-group" aria-labelledby="more-data-heading">
        <h2 id="more-data-heading" className="more-group-title">Data &amp; Backup</h2>
        <button type="button" className="more-row" onClick={onOpenExport}>
          <span>Export Data</span>
          <ChevronRight className="more-chevron" size={20} />
        </button>
        <button type="button" className="more-row" onClick={onOpenRestore}>
          <span>Restore Data</span>
          <ChevronRight className="more-chevron" size={20} />
        </button>
        <div className="more-row more-row-muted">
          <span>Cloud Sync</span>
          <span className="more-row-value">Coming Later</span>
        </div>
        <StatusMessage type={status.type} message={status.message} />
      </section>

      <section className="more-group" aria-labelledby="more-preferences-heading">
        <h2 id="more-preferences-heading" className="more-group-title">Preferences</h2>
        <div className="more-row more-row-muted">
          <span>Currency</span>
          <span className="more-row-value">PKR · Fixed</span>
        </div>
        <button type="button" className="more-row" onClick={onOpenPreferences}>
          <span>Date Format</span>
          <span className="more-row-trailing">
            <span className="more-row-value">{preferences?.dateFormat || 'DD MMM YYYY'}</span>
            <ChevronRight className="more-chevron" size={20} />
          </span>
        </button>
        <button type="button" className="more-row" onClick={onOpenPreferences}>
          <span>Notifications</span>
          <span className="more-row-trailing">
            <span className="more-row-value">{preferences?.notificationsEnabled ? 'Basic · On' : 'Basic · Off'}</span>
            <ChevronRight className="more-chevron" size={20} />
          </span>
        </button>
      </section>

      <section className="more-group" aria-labelledby="more-help-heading">
        <h2 id="more-help-heading" className="more-group-title">Help</h2>
        <button type="button" className="more-row" onClick={onOpenHelp}>
          <span>Help &amp; FAQ</span>
          <ChevronRight className="more-chevron" size={20} />
        </button>
        <button type="button" className="more-row" onClick={onOpenAbout}>
          <span>About</span>
          <ChevronRight className="more-chevron" size={20} />
        </button>
      </section>
    </div>
  );
}
