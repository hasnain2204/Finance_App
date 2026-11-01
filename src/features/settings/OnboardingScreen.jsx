import { ShieldCheck, WalletCards } from 'lucide-react';
import { StatusMessage } from '../../components/ui';

export function OnboardingScreen({
  onboardingName,
  setOnboardingName,
  status,
  onContinue
}) {
  return (
    <main className="onboarding-shell">
      <section className="onboarding-content">
        <div className="onboarding-hero">
          <span className="onboarding-icon"><WalletCards size={100} strokeWidth={1.75} /></span>
          <h1>Welcome to PWS</h1>
          <p>Manage your money here!</p>
        </div>

        <section className="onboarding-form">
          <h3>
            Basic setup
            <p className="onboarding-helper">Start now and make it yours!</p>
          </h3>

          <label htmlFor="onboarding-name">Your name</label>
          <input
            id="onboarding-name"
            value={onboardingName}
            onChange={(event) => setOnboardingName(event.target.value)}
            placeholder="Name (optional)"
            autoComplete="name"
          />

          <div className="privacy-note">
            <ShieldCheck size={24} />
            <div>
              <strong>Your data stays on this device</strong>
              <span>Works offline.</span>
            </div>
          </div>

          <button type="button" className="primary-action full onboarding-button" onClick={onContinue}>
            Continue
          </button>
          <StatusMessage type={status.type} message={status.message} />
          <p className="currency-label">(PKR) · Light mode</p>
        </section>
      </section>
    </main>
  );
}
