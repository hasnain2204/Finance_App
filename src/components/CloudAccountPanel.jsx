import { ArrowLeft, Cloud, LogIn, LogOut, UserPlus } from 'lucide-react';
import { useState } from 'react';

export default function CloudAccountPanel({ auth, onBack }) {
  const [mode, setMode] = useState('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (mode === 'sign-up') await auth.signUp(email, password);
    else await auth.signIn(email, password);
    setPassword('');
  };

  return (
    <main className="account-shell">
      <header className="add-transaction-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="Back to More">
          <ArrowLeft size={22} />
        </button>
        <h1>Cloud Account</h1>
      </header>

      <section className="cloud-account-content">
        <div className="export-data-notice cloud-account-local-notice">
          <Cloud size={20} aria-hidden="true" />
          <div>
            <strong>Local finance stays available</strong>
            <p>Signing in only manages your account. Transactions and budgets are not uploaded or downloaded in this phase.</p>
          </div>
        </div>

        {!auth.isConfigured ? (
          <section className="cloud-auth-card">
            <h2>Cloud account setup required</h2>
            <p>{auth.configurationError || 'Add the Supabase project URL and publishable key to .env.local, then restart Vite.'}</p>
            <p>Local finance features continue to work without cloud configuration.</p>
          </section>
        ) : auth.loading ? (
          <section className="cloud-auth-card" role="status" aria-live="polite">
            <h2>Restoring session</h2>
            <p>Checking this device for a saved Supabase session…</p>
          </section>
        ) : auth.user ? (
          <section className="cloud-auth-card">
            <p className="eyebrow">Signed in</p>
            <h2>{auth.user.email || 'Supabase user'}</h2>
            <p>Your local finance data has not been sent to Supabase.</p>
            <button
              type="button"
              className="primary-action full cloud-auth-submit"
              onClick={auth.signOut}
              disabled={auth.actionLoading}
            >
              <LogOut size={17} aria-hidden="true" />
              {auth.actionLoading ? 'Signing out…' : 'Sign out'}
            </button>
          </section>
        ) : (
          <form className="cloud-auth-card cloud-auth-form" onSubmit={handleSubmit}>
            <p className="eyebrow">{mode === 'sign-up' ? 'Create account' : 'Welcome back'}</p>
            <h2>{mode === 'sign-up' ? 'Sign up with email' : 'Sign in with email'}</h2>
            <label htmlFor="cloud-account-email">Email</label>
            <input
              id="cloud-account-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <label htmlFor="cloud-account-password">Password</label>
            <input
              id="cloud-account-password"
              name="password"
              type="password"
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {auth.error ? <p className="cloud-auth-error" role="alert">{auth.error.message || String(auth.error)}</p> : null}
            {auth.actionError ? <p className="cloud-auth-error" role="alert">{auth.actionError}</p> : null}
            {auth.message ? <p className="cloud-auth-message" role="status">{auth.message}</p> : null}
            <button
              type="submit"
              className="primary-action full cloud-auth-submit"
              disabled={auth.actionLoading}
            >
              {mode === 'sign-up' ? <UserPlus size={17} aria-hidden="true" /> : <LogIn size={17} aria-hidden="true" />}
              {auth.actionLoading
                ? (mode === 'sign-up' ? 'Creating account…' : 'Signing in…')
                : (mode === 'sign-up' ? 'Create account' : 'Sign in')}
            </button>
            <button
              type="button"
              className="link-button cloud-auth-mode-toggle"
              onClick={() => setMode((current) => current === 'sign-in' ? 'sign-up' : 'sign-in')}
              disabled={auth.actionLoading}
            >
              {mode === 'sign-up' ? 'Already registered? Sign in' : 'New to PWS? Create an account'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
