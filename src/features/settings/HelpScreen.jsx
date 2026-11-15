import { BackHeader } from '../../components/ui';

export function HelpScreen({ onBack }) {
  return (
    <main className="account-shell">
      <BackHeader title="Help & FAQ" onBack={onBack} backLabel="Back to More" />

      <section className="help-faq-list" aria-label="Frequently asked questions">
        <article className="help-faq-item">
          <h2>How is my balance calculated?</h2>
          <p>Income − Expenses = Available Balance.</p>
        </article>
        <article className="help-faq-item">
          <h2>Can I use PWS offline?</h2>
          <p>Yes. Record transactions without an internet connection. They are saved locally; cloud transfer waits until you configure an account and confirm the sync preview.</p>
        </article>
        <article className="help-faq-item">
          <h2>How do I keep my data safe?</h2>
          <p>In More, choose Export Data. Keep your backup outside the app before clearing browser data.</p>
        </article>
        <article className="help-faq-item">
          <h2>Can I sync or change currency?</h2>
          <p>Cloud sync is available from More → Cloud account after Supabase is configured and the initial merge is confirmed. PWS V1 uses PKR only.</p>
        </article>
      </section>
    </main>
  );
}
