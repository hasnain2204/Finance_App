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
  onOpenCloudSync,
  onOpenCurrency,
  onOpenPreferences,
  onOpenHelp,
  onOpenAbout
}) {
  return (
    <div className="more-page">
      <section className="more-group" aria-label="Account">
        <button type="button" className="more-row" onClick={onOpenCloudAccount}>
          <span>Account</span>
          <span className="more-row-trailing">
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
        <button type="button" className="more-row" onClick={onOpenCloudSync}>
          <span>Cloud Sync</span>
          <ChevronRight className="more-chevron" size={20} />
        </button>
        <StatusMessage type={status.type} message={status.message} />
      </section>

      <section className="more-group" aria-labelledby="more-preferences-heading">
        <h2 id="more-preferences-heading" className="more-group-title">Preferences</h2>
        <button type="button" className="more-row" onClick={onOpenCurrency}>
          <span>Currency</span>
          <span className="more-row-trailing">
            <span className="more-row-value">{preferences?.currency || 'PKR'}</span>
            <ChevronRight className="more-chevron" size={20} />
          </span>
        </button>
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
        <h2 id="more-help-heading" className="more-group-title">Help &amp; Info</h2>
        <button type="button" className="more-row" onClick={onOpenAbout}>
          <span>About</span>
          <ChevronRight className="more-chevron" size={20} />
        </button>
        <button type="button" className="more-row" onClick={onOpenHelp}>
          <span>Help &amp; FAQ</span>
          <ChevronRight className="more-chevron" size={20} />
        </button>
      </section>
    </div>
  );
}
