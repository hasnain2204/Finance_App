import { AppLogo, BackHeader } from '../../components/ui';
import { currencyMap } from '../../lib/finance';

export function AboutScreen({ preferences, onBack }) {
  const activeCurrency = preferences?.currency || 'PKR';
  const currencyMeta = currencyMap[activeCurrency] || { name: activeCurrency, symbol: activeCurrency };

  return (
    <main className="account-shell">
      <BackHeader title="About" onBack={onBack} backLabel="Back to More" />

      <section className="about-content">
        <article className="about-intro-card">
          <AppLogo size={52} className="about-brand-icon" />
          <h2>PWS V2</h2>
          <p className="about-tagline">Manage your money simply.</p>
          <p className="about-description">A simple, powerful personal finance tool for smart budget tracking.</p>
        </article>

        <section className="more-group about-details" aria-label="App information">
          <div className="more-row">
            <span>Version</span>
            <span className="more-row-value">V2</span>
          </div>
          <div className="more-row">
            <span>Active Currency</span>
            <span className="more-row-value">{activeCurrency} ({currencyMeta.symbol})</span>
          </div>
          <div className="more-row">
            <span>Appearance</span>
            <span className="more-row-value">Light</span>
          </div>
        </section>
      </section>
    </main>
  );
}
