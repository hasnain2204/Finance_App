import { BackHeader } from '../../components/ui';

export function HelpScreen({ onBack }) {
  return (
    <main className="account-shell">
      <BackHeader title="Help & FAQ" onBack={onBack} backLabel="Back to More" />

      <section className="help-faq-list" aria-label="Frequently asked questions">
        <article className="help-faq-item">
          <h2>1. How is my available balance calculated?</h2>
          <p>Cumulative Budget − Total Expenses = Available Balance. If an overall budget is not set, available balance displays as Not set.</p>
        </article>
        <article className="help-faq-item">
          <h2>2. Does PWS work completely offline?</h2>
          <p>Yes. All your transactions, budgets, categories, and analytics are stored locally on your device. You can track your expenses anywhere without internet.</p>
        </article>
        <article className="help-faq-item">
          <h2>3. How does Cloud Sync work?</h2>
          <p>When Cloud Sync is enabled, your data securely syncs to your account. Any newly added transactions automatically sync to the cloud every 30 seconds.</p>
        </article>
        <article className="help-faq-item">
          <h2>4. How do I back up or restore my data?</h2>
          <p>Go to More → Data &amp; Backup → Export Data to download a secure backup file or audit PDF. Use Restore Data to import and recover records anytime.</p>
        </article>
        <article className="help-faq-item">
          <h2>5. How can I change my currency or date format?</h2>
          <p>Open More → Preferences → Currency to select your preferred global or Asian currency, and Date Format to customize date styling across the entire app.</p>
        </article>
      </section>
    </main>
  );
}
