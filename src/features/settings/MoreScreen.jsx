import { ChevronRight } from 'lucide-react';
import { StatusMessage } from '../../components/ui';

export function MoreScreen({
  status,
  onOpenCloudAccount,
  onOpenAccount,
  onOpenPaymentMethods,
  onOpenBudgetTypes,
  onOpenExport,
  onOpenRestore,
  onOpenCloudSync,
  onOpenCurrency,
  onOpenAppearance,
  onOpenPreferences,
  onOpenDateFormat,
  onOpenNotifications,
  onOpenHelp,
  onOpenAbout
}) {
  return (
    <div className="more-page">
      <section className="more-group" aria-label="Settings and options">
        <button type="button" className="more-row" onClick={onOpenCloudAccount}>
          <span>Account</span>
          <ChevronRight className="more-chevron" size={20} />
        </button>
        <button type="button" className="more-row" onClick={onOpenAccount}>
          <span>Categories</span>
          <ChevronRight className="more-chevron" size={20} />
        </button>
        <button type="button" className="more-row" onClick={onOpenPaymentMethods}>
          <span>Payment Methods</span>
          <ChevronRight className="more-chevron" size={20} />
        </button>
        <button type="button" className="more-row" onClick={onOpenBudgetTypes}>
          <span>Budget Types</span>
          <ChevronRight className="more-chevron" size={20} />
        </button>
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
        <button type="button" className="more-row" onClick={onOpenCurrency}>
          <span>Currency</span>
          <ChevronRight className="more-chevron" size={20} />
        </button>
        <button type="button" className="more-row" onClick={onOpenAppearance}>
          <span>Appearance</span>
          <ChevronRight className="more-chevron" size={20} />
        </button>
        <button type="button" className="more-row" onClick={onOpenDateFormat || onOpenPreferences}>
          <span>Date Format</span>
          <ChevronRight className="more-chevron" size={20} />
        </button>
        <button type="button" className="more-row" onClick={onOpenNotifications || onOpenPreferences}>
          <span>Notifications</span>
          <ChevronRight className="more-chevron" size={20} />
        </button>
        <button type="button" className="more-row" onClick={onOpenAbout}>
          <span>About</span>
          <ChevronRight className="more-chevron" size={20} />
        </button>
        <button type="button" className="more-row" onClick={onOpenHelp}>
          <span>Help &amp; FAQ</span>
          <ChevronRight className="more-chevron" size={20} />
        </button>
      </section>

      {status?.message ? (
        <StatusMessage type={status.type} message={status.message} />
      ) : null}
    </div>
  );
}
