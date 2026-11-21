import { ShieldCheck, WalletCards } from 'lucide-react';
import { useState } from 'react';
import { StatusMessage } from '../../components/ui';

export function OnboardingScreen({
  onboardingName,
  setOnboardingName,
  status,
  auth,
  onContinue
}) {
  const [email, setEmail] = useState('');

  const handleSendVerificationLink = async (event) => {
    event.preventDefault();
    if (!auth?.isConfigured) return;
    await auth.sendEmailVerificationLink(email);
  };

  const connectedEmail = auth?.user?.email;

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

          <div className="onboarding-email-section">
            <div>
              <strong>Email verification <span>Optional</span></strong>
              <p>Verify a Gmail or other email address to connect an account. Your finance data stays on this device unless you enable cloud sync.</p>
            </div>
            {connectedEmail ? (
              <p className="onboarding-email-verified" role="status">
                <ShieldCheck size={18} aria-hidden="true" />
                {auth.user.email_confirmed_at ? 'Verified' : 'Account connected'}: {connectedEmail}
              </p>
            ) : (
              <form className="onboarding-email-form" onSubmit={handleSendVerificationLink}>
                <label htmlFor="onboarding-email">Email address</label>
                <input
                  id="onboarding-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@gmail.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                <button
                  type="submit"
                  className="secondary-button"
                  disabled={!auth?.isConfigured || auth.actionLoading}
                >
                  {auth?.actionLoading ? 'Sending link…' : 'Send verification link'}
                </button>
                {!auth?.isConfigured ? (
                  <p className="onboarding-email-help" role="status">
                    Email verification is unavailable until cloud account setup is configured. You can still continue and use the app offline.
                  </p>
                ) : null}
                {auth?.actionError ? <p className="cloud-auth-error" role="alert">{auth.actionError}</p> : null}
                {auth?.message ? <p className="cloud-auth-message" role="status">{auth.message}</p> : null}
              </form>
            )}
          </div>

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
