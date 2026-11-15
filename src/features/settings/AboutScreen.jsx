import { ShieldCheck, WalletCards } from 'lucide-react';
import { BackHeader } from '../../components/ui';

export function AboutScreen({ onBack }) {
  return (
    <main className="account-shell">
      <BackHeader title="About" onBack={onBack} backLabel="Back to More" />

      <section className="about-content">
        <article className="about-intro-card">
          <WalletCards className="about-brand-icon" size={24} aria-hidden="true" />
          <h2>PWS V1.2</h2>
          <p className="about-tagline">Manage your money simply.</p>
          <p className="about-description">A simple personal finance tool for students and users in Pakistan.</p>
        </article>

        <div className="export-data-notice about-local-notice">
          <ShieldCheck size={20} aria-hidden="true" />
          <div>
            <strong>Local-first &amp; offline friendly</strong>
            <p>No account required. Track income and expenses, understand your spending and set budgets in Pakistani Rupees.</p>
          </div>
        </div>

        <section className="more-group about-details" aria-label="App information">
          <div className="more-row">
            <span>Version</span>
            <span className="more-row-value">V1.2</span>
          </div>
          <div className="more-row">
            <span>Currency</span>
            <span className="more-row-value">PKR (Rs)</span>
          </div>
          <div className="more-row">
            <span>Appearance</span>
            <span className="more-row-value">Light</span>
          </div>
          <div className="more-row more-row-muted">
            <span>Cloud Sync</span>
            <span className="more-row-value">Coming Later</span>
          </div>
        </section>
      </section>
    </main>
  );
}
